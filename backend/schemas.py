from pydantic import BaseModel, field_validator
from typing import Optional, List, Any
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
    lat: Optional[float] = None
    lng: Optional[float] = None
    tags: List[TagOut] = []
    goal_relevance_score: Optional[float] = None
    goal_relevance_label: Optional[str] = None

    @field_validator('tags', mode='before')
    @classmethod
    def resolve_event_tags(cls, v: Any) -> Any:
        """EventTag join-table rows expose a .tag attribute; unwrap them."""
        result = []
        for item in v:
            if hasattr(item, 'tag') and item.tag is not None:
                result.append(item.tag)
            else:
                result.append(item)
        return result

    class Config:
        from_attributes = True


# --- User ---
class UserCreate(BaseModel):
    email: str
    display_name: str
    major: Optional[str] = None
    grad_year: Optional[int] = None
    university: Optional[str] = "Rutgers"


class UserOut(BaseModel):
    id: int
    email: str
    display_name: str
    major: Optional[str]
    grad_year: Optional[int]
    university: str
    avatar_url: Optional[str] = None
    created_at: datetime
    title: Optional[str] = None  # "Student" | "Alumni" | "Graduate Student" etc.

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
    timeline: Optional[str] = None  # "This semester" | "This academic year" | "By graduation"


class GoalOut(BaseModel):
    id: int
    user_id: int
    primary_type: str
    career_track: Optional[str]
    social_intent: Optional[str]
    interests: Optional[str]
    social_pref_note: Optional[str]
    status: str = "ongoing"
    created_at: datetime

    class Config:
        from_attributes = True


class GoalStatusUpdate(BaseModel):
    status: str  # "ongoing" | "completed"


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


# --- UserLocation ---
class UserLocationUpdate(BaseModel):
    lat: float
    lng: float
    sharing_mode: str = "everyone"  # "everyone" | "connections" | "off"
    fuzzy: bool = True
    expires_minutes: Optional[int] = None  # None = until cleared manually


class UserLocationOut(BaseModel):
    user_id: int
    lat: float
    lng: float
    sharing_mode: str
    fuzzy: bool
    expires_at: Optional[datetime]
    updated_at: datetime

    class Config:
        from_attributes = True


# --- NotificationPreference ---
class NotificationPrefUpdate(BaseModel):
    user_id: int
    event_proximity: bool = True
    peer_proximity: bool = False
    friend_proximity: bool = True
    radius_meters: int = 300
    schedule_aware: bool = True


class NotificationPrefOut(BaseModel):
    user_id: int
    event_proximity: bool
    peer_proximity: bool
    friend_proximity: bool
    radius_meters: int
    schedule_aware: bool

    class Config:
        from_attributes = True


# --- GoalEvent ---
class GoalEventCreate(BaseModel):
    user_id: int
    event_id: int
    goal_type: str  # "career" | "social"
    contribution_score: float = 0.0
    contribution_label: Optional[str] = None
    added_by: str = "copilot"


class GoalEventAttendance(BaseModel):
    attended: bool


class GoalEventOut(BaseModel):
    id: int
    user_id: int
    event_id: int
    goal_type: str
    contribution_score: float
    contribution_label: Optional[str]
    attended: Optional[bool]
    added_by: str
    added_at: datetime
    event: EventOut

    class Config:
        from_attributes = True


# --- Milestone ---
class Milestone(BaseModel):
    title: str
    target_count: int
    current_count: int = 0


# --- Goal Dashboard ---
class GoalDashboard(BaseModel):
    goal_id: int
    primary_type: str
    career_milestones: List[Milestone] = []
    social_milestones: List[Milestone] = []
    career_events: List[GoalEventOut] = []
    social_events: List[GoalEventOut] = []
    career_progress: float = 0.0  # 0-1
    social_progress: float = 0.0  # 0-1


# --- Connection ---
class ConnectionCreate(BaseModel):
    requester_id: int
    addressee_id: int


