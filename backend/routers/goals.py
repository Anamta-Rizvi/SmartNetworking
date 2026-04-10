from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from datetime import datetime
import models
import schemas
import json

router = APIRouter(prefix="/goals", tags=["Goals"])


@router.post("/", response_model=schemas.GoalOut)
def upsert_goal(payload: schemas.GoalCreate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.query(models.Goal).filter(models.Goal.user_id == payload.user_id).first()

    interests_json = json.dumps(payload.interests or [])

    if existing:
        existing.primary_type = payload.primary_type
        existing.career_track = payload.career_track
        existing.social_intent = payload.social_intent
        existing.interests = interests_json
        existing.social_pref_note = payload.social_pref_note
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    goal = models.Goal(
        user_id=payload.user_id,
        primary_type=payload.primary_type,
        career_track=payload.career_track,
        social_intent=payload.social_intent,
        interests=interests_json,
        social_pref_note=payload.social_pref_note,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.get("/{user_id}", response_model=schemas.GoalOut)
def get_goal(user_id: int, db: Session = Depends(get_db)):
    goal = db.query(models.Goal).filter(models.Goal.user_id == user_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="No goal set for this user")
    return goal
