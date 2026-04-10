from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    display_name = Column(String, nullable=False)
    major = Column(String, nullable=True)
    grad_year = Column(Integer, nullable=True)
    university = Column(String, default="NYU")
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    goal = relationship("Goal", back_populates="user", uselist=False)
    interests = relationship("UserInterest", back_populates="user", cascade="all, delete-orphan")
    rsvps = relationship("RSVP", back_populates="user")


class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    category = Column(String, nullable=False)  # career | social | hobby | academic | wellness

    event_tags = relationship("EventTag", back_populates="tag")
    user_interests = relationship("UserInterest", back_populates="tag")


class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    location = Column(String, nullable=False)
    organizer = Column(String, nullable=False)
    starts_at = Column(DateTime, nullable=False)
    ends_at = Column(DateTime, nullable=True)
    is_virtual = Column(Boolean, default=False)
    cover_image_url = Column(String, nullable=True)
    status = Column(String, default="published")
    rsvp_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    tags = relationship("EventTag", back_populates="event")
    rsvps = relationship("RSVP", back_populates="event")


class EventTag(Base):
    __tablename__ = "event_tags"
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    tag_id = Column(Integer, ForeignKey("tags.id"), nullable=False)

    event = relationship("Event", back_populates="tags")
    tag = relationship("Tag", back_populates="event_tags")


class Goal(Base):
    __tablename__ = "goals"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    primary_type = Column(String, default="both")  # career | social | both
    career_track = Column(String, nullable=True)
    social_intent = Column(String, nullable=True)
    interests = Column(String, nullable=True)  # JSON-encoded list of interest names
    social_pref_note = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="goal")


class UserInterest(Base):
    __tablename__ = "user_interests"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    tag_id = Column(Integer, ForeignKey("tags.id"), nullable=False)
    weight = Column(Float, default=1.0)

    user = relationship("User", back_populates="interests")
    tag = relationship("Tag", back_populates="user_interests")


class RSVP(Base):
    __tablename__ = "rsvps"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    attended = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="rsvps")
    event = relationship("Event", back_populates="rsvps")


class CopilotSession(Base):
    __tablename__ = "copilot_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    mode = Column(String, nullable=False)
    messages = Column(Text, nullable=True)  # JSON string of message history
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
