"""
Pattern Service - Pattern storage and retrieval
Handles learned question-answer patterns
"""
import json
import os
from datetime import datetime
from typing import List, Optional
from models import Pattern
from config import config

# Storage file path (from config)
PATTERNS_FILE = config.PATTERNS_FILE

# Shareable intents (from config)
SHAREABLE_INTENTS = config.SHAREABLE_INTENTS

from supabase_client import supabase

def is_shareable_intent(intent: str) -> bool:
    """Check if intent is shareable for privacy"""
    return intent in SHAREABLE_INTENTS

def read_patterns() -> List[dict]:
    """Read all patterns from Supabase (Global)"""
    try:
        result = supabase.table('global_patterns').select("*").execute()
        if result.error:
            print(f"Error reading global patterns: {result.error}")
            return []
        return result.data or []
    except Exception as e:
        print(f"Exception reading global patterns: {e}")
        return []

def search_pattern(question: str, user_email: Optional[str] = None) -> Optional[dict]:
    """Search for matching pattern in Supabase (Private + Global)"""
    question_lower = question.lower().strip()
    
    # 1. Search User's Private Patterns if email provided
    if user_email:
        try:
            result = supabase.table('learned_patterns').eq('user_email', user_email).execute()
            if not result.error and result.data:
                for p in result.data:
                    if p.get('question_pattern', '').lower().strip() == question_lower:
                        # Convert DB fields to extension format
                        return {
                            "id": p['id'],
                            "questionPattern": p['question_pattern'],
                            "intent": p['intent'],
                            "canonicalKey": p.get('canonical_key'),
                            "answerMappings": p['answer_mappings']
                        }
        except Exception as e:
            print(f"Error searching private patterns: {e}")

    # 2. Search Global Patterns
    try:
        # For now, we fetch all and do fuzzy match in memory (similar to old logic)
        # In production, we'd use pg_trgm or similar in Supabase
        patterns = read_patterns()
        for p in patterns:
            pattern_question = p.get('question_pattern', '').lower().strip()
            
            # Exact match
            if pattern_question == question_lower:
                return {
                    "id": p['id'],
                    "questionPattern": p['question_pattern'],
                    "intent": p['intent'],
                    "canonicalKey": p.get('canonical_key'),
                    "answerMappings": p['answer_mappings']
                }
            
            # Fuzzy match
            q_words = set(question_lower.split())
            p_words = set(pattern_question.split())
            
            if len(q_words) > 0 and len(p_words) > 0:
                matched_words = q_words.intersection(p_words)
                similarity = len(matched_words) / max(len(q_words), len(p_words))
                
                if similarity >= config.FUZZY_MATCH_THRESHOLD:
                    return {
                        "id": p['id'],
                        "questionPattern": p['question_pattern'],
                        "intent": p['intent'],
                        "canonicalKey": p.get('canonical_key'),
                        "answerMappings": p['answer_mappings']
                    }
    except Exception as e:
        print(f"Error searching global patterns: {e}")
    
    return None

def save_pattern(pattern: Pattern, user_email: Optional[str] = None) -> bool:
    """Save pattern to Supabase (Private)"""
    # We always save to private learned_patterns if user_email is provided
    if not user_email:
        print("⚠️ No user_email provided to save_pattern, skipping save.")
        return False

    try:
        pattern_dict = pattern.dict()
        
        # Normalize question pattern to lowercase for case-insensitive matching
        # This prevents duplicates like "website" vs "Website"
        normalized_question = pattern_dict['questionPattern'].lower().strip()
        
        # Create a deterministic ID based on user + question + intent
        # This prevents duplicates when multiple frames save the same pattern
        intent = pattern_dict['intent']
        deterministic_key = f"{user_email}:{normalized_question}:{intent}"
        
        # Use hash for shorter ID
        import hashlib
        hash_digest = hashlib.md5(deterministic_key.encode()).hexdigest()[:12]
        pattern_id = f"pattern_{hash_digest}"

        # Prepare data for Supabase - use normalized question
        db_data = {
            "id": pattern_id,
            "user_email": user_email,
            "question_pattern": normalized_question,  # Store normalized (lowercase)
            "intent": pattern_dict['intent'],
            "canonical_key": pattern_dict.get('canonicalKey'),
            "field_type": pattern_dict.get('fieldType'),
            "confidence": pattern_dict.get('confidence', 1.0),
            "answer_mappings": pattern_dict.get('answerMappings', []),
            "last_used": datetime.now().isoformat(),
            "created_at": pattern_dict.get('createdAt') or datetime.now().isoformat()
        }
        
        # Check if pattern already exists for this user + normalized question
        # This prevents duplicates from multiple iframe processing
        existing = supabase.table('learned_patterns')\
            .select('id')\
            .eq('user_email', user_email)\
            .eq('question_pattern', normalized_question)\
            .execute()
        
        if existing.data and len(existing.data) > 0:
            # Pattern exists - update it by upserting with same ID
            pattern_id = existing.data[0]['id']
            print(f"📝 Pattern exists, updating: {pattern_id}")
            
            # Use upsert to update (Supabase Python client)
            db_data['id'] = pattern_id  # Use existing ID
            result = supabase.table('learned_patterns').upsert(db_data).execute()
        else:
            # Pattern doesn't exist - insert new one
            print(f"➕ Creating new pattern: {pattern_id}")
            result = supabase.table('learned_patterns').insert(db_data).execute()
        
        # Handle Foreign Key constraint (user doesn't exist in user_profiles yet)
        if result.error and 'violates foreign key constraint' in str(result.error):
            print(f"⚠️ User {user_email} not found in user_profiles. Creating stub profile...")
            from resume_service import save_user_profile
            # Create a minimal profile so the pattern can be saved
            save_user_profile(user_email, {"personal": {"email": user_email}})
            # Retry the upsert
            result = supabase.table('learned_patterns').upsert(db_data, on_conflict="id").execute()

        if result.error:
            print(f"❌ Supabase Error saving pattern: {result.error}")
            return False
            
        print(f"✅ Pattern {pattern_id} saved successfully.")
        return True
    except Exception as e:
        print(f"❌ Exception saving pattern to Supabase: {e}")
        return False

def get_stats() -> dict:
    """Get pattern statistics from Supabase"""
    try:
        result = supabase.table('global_patterns').select("*").execute()
        patterns = result.data or []
        
        intent_breakdown = {}
        for p in patterns:
            intent = p.get('intent', 'unknown')
            intent_breakdown[intent] = intent_breakdown.get(intent, 0) + 1
        
        return {
            "totalGlobalPatterns": len(patterns),
            "intentBreakdown": intent_breakdown
        }
    except Exception as e:
        print(f"Error getting stats: {e}")
        return {"totalGlobalPatterns": 0, "intentBreakdown": {}}

def get_user_patterns(email: str) -> list:
    """Get all patterns for a specific user from Supabase"""
    try:
        result = supabase.table('learned_patterns').eq('user_email', email).execute()
        return result.data or []
    except Exception as e:
        print(f"Error getting user patterns: {e}")
        return []
