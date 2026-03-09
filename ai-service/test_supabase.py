import os
from dotenv import load_dotenv
import requests

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

if not url or not key:
    print(f"Error: Missing SUPABASE_URL ({url}) or SUPABASE_KEY ({key})")
    exit(1)

print(f"Testing connection to {url}")
headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}"
}

try:
    response = requests.get(f"{url}/rest/v1/global_patterns?select=count", headers=headers, timeout=10)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Exception: {e}")
