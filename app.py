# """
# AI Service - Unified Backend for Autofill Extension
# Combines AI predictions, pattern learning, and user data management

# Port: 8001
# """
# from fastapi import FastAPI, HTTPException, File, UploadFile
# from fastapi.middleware.cors import CORSMiddleware
# from models import (
#     AIRequest, AIResponse, Pattern, PatternUploadRequest,
#     PatternSearchRequest, UserProfile
# )
# import logging
# import os
# from dotenv import load_dotenv
# from config import config

# # Import service modules
# from ai_service import predict_answer
# from pattern_service import (
#     search_pattern, save_pattern, get_stats, read_patterns
# )
# from resume_service import (
#     save_user_profile, get_user_profile, parse_resume
# )

# # Load environment variables
# load_dotenv()

# # Configure logging
# logging.basicConfig(
#     level=logging.INFO,
#     format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
# )
# logger = logging.getLogger(__name__)

# app = FastAPI(
#     title="AI Service",
#     description="Unified AI prediction, pattern learning, and user data service",
#     version="3.0.0"
# )

# # Enable CORS
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=False,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # ===== AI PREDICTION ENDPOINTS =====

# @app.post("/predict", response_model=AIResponse)
# async def predict(request: AIRequest):
#     """
#     Predict answer using Pattern Memory (1st) or AWS Bedrock (2nd)
#     """
#     logger.info(f"Prediction requested for: {request.question}")

#     # 1. Check Pattern Memory first
#     memory_match = search_pattern(request.question)
#     if memory_match:
#         logger.info(f"Found in memory: {memory_match.get('answerMappings', [{}])[0].get('variants', [''])[0]}")
        
#         # Extract answer from pattern
#         answer_mappings = memory_match.get('answerMappings', [])
#         answer = ""
#         if answer_mappings and len(answer_mappings) > 0:
#             variants = answer_mappings[0].get('variants', [])
#             if variants:
#                 answer = variants[0]
        
#         if not answer:
#             # Fallback to canonical value
#             if answer_mappings:
#                 answer = answer_mappings[0].get('canonicalValue', '')
        
#         return AIResponse(
#             answer=answer,
#             confidence=config.PATTERN_MEMORY_CONFIDENCE,
#             reasoning="Retrieved from Pattern Memory",
#             intent=memory_match.get('intent')
#         )

#     # 2. Ask AI (AWS Bedrock)
#     ai_response = predict_answer(request)
    
#     # 3. Save to memory (if AI succeeded)
#     if ai_response.answer and ai_response.confidence > 0:
#         try:
#             pattern = Pattern(
#                 questionPattern=request.question.lower().strip(),
#                 intent=ai_response.intent or "unknown",
#                 fieldType=request.fieldType,
#                 confidence=ai_response.confidence,
#                 source="AI",
#                 answerMappings=[{
#                     "canonicalValue": ai_response.answer,
#                     "variants": [ai_response.answer],
#                     "contextOptions": request.options or []
#                 }] if request.options else None
#             )
#             save_pattern(pattern)
#             logger.info(f"💾 Saved pattern: '{request.question}' -> '{ai_response.answer}'")
#         except Exception as e:
#             logger.warning(f"Failed to save pattern: {str(e)}")
    
#     return ai_response

# # ===== PATTERN MANAGEMENT ENDPOINTS =====

# @app.post("/api/patterns/upload")
# async def upload_pattern(req: PatternUploadRequest):
#     """Upload a new learned pattern"""
#     try:
#         success = save_pattern(req.pattern)
#         if success:
#             return {"success": True, "message": "Pattern uploaded successfully"}
#         else:
#             return {"success": False, "error": "Intent not shareable"}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# @app.get("/api/patterns/search")
# async def search_patterns(q: str):
#     """Search for matching patterns"""
#     if not q:
#         raise HTTPException(status_code=400, detail="Query required")
    
#     match = search_pattern(q)
#     if match:
#         return {"success": True, "matches": [match]}
#     else:
#         return {"success": True, "matches": []}

# @app.get("/api/patterns/stats")
# async def pattern_stats():
#     """Get pattern statistics"""
#     try:
#         stats = get_stats()
#         return {"success": True, "stats": stats}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# @app.get("/api/patterns/sync")
# async def sync_patterns(since: str = None):
#     """Get all patterns (optionally filtered by date)"""
#     try:
#         patterns = read_patterns()
#         # TODO: Filter by 'since' date if needed
#         return {
#             "success": True,
#             "patterns": patterns,
#             "total": len(patterns)
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# # ===== USER DATA ENDPOINTS (for future use) =====