class ConnectionStatusUpdate(BaseModel):
    status: str  # "accepted" | "declined"


class ConnectionOut(BaseModel):
    id: int
    requester_id: int
    addressee_id: int
    status: str
    created_at: datetime
    requester: "UserOut"
    addressee: "UserOut"

    class Config:
        from_attributes = True


# --- Attendees / Friend Presence ---
class RSVPAttendeeOut(BaseModel):
    user_id: int
    display_name: str
    avatar_url: Optional[str] = None
    connection_status: str  # "none" | "pending_sent" | "pending_received" | "connected"


class FriendPresencePin(BaseModel):
    user_id: int
    display_name: str
    avatar_url: Optional[str] = None
    is_self: bool = False
    # GPS location (real, from UserLocation table — may be fuzzy)
    lat: Optional[float] = None
    lng: Optional[float] = None
    # RSVP-based event context
    event_id: Optional[int] = None
    event_title: Optional[str] = None
    event_location: Optional[str] = None
    event_lat: Optional[float] = None
    event_lng: Optional[float] = None
    event_starts_at: Optional[datetime] = None


class HeatmapPoint(BaseModel):
    event_id: int
    event_title: str
    lat: float
    lng: float
    live_count: int       # people whose GPS is near the event right now
    rsvp_count: int       # total RSVPs for reference


# --- Copilot ---
class Message(BaseModel):
    role: str  # user | assistant
    content: str


class CopilotChatRequest(BaseModel):
    user_id: int
    mode: str  # goal_setup | networking | daily_planner | progress_review
    messages: List[Message]
    context: Optional[dict] = {}


# --- ClassSchedule ---
class ClassScheduleCreate(BaseModel):
    user_id: int
    class_name: str
    day_of_week: int   # 0=Monday … 6=Sunday
    start_time: str    # "HH:MM"
    end_time: str      # "HH:MM"


class ClassScheduleOut(BaseModel):
    id: int
    user_id: int
    class_name: str
    day_of_week: int
    start_time: str
    end_time: str

    class Config:
        from_attributes = True


# --- CompanyPreference ---
class CompanyPreferenceCreate(BaseModel):
    user_id: int
    company_name: str
    job_role: Optional[str] = None


class CompanyPreferenceOut(BaseModel):
    id: int
    user_id: int
    company_name: str
    job_role: Optional[str]

    class Config:
        from_attributes = True


# --- Referral ---
class ReferralCreate(BaseModel):
    user_id: int
    company_name: str
    contact_name: Optional[str] = None
    notes: Optional[str] = None
    event_id: Optional[int] = None


class ReferralUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    notes: Optional[str] = None


class ReferralOut(BaseModel):
    id: int
    user_id: int
    company_name: str
    contact_name: Optional[str]
    notes: Optional[str]
    event_id: Optional[int]
    received_at: datetime

    class Config:
        from_attributes = True


# --- DirectMessage ---
class DirectMessageCreate(BaseModel):
    sender_id: int
    receiver_id: int
    content: str
    is_ai_generated: bool = False


class DirectMessageOut(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    content: str
    is_ai_generated: bool
    read_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationOut(BaseModel):
    peer: UserOut
    last_message: Optional[DirectMessageOut]
    unread_count: int


class BulkAIMessageRequest(BaseModel):
    sender_id: int
    receiver_ids: List[int]
    event_id: Optional[int] = None   # event that prompted the referral ask


# --- Feed / Posts ---
class PostReplyOut(BaseModel):
    id: int
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class PostOut(BaseModel):
    id: int
    content: str
    tag: str
    likes: int
    liked: bool = False   # populated in the router per requesting user
    created_at: datetime
    replies: List[PostReplyOut] = []

    class Config:
        from_attributes = True


class PostCreate(BaseModel):
    content: str
    tag: str
    user_id: Optional[int] = None   # None = anonymous


class PostReplyCreate(BaseModel):
    content: str
    user_id: Optional[int] = None
