import requests
import json
from datetime import datetime

# URL of the endpoint
url = "http://localhost:8001/api/analytics/track"

# Dummy analytics payload
payload = {
    "user_email": "endpoint_test@example.com",
    "user_name": "Endpoint Tester",
    "url": "http://localhost:8001/test",
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
    "missed_questions": [],
    "total_process_time_ms": 1000
}

try:
    print(f"🚀 Sending POST request to {url}...")
    response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
    
    print(f"📡 Status Code: {response.status_code}")
    print(f"📄 Response Body: {response.text}")
    
    if response.status_code == 200:
        print("✅ SUCCESS: Endpoint is active and working!")
    elif response.status_code == 404:
        print("❌ FAILED: Endpoint not found (404). Server is STALE.")
    elif response.status_code == 422:
        print("⚠️ VALIDATION ERROR (422). Endpoint exists but payload issue.")
    else:
        print(f"⚠️ UNEXPECTED STATUS: {response.status_code}")
        
except Exception as e:
    print(f"❌ CONNECTION ERROR: {e}")
    print("Backend server might be down or unreachable.")
