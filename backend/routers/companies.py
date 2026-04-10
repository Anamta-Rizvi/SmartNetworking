from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from typing import List
import models
import schemas

router = APIRouter(prefix="/companies", tags=["Companies"])

# Curated similarity map for AI-suggested related companies
SIMILAR_COMPANIES: dict = {
    "google": ["meta", "amazon", "apple", "microsoft", "netflix"],
    "meta": ["google", "tiktok", "snap", "twitter", "pinterest"],
    "amazon": ["google", "microsoft", "apple", "shopify", "salesforce"],
    "apple": ["google", "microsoft", "samsung", "sony", "amazon"],
    "microsoft": ["google", "amazon", "salesforce", "oracle", "ibm"],
    "goldman sachs": ["jp morgan", "morgan stanley", "blackrock", "citadel", "two sigma"],
    "jp morgan": ["goldman sachs", "morgan stanley", "bank of america", "citigroup", "wells fargo"],
    "morgan stanley": ["goldman sachs", "jp morgan", "blackstone", "carlyle", "kkr"],
    "mckinsey": ["bcg", "bain", "deloitte", "accenture", "oliver wyman"],
    "bcg": ["mckinsey", "bain", "deloitte", "strategy&", "roland berger"],
    "bain": ["mckinsey", "bcg", "deloitte", "kpmg", "ey"],
    "deloitte": ["kpmg", "ey", "pwc", "accenture", "mckinsey"],
    "salesforce": ["microsoft", "oracle", "hubspot", "servicenow", "workday"],
    "blackrock": ["vanguard", "fidelity", "goldman sachs", "pimco", "citadel"],
    "citadel": ["two sigma", "de shaw", "jane street", "renaissance", "blackrock"],
}


@router.get("/{user_id}", response_model=List[schemas.CompanyPreferenceOut])
def get_preferences(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.CompanyPreference).filter(
        models.CompanyPreference.user_id == user_id
    ).all()


@router.post("", response_model=schemas.CompanyPreferenceOut)
def add_preference(payload: schemas.CompanyPreferenceCreate, db: Session = Depends(get_db)):
    pref = models.CompanyPreference(**payload.dict())
    db.add(pref)
    db.commit()
    db.refresh(pref)
    return pref


@router.delete("/{pref_id}")
def delete_preference(pref_id: int, db: Session = Depends(get_db)):
    pref = db.query(models.CompanyPreference).filter(
        models.CompanyPreference.id == pref_id
    ).first()
    if not pref:
        raise HTTPException(status_code=404, detail="Preference not found")
    db.delete(pref)
    db.commit()
    return {"ok": True}


@router.get("/{user_id}/suggestions")
def suggest_companies(user_id: int, db: Session = Depends(get_db)):
    """Return AI-suggested companies based on what the user has saved."""
    prefs = db.query(models.CompanyPreference).filter(
        models.CompanyPreference.user_id == user_id
    ).all()
    saved_names = {p.company_name.lower() for p in prefs}
    suggested: dict = {}
    for name in saved_names:
        for similar in SIMILAR_COMPANIES.get(name, []):
            if similar not in saved_names and similar not in suggested:
                suggested[similar] = similar.title()
    return {"suggestions": list(suggested.values())}
