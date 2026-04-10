from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from database import get_db
from datetime import datetime, timedelta
from typing import List, Optional
import models
import schemas
import os
from openai import AzureOpenAI

router = APIRouter(prefix="/chat", tags=["Chat"])

client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY", "placeholder"),
    azure_endpoint=os.getenv("AZURE_OPENAI_BASE_URL", "https://placeholder.openai.azure.com/"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
)
CHAT_MODEL = os.getenv("AZURE_OPENAI_CHAT_MODEL", "gpt-4o")


def _is_connected(user_id: int, other_id: int, db: Session) -> bool:
    return db.query(models.Connection).filter(
        or_(
            and_(models.Connection.requester_id == user_id, models.Connection.addressee_id == other_id),
            and_(models.Connection.requester_id == other_id, models.Connection.addressee_id == user_id),
        ),
        models.Connection.status == "accepted",
    ).first() is not None


@router.get("/{user_id}/conversations", response_model=List[schemas.ConversationOut])
def list_conversations(user_id: int, db: Session = Depends(get_db)):
    """Return all conversations for a user, each with the peer's info and last message."""
    # Find all users this person has exchanged messages with
    sent = db.query(models.DirectMessage.receiver_id).filter(
        models.DirectMessage.sender_id == user_id
    ).distinct().all()
    received = db.query(models.DirectMessage.sender_id).filter(
        models.DirectMessage.receiver_id == user_id
    ).distinct().all()

    peer_ids = {r[0] for r in sent} | {r[0] for r in received}
    conversations: List[schemas.ConversationOut] = []

    for peer_id in peer_ids:
        peer = db.query(models.User).filter(models.User.id == peer_id).first()
        if not peer:
            continue

        last_msg = (
            db.query(models.DirectMessage)
            .filter(
                or_(
                    and_(models.DirectMessage.sender_id == user_id, models.DirectMessage.receiver_id == peer_id),
                    and_(models.DirectMessage.sender_id == peer_id, models.DirectMessage.receiver_id == user_id),
                )
            )
            .order_by(models.DirectMessage.created_at.desc())
            .first()
        )

        unread = db.query(models.DirectMessage).filter(
            models.DirectMessage.sender_id == peer_id,
            models.DirectMessage.receiver_id == user_id,
            models.DirectMessage.read_at.is_(None),
        ).count()

        peer_out = schemas.UserOut.from_orm(peer)
        last_out = schemas.DirectMessageOut.from_orm(last_msg) if last_msg else None

        conversations.append(
            schemas.ConversationOut(peer=peer_out, last_message=last_out, unread_count=unread)
        )

    # Sort by last message time descending
    conversations.sort(
        key=lambda c: c.last_message.created_at if c.last_message else datetime.min,
        reverse=True,
    )
    return conversations


@router.get("/{user_id}/messages/{peer_id}", response_model=List[schemas.DirectMessageOut])
def get_messages(user_id: int, peer_id: int, db: Session = Depends(get_db)):
    """Return all messages between two users. Marks unread as read."""
    messages = (
        db.query(models.DirectMessage)
        .filter(
            or_(
                and_(models.DirectMessage.sender_id == user_id, models.DirectMessage.receiver_id == peer_id),
                and_(models.DirectMessage.sender_id == peer_id, models.DirectMessage.receiver_id == user_id),
            )
        )
        .order_by(models.DirectMessage.created_at.asc())
        .all()
    )
    # Mark unread messages from peer as read
    for msg in messages:
        if msg.receiver_id == user_id and msg.read_at is None:
            msg.read_at = datetime.utcnow()
    db.commit()
    return messages


