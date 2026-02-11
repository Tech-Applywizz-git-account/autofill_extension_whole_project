"""
AI Service - AWS Bedrock Integration
Handles AI predictions using Amazon Nova

Key guarantees:
- Never returns placeholder answers ("I don't know", "Not provided", "N/A", "Free text input", etc.)
- Confidence always >= 0.70 when returning a usable answer
- Intent is always non-null and normalized to an allowed intent
"""

import json
import os
import re
import boto3
from typing import Optional, Dict, Any, List
from models import AIRequest, AIResponse

# ---------------------------------------------------------
# ROBUST AI SYSTEM PROMPT
# ---------------------------------------------------------
SYSTEM_PROMPT = """You are an AI assistant that fills out job application forms. Your ONLY job is to answer the specific question asked using ONLY the information from the user's profile.

# CRITICAL RULES (MUST FOLLOW):

1. **ANSWER LENGTH**: 
   - Give SHORT, SINGLE-LINE answers
   - NO paragraphs, NO explanations, NO extra details
   - If it's a Yes/No question, answer ONLY "Yes" or "No"
   - If it's a date, answer ONLY the date
   - If it's a name, answer ONLY the name

2. **USE ONLY PROVIDED DATA**:
   - ONLY use information from the User Profile provided
   - If information is NOT in the profile, answer "Not Provided"
   - NEVER make up, guess, or infer information
   - NEVER add information that wasn't explicitly given

3. **MATCH AVAILABLE OPTIONS**:
   - If the question provides "Available Options", you MUST choose from that exact list
   - Match the option text EXACTLY as provided (including capitalization)
   - If your answer isn't in the options, choose the closest match
   - If no close match exists, answer "Not Provided"

4. **SPECIFIC QUESTION HANDLING**:

   **"How did you hear about us?"** → ALWAYS answer "LinkedIn" (unless profile says otherwise)
   
   **"Worked here before?"** → Answer "No" (unless profile explicitly says yes)
   
   **"Need visa sponsorship?"** → Answer based on profile's work authorization, default "No"
   
   **"Are you 18 or older?"** → Answer "Yes" (assume adult applicant)
   
   **"Willing to relocate?"** → Answer based on profile's preferences, default "Yes"
   
   **"Currently employed?"** → Check if latest job has "currently working" = true
   
   **"Start date"** → Answer "Immediately" or "2 weeks" (unless profile specifies)

5. **DATE FORMATS**:
   - Month questions: Answer with FULL month name ("January", NOT "01" or "Jan")
   - Year questions: Answer with 4-digit year ("2020", NOT "20")
   - Full dates: Use format "MM/DD/YYYY"

6. **NAME FORMATS**:
   - First/Last names: Proper capitalization ("John", NOT "john")
   - Email: Lowercase
   - Phone: Numbers only, no formatting ("1234567890", NOT "(123) 456-7890")

7. **DROPDOWN/MULTIPLE CHOICE**:
   - Your answer MUST be ONE of the "Available Options"
   - Copy the option text EXACTLY
   - If unsure, pick the most common/professional option

8. **TEXT AREA / LONG ANSWERS**:
   - Even for text areas, keep answers to 1-2 sentences MAX
   - Focus on most relevant information only
   - Use bullet points if listing multiple items

9. **WORK AUTHORIZATION**:
   - "Authorized to work in [country]" → Check profile's work authorization
   - If profile doesn't specify, assume "Yes" for US applications
   - "Need sponsorship" → Opposite of authorized (if authorized=Yes, then sponsorship=No)

10. **SALARY QUESTIONS**:
    - Answer with numbers only, no dollar signs or "k" notation
    - Example: "120000" NOT "$120k"

# OUTPUT FORMAT:

Return ONLY the answer, nothing else. No preamble, no explanation, no quotes around the answer.
"""


# -----------------------------
# INTENT POLICY (IMPORTANT)
# -----------------------------

ALLOWED_INTENTS = {
    # Personal
    "personal.firstName",
    "personal.lastName",
    "personal.email",
    "personal.phone",
    "personal.linkedin",
    "personal.city",
    "personal.state",
    "personal.country",

    # Common job app
    "personal.desiredSalary",
    "personal.additionalInfo",
    "experience.whyFit",
    "experience.summary",

    # Work auth
    "workAuthorization.authorizedUS",
    "workAuthorization.needsSponsorship",

    # EEO
    "eeo.gender",
    "eeo.race",
    "eeo.veteran",
    "eeo.disability",

    # fallback
    "unknown",
}


