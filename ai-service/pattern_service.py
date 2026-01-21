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

def ensure_data_dir():
    """Ensure data directory exists"""
    os.makedirs(config.DATA_DIR, exist_ok=True)
    if not os.path.exists(PATTERNS_FILE):
        with open(PATTERNS_FILE, 'w') as f:
            json.dump({"patterns": []}, f)

def is_shareable_intent(intent: str) -> bool:
    """Check if intent is shareable for privacy"""
    return intent in SHAREABLE_INTENTS

def read_patterns() -> List[dict]:
    """Read all patterns from file"""
    ensure_data_dir()
    try:
        with open(PATTERNS_FILE, 'r') as f:
            data = json.load(f)
            return data.get('patterns', [])
    except:
        return []

def write_patterns(patterns: List[dict]):
    """Write patterns to file"""
    ensure_data_dir()
    with open(PATTERNS_FILE, 'w') as f:
        json.dump({"patterns": patterns}, f, indent=2)

def search_pattern(question: str) -> Optional[dict]:
    """Search for matching pattern by question text"""
    patterns = read_patterns()
    question_lower = question.lower().strip()
    
    # Find exact or fuzzy match
    for pattern in patterns:
        pattern_question = pattern.get('questionPattern', '').lower().strip()
        
        # Exact match
        if pattern_question == question_lower:
            return pattern
        
        # Fuzzy match (configurable threshold)
        q_words = set(question_lower.split())
        p_words = set(pattern_question.split())
        
        if len(q_words) > 0 and len(p_words) > 0:
            matched_words = q_words.intersection(p_words)
            similarity = len(matched_words) / max(len(q_words), len(p_words))
            
            if similarity >= config.FUZZY_MATCH_THRESHOLD:
                return pattern
    
    return None

def save_pattern(pattern: Pattern) -> bool:
    """Save new pattern or update existing"""
    if not is_shareable_intent(pattern.intent):
        return False  # Don't save private intents
    
    patterns = read_patterns()
    
    # Check if pattern exists
    existing_index = -1
    for i, p in enumerate(patterns):
        if (p.get('intent') == pattern.intent and 
            p.get('questionPattern', '').lower() == pattern.questionPattern.lower()):
            existing_index = i
            break
    
    pattern_dict = pattern.dict()
    pattern_dict['lastUsed'] = datetime.now().isoformat()
    
    if existing_index >= 0:
        # Update existing pattern
        existing = patterns[existing_index]
        existing['usageCount'] = existing.get('usageCount', 0) + 1
        existing['lastUsed'] = pattern_dict['lastUsed']
        
        # Merge answer mappings if present
        if pattern.answerMappings and existing.get('answerMappings'):
            for new_mapping in pattern.answerMappings:
                found = False
                for existing_mapping in existing['answerMappings']:
                    if existing_mapping.get('canonicalValue') == new_mapping.get('canonicalValue'):
                        # Add new variants
                        for variant in new_mapping.get('variants', []):
                            if variant not in existing_mapping.get('variants', []):
                                existing_mapping['variants'].append(variant)
                        found = True
                        break
                if not found:
                    existing['answerMappings'].append(new_mapping)
        
        patterns[existing_index] = existing
    else:
        # Add new pattern
        pattern_dict['id'] = f"pattern_{datetime.now().timestamp()}_{os.urandom(4).hex()}"
        pattern_dict['createdAt'] = datetime.now().isoformat()
        pattern_dict['usageCount'] = 1
        patterns.append(pattern_dict)
    
    write_patterns(patterns)
    return True

def get_stats() -> dict:
    """Get pattern statistics"""
    patterns = read_patterns()
    
    intent_breakdown = {}
    for p in patterns:
        intent = p.get('intent', 'unknown')
        intent_breakdown[intent] = intent_breakdown.get(intent, 0) + 1
    
    return {
        "totalPatterns": len(patterns),
        "intentBreakdown": intent_breakdown,
        "topPatterns": sorted(
            patterns, 
            key=lambda x: x.get('usageCount', 0), 
            reverse=True
        )[:10]
    }
