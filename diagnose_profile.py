"""
Diagnostic Script - Inspect exact data structure for errojunikhil@gmail.com
"""
import os
import json
from dotenv import load_dotenv
from supabase_client import supabase

# Load environment variables
load_dotenv()

def inspect_profile():
    email = "errojunikhil@gmail.com"
    print(f"🔍 Inspecting profile structure for {email}...")
    
    try:
        res = supabase.table('user_profiles').select("*").eq('email', email).execute()
        if res.data:
            row = res.data[0]
            print("\n--- 📦 FULL DATABASE ROW ---")
            print(json.dumps(row, indent=2))
            
            profile_data = row.get('profile_data')
            print("\n--- 📄 profile_data COLUMN ---")
            print(f"Type: {type(profile_data)}")
            print(json.dumps(profile_data, indent=2))
            
            if isinstance(profile_data, dict):
                print("\n--- 🔑 Top-level keys in profile_data ---")
                print(list(profile_data.keys()))
                
                if 'profile_data' in profile_data:
                    print("\n⚠️  NESTED 'profile_data' FOUND!")
                    nested = profile_data['profile_data']
                    print(json.dumps(nested, indent=2))
        else:
            print("❌ Profile NOT FOUND in database.")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    inspect_profile()
