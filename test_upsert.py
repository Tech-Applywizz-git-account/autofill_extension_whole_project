import os
import sys

# Add ai-service to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'ai-service'))

from resume_service import backup_user_data, get_master_restore
from models import Pattern

def run_test():
    test_email = "test.upsert@example.com"
    profile_data = {
        "personal": {
            "firstName": "Test",
            "lastName": "User"
        }
    }
    
    # Simulating a cache entry from Chrome Extension
    # Key format: question|fieldType|optionsHash
    ai_cache_initial = {
        "What is your expected salary?|number|": {
            "answer": "100000",
            "confidence": 0.95,
            "intent": "salary.expected"
        },
         "Do you have a clearance?|radio|hash123": {
            "answer": "No",
            "confidence": 0.85,
            "intent": "clearance.status"
        }
    }

    print("--- [TEST 1] Initial Insertion ---")
    success1 = backup_user_data(test_email, profile_data, [], ai_cache_initial)
    print(f"Insert Success: {success1}")
    
    if not success1:
        print("Failed on insert, aborting.")
        return

    # Verify state
    master1 = get_master_restore(test_email)
    print(f"Master Restore Cache Keys: {list(master1.get('aiCache', {}).keys())}")

    print("\n--- [TEST 2] Upsert / Update ---")
    # Simulate user changing their mind in the extension and saving again
    ai_cache_update = {
        "What is your expected salary?|number|": {
            "answer": "120000",  # Changed
            "confidence": 1.0,   # Changed
            "intent": "salary.expected"
        },
        "Do you have a clearance?|radio|hash123": {
            "answer": "No",
            "confidence": 0.85,
            "intent": "clearance.status"
        },
        "New Question?|text|": { # Brand new
            "answer": "Yes",
            "confidence": 0.99,
            "intent": "unknown"
        }
    }

    success2 = backup_user_data(test_email, profile_data, [], ai_cache_update)
    print(f"Update Success: {success2}")
    
    master2 = get_master_restore(test_email)
    updated_cache = master2.get('aiCache', {})
    print(f"Master Restore Cache Keys: {list(updated_cache.keys())}")
    
    salary_entry = updated_cache.get("What is your expected salary?|number|", {})
    print(f"Updated Salary Answer: {salary_entry.get('answer')} (Expected: 120000)")
    
    print("\nTest completed.")

if __name__ == "__main__":
    run_test()
