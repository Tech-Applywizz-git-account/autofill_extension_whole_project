# AI Service - Unified Backend

**Version:** 3.0.0  
**Port:** 8001  
**Technology:** Python + FastAPI + AWS Bedrock

## What This Service Does

This is the **unified backend** for the autofill extension. It combines three previously separate services:
- AI predictions (AWS Bedrock)
- Pattern learning (memory)
- User data management

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment variables
# Create .env file with:
# AWS_ACCESS_KEY_ID=your_key
# AWS_SECRET_ACCESS_KEY=your_secret
# AWS_REGION=us-east-1

# Run the service
uvicorn app:app --host 0.0.0.0 --port 8001

# Or use Python directly
python app.py
```

## Endpoints

### AI Predictions
- `POST /predict` - Get AI answer for a question

### Pattern Management
- `POST /api/patterns/upload` - Save new pattern
- `GET /api/patterns/search?q=question` - Search patterns
- `GET /api/patterns/stats` - Get statistics
- `GET /api/patterns/sync` - Sync all patterns

### User Data (Future)
- `POST /api/user-data/save` - Save user profile
- `GET /api/user-data/:email` - Get profile

### Resume Parsing (Future)
- `POST /parse-resume` - Parse PDF/DOCX resume

### Health
- `GET /health` - Service health check

## Architecture

```
ai-service/
├── app.py              # Main FastAPI application (all routes)
├── ai_service.py       # AWS Bedrock AI logic
├── pattern_service.py  # Pattern storage & retrieval
├── resume_service.py   # User data & resume parsing
├── models.py           # Data models (Pydantic)
├── requirements.txt    # Python dependencies
└── .env                # Environment variables (AWS credentials)
```

## Adding New Features

To add new functionality **without breaking existing code**:

1. **Create new service file:** `new_service.py`
2. **Add endpoints to** `app.py`
3. **Import and use** the new service

Example:
```python
# email_service.py
def send_email(to: str, subject: str, body: str):
    # Email logic here
    pass

# In app.py:
from email_service import send_email

@app.post("/api/email/send")
async def send_email_endpoint(request: EmailRequest):
    send_email(request.to, request.subject, request.body)
    return {"success": True}
```

## Environment Variables

```
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
PORT=8001
```

## Deployment (Render.com)

```bash
# Build command
pip install -r requirements.txt

# Start command
uvicorn app:app --host 0.0.0.0 --port $PORT
```

## Data Storage

Currently uses JSON files in `data/` folder:
- `data/patterns.json` - Learned patterns
- `data/users/*.json` - User profiles

**Future:** Can easily migrate to PostgreSQL by only changing `pattern_service.py` and `resume_service.py`.