# Map messy intents → allowed intents
INTENT_NORMALIZATION = {
    "experience": "experience.summary",
    "why_fit": "experience.whyFit",
    "whyfit": "experience.whyFit",
    "personal.additionalinfo": "personal.additionalInfo",
    "additionalinfo": "personal.additionalInfo",
    "salary": "personal.desiredSalary",
    "personal.salary": "personal.desiredSalary",
    "personal.desiredsalary": "personal.desiredSalary",
}


FORBIDDEN_ANSWER_PATTERNS = [
    r"\\bnot provided\\b",
    r"\\bi don't know\\b",
    r"\\bdo not know\\b",
    r"\\bn/?a\\b",
    r"\\bfree text input\\b",
    r"\\bno additional information\\b",
    r"\\bnothing to add\\b",
    r"\\bnot sure\\b",
]


def _normalize_intent(intent: Optional[str], question: str) -> str:
    """Normalize / infer intent safely to prevent memory pollution."""
    if not intent:
        intent = ""

    raw = intent.strip()
    key = raw.lower().replace(" ", "").replace("-", "").replace("_", "")

    if raw in ALLOWED_INTENTS:
        return raw

    if key in INTENT_NORMALIZATION:
        return INTENT_NORMALIZATION[key]

    # Heuristic inference from question text (backup)
    q = (question or "").lower()
    if "salary" in q or "compensation" in q or "pay" in q:
        return "personal.desiredSalary"
    if "anything else" in q or "additional" in q or "know about you" in q:
        return "personal.additionalInfo"
    if "strong fit" in q or "why you" in q or "why should we hire" in q:
        return "experience.whyFit"

    # Otherwise fallback
    return "unknown"


def _is_forbidden_answer(ans: str) -> bool:
    s = (ans or "").strip().lower()
    if not s:
        return True
    for pat in FORBIDDEN_ANSWER_PATTERNS:
        if re.search(pat, s, flags=re.IGNORECASE):
            return True
    return False


def _repair_answer(question: str, options: Optional[List[str]], intent: str) -> str:
    """
    If model returns garbage, generate safe job-applier fallback text.
    """
    q = (question or "").lower()

    # If options exist, pick safest professional option
    if options:
        pref = ["Prefer not to say", "Decline to answer", "Decline to state", "Prefer not to disclose"]
        for p in pref:
            for opt in options:
                if opt.strip().lower() == p.lower():
                    return opt
        return options[0]

    # Salary fallback
    if intent == "personal.desiredSalary" or "salary" in q or "compensation" in q:
        return "Open to a competitive salary aligned with the role scope, market standards, and total compensation."

    # “Anything else” fallback
    if intent == "personal.additionalInfo" or "anything else" in q or "additional" in q:
        return ("I’m genuinely excited about this opportunity and would welcome the chance to discuss how I can "
                "contribute. I’m quick to learn, dependable, and committed to delivering high-quality work.")

    # Why fit fallback
    if intent == "experience.whyFit" or "strong fit" in q or "why should" in q:
        return ("I’m a strong fit because I bring consistent execution, clear communication, and a practical mindset. "
                "I focus on understanding requirements quickly, delivering reliable outcomes, and collaborating well "
                "with teams to move work forward efficiently.")

    # Generic fallback
    return ("I’m excited about this role and confident I can add value through strong ownership, adaptability, and "
            "a results-driven approach. I’m ready to contribute from day one.")


