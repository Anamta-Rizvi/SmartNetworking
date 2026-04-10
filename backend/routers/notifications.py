from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from datetime import datetime
from typing import Optional
import math
import models
import schemas

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6_371_000.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@router.get("/preferences/{user_id}", response_model=schemas.NotificationPrefOut)
def get_preferences(user_id: int, db: Session = Depends(get_db)):
    prefs = db.query(models.NotificationPreference).filter(
        models.NotificationPreference.user_id == user_id
    ).first()
    if not prefs:
        # Return defaults without persisting
        return schemas.NotificationPrefOut(
            user_id=user_id,
            event_proximity=True,
            peer_proximity=False,
            friend_proximity=True,
            radius_meters=300,
            schedule_aware=True,
        )
    return prefs


@router.post("/preferences", response_model=schemas.NotificationPrefOut)
def upsert_preferences(payload: schemas.NotificationPrefUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    prefs = db.query(models.NotificationPreference).filter(
        models.NotificationPreference.user_id == payload.user_id
    ).first()

    if prefs:
        prefs.event_proximity = payload.event_proximity
        prefs.peer_proximity = payload.peer_proximity
        prefs.friend_proximity = payload.friend_proximity
        prefs.radius_meters = payload.radius_meters
        prefs.schedule_aware = payload.schedule_aware
        prefs.updated_at = datetime.utcnow()
    else:
        prefs = models.NotificationPreference(
            user_id=payload.user_id,
            event_proximity=payload.event_proximity,
            peer_proximity=payload.peer_proximity,
            friend_proximity=payload.friend_proximity,
            radius_meters=payload.radius_meters,
            schedule_aware=payload.schedule_aware,
        )
        db.add(prefs)
    db.commit()
    db.refresh(prefs)
    return prefs


@router.get("/nearby")
def nearby_events(
    lat: float = Query(...),
    lng: float = Query(...),
    user_id: int = Query(...),
    radius: Optional[int] = Query(None, description="Override radius in meters"),
    db: Session = Depends(get_db),
):
    """
    Return upcoming events within the user's proximity radius.
    Used by the mobile background geofencing task to decide whether to fire a notification.
    """
    prefs = db.query(models.NotificationPreference).filter(
        models.NotificationPreference.user_id == user_id
    ).first()
    radius_m = radius or (prefs.radius_meters if prefs else 300)

    now = datetime.utcnow()
    events = (
        db.query(models.Event)
        .filter(
            models.Event.status == "published",
            models.Event.lat.isnot(None),
            models.Event.lng.isnot(None),
            models.Event.starts_at > now,
        )
        .all()
    )

    nearby = []
    for event in events:
        dist = _haversine_meters(lat, lng, event.lat, event.lng)
        if dist <= radius_m:
            nearby.append({
                "event_id": event.id,
                "title": event.title,
                "location": event.location,
                "starts_at": event.starts_at.isoformat(),
                "distance_meters": round(dist),
                "lat": event.lat,
                "lng": event.lng,
            })

    nearby.sort(key=lambda e: e["distance_meters"])
    return {"radius_meters": radius_m, "nearby": nearby}
