from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from database import get_db
import models
import schemas
from typing import List

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/", response_model=schemas.UserOut)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    db_user = models.User(**user.model_dump())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.get("/login/{email}", response_model=schemas.UserOut)
def login_by_email(email: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email.lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with that email")
    return user


@router.get("/{user_id}", response_model=schemas.UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/{user_id}/interests")
def set_interests(user_id: int, payload: schemas.InterestsUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.query(models.UserInterest).filter(models.UserInterest.user_id == user_id).delete()
    for tag_id in payload.tag_ids:
        tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
        if tag:
            db.add(models.UserInterest(user_id=user_id, tag_id=tag_id))
    db.commit()
    return {"message": "Interests updated", "tag_ids": payload.tag_ids}


@router.get("/{user_id}/interests", response_model=List[schemas.TagOut])
def get_interests(user_id: int, db: Session = Depends(get_db)):
    interests = (
        db.query(models.UserInterest)
        .filter(models.UserInterest.user_id == user_id)
        .all()
    )
    return [schemas.TagOut(id=i.tag.id, name=i.tag.name, category=i.tag.category)
            for i in interests if i.tag]


@router.get("/{user_id}/rsvps", response_model=List[schemas.RSVPOut])
def get_rsvps(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.RSVP).filter(models.RSVP.user_id == user_id).all()


@router.post("/rsvp", response_model=schemas.RSVPOut)
def rsvp(payload: schemas.RSVPCreate, db: Session = Depends(get_db)):
    existing = db.query(models.RSVP).filter(
        models.RSVP.user_id == payload.user_id,
        models.RSVP.event_id == payload.event_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already RSVPed")

    rsvp = models.RSVP(user_id=payload.user_id, event_id=payload.event_id)
    db.add(rsvp)

    event = db.query(models.Event).filter(models.Event.id == payload.event_id).first()
    if event:
        event.rsvp_count += 1

    db.commit()
    db.refresh(rsvp)
    return rsvp


@router.delete("/rsvp/{rsvp_id}")
def delete_rsvp(rsvp_id: int, db: Session = Depends(get_db)):
    rsvp = db.query(models.RSVP).filter(models.RSVP.id == rsvp_id).first()
    if not rsvp:
        raise HTTPException(status_code=404, detail="RSVP not found")

    event = db.query(models.Event).filter(models.Event.id == rsvp.event_id).first()
    if event and event.rsvp_count > 0:
        event.rsvp_count -= 1

    db.delete(rsvp)
    db.commit()
    return {"message": "RSVP removed"}
