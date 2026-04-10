from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from database import get_db
from datetime import datetime
import models
import schemas
from typing import List

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


def _compute_score(event: models.Event, user_tag_ids: set, goal_type: str) -> tuple[float, str]:
    event_tag_ids = {et.tag_id for et in event.tags}
    event_tag_names = {et.tag.name for et in event.tags if et.tag}
    event_categories = {et.tag.category for et in event.tags if et.tag}

    # Tag overlap score (0–1)
    overlap = len(event_tag_ids & user_tag_ids)
    tag_score = overlap / max(len(event_tag_ids), 1)

    # Recency score — events sooner score higher, within a 14-day window
    now = datetime.utcnow()
    days_until = (event.starts_at - now).total_seconds() / 86400
    if days_until < 0:
        return 0.0, ""
    recency_score = max(0.0, 1.0 - days_until / 14.0)

    # Goal alignment bonus
    goal_score = 0.0
    if goal_type == "career" and "career" in event_categories:
        goal_score = 1.0
    elif goal_type == "social" and ("social" in event_categories or "hobby" in event_categories):
        goal_score = 1.0
    elif goal_type == "both":
        goal_score = 0.5

    final = 0.45 * tag_score + 0.30 * recency_score + 0.25 * goal_score

    # Build reason string
    matched = list(event_tag_names & {name for name in event_tag_names})[:3]
    if overlap > 0:
        reason = f"Matches your interest in {', '.join(list(event_tag_names)[:2])}."
    elif goal_type in ("career", "both") and "career" in event_categories:
        reason = "Relevant to your career goals."
    elif goal_type in ("social", "both") and ("social" in event_categories or "hobby" in event_categories):
        reason = "Aligns with your social and hobby goals."
    else:
        reason = "Happening soon on campus."

    return round(final, 4), reason


@router.get("/{user_id}", response_model=List[schemas.RecommendationOut])
def get_recommendations(user_id: int, limit: int = 20, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get user tag IDs
    user_tag_ids = {
        ui.tag_id for ui in
        db.query(models.UserInterest).filter(models.UserInterest.user_id == user_id).all()
    }

    # Get goal type
    goal = db.query(models.Goal).filter(models.Goal.user_id == user_id).first()
    goal_type = goal.primary_type if goal else "both"

    # Get all upcoming published events
    events = (
        db.query(models.Event)
        .options(joinedload(models.Event.tags).joinedload(models.EventTag.tag))
        .filter(models.Event.starts_at >= datetime.utcnow())
        .filter(models.Event.status == "published")
        .all()
    )

    scored = []
    for event in events:
        score, reason = _compute_score(event, user_tag_ids, goal_type)
        if score > 0:
            tags = [schemas.TagOut(id=et.tag.id, name=et.tag.name, category=et.tag.category)
                    for et in event.tags if et.tag]
            event_out = schemas.EventOut(
                id=event.id,
                title=event.title,
                description=event.description,
                location=event.location,
                organizer=event.organizer,
                starts_at=event.starts_at,
                ends_at=event.ends_at,
                is_virtual=event.is_virtual,
                cover_image_url=event.cover_image_url,
                rsvp_count=event.rsvp_count,
                tags=tags,
            )
            scored.append(schemas.RecommendationOut(event=event_out, score=score, reason=reason))

    scored.sort(key=lambda x: x.score, reverse=True)
    return scored[:limit]
