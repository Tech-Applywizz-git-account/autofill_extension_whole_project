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
    dependencies=[Depends(verify_api_key)] # Apply globally to all routes
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

@app.post("/predict", response_model=AIResponse)
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

@app.post("/api/patterns/upload")
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


@app.get("/api/patterns/search")
async def search_patterns(q: str):
    """Search for patterns by question text"""
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")

    match = search_pattern(q)
    return {
        "success": True,
        "matches": [match] if match else [],
    }


@app.get("/api/patterns/stats")
async def pattern_stats():
    """Get memory statistics"""
    try:
        return {"success": True, "stats": get_stats()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/patterns/sync")
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


@app.get("/api/patterns/user/{email}")
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

@app.post("/api/user-data/save")
async def save_user_data(profile: UserProfile):
    """Persist user profile"""
    try:
        if save_user_profile(profile.email, profile.dict()):
            return {"success": True, "message": "Profile saved"}
        raise HTTPException(status_code=500, detail="Failed to save profile")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/user-data/{email}")
async def get_user_data(email: str):
    """Fetch user profile"""
    profile = get_user_profile(email)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"success": True, "profile": profile}

# ---------------------------------------------------------
# STATS & FEEDBACK
# ---------------------------------------------------------

@app.get("/api/stats/summary")
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

@app.post("/api/feedback/track")
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.HOST, port=config.PORT)