# @app.post("/api/user-data/save")
# async def save_user_data(profile: UserProfile):
#     """Save user profile"""
#     try:
#         success = save_user_profile(profile.email, profile.dict())
#         if success:
#             return {"success": True, "message": "Profile saved"}
#         else:
#             raise HTTPException(status_code=500, detail="Failed to save profile")
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# @app.get("/api/user-data/{email}")
# async def get_user_data(email: str):
#     """Get user profile by email"""
#     profile = get_user_profile(email)
#     if profile:
#         return {"success": True, "profile": profile}
#     else:
#         raise HTTPException(status_code=404, detail="Profile not found")

# # ===== RESUME PARSING (for future use) =====

# @app.post("/parse-resume")
# async def parse_resume_endpoint(file: UploadFile = File(...)):
#     """
#     Parse resume from uploaded file
#     TODO: Implement full parsing logic
#     """
#     return {
#         "success": False,
#         "message": "Resume parsing not yet implemented",
#         "note": "This endpoint is ready for future PDF/DOCX parsing"
#     }

# # ===== HEALTH CHECK =====

# @app.get("/health")
# async def health_check():
#     return {
#         "status": "ok",
#         "service": "ai-service",
#         "version": "3.0.0",
#         "endpoints": {
#             "ai": "/predict",
#             "patterns": "/api/patterns/*",
#             "users": "/api/user-data/*",
#             "resume": "/parse-resume"
#         }
#     }

# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host=config.HOST, port=config.PORT)




# """
# AI Service - Unified Backend for Autofill Extension

# Responsibilities:
# - AI prediction (Pattern Memory → AWS Bedrock)
# - Pattern learning & sync
# - User profile storage
# - Resume parsing (future)

# Port: 8001
# """

# from fastapi import FastAPI, HTTPException, File, UploadFile
# from fastapi.middleware.cors import CORSMiddleware
# from dotenv import load_dotenv
# import logging

# from models import (
#     AIRequest,
#     AIResponse,
#     Pattern,
#     PatternUploadRequest,
#     PatternSearchRequest,
#     UserProfile,
# )

# from config import config

# # Services
# from ai_service import predict_answer
# from pattern_service import (
#     search_pattern,
#     save_pattern,
#     get_stats,
#     read_patterns,
# )
# from resume_service import (
#     save_user_profile,
#     get_user_profile,
#     parse_resume,
# )

# # ---------------------------------------------------------
# # ENV + LOGGING
# # ---------------------------------------------------------

# load_dotenv()

# logging.basicConfig(
#     level=logging.INFO,
#     format="%(asctime)s - %(levelname)s - %(message)s",
# )

# logger = logging.getLogger("ai-service")

# # ---------------------------------------------------------
# # APP INIT
# # ---------------------------------------------------------

# app = FastAPI(
#     title="AI Service",
#     description="Unified AI prediction, pattern learning, and user data service",
#     version="3.0.0",
# )

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=False,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # ---------------------------------------------------------
# # AI PREDICTION
# # ---------------------------------------------------------

# @app.post("/predict", response_model=AIResponse)
# async def predict(request: AIRequest):
#     """
#     Prediction flow:
#     1) Pattern Memory
#     2) AWS Bedrock (AI)
#     3) Save learned pattern
#     """

#     logger.info(f"🧠 Prediction request: {request.question}")

#     # -----------------------------------------------------
#     # 1️⃣ PATTERN MEMORY LOOKUP
#     # -----------------------------------------------------
#     memory_match = search_pattern(request.question)

#     if memory_match:
#         logger.info("📦 Answer served from Pattern Memory")

#         answer = ""
#         mappings = memory_match.get("answerMappings", [])

#         if mappings:
#             variants = mappings[0].get("variants", [])
#             answer = variants[0] if variants else mappings[0].get("canonicalValue", "")

#         if not answer:
#             logger.warning("⚠ Pattern found but answer empty, falling back to AI")
#         else:
#             return AIResponse(
#                 answer=answer,
#                 confidence=config.PATTERN_MEMORY_CONFIDENCE,
#                 reasoning="Retrieved from Pattern Memory",
#                 intent=memory_match.get("intent"),
#             )

