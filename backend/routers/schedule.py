from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from typing import List
import models
import schemas

router = APIRouter(prefix="/schedule", tags=["Schedule"])


@router.get("/{user_id}", response_model=List[schemas.ClassScheduleOut])
def get_schedule(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.ClassSchedule).filter(models.ClassSchedule.user_id == user_id).all()


@router.post("", response_model=schemas.ClassScheduleOut)
def add_class(payload: schemas.ClassScheduleCreate, db: Session = Depends(get_db)):
    slot = models.ClassSchedule(**payload.dict())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.delete("/{slot_id}")
def delete_class(slot_id: int, db: Session = Depends(get_db)):
    slot = db.query(models.ClassSchedule).filter(models.ClassSchedule.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Class slot not found")
    db.delete(slot)
    db.commit()
    return {"ok": True}
