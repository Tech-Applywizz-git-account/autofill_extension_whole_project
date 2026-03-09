"""
AI Service - Unified Backend for Autofill Extension
Combines AI predictions, pattern learning, and user data management
Port: 8001

Production hardening:
- Sync calls run in FastAPI threadpool (def routes, not async def)
- Server-side in-memory caching for stats + patterns (TTL-based)
- Per-user rate limiting for /predict
- Request deduplication for /predict (same user + question in 5s)
- Full request timing logs
"""

from fastapi import FastAPI, HTTPException, Request, Depends, Security
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import logging
import time
import hashlib
import threading
from typing import Optional, Dict, Any

from models import (
    AIRequest, AIResponse, Pattern, PatternUploadRequest,
    BatchPatternUploadRequest, UserProfile, AnalyticsEvent, BackupRequest
)

from config import config

from ai_service import predict_answer, ALLOWED_INTENTS
from pattern_service import search_pattern, save_pattern, get_stats, read_patterns
import resume_service
from resume_service import (
    save_user_profile, get_user_profile, get_total_users, 
    track_feedback, get_feedback_stats, backup_user_data, get_master_restore
)


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
    version="4.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Log detailed validation errors for debugging 422s"""
    logger.error(f"❌ Request Validation Error: {exc.errors()}")
    # We can't easily log the body here without consuming it, 
    # but the errors() list is usually enough to spot the field.
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "message": "Validation failed for request body"}
    )


# ---------------------------------------------------------
# SERVER-SIDE IN-MEMORY CACHE (TTL-based, thread-safe)
# ---------------------------------------------------------

class TTLCache:
    """Simple thread-safe in-memory cache with TTL expiry."""

    def __init__(self):
        self._store: Dict[str, Any] = {}
        self._lock = threading.Lock()

    def get(self, key: str):
        with self._lock:
            entry = self._store.get(key)
            if not entry:
                return None
            value, expires_at = entry
            if time.time() > expires_at:
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl_seconds: int):
        with self._lock:
            self._store[key] = (value, time.time() + ttl_seconds)

    def delete(self, key: str):
        with self._lock:
            self._store.pop(key, None)

    def size(self):
        with self._lock:
            return len(self._store)


_cache = TTLCache()

# Cache TTLs (seconds)
STATS_CACHE_TTL = 30        # /api/stats/summary — refresh every 30s
PATTERNS_CACHE_TTL = 300    # /api/patterns/sync — refresh every 5 mins
PREDICT_DEDUP_TTL = 5       # /predict deduplication — same question in 5s → cached


# ---------------------------------------------------------
# PER-USER RATE LIMITING FOR /predict
# max 5 predict calls per user per 60 seconds
# ---------------------------------------------------------

class RateLimiter:
    """Simple sliding-window rate limiter per user key."""

    def __init__(self, max_calls: int, window_seconds: int):
        self.max_calls = max_calls
        self.window = window_seconds
        self._store: Dict[str, list] = {}
        self._lock = threading.Lock()

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        with self._lock:
            calls = self._store.get(key, [])
            # Remove old entries outside the window
            calls = [t for t in calls if now - t < self.window]
            if len(calls) >= self.max_calls:
                self._store[key] = calls
                return False
            calls.append(now)
            self._store[key] = calls
            return True


_predict_rate_limiter = RateLimiter(max_calls=60, window_seconds=60)


# ---------------------------------------------------------
# AI PREDICTION
# ---------------------------------------------------------

