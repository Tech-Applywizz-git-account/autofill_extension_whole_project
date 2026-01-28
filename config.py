"""
Centralized Configuration for AI Service
All configurable values in one place
"""
import os
from typing import List
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Application configuration loaded from environment variables"""
    
    # AWS Bedrock Configuration
    AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
    AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")
    BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.amazon.nova-lite-v1:0")
    
    # Server Configuration
    PORT = int(os.environ.get("PORT", "8001"))
    HOST = os.environ.get("HOST", "0.0.0.0")
    API_KEY = os.environ.get("APP_API_KEY", "").strip('"').strip("'") or None
    
    # Storage Paths
    DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
    PATTERNS_FILE = os.path.join(DATA_DIR, 'patterns.json')
    USERS_DIR = os.path.join(DATA_DIR, 'users')
    
    # Thresholds
    FUZZY_MATCH_THRESHOLD = float(os.environ.get("FUZZY_MATCH_THRESHOLD", "0.7"))
    PATTERN_MEMORY_CONFIDENCE = float(os.environ.get("PATTERN_MEMORY_CONFIDENCE", "0.95"))
    MIN_CONFIDENCE_THRESHOLD = float(os.environ.get("MIN_CONFIDENCE_THRESHOLD", "0.6"))
    
    # Model Configuration
    MAX_NEW_TOKENS = int(os.environ.get("MAX_NEW_TOKENS", "1000"))
    
    # Privacy: Shareable Intents
    SHAREABLE_INTENTS: List[str] = [
        'eeo.gender',
        'eeo.hispanic',
        'eeo.veteran',
        'eeo.disability',
        'eeo.race',
        'workAuth.sponsorship',
        'workAuth.usAuthorized',
        'workAuth.driverLicense',
        'location.country',
        'location.state',
        'application.hasRelatives',
        'application.previouslyApplied',
        # Pattern-only sharing (no answer values)
        'personal.firstName',
        'personal.lastName',
        'personal.email',
        'personal.phone',
    ]

# Global config instance
config = Config()
