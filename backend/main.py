import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

from database import engine
import models
from routers import events, users, goals, recommendations, copilot, map, notifications, connections, uploads
from seed import seed

models.Base.metadata.create_all(bind=engine)
seed()

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

_uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(_uploads_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=_uploads_dir), name="static")


@app.get("/")
def root():
    return {"message": "Campus OS API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
