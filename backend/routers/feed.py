from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db
from typing import List, Optional
import models
import schemas

router = APIRouter(prefix="/feed", tags=["Feed"])


@router.get("/", response_model=List[schemas.PostOut])
def list_posts(
    tag: Optional[str] = None,
    user_id: Optional[int] = None,
    limit: int = Query(default=50, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(models.Post)
    if tag:
        q = q.filter(models.Post.tag == tag)
    posts = q.order_by(models.Post.created_at.desc()).limit(limit).all()

    liked_ids: set = set()
    if user_id:
        liked_ids = {
            lk.post_id for lk in
            db.query(models.PostLike).filter(models.PostLike.user_id == user_id).all()
        }

    result = []
    for p in posts:
        out = schemas.PostOut.from_orm(p)
        out.liked = p.id in liked_ids
        result.append(out)
    return result


@router.post("/", response_model=schemas.PostOut)
def create_post(payload: schemas.PostCreate, db: Session = Depends(get_db)):
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")
    post = models.Post(
        user_id=payload.user_id,
        content=payload.content.strip(),
        tag=payload.tag,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    out = schemas.PostOut.from_orm(post)
    out.liked = False
    return out


@router.post("/{post_id}/like", response_model=schemas.PostOut)
def toggle_like(post_id: int, user_id: int = Query(...), db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = db.query(models.PostLike).filter(
        models.PostLike.post_id == post_id,
        models.PostLike.user_id == user_id,
    ).first()

    if existing:
        db.delete(existing)
        post.likes = max(0, post.likes - 1)
        liked = False
    else:
        db.add(models.PostLike(post_id=post_id, user_id=user_id))
        post.likes += 1
        liked = True

    db.commit()
    db.refresh(post)
    out = schemas.PostOut.from_orm(post)
    out.liked = liked
    return out


@router.post("/{post_id}/reply", response_model=schemas.PostOut)
def add_reply(post_id: int, payload: schemas.PostReplyCreate, user_id: Optional[int] = Query(default=None), db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    reply = models.PostReply(
        post_id=post_id,
        user_id=payload.user_id or user_id,
        content=payload.content.strip(),
    )
    db.add(reply)
    db.commit()
    db.refresh(post)

    liked = db.query(models.PostLike).filter(
        models.PostLike.post_id == post_id,
        models.PostLike.user_id == (payload.user_id or user_id),
    ).first() is not None

    out = schemas.PostOut.from_orm(post)
    out.liked = liked
    return out


@router.delete("/{post_id}", status_code=204)
def delete_post(post_id: int, user_id: int = Query(...), db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not your post")
    db.delete(post)
    db.commit()