#     # -----------------------------------------------------
#     # 2️⃣ AI FALLBACK (AWS BEDROCK)
#     # -----------------------------------------------------
#     ai_response = predict_answer(request)

#     # Hard safety: never allow null / empty intent
#     if not ai_response.intent:
#         logger.warning("⚠ AI returned empty intent, assigning fallback")
#         ai_response.intent = "unknown"

#     # -----------------------------------------------------
#     # 3️⃣ SAVE LEARNED PATTERN
#     # -----------------------------------------------------
#     if ai_response.answer and ai_response.confidence >= 0.70:
#         try:
#             pattern = Pattern(
#                 questionPattern=request.question.lower().strip(),
#                 intent=ai_response.intent,
#                 fieldType=request.fieldType,
#                 confidence=ai_response.confidence,
#                 source="AI",
#                 answerMappings=[
#                     {
#                         "canonicalValue": ai_response.answer,
#                         "variants": [ai_response.answer],
#                         "contextOptions": request.options or [],
#                     }
#                 ],
#             )

#             save_pattern(pattern)
#             logger.info(f"💾 Learned pattern saved → {ai_response.intent}")

#         except Exception as e:
#             logger.warning(f"⚠ Failed to save pattern: {str(e)}")

#     return ai_response

# # ---------------------------------------------------------
# # PATTERN MANAGEMENT
# # ---------------------------------------------------------

# @app.post("/api/patterns/upload")
# async def upload_pattern(req: PatternUploadRequest):
#     """Upload a manually curated or shared pattern"""
#     try:
#         success = save_pattern(req.pattern)
#         if not success:
#             return {"success": False, "error": "Pattern rejected (intent not shareable)"}

#         return {"success": True, "message": "Pattern uploaded successfully"}

#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/api/patterns/search")
# async def search_patterns(q: str):
#     """Search for patterns by question text"""
#     if not q:
#         raise HTTPException(status_code=400, detail="Query parameter 'q' is required")

#     match = search_pattern(q)
#     return {
#         "success": True,
#         "matches": [match] if match else [],
#     }


# @app.get("/api/patterns/stats")
# async def pattern_stats():
#     """Get memory statistics"""
#     try:
#         return {"success": True, "stats": get_stats()}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/api/patterns/sync")
# async def sync_patterns(since: str | None = None):
#     """Sync all patterns (date filter ready)"""
#     try:
#         patterns = read_patterns()
#         return {
#             "success": True,
#             "patterns": patterns,
#             "total": len(patterns),
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# # ---------------------------------------------------------
# # USER PROFILE MANAGEMENT
# # ---------------------------------------------------------

# @app.post("/api/user-data/save")
# async def save_user_data(profile: UserProfile):
#     """Persist user profile"""
#     try:
#         if save_user_profile(profile.email, profile.dict()):
#             return {"success": True, "message": "Profile saved"}
#         raise HTTPException(status_code=500, detail="Failed to save profile")
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/api/user-data/{email}")
# async def get_user_data(email: str):
#     """Fetch user profile"""
#     profile = get_user_profile(email)
#     if not profile:
#         raise HTTPException(status_code=404, detail="Profile not found")
#     return {"success": True, "profile": profile}

# # ---------------------------------------------------------
# # RESUME PARSING (PLACEHOLDER)
# # ---------------------------------------------------------

# @app.post("/parse-resume")
# async def parse_resume_endpoint(file: UploadFile = File(...)):
#     """
#     Resume parsing placeholder.
#     Hook PDF/DOCX logic here later.
#     """
#     return {
#         "success": False,
#         "message": "Resume parsing not implemented yet",
#         "note": "Endpoint reserved for future parsing logic",
#     }

# # ---------------------------------------------------------
# # HEALTH
# # ---------------------------------------------------------

# @app.get("/health")
# async def health_check():
#     return {
#         "status": "ok",
#         "service": "ai-service",
#         "version": "3.0.0",
#         "endpoints": {
#             "ai": "/predict",
#             "patterns": "/api/patterns/*",
#             "users": "/api/user-data/*",
#             "resume": "/parse-resume",
#         },
#     }

# # ---------------------------------------------------------
# # LOCAL RUN
# # ---------------------------------------------------------

# if __name__ == "__main__":
#     import uvicorn

#     uvicorn.run(
#         app,
#         host=config.HOST,
#         port=config.PORT,
#         log_level="info",
#     )






