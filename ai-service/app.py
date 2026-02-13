"""
AI Service - Unified Backend for Autofill Extension
Combines AI predictions, pattern learning, and user data management
Port: 8001
"""

from fastapi import FastAPI, HTTPException, File, UploadFile, Depends, Security
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import logging
from typing import Optional

from models import (
    AIRequest, AIResponse, Pattern, PatternUploadRequest,
    UserProfile
)

from config import config

from ai_service import predict_answer, ALLOWED_INTENTS
from pattern_service import search_pattern, save_pattern, get_stats, read_patterns
from resume_service import save_user_profile, get_user_profile, get_total_users, track_feedback, get_feedback_stats


load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("ai-service")

# --- Security Configuration ---
API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

async def verify_api_key(api_key: str = Security(api_key_header)):
    """Enforce API Key requirement if configured"""
    # In local dev with no key set, we allow skip (for now), 
    # but in production you MUST set APP_API_KEY
    if not config.API_KEY:
        logger.warning("⚠️ API Authentication is DISABLED (no APP_API_KEY set in .env)")
        return
        
    if api_key != config.API_KEY:
        logger.error(f"❌ Unauthorized access attempt: {'Empty Header' if not api_key else 'Invalid Key'}")
        raise HTTPException(
            status_code=403,
            detail="Could not validate credentials - Missing or invalid X-API-Key"
        )

