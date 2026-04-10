from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from datetime import datetime, timedelta
from typing import Optional
import math
import models
import schemas
from routers.events import _event_with_tags

router = APIRouter(prefix="/map", tags=["Map"])


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _fuzzy(lat: float, lng: float) -> tuple[float, float]:
    """Round to ~100m building-level precision."""
    return round(lat, 3), round(lng, 3)


@router.get("/events", response_model=list[schemas.EventOut])
def map_events(
    sw_lat: Optional[float] = Query(None),
    sw_lng: Optional[float] = Query(None),
    ne_lat: Optional[float] = Query(None),
    ne_lng: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    """Return published events that have coordinates, optionally filtered by bounding box."""
    query = (
        db.query(models.Event)
        .filter(
            models.Event.status == "published",
            models.Event.lat.isnot(None),
            models.Event.lng.isnot(None),
        )
    )
    if all(v is not None for v in [sw_lat, sw_lng, ne_lat, ne_lng]):
        query = query.filter(
            models.Event.lat >= sw_lat,
            models.Event.lat <= ne_lat,
            models.Event.lng >= sw_lng,
            models.Event.lng <= ne_lng,
        )
    events = query.order_by(models.Event.starts_at).all()
    return [_event_with_tags(e) for e in events]


@router.get("/users", response_model=list[schemas.FriendPresencePin])
def map_users(user_id: int = Query(...), db: Session = Depends(get_db)):
    """
    Return RSVP-based friend presence pins.
    Shows accepted connections who have RSVPed to upcoming events (with coordinates).
    Friend pins are placed at the event location — no real GPS used.
    """
    from routers.connections import _get_connection_ids

    friend_ids = _get_connection_ids(user_id, db)
    if not friend_ids:
        return []

    now = datetime.utcnow()
    two_hours_ago = datetime.utcfromtimestamp(now.timestamp() - 7200)

    rsvps = (
        db.query(models.RSVP)
        .join(models.Event, models.RSVP.event_id == models.Event.id)
        .filter(
            models.RSVP.user_id.in_(friend_ids),
            models.Event.lat.isnot(None),
            models.Event.lng.isnot(None),
            models.Event.starts_at >= two_hours_ago,  # include events up to 2h after start
        )
        .all()
    )

    result = []
    for rsvp in rsvps:
        friend = db.query(models.User).filter(models.User.id == rsvp.user_id).first()
        event = rsvp.event
        if not friend or not event:
            continue
        result.append(schemas.FriendPresencePin(
            user_id=friend.id,
            display_name=friend.display_name,
            avatar_url=friend.avatar_url,
            event_id=event.id,
            event_title=event.title,
            event_location=event.location,
            event_lat=event.lat,
            event_lng=event.lng,
            event_starts_at=event.starts_at,
        ))

    return result


@router.post("/users/{user_id}/location", response_model=schemas.UserLocationOut)
def update_location(user_id: int, payload: schemas.UserLocationUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    expires_at = None
    if payload.expires_minutes:
        expires_at = datetime.utcnow() + timedelta(minutes=payload.expires_minutes)

    loc = db.query(models.UserLocation).filter(models.UserLocation.user_id == user_id).first()
    if loc:
        loc.lat = payload.lat
        loc.lng = payload.lng
        loc.sharing_mode = payload.sharing_mode
        loc.fuzzy = payload.fuzzy
        loc.expires_at = expires_at
        loc.updated_at = datetime.utcnow()
    else:
        loc = models.UserLocation(
            user_id=user_id,
            lat=payload.lat,
            lng=payload.lng,
            sharing_mode=payload.sharing_mode,
            fuzzy=payload.fuzzy,
            expires_at=expires_at,
        )
        db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc


@router.delete("/users/{user_id}/location", status_code=204)
def clear_location(user_id: int, db: Session = Depends(get_db)):
    """Go offline / enable ghost mode by deleting location record."""
    loc = db.query(models.UserLocation).filter(models.UserLocation.user_id == user_id).first()
    if loc:
        db.delete(loc)
        db.commit()
