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
