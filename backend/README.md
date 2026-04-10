# Campus OS — Backend API

FastAPI backend for Campus OS, an intelligent campus platform that helps students discover events, set goals, and get AI-powered guidance for career and social outcomes.

## Tech Stack

- **Framework**: FastAPI
- **Database**: SQLite (via SQLAlchemy)
- **AI**: OpenAI API (used by Campus Copilot)
- **Runtime**: Python 3.10+

## Project Structure

```
backend/
├── main.py           # App entry point, middleware, router registration
├── database.py       # SQLAlchemy engine and session setup
├── models.py         # Database models
├── schemas.py        # Pydantic request/response schemas
├── seed.py           # Database seeding
├── requirements.txt  # Python dependencies
├── campus_os.db      # SQLite database (auto-created on first run)
└── routers/
    ├── events.py         # Event discovery endpoints
    ├── users.py          # User profile endpoints
    ├── goals.py          # Goal tracking endpoints
    ├── recommendations.py # AI-powered event recommendations
    └── copilot.py        # Campus Copilot AI assistant
```

## Setup

### 1. Create and activate virtual environment

```bash
python3 -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Set environment variables

Create a `.env` file in the `backend/` directory:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

> The OpenAI key is required for the `/copilot` endpoints. All other endpoints work without it.

## Running the Server

```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`.

## API Docs

FastAPI auto-generates interactive docs:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| GET | `/health` | Health status |
| GET | `/events` | List all events |
| POST | `/users` | Create user profile |
| GET | `/users/{id}` | Get user profile |
| POST | `/goals` | Set a user goal |
| GET | `/recommendations/{user_id}` | Get personalized event recommendations |
| POST | `/copilot` | Chat with Campus Copilot AI |

## Notes

- The SQLite database (`campus_os.db`) and seed data are created automatically on first run.
- CORS is open to all origins (`*`) — restrict this before deploying to production.