app = FastAPI(
    title="AI Service",
    description="Unified AI prediction, pattern learning, and user data service",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# AI PREDICTION
# ---------------------------------------------------------

@app.post("/predict", response_model=AIResponse, dependencies=[Depends(verify_api_key)])
async def predict(request: AIRequest):
    """
    Prediction flow:
    1) Pattern Memory
    2) AWS Bedrock (AI)
    3) Save learned pattern
    """

    # 1. Check Pattern Memory first
    memory_match = search_pattern(request.question)

    if memory_match:
        answer = ""
        mappings = memory_match.get("answerMappings", [])

        if mappings:
            variants = mappings[0].get("variants", [])
            answer = variants[0] if variants else mappings[0].get("canonicalValue", "")

        if answer:
            return AIResponse(
                answer=answer,
                confidence=config.PATTERN_MEMORY_CONFIDENCE,
                reasoning="Retrieved from Pattern Memory",
                intent=memory_match.get("intent"),
            )

    # 2. AI FALLBACK (AWS BEDROCK)
    ai_response = predict_answer(request)

    # Hard safety: never allow null / empty intent
    if not ai_response.intent:
        ai_response.intent = "unknown"

    # 3. SAVE LEARNED PATTERN
    if ai_response.answer and ai_response.confidence >= 0.70:
        try:
            pattern = Pattern(
                questionPattern=request.question.lower().strip(),
                intent=ai_response.intent,
                fieldType=request.fieldType,
                confidence=ai_response.confidence,
                source="AI",
                answerMappings=[
                    {
                        "canonicalValue": ai_response.answer,
                        "variants": [ai_response.answer],
                        "contextOptions": request.options or [],
                    }
                ],
            )

            save_pattern(pattern, request.userEmail)

        except Exception as e:
            pass

    return ai_response

# ---------------------------------------------------------
# PATTERN MANAGEMENT
# ---------------------------------------------------------

@app.post("/api/patterns/upload", dependencies=[Depends(verify_api_key)])
async def upload_pattern(req: PatternUploadRequest, email: str = None):
    """Upload a manually curated or shared pattern"""
    try:
        # Pass email to save_pattern so it saves to user's learned_patterns table
        success = save_pattern(req.pattern, user_email=email)
        if not success:
            return {"success": False, "error": "Pattern rejected - email required"}

        return {"success": True, "message": "Pattern uploaded successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/patterns/search", dependencies=[Depends(verify_api_key)])
async def search_patterns(q: str):
    """Search for patterns by question text"""
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")

    match = search_pattern(q)
    return {
        "success": True,
        "matches": [match] if match else [],
    }


@app.get("/api/patterns/stats", dependencies=[Depends(verify_api_key)])
async def pattern_stats():
    """Get memory statistics"""
    try:
        return {"success": True, "stats": get_stats()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/patterns/sync", dependencies=[Depends(verify_api_key)])
async def sync_patterns(since: str | None = None):
    """Sync all patterns (date filter ready)"""
    try:
        patterns = read_patterns()
        return {
            "success": True,
            "patterns": patterns,
            "total": len(patterns),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/patterns/user/{email}", dependencies=[Depends(verify_api_key)])
async def get_user_patterns_endpoint(email: str):
    """Get all learned patterns for a specific user"""
    try:
        from pattern_service import get_user_patterns
        patterns = get_user_patterns(email)
        return {
            "success": True,
            "patterns": patterns,
            "total": len(patterns)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------
# USER PROFILE MANAGEMENT
# ---------------------------------------------------------

@app.post("/api/user-data/save", dependencies=[Depends(verify_api_key)])
async def save_user_data(profile: UserProfile):
    """Persist user profile"""
    try:
        if save_user_profile(profile.email, profile.model_dump()):
            return {"success": True, "message": "Profile saved"}
        raise HTTPException(status_code=500, detail="Failed to save profile")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/user-data/{email}", dependencies=[Depends(verify_api_key)])
async def get_user_data(email: str):
    """Fetch user profile"""
    profile = get_user_profile(email)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"success": True, "profile": profile}

# ---------------------------------------------------------
# STATS & FEEDBACK
# ---------------------------------------------------------

@app.get("/api/stats/summary", dependencies=[Depends(verify_api_key)])
async def get_stats_summary():
    """Get summary stats for the overlay panel"""
    try:
        user_stats = get_total_users()
        feedback_stats = get_feedback_stats()
        return {
            "success": True,
            "users": user_stats,
            "feedback": feedback_stats
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/feedback/track", dependencies=[Depends(verify_api_key)])
async def track_user_feedback(email: str, type: str = "click"):
    """Track user feedback interaction"""
    success = track_feedback(email, type)
    return {"success": success}

# ---------------------------------------------------------
# HEALTH
# ---------------------------------------------------------

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "ai-service",
        "version": "3.0.0",
    }


# ---------------------------------------------------------
# ROBUST AI SYSTEM PROMPT
# ---------------------------------------------------------
SYSTEM_PROMPT = """You ARE the job applicant described in the provided user profile. You are 100% committed to securing this position at any cost, as your life and career depend on this opportunity. You are highly motivated, professional, and eager to prove your value. Your ONLY job is to answer every question with absolute conviction and motivation, using ONLY the information from your profile.

# CRITICAL RULES (MUST FOLLOW):

1. **ANSWER LENGTH**: 
   - Give SHORT, SINGLE-LINE answers
   - NO paragraphs, NO explanations, NO extra details
   - If it's a Yes/No question, answer ONLY "Yes" or "No"
   - If it's a date, answer ONLY the date
   - If it's a name, answer ONLY the name

2. **USE ONLY PROVIDED DATA**:
   - ONLY use information from the User Profile provided
   - If information is NOT in the profile, answer "Not Provided"
   - NEVER make up, guess, or infer information
   - NEVER add information that wasn't explicitly given

3. **MATCH AVAILABLE OPTIONS**:
   - If the question provides "Available Options", you MUST choose from that exact list
   - Match the option text EXACTLY as provided (including capitalization)
   - If your answer isn't in the options, choose the closest match
   - If no close match exists, answer "Not Provided"

4. **SPECIFIC QUESTION HANDLING**:

   **"How did you hear about us?"** → ALWAYS answer "LinkedIn" (unless profile says otherwise)
   
   **"Worked here before?"** → Answer "No" (unless profile explicitly says yes)
   
   **"Need visa sponsorship?"** → Answer based on profile's work authorization, default "No"
   
   **"Are you 18 or older?"** → Answer "Yes" (assume adult applicant)
   
   **"Willing to relocate?"** → Answer based on profile's preferences, default "Yes"
   
   **"Currently employed?"** → Check if latest job has "currently working" = true
   
   **"Start date"** → Answer "Immediately" or "2 weeks" (unless profile specifies)

5. **DATE FORMATS**:
   - Month questions: Answer with FULL month name ("January", NOT "01" or "Jan")
   - Year questions: Answer with 4-digit year ("2020", NOT "20")
   - Full dates: Use format "MM/DD/YYYY"

6. **NAME FORMATS**:
   - First/Last names: Proper capitalization ("John", NOT "john")
   - Email: Lowercase
   - Phone: Numbers only, no formatting ("1234567890", NOT "(123) 456-7890")

7. **DROPDOWN/MULTIPLE CHOICE**:
   - Your answer MUST be ONE of the "Available Options"
   - Copy the option text EXACTLY
   - If unsure, pick the most common/professional option

8. **TEXT AREA / LONG ANSWERS**:
   - Even for text areas, keep answers to 1-2 sentences MAX
   - Focus on most relevant information only
   - Use bullet points if listing multiple items

9. **WORK AUTHORIZATION**:
   - "Authorized to work in [country]" → Check profile's work authorization
   - If profile doesn't specify, assume "Yes" for US applications
   - "Need sponsorship" → Opposite of authorized (if authorized=Yes, then sponsorship=No)

10. **SALARY QUESTIONS**:
    - Answer with numbers only, no dollar signs or "k" notation
    - Example: "120000" NOT "$120k"

# OUTPUT FORMAT:

Return ONLY the answer, nothing else. No preamble, no explanation, no quotes around the answer.
"""

if __name__ == "__main__":
    import uvicorn
    # Make SYSTEM_PROMPT available to ai_service through config or direct import if needed
    # (assuming ai_service.py will be updated to use this, or we inject it here)
    # For now, let's keep the file structure clean and just update the prompt in ai_service.py separately if needed
    # But wait, ai_service.py is imported at the top. Let's check ai_service.py content first to see where the prompt lives.
    uvicorn.run(app, host=config.HOST, port=config.PORT)

