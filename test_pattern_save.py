"""
Test script to verify pattern save/upload functionality
"""
import requests
import json
from datetime import datetime

# Test pattern data
test_pattern = {
    "id": f"test_pattern_{int(datetime.now().timestamp())}",
    "questionPattern": "What is your desired salary range?",
    "intent": "application.salaryExpectation",
    "canonicalKey": "application.salaryExpectation",
    "fieldType": "text",
    "confidence": 0.95,
    "source": "AI",
    "answerMappings": [
        {
            "canonicalValue": "$80,000 - $100,000",
            "variants": ["$80,000 - $100,000", "80k-100k"],
            "contextOptions": []
        }
    ]
}

# Test user email
user_email = "errojunikhil@gmail.com"

print("=" * 60)
print("TESTING PATTERN SAVE FUNCTIONALITY")
print("=" * 60)

# Test 1: Upload pattern endpoint
print("\n[TEST 1] Testing /api/patterns/upload endpoint...")
print(f"User Email: {user_email}")
print(f"Pattern: {test_pattern['questionPattern']}")

try:
    # Try the upload endpoint (needs email in query params based on patternStorage.ts line 482)
    url = f"http://localhost:8001/api/patterns/upload?email={user_email}"
    
    response = requests.post(
        url,
        json={"pattern": test_pattern},
        headers={"Content-Type": "application/json"}
    )
    
    print(f"\nResponse Status: {response.status_code}")
    print(f"Response Body: {json.dumps(response.json(), indent=2)}")
    
    if response.status_code == 200 and response.json().get("success"):
        print("\n✅ Pattern saved successfully!")
    else:
        print("\n❌ Pattern save failed!")
        
except Exception as e:
    print(f"\n❌ Error: {e}")

# Test 2: Verify pattern was saved by fetching user patterns
print("\n" + "=" * 60)
print("[TEST 2] Verifying pattern was saved...")

try:
    response = requests.get(f"http://localhost:8001/api/patterns/user/{user_email}")
    data = response.json()
    
    patterns = data.get("patterns", [])
    print(f"\nTotal patterns for user: {len(patterns)}")
    
    # Check if our test pattern is in the list
    found = False
    for p in patterns:
        if p.get("question_pattern") == test_pattern["questionPattern"]:
            found = True
            print(f"\n✅ Test pattern found in database!")
            print(f"   ID: {p.get('id')}")
            print(f"   Intent: {p.get('intent')}")
            print(f"   Created: {p.get('created_at')}")
            break
    
    if not found:
        print(f"\n❌ Test pattern NOT found in database")
        print("\nAll patterns in database:")
        for i, p in enumerate(patterns, 1):
            print(f"   {i}. {p.get('question_pattern')} (intent: {p.get('intent')})")
            
except Exception as e:
    print(f"\n❌ Error verifying: {e}")

print("\n" + "=" * 60)
print("TEST COMPLETE")
print("=" * 60)
