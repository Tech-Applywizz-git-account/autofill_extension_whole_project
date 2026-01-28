import requests
import json
import time
import os

AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://localhost:8001")
TEST_EMAIL = "test_user@example.com"

def test_pattern_upload():
    print(f"🚀 Testing pattern upload to {AI_SERVICE_URL}...")
    
    pattern_data = {
        "pattern": {
            "questionPattern": "What is your favorite color?",
            "intent": "personal.favoriteColor",
            "fieldType": "text",
            "confidence": 0.95,
            "source": "AI",
            "answerMappings": [
                {
                    "canonicalValue": "Blue",
                    "variants": ["Blue", "Light Blue"]
                }
            ]
        }
    }
    
    try:
        # 1. Upload pattern
        print(f"📤 Uploading pattern for {TEST_EMAIL}...")
        response = requests.post(
            f"{AI_SERVICE_URL}/api/patterns/upload?email={TEST_EMAIL}",
            json=pattern_data
        )
        
        print(f"📥 Response Status: {response.status_code}")
        print(f"📥 Response Body: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print("✅ Pattern upload successful!")
            else:
                print(f"❌ Pattern upload failed: {data.get('error')}")
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            
    except Exception as e:
        print(f"💥 Exception: {str(e)}")

if __name__ == "__main__":
    test_pattern_upload()
