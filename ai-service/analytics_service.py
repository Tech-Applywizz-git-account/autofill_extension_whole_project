"""
Analytics Service - Handles tracking of extension usage metrics
Stores data in 'extension_analytics' table in Supabase
"""
from datetime import datetime
from models import AnalyticsEvent
from supabase_client import supabase
import json

def log_analytics_event(event: AnalyticsEvent) -> bool:
    """
    Log an analytics event to Supabase
    """
    try:
        # Convert Pydantic model to dict
        data = event.dict()
        
        # Add timestamp if not present (handled by DB default, but good for explicit)
        # data['created_at'] = datetime.now().isoformat()
        
        # Ensure missed_questions is JSON serializable (List[str] -> list)
        if data.get('missed_questions') is None:
            data['missed_questions'] = []
            
        print(f"📊 Logging analytics event for {data.get('user_email', 'unknown user')} on {data.get('url')}")
        
        # Insert into Supabase
        result = supabase.table('extension_analytics').insert(data).execute()
        
        if result.data:
            print(f"✅ Analytics data saved successfully. ID: {result.data[0].get('id')}")
            return True
        else:
            print("⚠️ Analytics save returned no data (check RLS policies if this persists)")
            return False
            
    except Exception as e:
        print(f"❌ Error saving analytics event: {str(e)}")
        # Don't throw - analytics failure shouldn't break the app
        return False
