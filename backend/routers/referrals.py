from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from typing import List
import models
import schemas

router = APIRouter(prefix="/referrals", tags=["Referrals"])


@router.get("/{user_id}", response_model=List[schemas.ReferralOut])
def get_referrals(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Referral).filter(
        models.Referral.user_id == user_id
    ).order_by(models.Referral.received_at.desc()).all()


@router.post("", response_model=schemas.ReferralOut)
def log_referral(payload: schemas.ReferralCreate, db: Session = Depends(get_db)):
    referral = models.Referral(**payload.dict())
    db.add(referral)
    db.commit()
    db.refresh(referral)
    return referral


@router.patch("/{referral_id}", response_model=schemas.ReferralOut)
def update_referral(
    referral_id: int,
    payload: schemas.ReferralUpdate,
    db: Session = Depends(get_db),
):
    referral = db.query(models.Referral).filter(models.Referral.id == referral_id).first()
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(referral, field, value)
    db.commit()
    db.refresh(referral)
    return referral


@router.delete("/{referral_id}")
def delete_referral(referral_id: int, db: Session = Depends(get_db)):
    referral = db.query(models.Referral).filter(models.Referral.id == referral_id).first()
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    db.delete(referral)
    db.commit()
    return {"ok": True}