@app.post("/predict", response_model=AIResponse, dependencies=[Depends(verify_api_key)])
def predict(request: AIRequest, http_request: Request):
    """
    Prediction flow:
    1) Rate limit check (5 calls/min per user/IP)
    2) Dedup: same user+question in last 5s → return cached
    3) Pattern Memory
    4) AWS Bedrock (AI)
    5) Save learned pattern

    NOTE: Uses 'def' (not async def) so FastAPI automatically runs this
    in a threadpool, preventing sync boto3/requests calls from blocking
    the event loop. This is the correct pattern for sync I/O-heavy endpoints.
    """
    t_start = time.time()

    # Build a user key for rate limiting (prefer profile email, fallback to IP)
    user_key = (request.userProfile.get('email') if isinstance(request.userProfile, dict) and request.userProfile.get('email')
                else http_request.client.host if http_request.client else "unknown")

    # 1. Rate limit check
    if not _predict_rate_limiter.is_allowed(user_key):
        logger.warning(f"⚡ Rate limit hit for user={user_key}")
        raise HTTPException(status_code=429, detail="Too many requests. Please wait before trying again.")

    # 2. Deduplication cache: same user + question within 5s
    dedup_key = f"dedup:{hashlib.md5(f'{user_key}:{request.question}'.encode()).hexdigest()}"
    cached = _cache.get(dedup_key)
    if cached:
        logger.info(f"🔁 predict | DEDUP HIT | user={user_key} | q={request.question[:60]}")
        return cached

    # 3. Check Pattern Memory first
    memory_match = search_pattern(request.question)

    if memory_match:
        answer = ""
        mappings = memory_match.get("answerMappings", [])

        if mappings:
            variants = mappings[0].get("variants", [])
            answer = variants[0] if variants else mappings[0].get("canonicalValue", "")

        if answer:
            result = AIResponse(
                answer=answer,
                confidence=config.PATTERN_MEMORY_CONFIDENCE,
                reasoning="Retrieved from Pattern Memory",
                intent=memory_match.get("intent"),
            )
            _cache.set(dedup_key, result, PREDICT_DEDUP_TTL)
            elapsed = int((time.time() - t_start) * 1000)
            logger.info(f"✅ predict | PATTERN HIT | user={user_key} | elapsed={elapsed}ms")
            return result

    # 4. AI FALLBACK (AWS BEDROCK) — sync call, safe here because `def` route runs in threadpool
    ai_response = predict_answer(request)

    # Hard safety: never allow null / empty intent
    if not ai_response.intent:
        ai_response.intent = "unknown"

    # 5. SAVE LEARNED PATTERN (fire and forget in same thread — quick DB write)
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
            pass  # Don't fail the request if pattern save fails

    # Cache the result for dedup
    _cache.set(dedup_key, ai_response, PREDICT_DEDUP_TTL)

    elapsed = int((time.time() - t_start) * 1000)
    logger.info(f"✅ predict | AI RESPONSE | user={user_key} | elapsed={elapsed}ms | intent={ai_response.intent}")

    return ai_response

# ---------------------------------------------------------
# PATTERN MANAGEMENT
# ---------------------------------------------------------

@app.post("/api/patterns/upload", dependencies=[Depends(verify_api_key)])
def upload_pattern(req: PatternUploadRequest, email: str = None):
    """Upload a manually curated or shared pattern"""
    try:
        success = save_pattern(req.pattern, user_email=email)
        if not success:
            return {"success": False, "error": "Pattern rejected - email required"}
        # Invalidate the patterns sync cache so next sync gets fresh data
        _cache.delete("patterns:all")
        return {"success": True, "message": "Pattern uploaded successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/patterns/upload-batch", dependencies=[Depends(verify_api_key)])
