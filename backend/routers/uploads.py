import os
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from database import get_db
import models

router = APIRouter(prefix="/uploads", tags=["Uploads"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "avatars")
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("/avatar")
async def upload_avatar(
    user_id: int = Query(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, or WebP images allowed")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 5 MB)")

    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(data)).convert("RGB")
        img.thumbnail((256, 256), Image.LANCZOS)
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=85)
        out.seek(0)
        final_bytes = out.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"{user_id}.jpg"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(final_bytes)

    avatar_url = f"/static/avatars/{filename}"
    user.avatar_url = avatar_url
    db.commit()

    return {"avatar_url": avatar_url}