def predict_answer(request: AIRequest) -> AIResponse:
    """
    Predict answer using AWS Bedrock (Amazon Nova)
    """
    try:
        aws_region = os.environ.get("AWS_REGION", "us-east-1")
        aws_access_key = os.environ.get("AWS_ACCESS_KEY_ID")
        aws_secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")

        if not aws_access_key or not aws_secret_key:
            return AIResponse(
                answer="",
                confidence=0.0,
                reasoning="AWS Credentials Missing",
                intent="unknown",
            )

        bedrock = boto3.client(
            service_name="bedrock-runtime",
            region_name=aws_region,
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
        )

        options_block = ""
        if request.options and len(request.options) > 0:
            options_block = (
                "\\n\\nAVAILABLE OPTIONS (CHOOSE EXACTLY ONE, COPY EXACTLY):\\n"
                + "\\n".join([f"- {o}" for o in request.options])
            )
        else:
            options_block = "\\n\\nThis question requires a written response."

        allowed_intents_block = "\\n".join([f"- {i}" for i in sorted(ALLOWED_INTENTS)])

        prompt = f"""
{SYSTEM_PROMPT}

USER PROFILE (may be incomplete):
{json.dumps(request.userProfile, indent=2)}

QUESTION:
{request.question}
{options_block}

ALLOWED INTENTS (MUST SELECT EXACTLY ONE):
{allowed_intents_block}

RESPONSE FORMAT (JSON ONLY, NO EXTRA TEXT):
{{
  "answer": "string",
  "confidence": 0.70,
  "reasoning": "short practical reason why this helps hiring",
  "intent": "one_allowed_intent"
}}
"""

        body = json.dumps(
            {
                "inferenceConfig": {"max_new_tokens": 450},
                "messages": [{"role": "user", "content": [{"text": prompt}]}],
            }
        )

        model_id = "us.amazon.nova-lite-v1:0"

        response = bedrock.invoke_model(
            body=body,
            modelId=model_id,
            accept="application/json",
            contentType="application/json",
        )

        response_body = json.loads(response["body"].read())
        content_text = response_body["output"]["message"]["content"][0]["text"]

        clean_text = content_text.replace("```json", "").replace("```", "").strip()

        try:
            ai_data: Dict[str, Any] = json.loads(clean_text)
        except json.JSONDecodeError:
            intent = _normalize_intent(None, request.question)
            ans = _repair_answer(request.question, request.options, intent)
            return AIResponse(
                answer=ans,
                confidence=0.78,
                reasoning="Fallback response due to formatting issue.",
                intent=intent,
            )

        raw_answer = (ai_data.get("answer") or "").strip()
        raw_conf = ai_data.get("confidence", 0.75)
        raw_reason = (ai_data.get("reasoning") or "").strip()
        raw_intent = ai_data.get("intent")

        intent = _normalize_intent(raw_intent, request.question)

        try:
            conf = float(raw_conf)
        except Exception:
            conf = 0.75
        conf = max(0.70, min(conf, 0.99))

        if _is_forbidden_answer(raw_answer):
            repaired = _repair_answer(request.question, request.options, intent)
            return AIResponse(
                answer=repaired,
                confidence=max(conf, 0.75),
                reasoning="Repaired answer to avoid placeholders.",
                intent=intent,
            )

        if request.options and raw_answer not in request.options:
            lower_map = {o.lower().strip(): o for o in request.options}
            candidate = lower_map.get(raw_answer.lower().strip())
            
            if not candidate:
                synonym_map = {
                    'male': ['man', 'cisgender male', 'cis male'],
                    'female': ['woman', 'cisgender female', 'cis female'],
                    'man': ['male', 'cisgender male', 'cis male'],
                    'woman': ['female', 'cisgender female', 'cis female'],
                    'non-binary': ['nonbinary', 'genderqueer', 'gender non-conforming', 'gender non-binary', 'non-binary/non-conforming'],
                    'yes': ['y', 'true', 'i do', 'authorized'],
                    'no': ['n', 'false', 'i do not', 'not authorized']
                }
                ans_lower = raw_answer.lower().strip()
                if ans_lower in synonym_map:
                    for syn in synonym_map[ans_lower]:
                        if syn in lower_map:
                            candidate = lower_map[syn]
                            break
            
            if not candidate:
                for opt_lower, opt_original in lower_map.items():
                    if opt_lower in raw_answer.lower() or raw_answer.lower() in opt_lower:
                        candidate = opt_original
                        break

            if candidate:
                raw_answer = candidate
            else:
                raw_answer = _repair_answer(request.question, request.options, intent)
                conf = max(conf, 0.75)

        if intent not in ALLOWED_INTENTS:
            intent = "unknown"

        return AIResponse(
            answer=raw_answer,
            confidence=conf,
            reasoning=raw_reason or "Answer chosen to maximize hiring chances.",
            intent=intent,
        )

    except Exception as e:
        return AIResponse(
            answer="",
            confidence=0.0,
            reasoning=f"AWS Error: {str(e)}",
            intent="unknown",
        )
