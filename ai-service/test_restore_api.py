import requests
import json

url = "http://localhost:8001/api/user-data/restore/sampath%40gmail.com"
headers = {
    "X-API-Key": "K3jR9zP2m7B5vW8xL1qN4hT6uS9aZ0cNdiokuhyikl"
}

try:
    response = requests.get(url, headers=headers)
    print(f"Status Code: {response.status_code}")
    data = response.json()
    if data.get("success"):
        profile = data.get("profileData")
        if profile:
            print("PERSONAL:")
            print(json.dumps(profile.get("personal"), indent=2))
            print("EMAILS IN PROFILE:")
            print(f"Personal Email: {profile.get('personal', {}).get('email')}")
            print(f"Consent Agreed: {profile.get('consent', {}).get('agreedToAutofill')}")
        else:
            print("profileData is missing")
    else:
        print(f"API Error: {data.get('error')}")
except Exception as e:
    print(f"Error: {e}")
