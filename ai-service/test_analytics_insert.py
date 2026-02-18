from analytics_service import log_analytics_event
from models import AnalyticsEvent
import time

def test_insert():
    print("🚀 Testing Analytics Insertion...")
    
    dummy_event = AnalyticsEvent(
        user_email="test_dummy@example.com",
        user_name="Test Dummy",
        url="https://example.com/job/123",
        scan_duration_ms=500,
        total_questions=10,
        mapping_duration_ms=200,
        mapped_by_rules=5,
        ai_questions_count=3,
        ai_calls_count=1,
        learned_patterns_used=2,
        filling_duration_ms=1000,
        filled_success_count=9,
        filled_failed_count=1,
        missed_questions=["Why is the sky blue?"],
        total_process_time_ms=2000
    )
    
    print(f"📦 Payload: {dummy_event.dict()}")
    
    success = log_analytics_event(dummy_event)
    
    if success:
        print("✅ SUCCESS: Dummy data inserted into Supabase!")
    else:
        print("❌ FAILED: Could not insert data. Check logs/schema.")

if __name__ == "__main__":
    test_insert()
