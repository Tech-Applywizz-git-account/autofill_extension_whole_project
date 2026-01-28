import os
import requests
from dotenv import load_dotenv
from typing import Optional, Any, Dict, List

load_dotenv()

class SupabaseResponse:
    def __init__(self, data: Any = None, error: Any = None, count: Optional[int] = None):
        self.data = data
        self.error = error
        self.count = count

class SupabaseClient:
    def __init__(self):
        self.url = os.environ.get("SUPABASE_URL") or ""
        # Use SERVICE_ROLE_KEY for backend operations to bypass RLS
        self.key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY") or ""
        self.headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    def table(self, table_name: str):
        return SupabaseTable(self.url, self.headers, table_name)

class SupabaseTable:
    def __init__(self, base_url: str, headers: dict, table_name: str):
        self.url = f"{base_url}/rest/v1/{table_name}"
        self.headers = headers.copy()
        self.params = {}
        self.method = "GET"
        self.json_data = None

    def select(self, query: str = "*", count: Optional[str] = None):
        self.params["select"] = query
        if count:
            self.headers["Prefer"] = f"count={count}"
        return self

    def insert(self, data: Any):
        self.method = "POST"
        self.json_data = data
        return self

    def upsert(self, data: dict, on_conflict: str = None):
        self.method = "POST"
        self.headers["Prefer"] = f"resolution=merge-duplicates,return=representation"
        if on_conflict:
            self.params["on_conflict"] = on_conflict
        self.json_data = data
        return self

    def eq(self, column: str, value: Any):
        self.params[column] = f"eq.{value}"
        return self

    def gte(self, column: str, value: Any):
        self.params[column] = f"gte.{value}"
        return self

    def execute(self) -> SupabaseResponse:
        try:
            if self.method == "GET":
                response = requests.get(self.url, headers=self.headers, params=self.params)
            elif self.method == "POST":
                response = requests.post(self.url, headers=self.headers, params=self.params, json=self.json_data)
            else:
                return SupabaseResponse(error=f"Unsupported method: {self.method}")

            return self._handle_response(response)
        except Exception as e:
            return SupabaseResponse(error=str(e))

    def _handle_response(self, response) -> SupabaseResponse:
        data = None
        error = None
        count = None

        # Extract count from Content-Range header if present
        # Format: 0-9/100
        content_range = response.headers.get("Content-Range")
        if content_range and "/" in content_range:
            try:
                count = int(content_range.split("/")[-1])
            except:
                pass

        if response.status_code in [200, 201]:
            data = response.json()
        elif response.status_code == 204:
            data = None
        else:
            try:
                error = response.json()
            except:
                error = response.text

        return SupabaseResponse(data=data, error=error, count=count)

supabase = SupabaseClient()
