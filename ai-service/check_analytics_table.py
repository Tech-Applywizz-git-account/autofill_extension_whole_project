from supabase_client import supabase
import json
from datetime import datetime

def check_analytics_table():
    print("--- 📊 Diagnostic: extension_analytics table ---")
    
    # 1. Try to fetch one row to see structure
    try:
        print("\n1. Fetching a sample row...")
        result = supabase.table('extension_analytics').select('*').execute()
        if result.data:
            print(f"✅ Found data. Columns: {list(result.data[0].keys())}")
            # print(f"Sample: {json.dumps(result.data[0], indent=2)}")
        else:
            print("⚠️ Table exists but is empty.")
    except Exception as e:
        print(f"❌ Error fetching from extension_analytics: {e}")
        return

    # 2. Test insertion with full payload
    print("\n2. Testing insertion with full payload...")
    test_payload = {
        "user_email": "diagnostic_test@example.com",
        "user_name": "Diagnostic Bot",
        "url": "http://localhost/diagnostic",
        "scan_duration_ms": 100,
        "total_questions": 5,
        "mapping_duration_ms": 50,
        "mapped_by_rules": 2,
        "ai_questions_count": 2,
        "ai_calls_count": 1,
        "learned_patterns_used": 1,
        "filling_duration_ms": 500,
        "filled_success_count": 5,
        "filled_failed_count": 0,
        "missed_questions": ["test_missed"],
        "all_questions": ["q1", "q2", "q3", "q4", "q5"],
        "total_process_time_ms": 1000
    }
    
    try:
        res = supabase.table('extension_analytics').insert(test_payload).execute()
        if res.data:
            print(f"✅ Insertion successful! ID: {res.data[0].get('id')}")
        else:
            print(f"❌ Insertion failed. No data returned. Check RLS or schema.")
    except Exception as e:
        print(f"❌ Insertion Error: {e}")

if __name__ == "__main__":
    check_analytics_table()
