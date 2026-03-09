import os
from dotenv import load_dotenv
from supabase_client import supabase

load_dotenv()

email = "sampath@gmail.com"
print(f"Checking profile for {email}...")

result = supabase.table('user_profiles').select("*").eq('email', email).execute()

if result.data:
    print("Profile found!")
    print(result.data)
else:
    print("Profile NOT found.")
    
    # Check all profiles to see what's there
    all_profiles = supabase.table('user_profiles').select("email").execute()
    print("All existing emails in user_profiles:")
    for row in all_profiles.data or []:
        print(f"- {row.get('email')}")
