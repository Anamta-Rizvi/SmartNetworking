from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
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
    location = relationship("UserLocation", back_populates="user", uselist=False, cascade="all, delete-orphan")
    notification_prefs = relationship("NotificationPreference", back_populates="user", uselist=False, cascade="all, delete-orphan")
    goal_events = relationship("GoalEvent", back_populates="user", cascade="all, delete-orphan")
    sent_requests = relationship("Connection", foreign_keys="Connection.requester_id", back_populates="requester", cascade="all, delete-orphan")
    received_requests = relationship("Connection", foreign_keys="Connection.addressee_id", back_populates="addressee", cascade="all, delete-orphan")


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
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tags = relationship("EventTag", back_populates="event")
    rsvps = relationship("RSVP", back_populates="event")
    goal_events = relationship("GoalEvent", back_populates="event")


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
    career_milestones = Column(Text, nullable=True)  # JSON: [{title, target_count, current_count}]
    social_milestones = Column(Text, nullable=True)   # JSON: [{title, target_count, current_count}]
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="goal")
    goal_events = relationship("GoalEvent", back_populates="goal", cascade="all, delete-orphan")


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


class UserLocation(Base):
    __tablename__ = "user_locations"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    sharing_mode = Column(String, default="everyone")  # "everyone" | "connections" | "off"
    fuzzy = Column(Boolean, default=True)  # building-level precision when True
    expires_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="location")


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    event_proximity = Column(Boolean, default=True)
    peer_proximity = Column(Boolean, default=False)  # requires explicit opt-in
    friend_proximity = Column(Boolean, default=True)
    radius_meters = Column(Integer, default=300)
    schedule_aware = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="notification_prefs")


class GoalEvent(Base):
    __tablename__ = "goal_events"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    goal_type = Column(String, nullable=False)       # "career" | "social"
    contribution_score = Column(Float, default=0.0)  # 0-1
    contribution_label = Column(String, nullable=True)  # e.g. "Matches networking milestone"
    attended = Column(Boolean, nullable=True)        # None=pending, True=attended, False=skipped
    added_by = Column(String, default="copilot")     # "copilot" | "user"
    added_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="goal_events")
    goal = relationship("Goal", back_populates="goal_events")
    event = relationship("Event", back_populates="goal_events")


class Connection(Base):
    __tablename__ = "connections"
    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    addressee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="pending")  # "pending" | "accepted" | "declined"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (UniqueConstraint("requester_id", "addressee_id", name="uq_connection_pair"),)

    requester = relationship("User", foreign_keys=[requester_id], back_populates="sent_requests")
    addressee = relationship("User", foreign_keys=[addressee_id], back_populates="received_requests")


class CopilotSession(Base):
    __tablename__ = "copilot_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    mode = Column(String, nullable=False)
    messages = Column(Text, nullable=True)  # JSON string of message history
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
