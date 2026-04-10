from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from database import get_db
from datetime import datetime, timedelta
from typing import Optional, List
import math
import models
import schemas
from routers.events import _event_with_tags
from routers.recommendations import _compute_score

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


@router.get("/events", response_model=List[schemas.EventOut])
def map_events(
    user_id: Optional[int] = Query(None, description="Requesting user — used to compute goal relevance"),
    sw_lat: Optional[float] = Query(None),
    sw_lng: Optional[float] = Query(None),
    ne_lat: Optional[float] = Query(None),
    ne_lng: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    """Return published events with coordinates and optional goal relevance scoring."""
    query = (
        db.query(models.Event)
        .options(joinedload(models.Event.tags).joinedload(models.EventTag.tag))
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

    # Pre-load user context for relevance scoring
    user_tag_ids: set = set()
    goal_type = "both"
    if user_id:
        user_tag_ids = {
            ui.tag_id for ui in
            db.query(models.UserInterest).filter(models.UserInterest.user_id == user_id).all()
        }
        goal = db.query(models.Goal).filter(models.Goal.user_id == user_id).first()
        if goal:
            goal_type = goal.primary_type

    result = []
    for event in events:
        tags = [schemas.TagOut(id=et.tag.id, name=et.tag.name, category=et.tag.category)
                for et in event.tags if et.tag]
        score, label = (None, None)
        if user_id:
            score, label = _compute_score(event, user_tag_ids, goal_type)
            if score == 0.0:
                score, label = None, None

        result.append(schemas.EventOut(
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
            lat=event.lat,
            lng=event.lng,
            tags=tags,
            goal_relevance_score=round(score, 3) if score is not None else None,
            goal_relevance_label=label,
        ))

    return result


@router.get("/users", response_model=List[schemas.FriendPresencePin])
def map_users(user_id: int = Query(...), db: Session = Depends(get_db)):
    """
    Return people pins for the People tab.
    Priority: real GPS location (UserLocation) — fallback to RSVP-based event location.
    Always includes the requesting user themselves (if they have a location).
    """
    from routers.connections import _get_connection_ids

    friend_ids = _get_connection_ids(user_id, db)
    result = []

    # --- Own user pin first ---
    self_user = db.query(models.User).filter(models.User.id == user_id).first()
    if self_user:
        self_loc = db.query(models.UserLocation).filter(
            models.UserLocation.user_id == user_id
        ).first()
        # Upcoming RSVP for context
        self_rsvp = _nearest_rsvp(user_id, db)
        if self_loc and _loc_valid(self_loc):
            lat, lng = (round(self_loc.lat, 3), round(self_loc.lng, 3)) if self_loc.fuzzy else (self_loc.lat, self_loc.lng)
            pin = schemas.FriendPresencePin(
                user_id=self_user.id,
                display_name="You",
                avatar_url=self_user.avatar_url,
                is_self=True,
                lat=lat,
                lng=lng,
            )
            if self_rsvp:
                ev = self_rsvp.event
                pin.event_id = ev.id
                pin.event_title = ev.title
                pin.event_location = ev.location
                pin.event_lat = ev.lat
                pin.event_lng = ev.lng
                pin.event_starts_at = ev.starts_at
            result.append(pin)

    if not friend_ids:
        return result

    # --- Connection pins ---
    # Load all connections' UserLocation records
    loc_map: dict = {}
    locs = db.query(models.UserLocation).filter(
        models.UserLocation.user_id.in_(friend_ids)
    ).all()
    for loc in locs:
        if _loc_valid(loc):
            loc_map[loc.user_id] = loc

    # Load upcoming RSVPs for all friends (event context)
    now = datetime.utcnow()
    two_hours_ago = now - timedelta(hours=2)
    rsvps = (
        db.query(models.RSVP)
        .join(models.Event, models.RSVP.event_id == models.Event.id)
        .filter(
            models.RSVP.user_id.in_(friend_ids),
            models.Event.lat.isnot(None),
            models.Event.lng.isnot(None),
            models.Event.starts_at >= two_hours_ago,
        )
        .all()
    )
    # Map friend_id → nearest rsvp
    rsvp_map: dict = {}
    for rsvp in rsvps:
        fid = rsvp.user_id
        if fid not in rsvp_map:
            rsvp_map[fid] = rsvp
        else:
            # Prefer the closest future event
            existing_start = rsvp_map[fid].event.starts_at
            new_start = rsvp.event.starts_at
            if abs((new_start - now).total_seconds()) < abs((existing_start - now).total_seconds()):
                rsvp_map[fid] = rsvp

    # Build a pin for every friend who has either a GPS loc OR an RSVP
    seen = set()
    for fid in friend_ids:
        if fid in seen:
            continue
        seen.add(fid)
        friend = db.query(models.User).filter(models.User.id == fid).first()
        if not friend:
            continue

        loc = loc_map.get(fid)
        rsvp = rsvp_map.get(fid)

        # Need at least one of: GPS or RSVP
        if not loc and not rsvp:
            continue

        pin = schemas.FriendPresencePin(
            user_id=friend.id,
            display_name=friend.display_name,
            avatar_url=friend.avatar_url,
            is_self=False,
        )

        if loc:
            # Use real GPS (respecting fuzzy)
            lat = round(loc.lat, 3) if loc.fuzzy else loc.lat
            lng = round(loc.lng, 3) if loc.fuzzy else loc.lng
            pin.lat = lat
            pin.lng = lng

        if rsvp:
            ev = rsvp.event
            pin.event_id = ev.id
            pin.event_title = ev.title
            pin.event_location = ev.location
            pin.event_lat = ev.lat
            pin.event_lng = ev.lng
            pin.event_starts_at = ev.starts_at

        result.append(pin)

    return result


def _loc_valid(loc: models.UserLocation) -> bool:
    """Check location is not expired and sharing is enabled."""
    if loc.sharing_mode == "off":
        return False
    if loc.expires_at and loc.expires_at < datetime.utcnow():
        return False
    return True


def _nearest_rsvp(user_id: int, db) -> Optional[models.RSVP]:
    now = datetime.utcnow()
    return (
        db.query(models.RSVP)
        .join(models.Event, models.RSVP.event_id == models.Event.id)
        .filter(
            models.RSVP.user_id == user_id,
            models.Event.lat.isnot(None),
            models.Event.lng.isnot(None),
            models.Event.starts_at >= now - timedelta(hours=2),
        )
        .order_by(models.Event.starts_at)
        .first()
    )


ATTEND_RADIUS_KM = 0.15  # 150 m — "at the event"


@router.get("/heatmap", response_model=List[schemas.HeatmapPoint])
def map_heatmap(db: Session = Depends(get_db)):
    """
    Return live-attendee heatmap points.
    live_count = number of RSVPed users whose GPS is within 150m of the event
                 AND the current time is between event start and end.
    rsvp_count = total RSVPs (reference only).
    """
    now = datetime.utcnow()

    # Events currently in progress (started but not ended / no end time → 3h window)
    active_events = (
        db.query(models.Event)
        .filter(
            models.Event.status == "published",
            models.Event.lat.isnot(None),
            models.Event.lng.isnot(None),
            models.Event.starts_at <= now,
        )
        .all()
    )
    active_events = [
        e for e in active_events
        if (e.ends_at or e.starts_at + timedelta(hours=3)) >= now
    ]

    # Load all active GPS locations
    all_locs = db.query(models.UserLocation).filter(
        models.UserLocation.sharing_mode != "off"
    ).all()
    valid_locs = [loc for loc in all_locs if _loc_valid(loc)]

    # Map user_id → location
    loc_by_user = {loc.user_id: loc for loc in valid_locs}

    result = []
    for event in active_events:
        # Get RSVPed user IDs
        rsvp_user_ids = {
            r.user_id for r in
            db.query(models.RSVP).filter(models.RSVP.event_id == event.id).all()
        }
        # Count how many are physically near
        live_count = 0
        for uid in rsvp_user_ids:
            loc = loc_by_user.get(uid)
            if loc:
                dist = _haversine_km(loc.lat, loc.lng, event.lat, event.lng)
                if dist <= ATTEND_RADIUS_KM:
                    live_count += 1

        result.append(schemas.HeatmapPoint(
            event_id=event.id,
            event_title=event.title,
            lat=event.lat,
            lng=event.lng,
            live_count=live_count,
            rsvp_count=event.rsvp_count,
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
