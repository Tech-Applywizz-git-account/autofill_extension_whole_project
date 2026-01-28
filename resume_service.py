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

def save_user_profile(email: str, profile_data: dict) -> bool:
    """Save user profile to Supabase"""
    try:
        # Ensure we are saving the clean profile_data
        # If profile_data itself contains 'profile_data', unwrap it (defensive)
        clean_data = profile_data
        if isinstance(profile_data, dict) and 'profile_data' in profile_data:
            clean_data = profile_data['profile_data']

        db_data = {
            "email": email,
            "profile_data": clean_data,
            "updated_at": datetime.now().isoformat()
        }
        supabase.table('user_profiles').upsert(db_data, on_conflict="email").execute()
        return True
    except Exception as e:
        print(f"❌ Exception saving user profile to Supabase: {e}")
        return False

def get_user_profile(email: str) -> Optional[dict]:
    """Get user profile from Supabase"""
    try:
        result = supabase.table('user_profiles').select("*").eq('email', email).execute()
        if result.data and len(result.data) > 0:
            row = result.data[0]
            # Robust extraction: 
            # If the column 'profile_data' contains a dict that itself has 'profile_data', unwrap it.
            data = row.get('profile_data')
            if isinstance(data, dict) and 'profile_data' in data:
                return data['profile_data']
            return data
        return None
    except Exception as e:
        print(f"Error getting user profile from Supabase: {e}")
        return None

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
