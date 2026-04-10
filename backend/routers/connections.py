from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from datetime import datetime
from typing import Optional
import models
import schemas

router = APIRouter(prefix="/connections", tags=["Connections"])


def _get_connection_ids(user_id: int, db: Session) -> list[int]:
    rows = db.query(models.Connection).filter(
        models.Connection.status == "accepted",
        (
            (models.Connection.requester_id == user_id) |
            (models.Connection.addressee_id == user_id)
        )
    ).all()
    result = []
    for c in rows:
        other = c.addressee_id if c.requester_id == user_id else c.requester_id
        result.append(other)
    return result


def _connection_status(user_id: int, other_id: int, db: Session) -> str:
    c = db.query(models.Connection).filter(
        (
            (models.Connection.requester_id == user_id) &
            (models.Connection.addressee_id == other_id)
        ) | (
            (models.Connection.requester_id == other_id) &
            (models.Connection.addressee_id == user_id)
        )
    ).first()
    if not c:
        return "none"
    if c.status == "accepted":
        return "connected"
    if c.status == "pending":
        return "pending_sent" if c.requester_id == user_id else "pending_received"
    return "none"


# ── FIXED: search and suggestions MUST come before /{user_id} routes ──────────

@router.get("/search", response_model=list[dict])
def search_users(q: str = Query(..., min_length=1), user_id: int = Query(...), db: Session = Depends(get_db)):
    """Search users by name or email."""
    requesting_user = db.query(models.User).filter(models.User.id == user_id).first()
    university = requesting_user.university if requesting_user else "Rutgers"

    users = (
        db.query(models.User)
        .filter(
            models.User.id != user_id,
            models.User.university == university,
            (
                models.User.display_name.ilike(f"%{q}%") |
                models.User.email.ilike(f"%{q}%") |
                models.User.major.ilike(f"%{q}%")
            ),
        )
        .limit(20)
        .all()
    )

    return [
        {
            "user_id": u.id,
            "display_name": u.display_name,
            "email": u.email,
            "major": u.major,
            "grad_year": u.grad_year,
            "connection_status": _connection_status(user_id, u.id, db),
        }
        for u in users
    ]


@router.post("/request", response_model=schemas.ConnectionOut)
def send_request(payload: schemas.ConnectionCreate, db: Session = Depends(get_db)):
    if payload.requester_id == payload.addressee_id:
        raise HTTPException(status_code=400, detail="Cannot connect with yourself")

    for uid in [payload.requester_id, payload.addressee_id]:
        if not db.query(models.User).filter(models.User.id == uid).first():
            raise HTTPException(status_code=404, detail=f"User {uid} not found")

    existing = db.query(models.Connection).filter(
        (
            (models.Connection.requester_id == payload.requester_id) &
            (models.Connection.addressee_id == payload.addressee_id)
        ) | (
            (models.Connection.requester_id == payload.addressee_id) &
            (models.Connection.addressee_id == payload.requester_id)
        )
    ).first()

    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=409, detail="Already connected")
        if existing.status == "pending":
            raise HTTPException(status_code=409, detail="Request already pending")
        existing.requester_id = payload.requester_id
        existing.addressee_id = payload.addressee_id
        existing.status = "pending"
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    conn = models.Connection(
        requester_id=payload.requester_id,
        addressee_id=payload.addressee_id,
        status="pending",
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


@router.patch("/{connection_id}", response_model=schemas.ConnectionOut)
def respond_to_request(
    connection_id: int,
    payload: schemas.ConnectionStatusUpdate,
    user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    if payload.status not in ("accepted", "declined"):
        raise HTTPException(status_code=400, detail="Status must be 'accepted' or 'declined'")

    conn = db.query(models.Connection).filter(models.Connection.id == connection_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    if conn.addressee_id != user_id:
        raise HTTPException(status_code=403, detail="Only the addressee can respond")
    if conn.status != "pending":
        raise HTTPException(status_code=409, detail="Request is no longer pending")

    conn.status = payload.status
    conn.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(conn)
    return conn


@router.get("/{user_id}", response_model=list[schemas.UserOut])
def list_connections(user_id: int, db: Session = Depends(get_db)):
    friend_ids = _get_connection_ids(user_id, db)
    if not friend_ids:
        return []
    return db.query(models.User).filter(models.User.id.in_(friend_ids)).all()


@router.get("/{user_id}/pending", response_model=list[schemas.ConnectionOut])
def list_pending(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Connection).filter(
        models.Connection.addressee_id == user_id,
        models.Connection.status == "pending",
    ).order_by(models.Connection.created_at.desc()).all()


@router.get("/{user_id}/suggestions", response_model=list[dict])
def get_suggestions(user_id: int, db: Session = Depends(get_db)):
    """
    Suggest people to connect with based on shared interests and shared RSVPs.
    Excludes existing connections and pending requests.
    """
    requesting_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not requesting_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get user's tag IDs
    user_tag_ids = {
        ui.tag_id for ui in
        db.query(models.UserInterest).filter(models.UserInterest.user_id == user_id).all()
    }

    # Get events user RSVPed to
    user_event_ids = {
        r.event_id for r in
        db.query(models.RSVP).filter(models.RSVP.user_id == user_id).all()
    }

    # Get all connection IDs (both directions) to exclude
    excluded_ids = set(_get_connection_ids(user_id, db))
    pending_rows = db.query(models.Connection).filter(
        (models.Connection.requester_id == user_id) |
        (models.Connection.addressee_id == user_id)
    ).all()
    for c in pending_rows:
        excluded_ids.add(c.requester_id)
        excluded_ids.add(c.addressee_id)
    excluded_ids.add(user_id)

    # Get all other users at same university
    candidates = (
        db.query(models.User)
        .filter(
            models.User.id.notin_(excluded_ids),
            models.User.university == requesting_user.university,
        )
        .limit(50)
        .all()
    )

    scored = []
    for u in candidates:
        score = 0
        reasons = []

        # Shared interests
        their_tag_ids = {
            ui.tag_id for ui in
            db.query(models.UserInterest).filter(models.UserInterest.user_id == u.id).all()
        }
        shared_tags = user_tag_ids & their_tag_ids
        if shared_tags:
            score += len(shared_tags) * 2
            tag_names = [
                t.name for t in db.query(models.Tag).filter(models.Tag.id.in_(shared_tags)).limit(2).all()
            ]
            reasons.append(f"Shares interest in {', '.join(tag_names)}")

        # Shared RSVPs
        their_event_ids = {
            r.event_id for r in
            db.query(models.RSVP).filter(models.RSVP.user_id == u.id).all()
        }
        shared_events = user_event_ids & their_event_ids
        if shared_events:
            score += len(shared_events) * 3
            reasons.append(f"Going to {len(shared_events)} same event(s)")

        # Same major
        if u.major and requesting_user.major and u.major.lower() == requesting_user.major.lower():
            score += 2
            reasons.append(f"Same major: {u.major}")

        if score > 0:
            scored.append({
                "user_id": u.id,
                "display_name": u.display_name,
                "email": u.email,
                "major": u.major,
                "grad_year": u.grad_year,
                "connection_status": "none",
                "score": score,
                "reason": reasons[0] if reasons else "Goes to your school",
            })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:10]


@router.delete("/{connection_id}", status_code=204)
def remove_connection(connection_id: int, user_id: int = Query(...), db: Session = Depends(get_db)):
    conn = db.query(models.Connection).filter(models.Connection.id == connection_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    if conn.requester_id != user_id and conn.addressee_id != user_id:
        raise HTTPException(status_code=403, detail="Not your connection")
    db.delete(conn)
    db.commit()
