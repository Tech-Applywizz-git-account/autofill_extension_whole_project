"""
Verification Script - Test Supabase GET/POST via Service Role Key
"""
import os
import json
from dotenv import load_dotenv
from supabase_client import supabase
from datetime import datetime

# Load environment variables
load_dotenv()

def test_supabase_flow():
    test_email = "test_verification@example.com"
    test_profile = {
        "personal": {
            "firstName": "Test",
            "lastName": "User",
            "email": test_email
        },
        "eeo": {},
        "workAuthorization": {}
    }

    print(f"--- 🚀 Starting Supabase Verification for {test_email} ---")
    
    # 1. Test POST (Upsert)
    print("\n1. Testing POST (Upsert)...")
    try:
        db_data = {
            "email": test_email,
            "profile_data": test_profile,
            "updated_at": datetime.now().isoformat()
        }
        response = supabase.table('user_profiles').upsert(db_data, on_conflict="email").execute()
        if response.error:
            print(f"❌ POST Failed: {response.error}")
        else:
            print("✅ POST Successful!")
    except Exception as e:
        print(f"❌ POST Exception: {e}")

    # 2. Test GET (Retrieve)
    print("\n2. Testing GET (Retrieve)...")
    try:
        response = supabase.table('user_profiles').select("*").eq('email', test_email).execute()
        if response.error:
            print(f"❌ GET Failed: {response.error}")
        elif not response.data:
            print("❌ GET Failed: No data found")
        else:
            retrieved_data = response.data[0].get('profile_data')
            print(f"✅ GET Successful! Retrieved Email: {response.data[0]['email']}")
            
            # Check for double wrapping
            if isinstance(retrieved_data, dict) and 'profile_data' in retrieved_data:
                print("⚠️  Warning: Data is double-wrapped. Unwrapping...")
                retrieved_data = retrieved_data['profile_data']
            
            print(f"   Name in profile: {retrieved_data['personal']['firstName']} {retrieved_data['personal']['lastName']}")

    except Exception as e:
        print(f"❌ GET Exception: {e}")

    print("\n--- 🏁 Verification Complete ---")

if __name__ == "__main__":
    test_supabase_flow()
