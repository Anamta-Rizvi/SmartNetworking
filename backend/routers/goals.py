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


# ── Dashboard ────────────────────────────────────────────────────────────────

def _compute_progress(milestones: list) -> float:
    if not milestones:
        return 0.0
    total = sum(m["target_count"] for m in milestones)
    done = sum(min(m["current_count"], m["target_count"]) for m in milestones)
    return round(done / total, 3) if total > 0 else 0.0


@router.get("/{user_id}/dashboard", response_model=schemas.GoalDashboard)
def get_dashboard(user_id: int, db: Session = Depends(get_db)):
    goal = db.query(models.Goal).filter(models.Goal.user_id == user_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="No goal set for this user")

    career_milestones = json.loads(goal.career_milestones or "[]")
    social_milestones = json.loads(goal.social_milestones or "[]")

    goal_events = (
        db.query(models.GoalEvent)
        .filter(models.GoalEvent.user_id == user_id)
        .order_by(models.GoalEvent.added_at.desc())
        .all()
    )
    career_events = [ge for ge in goal_events if ge.goal_type == "career"]
    social_events = [ge for ge in goal_events if ge.goal_type == "social"]

    return schemas.GoalDashboard(
        goal_id=goal.id,
        primary_type=goal.primary_type,
        career_milestones=[schemas.Milestone(**m) for m in career_milestones],
        social_milestones=[schemas.Milestone(**m) for m in social_milestones],
        career_events=career_events,
        social_events=social_events,
        career_progress=_compute_progress(career_milestones),
        social_progress=_compute_progress(social_milestones),
    )


@router.post("/{user_id}/events", response_model=schemas.GoalEventOut)
def add_goal_event(user_id: int, payload: schemas.GoalEventCreate, db: Session = Depends(get_db)):
    goal = db.query(models.Goal).filter(models.Goal.user_id == user_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="No goal set for this user")
    event = db.query(models.Event).filter(models.Event.id == payload.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Avoid duplicates for the same goal_type
    existing = db.query(models.GoalEvent).filter(
        models.GoalEvent.user_id == user_id,
        models.GoalEvent.event_id == payload.event_id,
        models.GoalEvent.goal_type == payload.goal_type,
    ).first()
    if existing:
        return existing

    ge = models.GoalEvent(
        user_id=user_id,
        goal_id=goal.id,
        event_id=payload.event_id,
        goal_type=payload.goal_type,
        contribution_score=payload.contribution_score,
        contribution_label=payload.contribution_label,
        added_by=payload.added_by,
    )
    db.add(ge)
    db.commit()
    db.refresh(ge)
    return ge


@router.patch("/{user_id}/events/{event_id}", response_model=schemas.GoalEventOut)
def update_attendance(
    user_id: int,
    event_id: int,
    payload: schemas.GoalEventAttendance,
    goal_type: str = "career",
    db: Session = Depends(get_db),
):
    ge = db.query(models.GoalEvent).filter(
        models.GoalEvent.user_id == user_id,
        models.GoalEvent.event_id == event_id,
        models.GoalEvent.goal_type == goal_type,
    ).first()
    if not ge:
        raise HTTPException(status_code=404, detail="Goal event not found")

    ge.attended = payload.attended

    # If attended, increment relevant milestone current_count
    if payload.attended:
        goal = db.query(models.Goal).filter(models.Goal.id == ge.goal_id).first()
        field = "career_milestones" if goal_type == "career" else "social_milestones"
        milestones = json.loads(getattr(goal, field) or "[]")
        if milestones:
            milestones[0]["current_count"] = milestones[0].get("current_count", 0) + 1
            setattr(goal, field, json.dumps(milestones))
            goal.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(ge)
    return ge


@router.delete("/{user_id}/events/{event_id}", status_code=204)
def remove_goal_event(user_id: int, event_id: int, goal_type: str = "career", db: Session = Depends(get_db)):
    ge = db.query(models.GoalEvent).filter(
        models.GoalEvent.user_id == user_id,
        models.GoalEvent.event_id == event_id,
        models.GoalEvent.goal_type == goal_type,
    ).first()
    if ge:
        db.delete(ge)
        db.commit()


@router.get("/{user_id}/schedule-fit/{event_id}")
def schedule_fit(user_id: int, event_id: int, db: Session = Depends(get_db)):
    """
    Basic schedule fit check: returns whether the event overlaps any other RSVPed event.
    Extend this with calendar data for richer conflict detection.
    """
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if not event.starts_at or not event.ends_at:
        return {"fits": True, "conflicts": []}

    rsvps = db.query(models.RSVP).filter(models.RSVP.user_id == user_id).all()
    conflicts = []
    for rsvp in rsvps:
        other = db.query(models.Event).filter(models.Event.id == rsvp.event_id).first()
        if not other or other.id == event_id or not other.ends_at:
            continue
        # Overlap check
        if other.starts_at < event.ends_at and other.ends_at > event.starts_at:
            conflicts.append({"event_id": other.id, "title": other.title})

    return {"fits": len(conflicts) == 0, "conflicts": conflicts}
