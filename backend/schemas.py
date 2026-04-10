from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# --- Tag ---
class TagOut(BaseModel):
    id: int
    name: str
    category: str

    class Config:
        from_attributes = True


# --- Event ---
class EventOut(BaseModel):
    id: int
    title: str
    description: str
    location: str
    organizer: str
    starts_at: datetime
    ends_at: Optional[datetime]
    is_virtual: bool
    cover_image_url: Optional[str]
    rsvp_count: int
    tags: List[TagOut] = []

    class Config:
        from_attributes = True


# --- User ---
class UserCreate(BaseModel):
    email: str
    display_name: str
    major: Optional[str] = None
    grad_year: Optional[int] = None
    university: Optional[str] = "NYU"


class UserOut(BaseModel):
    id: int
    email: str
    display_name: str
    major: Optional[str]
    grad_year: Optional[int]
    university: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Goal ---
class GoalCreate(BaseModel):
    user_id: int
    primary_type: str  # career, social, both
    career_track: Optional[str] = None
    social_intent: Optional[str] = None
    interests: Optional[List[str]] = []
    social_pref_note: Optional[str] = None


class GoalOut(BaseModel):
    id: int
    user_id: int
    primary_type: str
    career_track: Optional[str]
    social_intent: Optional[str]
    interests: Optional[str]
    social_pref_note: Optional[str]

    class Config:
        from_attributes = True


# --- User Interests ---
class InterestsUpdate(BaseModel):
    tag_ids: List[int]


# --- RSVP ---
class RSVPCreate(BaseModel):
    user_id: int
    event_id: int


class RSVPOut(BaseModel):
    id: int
    user_id: int
    event_id: int
    attended: bool
    created_at: datetime

    class Config:
        from_attributes = True


# --- Recommendation ---
class RecommendationOut(BaseModel):
    event: EventOut
    score: float
    reason: str


# --- Copilot ---
class Message(BaseModel):
    role: str  # user | assistant
    content: str


class CopilotChatRequest(BaseModel):
    user_id: int
    mode: str  # goal_setup | networking | elevator_pitch | icebreaker | followup | daily_planner
    messages: List[Message]
    context: Optional[dict] = {}
