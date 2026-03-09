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
    
    # Privacy: Universal Shareable Intents (Global learning OK)
    SHAREABLE_INTENTS: List[str] = [
        'eeo.gender', 'eeo.race', 'eeo.hispanic', 'eeo.veteran', 'eeo.disability', 'eeo.lgbtq', 'eeo.transgender', 'eeo.preferNotToAnswer',
        'workAuthorization.authorizedUS', 'workAuthorization.authorizedCountry', 'workAuthorization.needsSponsorship',
        'workAuthorization.needsSponsorshipNow', 'workAuthorization.needsSponsorshipFuture', 'workAuthorization.citizenshipStatus',
        'workAuthorization.visaType', 'workAuthorization.workPermitType', 'workAuthorization.workPermitValidUntil',
        'workAuthorization.driverLicense', 'workAuthorization.securityClearance', 'workAuthorization.securityClearanceLevel',
        'workAuthorization.exportControlEligible',
        'application.workArrangement', 'application.workType', 'application.shiftAvailability', 'application.weekendAvailability',
        'application.nightShiftAvailability', 'application.overtimeWillingness', 'application.willingToRelocate',
        'application.willingToTravel', 'application.travelPercentage',
        'application.startDateAvailability', 'application.noticePeriod',
        'application.agreeToTerms', 'application.privacyPolicyConsent', 'application.dataProcessingConsent',
        'application.backgroundCheckConsent', 'application.drugTestConsent', 'application.rightToWorkConfirmation',
        'application.equalOpportunityAcknowledgement',
        'application.howDidYouHear', 'application.wasReferred', 'application.previouslyApplied',
        'application.previouslyInterviewed', 'application.previouslyEmployed', 'application.hasRelatives',
        'location.country', 'location.state', 'location.city', 'location.postalCode',
        'application.allowSmsMessages', 'application.allowEmailUpdates', 'application.marketingConsent',
        'application.talentCommunityOptIn',
        'experience.yearsTotal', 'experience.managementExperience', 'experience.peopleManagement',
        'education.level', 'education.degreeType', 'education.graduationStatus'
    ]

    # Pattern-only intents (No values ever shared globally)
    PATTERN_ONLY_INTENTS: List[str] = [
        'personal.firstName', 'personal.middleName', 'personal.lastName', 'personal.fullName',
        'personal.preferredName', 'personal.email', 'personal.phone', 'personal.linkedin',
        'personal.github', 'personal.portfolio', 'personal.website',
        'personal.addressLine1', 'personal.addressLine2', 'personal.city', 'personal.state',
        'personal.postalCode', 'personal.country',
        'documents.resume', 'documents.coverLetter', 'documents.transcript', 'documents.workAuthorizationDocument',
        'education.school', 'education.major', 'education.gpa', 'education.startDate', 'education.endDate',
        'experience.company', 'experience.title', 'experience.startDate', 'experience.endDate', 'experience.currentlyWorking'
    ]

    # Screening text intents (Patterns shared, values private)
    SCREENING_TEXT_INTENTS: List[str] = [
        'screening.whyCompany', 'screening.whyRole', 'screening.whyYou', 'screening.whyChange', 'screening.whyNow',
        'screening.aboutYourself', 'screening.professionalSummary', 'screening.careerGoals',
        'screening.strengths', 'screening.weaknesses', 'screening.biggestAchievement',
        'screening.leadershipExample', 'screening.teamworkExample', 'screening.conflictExample', 'screening.problemSolved',
        'screening.projectHighlights', 'screening.recentProject', 'screening.projectChallenge',
        'screening.additionalInfo', 'screening.coverLetterLike'
    ]

# Global config instance
config = Config()
