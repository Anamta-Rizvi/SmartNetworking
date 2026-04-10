from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from database import get_db
from datetime import datetime, date
import models
import schemas
from typing import List, Optional

router = APIRouter(prefix="/events", tags=["Events"])


def _event_with_tags(event: models.Event) -> schemas.EventOut:
    tags = [schemas.TagOut(id=et.tag.id, name=et.tag.name, category=et.tag.category)
            for et in event.tags if et.tag]
    return schemas.EventOut(
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
        lat=getattr(event, 'lat', None),
        lng=getattr(event, 'lng', None),
        tags=tags,
    )


@router.get("/", response_model=List[schemas.EventOut])
def list_events(
    category: Optional[str] = Query(None, description="Filter by tag category"),
    tag: Optional[str] = Query(None, description="Filter by tag name"),
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.Event)
        .options(joinedload(models.Event.tags).joinedload(models.EventTag.tag))
        .filter(models.Event.starts_at >= datetime.utcnow())
        .filter(models.Event.status == "published")
        .order_by(models.Event.starts_at)
    )

    if category or tag:
        query = query.join(models.EventTag).join(models.Tag)
        if category:
            query = query.filter(models.Tag.category == category)
        if tag:
            query = query.filter(models.Tag.name == tag)

    events = query.distinct().all()
    return [_event_with_tags(e) for e in events]


@router.get("/today", response_model=List[schemas.EventOut])
def list_today_events(db: Session = Depends(get_db)):
    today = date.today()
    events = (
        db.query(models.Event)
        .options(joinedload(models.Event.tags).joinedload(models.EventTag.tag))
        .filter(func.date(models.Event.starts_at) == today)
        .filter(models.Event.status == "published")
        .order_by(models.Event.starts_at)
        .all()
    )
    return [_event_with_tags(e) for e in events]


@router.get("/tags", response_model=List[schemas.TagOut])
def list_tags(db: Session = Depends(get_db)):
    tags = db.query(models.Tag).order_by(models.Tag.category, models.Tag.name).all()
    return tags


@router.get("/{event_id}", response_model=schemas.EventOut)
def get_event(event_id: int, db: Session = Depends(get_db)):
    event = (
        db.query(models.Event)
        .options(joinedload(models.Event.tags).joinedload(models.EventTag.tag))
        .filter(models.Event.id == event_id)
        .first()
    )
    if not event:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Event not found")
    return _event_with_tags(event)


@router.get("/{event_id}/attendees", response_model=List[schemas.RSVPAttendeeOut])
def get_attendees(
    event_id: int,
    user_id: Optional[int] = Query(None, description="Requesting user — used to compute connection_status"),
    db: Session = Depends(get_db),
):
    """Return all RSVPs for an event with connection status relative to the requesting user."""
    from routers.connections import _connection_status

    rsvps = db.query(models.RSVP).filter(models.RSVP.event_id == event_id).all()
    result = []
    for rsvp in rsvps:
        attendee = db.query(models.User).filter(models.User.id == rsvp.user_id).first()
        if not attendee:
            continue
        status = "none"
        if user_id and user_id != attendee.id:
            status = _connection_status(user_id, attendee.id, db)
        elif user_id == attendee.id:
            status = "self"
        result.append(schemas.RSVPAttendeeOut(
            user_id=attendee.id,
            display_name=attendee.display_name,
            avatar_url=attendee.avatar_url,
            connection_status=status,
        ))
    return result
