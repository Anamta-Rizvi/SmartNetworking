import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

from database import engine
import models
from routers import events, users, goals, recommendations, copilot, map, notifications, connections, uploads, schedule, companies, referrals, chat, feed
from seed import seed

models.Base.metadata.create_all(bind=engine)
seed()

# ── Migration: rebuild goals table to remove unique(user_id) and add status ──
def _migrate_goals():
    from sqlalchemy import text
    with engine.connect() as conn:
        # Check if goals table has a unique index on user_id
        indexes = conn.execute(text("PRAGMA index_list('goals')")).fetchall()
        unique_on_user = any(
            idx[2] == 1  # unique flag
            for idx in indexes
            if any(
                col[2] == 'user_id'
                for col in conn.execute(text(f"PRAGMA index_info('{idx[1]}')")).fetchall()
            )
        )
        # Check if status column exists
        cols = {row[1] for row in conn.execute(text("PRAGMA table_info('goals')")).fetchall()}
        has_status = 'status' in cols

        if not unique_on_user and has_status:
            return  # nothing to do

        # Rebuild table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS goals_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                primary_type VARCHAR DEFAULT 'both',
                career_track VARCHAR,
                social_intent VARCHAR,
                interests VARCHAR,
                social_pref_note VARCHAR,
                career_milestones TEXT,
                social_milestones TEXT,
                status VARCHAR DEFAULT 'ongoing',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))
        existing_cols = ', '.join(c for c in [
            'id', 'user_id', 'primary_type', 'career_track', 'social_intent',
            'interests', 'social_pref_note', 'career_milestones', 'social_milestones',
            'created_at', 'updated_at'
        ] if c in cols)
        conn.execute(text(f"""
            INSERT INTO goals_new ({existing_cols}, status)
            SELECT {existing_cols}, 'ongoing' FROM goals
        """))
        conn.execute(text("DROP TABLE goals"))
        conn.execute(text("ALTER TABLE goals_new RENAME TO goals"))
        conn.commit()

_migrate_goals()

app = FastAPI(title="Campus OS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router)
app.include_router(users.router)
app.include_router(goals.router)
app.include_router(recommendations.router)
app.include_router(copilot.router)
app.include_router(map.router)
app.include_router(notifications.router)
app.include_router(connections.router)
app.include_router(uploads.router)
app.include_router(schedule.router)
app.include_router(companies.router)
app.include_router(referrals.router)
app.include_router(chat.router)
app.include_router(feed.router)

_uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(_uploads_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=_uploads_dir), name="static")


@app.get("/")
def root():
    return {"message": "Campus OS API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
