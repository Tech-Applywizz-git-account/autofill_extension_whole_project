"""
Resume Service - Resume parsing and user data management
Handles PDF/DOCX parsing and user profile storage (for future use)
"""
import json
import os
from typing import Optional

# Storage paths
USER_DATA_DIR = os.path.join(os.path.dirname(__file__), 'data', 'users')

def ensure_user_dir():
    """Ensure user data directory exists"""
    os.makedirs(USER_DATA_DIR, exist_ok=True)

def save_user_profile(email: str, profile_data: dict) -> bool:
    """Save user profile to file"""
    ensure_user_dir()
    try:
        file_path = os.path.join(USER_DATA_DIR, f"{email.replace('@', '_at_')}.json")
        with open(file_path, 'w') as f:
            json.dump(profile_data, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving user profile: {e}")
        return False

def get_user_profile(email: str) -> Optional[dict]:
    """Get user profile by email"""
    ensure_user_dir()
    try:
        file_path = os.path.join(USER_DATA_DIR, f"{email.replace('@', '_at_')}.json")
        if os.path.exists(file_path):
            with open(file_path, 'r') as f:
                return json.load(f)
        return None
    except Exception as e:
        print(f"Error loading user profile: {e}")
        return None

def parse_resume(file_data: str, file_type: str) -> dict:
    """
    Parse resume from base64 data
    TODO: Implement PDF/DOCX parsing using pdf-parse or mammoth
    For now, returns placeholder
    """
    return {
        "status": "not_implemented",
        "message": "Resume parsing will be implemented later",
        "extracted_data": {}
    }

# Note: Full resume parsing would require additional dependencies:
# - PyPDF2 or pdfplumber for PDF parsing
# - python-docx for DOCX parsing
# These can be added when needed without affecting other services
