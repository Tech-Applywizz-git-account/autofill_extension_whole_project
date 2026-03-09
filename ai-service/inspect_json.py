import json

with open('restore_output.json', 'r') as f:
    text = f.read()
    # Handle the "Status Code: 200\nResponse Body:\n" prefix if it exists
    if "Response Body:" in text:
        json_str = text.split("Response Body:")[1].strip()
    else:
        json_str = text.strip()
        
    data = json.loads(json_str)
    print("RESTORE DATA KEYS:", data.keys())
    if "profileData" in data:
        profile = data["profileData"]
        print("PERSONAL:", json.dumps(profile.get("personal"), indent=2))
        print("CONSENT:", json.dumps(profile.get("consent"), indent=2))
        print("EDUCATION COUNT:", len(profile.get("education", [])))
        print("EXPERIENCE COUNT:", len(profile.get("experience", [])))
    else:
        print("profileData NOT FOUND IN RESPONSE")