"""
AI Service - Unified Backend for Autofill Extension
Combines AI predictions, pattern learning, and user data management
Port: 8001
"""

from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import logging

from models import (
    AIRequest, AIResponse, Pattern, PatternUploadRequest,
    UserProfile
)

from config import config

from ai_service import predict_answer, ALLOWED_INTENTS
from pattern_service import search_pattern, save_pattern, get_stats, read_patterns
from resume_service import save_user_profile, get_user_profile


load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("ai-service")

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


@app.post("/predict", response_model=AIResponse)
async def predict(request: AIRequest):
    """
    1) Pattern Memory
    2) AI (Bedrock)
    3) Save pattern if valid
    """
    logger.info(f"🧠 Prediction requested: {request.question}")

    # 1) Memory first
    memory_match = search_pattern(request.question)
    if memory_match:
        mappings = memory_match.get("answerMappings", [])
        answer = ""
        if mappings:
            variants = mappings[0].get("variants", [])
            answer = variants[0] if variants else mappings[0].get("canonicalValue", "")

        if answer:
            return AIResponse(
                answer=answer,
                confidence=config.PATTERN_MEMORY_CONFIDENCE,
                reasoning="Retrieved from Pattern Memory",
                intent=memory_match.get("intent") or "unknown",
            )

    # 2) AI fallback
    ai_response = predict_answer(request)

    # 3) Save learned pattern (only if safe)
    can_save = (
        bool(ai_response.answer)
        and ai_response.confidence >= 0.70
        and (ai_response.intent in ALLOWED_INTENTS)
        and (ai_response.intent != "unknown")
    )

    if can_save:
        try:
            pattern = Pattern(
                questionPattern=request.question.lower().strip(),
                intent=ai_response.intent,
                fieldType=request.fieldType,
                confidence=ai_response.confidence,
                source="AI",
                answerMappings=[{
                    "canonicalValue": ai_response.answer,
                    "variants": [ai_response.answer],
                    "contextOptions": request.options or []
                }],
            )
            save_pattern(pattern)
            logger.info(f"💾 Saved pattern: {pattern.questionPattern} -> {pattern.intent}")
        except Exception as e:
            logger.warning(f"⚠ Failed saving pattern: {str(e)}")
    else:
        logger.info(
            f"🚫 Not saving pattern (answer/intents not safe). intent={ai_response.intent}, conf={ai_response.confidence}"
        )

    return ai_response


# ---------------- PATTERNS ----------------

@app.post("/api/patterns/upload")
async def upload_pattern(req: PatternUploadRequest):
    try:
        success = save_pattern(req.pattern)
        if success:
            return {"success": True, "message": "Pattern uploaded successfully"}
        return {"success": False, "error": "Pattern rejected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/patterns/search")
async def search_patterns(q: str):
    if not q:
        raise HTTPException(status_code=400, detail="Query required")

    match = search_pattern(q)
    return {"success": True, "matches": [match] if match else []}


@app.get("/api/patterns/stats")
async def pattern_stats():
    try:
        return {"success": True, "stats": get_stats()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/patterns/sync")
async def sync_patterns(since: str = None):
    try:
        patterns = read_patterns()
        return {"success": True, "patterns": patterns, "total": len(patterns)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------- USER DATA ----------------

@app.post("/api/user-data/save")
async def save_user_data(profile: UserProfile):
    try:
        ok = save_user_profile(profile.email, profile.dict())
        if ok:
            return {"success": True, "message": "Profile saved"}
        raise HTTPException(status_code=500, detail="Failed to save profile")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/user-data/{email}")
async def get_user_data(email: str):
    profile = get_user_profile(email)
    if profile:
        return {"success": True, "profile": profile}
    raise HTTPException(status_code=404, detail="Profile not found")


# ---------------- RESUME PARSING PLACEHOLDER ----------------

@app.post("/parse-resume")
async def parse_resume_endpoint(file: UploadFile = File(...)):
    return {
        "success": False,
        "message": "Resume parsing not yet implemented",
        "note": "Endpoint reserved for future PDF/DOCX parsing"
    }


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "ai-service",
        "version": "3.0.0",
        "endpoints": {
            "ai": "/predict",
            "patterns": "/api/patterns/*",
            "users": "/api/user-data/*",
            "resume": "/parse-resume",
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.HOST, port=config.PORT, log_level="info")
