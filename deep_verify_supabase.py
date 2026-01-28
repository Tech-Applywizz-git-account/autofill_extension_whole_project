"""
Deep Verification - Test all 4 Supabase Tables
"""
import os
import json
from dotenv import load_dotenv
from supabase_client import supabase
from datetime import datetime

# Load environment variables
load_dotenv()

def deep_verify():
    target_email = "errojunikhil@gmail.com"
    test_tag = f"Verification Test {datetime.now().strftime('%H:%M:%S')}"
    
    print(f"--- 🚀 Deep Verification Starting ---")
    print(f"Target: {target_email}")
    print(f"Tag: {test_tag}\n")

    # 1. Fetch errojunikhil@gmail.com
    print("1. [GET] user_profiles for errojunikhil@gmail.com...")
    try:
        res = supabase.table('user_profiles').select("*").eq('email', target_email).execute()
        if res.data:
            print(f"✅ FOUND: Updated at {res.data[0].get('updated_at')}")
            # print(json.dumps(res.data[0], indent=2))
        else:
            print("⚠️ NOT FOUND: Profile does not exist yet.")
    except Exception as e:
        print(f"❌ Error fetching profile: {e}")

    # 2. Insert test row in user_profiles (Upsert)
    print("\n2. [UPSERT] user_profiles (Test Bot)...")
    try:
        bot_email = "test_bot@autofill.com"
        db_data = {
            "email": bot_email,
            "profile_data": {"verification": "success", "tag": test_tag},
            "updated_at": datetime.now().isoformat()
        }
        res = supabase.table('user_profiles').upsert(db_data, on_conflict="email").execute()
        print("✅ Success" if not res.error else f"❌ Failed: {res.error}")
    except Exception as e:
        print(f"❌ Exception: {e}")

    # 3. Insert test row in learned_patterns
    print("\n3. [INSERT] learned_patterns...")
    try:
        pattern_data = {
            "id": f"test_id_{datetime.now().timestamp()}",
            "user_email": target_email,
            "question_pattern": f"Test question {datetime.now().timestamp()}",
            "intent": "test.status",
            "field_type": "text",
            "answer_mappings": [{"canonicalValue": "Functional", "variants": ["OK"]}],
            "confidence": 1.0,
            "usage_count": 1,
            "created_at": datetime.now().isoformat()
        }
        res = supabase.table('learned_patterns').insert(pattern_data).execute()
        print("✅ Success" if not res.error else f"❌ Failed: {res.error}")
    except Exception as e:
        print(f"❌ Exception: {e}")

    # 4. Insert test row in feedbacks
    print("\n4. [INSERT] feedbacks...")
    try:
        feedback_data = {
            "email": target_email,
            "feedback_type": "verification_test",
            "created_at": datetime.now().isoformat()
        }
        res = supabase.table('feedbacks').insert(feedback_data).execute()
        print("✅ Success" if not res.error else f"❌ Failed: {res.error}")
    except Exception as e:
        print(f"❌ Exception: {e}")

    # 5. Insert test row in global_patterns
    print("\n5. [INSERT] global_patterns...")
    try:
        global_data = {
            "question_pattern": f"Global test {datetime.now().timestamp()}",
            "intent": "global.test",
            "field_type": "text",
            "answer_mappings": [{"canonicalValue": "GlobalOK"}],
            "popularity": 100,
            "created_at": datetime.now().isoformat()
        }
        res = supabase.table('global_patterns').insert(global_data).execute()
        print("✅ Success" if not res.error else f"❌ Failed: {res.error}")
    except Exception as e:
        print(f"❌ Exception: {e}")

    print("\n--- 🏁 Deep Verification Complete ---")

if __name__ == "__main__":
    deep_verify()