@router.post("/send", response_model=schemas.DirectMessageOut)
def send_message(payload: schemas.DirectMessageCreate, db: Session = Depends(get_db)):
    """Send a direct message to a connection."""
    if not _is_connected(payload.sender_id, payload.receiver_id, db):
        raise HTTPException(status_code=403, detail="You can only message accepted connections")
    msg = models.DirectMessage(**payload.dict())
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.get("/{user_id}/referral-suggestions")
def referral_suggestions(user_id: int, db: Session = Depends(get_db)):
    """
    Return connections made in the last 48 hours, grouped by event,
    so the AI can suggest asking them for a referral.
    """
    cutoff = datetime.utcnow() - timedelta(hours=48)

    # Accepted connections made recently
    recent_connections = db.query(models.Connection).filter(
        or_(
            models.Connection.requester_id == user_id,
            models.Connection.addressee_id == user_id,
        ),
        models.Connection.status == "accepted",
        models.Connection.updated_at >= cutoff,
    ).all()

    if not recent_connections:
        return {"suggestions": []}

    peer_ids = []
    for conn in recent_connections:
        peer_id = conn.addressee_id if conn.requester_id == user_id else conn.requester_id
        peer_ids.append(peer_id)

    # Find events they shared RSVPs for (as the meeting context)
    peers_with_event: list = []
    for peer_id in peer_ids:
        peer = db.query(models.User).filter(models.User.id == peer_id).first()
        if not peer:
            continue
        # Find the most recent shared event (both RSVPed)
        shared_rsvp = (
            db.query(models.RSVP)
            .filter(
                models.RSVP.user_id == peer_id,
                models.RSVP.event_id.in_(
                    db.query(models.RSVP.event_id).filter(models.RSVP.user_id == user_id)
                ),
            )
            .join(models.Event, models.Event.id == models.RSVP.event_id)
            .order_by(models.Event.starts_at.desc())
            .first()
        )
        shared_event = None
        if shared_rsvp:
            shared_event = db.query(models.Event).filter(
                models.Event.id == shared_rsvp.event_id
            ).first()

        peers_with_event.append({
            "user_id": peer.id,
            "display_name": peer.display_name,
            "major": peer.major,
            "avatar_url": peer.avatar_url,
            "shared_event_id": shared_event.id if shared_event else None,
            "shared_event_title": shared_event.title if shared_event else None,
        })

    return {"suggestions": peers_with_event}


@router.post("/bulk-ai-message", response_model=List[schemas.DirectMessageOut])
def bulk_ai_message(payload: schemas.BulkAIMessageRequest, db: Session = Depends(get_db)):
    """
    Draft and send a personalized AI referral-request message to multiple connections.
    """
    sender = db.query(models.User).filter(models.User.id == payload.sender_id).first()
    if not sender:
        raise HTTPException(status_code=404, detail="Sender not found")

    goal = db.query(models.Goal).filter(models.Goal.user_id == payload.sender_id).first()
    event = None
    if payload.event_id:
        event = db.query(models.Event).filter(models.Event.id == payload.event_id).first()

    # Build company preferences context
    company_prefs = db.query(models.CompanyPreference).filter(
        models.CompanyPreference.user_id == payload.sender_id
    ).all()
    company_list = ", ".join(
        f"{p.company_name} ({p.job_role})" if p.job_role else p.company_name
        for p in company_prefs
    ) or "various companies"

    sent_messages: List[models.DirectMessage] = []

    for receiver_id in payload.receiver_ids:
        if not _is_connected(payload.sender_id, receiver_id, db):
            continue
        receiver = db.query(models.User).filter(models.User.id == receiver_id).first()
        if not receiver:
            continue

        # Build AI prompt for personalized message
        context_parts = [
            f"Sender: {sender.display_name}, {sender.major or 'student'} at {sender.university}.",
            f"Receiver: {receiver.display_name}, {receiver.major or 'student'}.",
        ]
        if goal:
            context_parts.append(f"Sender's goal: {goal.primary_type} — {goal.career_track or goal.social_intent or ''}.")
        context_parts.append(f"Target companies/roles: {company_list}.")
        if event:
            context_parts.append(f"They met at: {event.title}.")

        system_prompt = (
            "You draft short, warm, personalized networking messages from a student to a connection. "
            "The message should ask for a referral or career advice. "
            "Keep it under 60 words. Do NOT use placeholders like [Name] — use the actual names provided. "
            "No subject line, just the message body."
        )
        user_prompt = " ".join(context_parts) + " Write the message now."

        try:
            response = client.chat.completions.create(
                model=CHAT_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=120,
                temperature=0.7,
            )
            content = response.choices[0].message.content.strip()
        except Exception:
            content = (
                f"Hey {receiver.display_name}! It was great connecting"
                + (f" at {event.title}" if event else "")
                + f". I'm looking for opportunities in {company_list}. "
                "Would you be open to referring me or sharing advice? Thanks so much!"
            )

        msg = models.DirectMessage(
            sender_id=payload.sender_id,
            receiver_id=receiver_id,
            content=content,
            is_ai_generated=True,
        )
        db.add(msg)
        sent_messages.append(msg)

    db.commit()
    for msg in sent_messages:
        db.refresh(msg)
    return sent_messages
