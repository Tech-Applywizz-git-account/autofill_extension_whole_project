"""
Resume Service - Resume parsing and user data management
Handles PDF/DOCX parsing and user profile storage (for future use)
"""
import json
import os
from datetime import datetime
from typing import Optional

# Storage paths
USER_DATA_DIR = os.path.join(os.path.dirname(__file__), 'data', 'users')

from supabase_client import supabase

def save_user_profile(email: str, profile_data: dict, ai_cache: Optional[dict] = None) -> bool:
    """Save user profile and optional AI cache to Supabase"""
    try:
        # Ensure we are saving the clean profile_data
        clean_data = profile_data
        if isinstance(profile_data, dict) and 'profile_data' in profile_data:
            clean_data = profile_data['profile_data']

        db_data = {
            "email": email,
            "profile_data": clean_data,
            "updated_at": datetime.now().isoformat()
        }
        
        # Add AI cache to profile_data if provided
        if ai_cache is not None:
            clean_data['ai_cache'] = ai_cache

        supabase.table('user_profiles').upsert(db_data, on_conflict="email").execute()
        return True
    except Exception as e:
        print(f"❌ Exception saving user profile to Supabase: {e}")
        return False

def backup_user_data(email: str, profile_data: dict, patterns: list, ai_cache: dict) -> bool:
    """
    Perform a full 'Fresh Dump' of user data.
    1. Overwrites User Profile & AI Cache.
    2. Deletes old patterns and inserts new ones.
    """
    try:
        # 1. Save Profile & AI Cache
        save_success = save_user_profile(email, profile_data, ai_cache)
        if not save_success:
            return False

        # 2. Clear old patterns
        supabase.table('learned_patterns').eq('user_email', email).delete().execute()

        # 3. Bulk insert new patterns if any
        if patterns:
            from pattern_service import save_pattern
            from models import Pattern
            for p in patterns:
                # If it's a dict, convert to Pattern object. If already Pattern, use directly.
                pat_obj = Pattern(**p) if isinstance(p, dict) else p
                save_pattern(pat_obj, email)

        return True
    except Exception as e:
        print(f"❌ Exception in backup_user_data: {e}")
        return False

def get_user_profile(email: str) -> Optional[dict]:
    """Get user profile from Supabase"""
    try:
        result = supabase.table('user_profiles').select("*").eq('email', email).execute()
        if result.data and len(result.data) > 0:
            row = result.data[0]
            data = row.get('profile_data')
            if isinstance(data, dict) and 'profile_data' in data:
                return data['profile_data']
            return data
        return None
    except Exception as e:
        print(f"Error getting user profile from Supabase: {e}")
        return None

def get_master_restore(email: str) -> dict:
    """
    Get full master restoration data:
    1. Profile DATA (including AI Cache)
    2. Private Learned Patterns
    """
    try:
        # 1. Get Profile
        profile_data = get_user_profile(email) or {}
        
        # 2. Extract AI Cache from profile_data if present
        ai_cache = {}
        if isinstance(profile_data, dict) and 'ai_cache' in profile_data:
            ai_cache = profile_data.pop('ai_cache') # Remove from profile for clean return

        # 3. Get User-specific Patterns
        from pattern_service import get_user_patterns
        patterns = get_user_patterns(email)
        
        return {
            "success": True,
            "profileData": profile_data,
            "patterns": patterns,
            "aiCache": ai_cache
        }
    except Exception as e:
        print(f"Error in master restoration: {e}")
        return {"success": False, "error": str(e)}

def get_total_users() -> dict:
    """Get total and 24h user stats from Supabase"""
    try:
        # Get total count
        total_result = supabase.table('user_profiles').select("email", count="exact").execute()
        total_count = total_result.count if total_result.count is not None else (len(total_result.data) if total_result.data else 0)

        # Get 24h count
        from datetime import timedelta
        yesterday = (datetime.now() - timedelta(days=1)).isoformat()
        recent_result = supabase.table('user_profiles').select("email", count="exact").gte('updated_at', yesterday).execute()
        recent_count = recent_result.count if recent_result.count is not None else (len(recent_result.data) if recent_result.data else 0)

        return {
            "total": total_count,
            "recent_24h": recent_count
        }
    except Exception as e:
        print(f"Error getting user stats: {e}")
        return {"total": 0, "recent_24h": 0}

def track_feedback(email: str, feedback_type: str = "click") -> bool:
    """Track a feedback button click in Supabase"""
    try:
        db_data = {
            "email": email,
            "feedback_type": feedback_type,
            "created_at": datetime.now().isoformat()
        }
        supabase.table('feedbacks').insert(db_data).execute()
        return True
    except Exception as e:
        print(f"❌ Error tracking feedback: {e}")
        return False

def get_feedback_stats() -> dict:
    """Get total and 24h feedback stats from Supabase"""
    try:
        # Get total count
        total_result = supabase.table('feedbacks').select("id", count="exact").execute()
        total_count = total_result.count if total_result.count is not None else (len(total_result.data) if total_result.data else 0)

        # Get 24h count
        from datetime import timedelta
        yesterday = (datetime.now() - timedelta(days=1)).isoformat()
        recent_result = supabase.table('feedbacks').select("id", count="exact").gte('created_at', yesterday).execute()
        recent_count = recent_result.count if recent_result.count is not None else (len(recent_result.data) if recent_result.data else 0)

        return {
            "total": total_count,
            "recent_24h": recent_count
        }
    except Exception as e:
        print(f"Error getting feedback stats: {e}")
        return {"total": 0, "recent_24h": 0}

def parse_resume(file_data: str, file_type: str) -> dict:
    """
    Parse resume from base64 data
    TODO: Implement PDF/DOCX parsing using pdf-parse or mammoth
    """
    return {
        "status": "not_implemented",
        "message": "Resume parsing will be implemented later",
        "extracted_data": {}
    }