def upload_patterns_batch(req: BatchPatternUploadRequest, email: str = None):
    """Upload multiple patterns at once"""
    try:
        from pattern_service import save_patterns_batch
        summary = save_patterns_batch(req.patterns, user_email=email)
        
        # Invalidate cache if any succeeded
        if summary["success"] > 0:
            _cache.delete("patterns:all")
            
        return {
            "success": True, 
            "message": f"Batch completed: {summary['success']} saved, {summary['failed']} failed",
            "summary": summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/patterns/search", dependencies=[Depends(verify_api_key)])
def search_patterns(q: str):
    """Search for patterns by question text"""
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")

    match = search_pattern(q)
    return {
        "success": True,
        "matches": [match] if match else [],
    }


@app.get("/api/user-stats", dependencies=[Depends(verify_api_key)])
def get_user_stats():
    """Get aggregated user and feedback statistics"""
    return {
        "users": resume_service.get_total_users(),
        "feedback": resume_service.get_feedback_stats()
    }

# --- UNIFIED BACKUP & RESTORE ---

@app.post("/api/user-data/backup", dependencies=[Depends(verify_api_key)])
def backup_user_data(request: BackupRequest):
    """Unified endpoint for full state backup (Fresh Dump)"""
    try:
        success = resume_service.backup_user_data(
            request.email,
            request.profileData,
            request.patterns,
            request.aiCache
        )
        if not success:
            raise HTTPException(status_code=500, detail="Failed to backup user data")
        return {"success": True, "message": "Master backup completed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user-data/restore/{email}", dependencies=[Depends(verify_api_key)])
def restore_user_data(email: str):
    """Unified endpoint for full state restoration"""
    try:
        data = resume_service.get_master_restore(email)
        if not data.get("success"):
            raise HTTPException(status_code=404, detail=data.get("error", "Failed to restore data"))
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/patterns/stats", dependencies=[Depends(verify_api_key)])
def pattern_stats():
    """Get memory statistics"""
    try:
        return {"success": True, "stats": get_stats()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/patterns/sync", dependencies=[Depends(verify_api_key)])
def sync_patterns(since: str | None = None):
    """
    Sync all patterns (cached for 5 minutes to prevent polling overload).
    150 users × poll-every-10s = 900 requests/min → with 5min cache = near zero DB hits.
    """
    cache_key = "patterns:all"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        t = time.time()
        patterns = read_patterns()
        elapsed = int((time.time() - t) * 1000)
        logger.info(f"📦 patterns/sync | DB fetch | count={len(patterns)} | elapsed={elapsed}ms")
        result = {
            "success": True,
            "patterns": patterns,
            "total": len(patterns),
        }
        _cache.set(cache_key, result, PATTERNS_CACHE_TTL)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/patterns/user/{email}", dependencies=[Depends(verify_api_key)])
def get_user_patterns_endpoint(email: str):
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
def save_user_data(profile: UserProfile):
    """Persist user profile"""
    try:
        if save_user_profile(profile.email, profile.model_dump()):
            return {"success": True, "message": "Profile saved"}
        raise HTTPException(status_code=500, detail="Failed to save profile")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/user-data/{email}", dependencies=[Depends(verify_api_key)])
def get_user_data(email: str):
    """Fetch user profile"""
    profile = get_user_profile(email)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"success": True, "profile": profile}

# ---------------------------------------------------------
# STATS & FEEDBACK (cached 30s to prevent polling overload)
# ---------------------------------------------------------

@app.get("/api/stats/summary", dependencies=[Depends(verify_api_key)])
def get_stats_summary():
    """
    Get summary stats for the overlay panel — cached for 30 seconds.
    150 users × poll-every-5s = 1,800 req/min → with cache = 2 req/min to DB.
    """
    cache_key = "stats:summary"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        t = time.time()
        user_stats = get_total_users()
        feedback_stats = get_feedback_stats()
        elapsed = int((time.time() - t) * 1000)
        logger.info(f"📊 stats/summary | DB fetch | elapsed={elapsed}ms")
        result = {
            "success": True,
            "users": user_stats,
            "feedback": feedback_stats
        }
        _cache.set(cache_key, result, STATS_CACHE_TTL)
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/feedback/track", dependencies=[Depends(verify_api_key)])
def track_user_feedback(email: str, type: str = "click"):
    """Track user feedback interaction"""
    success = track_feedback(email, type)
    # Invalidate stats cache so next poll gets fresh counts
    _cache.delete("stats:summary")
    return {"success": success}

# ---------------------------------------------------------
# ANALYTICS
# ---------------------------------------------------------

@app.post("/api/analytics/track", dependencies=[Depends(verify_api_key)])
def track_analytics(event: AnalyticsEvent):
    """Track extension usage metrics"""
    from analytics_service import log_analytics_event
    
    if log_analytics_event(event):
        return {"success": True}
    
    # Return 200 even on failure to not break client
    return {"success": False, "error": "Failed to save analytics"}

# ---------------------------------------------------------
# HEALTH
# ---------------------------------------------------------

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "ai-service",
        "version": "4.0.0",
        "cache_entries": _cache.size(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.HOST, port=config.PORT)
