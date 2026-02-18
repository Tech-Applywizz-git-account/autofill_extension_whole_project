from pydantic import BaseModel
from typing import List, Literal, Optional

# ===== AI Models =====
class AIRequest(BaseModel):
    """Request to predict an answer for a job question"""
    question: str
    options: List[str] | None = None
    fieldType: str
    userProfile: dict

class AIResponse(BaseModel):
    """AI predicted answer"""
    answer: str
    confidence: float
    reasoning: str | None = None
    intent: str | None = None
    isNewIntent: bool = False
    suggestedIntentName: str | None = None

# ===== Pattern Models =====
class Pattern(BaseModel):
    """Learned question-answer pattern"""
    questionPattern: str
    intent: str
    canonicalKey: str | None = None
    fieldType: str
    confidence: float
    source: str = "AI"
    answerMappings: List[dict] | None = None
    usageCount: int = 1
    createdAt: str | None = None
    lastUsed: str | None = None

class PatternSearchRequest(BaseModel):
    """Pattern search query"""
    query: str

class PatternUploadRequest(BaseModel):
    """Upload new pattern"""
    pattern: Pattern

# ===== User/Resume Models =====
class UserProfile(BaseModel):
    """User profile data"""
    email: str
    profile_data: dict
    resume_base64: str | None = None
    cover_letter_base64: str | None = None

class ResumeParseRequest(BaseModel):
    """Resume parsing request (for future)"""
    file_data: str  # Base64 encoded file
    file_type: Literal["pdf", "docx"]

# ===== Fill Plan Models (from selenium-runner) =====
class Action(BaseModel):
    """Field action in fill plan"""
    id: str
    type: Literal[
        "input_text",
        "textarea", 
        "input_file",
        "radio",
        "checkbox",
        "dropdown_native",
        "dropdown_custom",
        "click"
    ]
    selector: str
    value: str | bool | None
    required: bool
    fileName: str | None = None

class FillPlan(BaseModel):
    """Complete fill plan from extension"""
    jobUrl: str
    actions: List[Action]

class ExecutionResponse(BaseModel):
    """Response after executing fill plan"""
    status: Literal["completed", "failed"]
    results: dict[str, Literal["success", "failed", "skipped"]]
    errors: dict[str, str] = {}

# ===== Analytics Models =====
class AnalyticsEvent(BaseModel):
    """Event data for extension analytics"""
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    url: str
    scan_duration_ms: int
    total_questions: int
    mapping_duration_ms: int
    mapped_by_rules: int
    ai_questions_count: int
    ai_calls_count: int
    learned_patterns_used: int
    filling_duration_ms: int
    filled_success_count: int
    filled_failed_count: int
    missed_questions: Optional[List[str]] = []
    all_questions: Optional[List[str]] = []
    total_process_time_ms: int
