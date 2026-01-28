"""
Safe test for AWS Bedrock AI integration
Tests if credentials are configured and working WITHOUT exposing key values
"""
import requests
import json
from datetime import datetime

API_URL = "http://localhost:8001"

print("=" * 70)
print("AWS BEDROCK AI INTEGRATION TEST")
print("=" * 70)

# Test 1: Check if credentials are configured (without showing values)
print("\n[TEST 1] Checking AWS Configuration...")
print("-" * 70)

try:
    import os
    from dotenv import load_dotenv
    load_dotenv()
    
    # Check if credentials exist (NOT showing values)
    aws_key_exists = bool(os.environ.get("AWS_ACCESS_KEY_ID"))
    aws_secret_exists = bool(os.environ.get("AWS_SECRET_ACCESS_KEY"))
    aws_region = os.environ.get("AWS_REGION", "us-east-1")
    model_id = os.environ.get("BEDROCK_MODEL_ID", "us.amazon.nova-lite-v1:0")
    
    print(f"✓ AWS_ACCESS_KEY_ID configured: {aws_key_exists}")
    print(f"✓ AWS_SECRET_ACCESS_KEY configured: {aws_secret_exists}")
    print(f"✓ AWS_REGION: {aws_region}")
    print(f"✓ BEDROCK_MODEL_ID: {model_id}")
    
    if not (aws_key_exists and aws_secret_exists):
        print("\n❌ AWS credentials not found in .env file!")
        print("   Please ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set")
        exit(1)
    else:
        print("\n✅ AWS credentials are configured")
        
except Exception as e:
    print(f"❌ Error checking configuration: {e}")
    exit(1)

# Test 2: Test AI prediction endpoint
print("\n[TEST 2] Testing AI Prediction Endpoint...")
print("-" * 70)

test_request = {
    "question": "What is your gender?",
    "fieldType": "radio",
    "options": ["Male", "Female", "Non-binary", "Prefer not to say"],
    "userProfile": {
        "personal": {
            "firstName": "Mahesh",
            "gender": "Male"
        },
        "eeo": {
            "gender": "Male"
        }
    }
}

print(f"Question: {test_request['question']}")
print(f"Field Type: {test_request['fieldType']}")
print(f"Options: {test_request['options']}")

try:
    print("\nCalling /predict endpoint...")
    response = requests.post(
        f"{API_URL}/predict",
        json=test_request,
        headers={"Content-Type": "application/json"},
        timeout=30  # Bedrock can take a few seconds
    )
    
    print(f"Response Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"\n✅ AI Prediction Successful!")
        print(f"\nPrediction Details:")
        print(f"  Answer: {data.get('answer')}")
        print(f"  Confidence: {data.get('confidence')}")
        print(f"  Intent: {data.get('intent')}")
        print(f"  Reasoning: {data.get('reasoning')}")
        
        # Check if this was from pattern memory or actual AI
        if data.get('reasoning') == 'Retrieved from Pattern Memory':
            print(f"\n  📝 Note: Answer came from pattern memory (not AWS)")
        else:
            print(f"\n  🤖 Answer came from AWS Bedrock AI")
            
    else:
        print(f"\n❌ Prediction failed!")
        print(f"Response: {response.text}")
        
except requests.exceptions.Timeout:
    print("\n❌ Request timed out - AWS Bedrock may be slow or credentials invalid")
except requests.exceptions.ConnectionError:
    print("\n❌ Cannot connect to API - is the server running?")
except Exception as e:
    print(f"\n❌ Error: {e}")

# Test 3: Test with a question that WON'T be in pattern memory
print("\n[TEST 3] Testing Fresh AI Call (No Pattern Memory)...")
print("-" * 70)

unique_question = f"Tell me about your experience with project management as of {datetime.now().isoformat()}"

test_request_fresh = {
    "question": unique_question,
    "fieldType": "textarea",
    "options": [],
    "userProfile": {
        "experience": [
            {
                "title": "AML & Financial Crime Analyst",
                "company": "MTX Group",
                "bullets": ["Led AML investigations", "Automated compliance workflows"]
            }
        ]
    }
}

print(f"Question: {unique_question[:50]}...")
print(f"Field Type: {test_request_fresh['fieldType']}")

try:
    print("\nCalling /predict endpoint with unique question...")
    response = requests.post(
        f"{API_URL}/predict",
        json=test_request_fresh,
        headers={"Content-Type": "application/json"},
        timeout=30
    )
    
    print(f"Response Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        
        if data.get('reasoning') == 'Retrieved from Pattern Memory':
            print(f"\n⚠️  Answer from pattern memory (unexpected for unique question)")
        else:
            print(f"\n✅ AWS Bedrock AI is working!")
            print(f"\nAI Response:")
            print(f"  Answer: {data.get('answer')[:100]}...")
            print(f"  Confidence: {data.get('confidence')}")
            print(f"  Intent: {data.get('intent')}")
    else:
        print(f"\n❌ Prediction failed!")
        error_text = response.text
        
        # Check for common AWS errors without exposing keys
        if "credentials" in error_text.lower():
            print("  Issue: AWS credentials may be invalid")
        elif "access denied" in error_text.lower():
            print("  Issue: AWS access denied - check permissions")
        elif "region" in error_text.lower():
            print("  Issue: AWS region configuration problem")
        else:
            print(f"  Response: {error_text[:200]}")
            
except requests.exceptions.Timeout:
    print("\n❌ Request timed out after 30s")
    print("   This could mean:")
    print("   - AWS Bedrock is slow to respond")
    print("   - Credentials are incorrect")
    print("   - Network connectivity issues")
except Exception as e:
    error_msg = str(e)
    # Filter out any potential key exposure in error messages
    if "AWS_ACCESS_KEY" in error_msg or "AWS_SECRET" in error_msg:
        print(f"\n❌ AWS credential error (details hidden for security)")
    else:
        print(f"\n❌ Error: {e}")

print("\n" + "=" * 70)
print("TEST COMPLETE")
print("=" * 70)
