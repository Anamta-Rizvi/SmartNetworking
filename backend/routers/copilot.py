from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
import tempfile
from sqlalchemy.orm import Session
from database import get_db
from datetime import datetime, timedelta
import models
import schemas
import json
import os
from openai import AzureOpenAI

router = APIRouter(prefix="/copilot", tags=["Copilot"])

client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY", "placeholder"),
    azure_endpoint=os.getenv("AZURE_OPENAI_BASE_URL", "https://placeholder.openai.azure.com/"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
)

whisper_client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY", "placeholder"),
    azure_endpoint=os.getenv("AZURE_WHISPER_BASE_URL", "https://placeholder.cognitiveservices.azure.com/"),
    api_version=os.getenv("AZURE_WHISPER_API_VERSION", "2024-06-01"),
)

CHAT_MODEL = os.getenv("AZURE_OPENAI_CHAT_MODEL", "gpt-4o")
WHISPER_MODEL = os.getenv("AZURE_WHISPER_MODEL", "whisper")

SYSTEM_PROMPTS = {
    "goal_setup": """You are a friendly campus life advisor helping a student set up their networking goals on CampusOS.

CRITICAL INSTRUCTIONS:
- Ask EXACTLY ONE question at a time
- For EVERY question, you MUST include a [QUESTION] marker in this EXACT JSON format on its own line:
  [QUESTION: {"text": "Your question here?", "options": ["Option 1", "Option 2", "Option 3"]}]
- Write a brief warm sentence BEFORE the [QUESTION] marker
- The user can tap an option OR type their own answer — accept both gracefully
- Do NOT skip any step

Follow this EXACT 5-step flow in order:

STEP 1 — Ask about their PRIMARY GOAL:
Write: "Welcome! Let's set up your networking goals. First..."
[QUESTION: {"text": "What's your main goal for networking on campus?", "options": ["Career Networking", "Social Connections", "Both"]}]

STEP 2 — Based on their Step 1 answer:
- If career or both: ask about their field/track:
  [QUESTION: {"text": "What field or track are you pursuing?", "options": ["Software Engineering", "Product Management", "Finance & Business", "Data Science", "Marketing / Design", "Research / Academia", "Other"]}]
- If social: ask about social intent:
  [QUESTION: {"text": "What kind of social connections are you looking for?", "options": ["Making new friends", "Finding study partners", "Joining clubs & orgs", "Building a community", "All of the above"]}]

STEP 3 — Ask about TIMELINE:
[QUESTION: {"text": "What's your timeline for achieving these goals?", "options": ["This semester", "This academic year", "By graduation"]}]

STEP 4 — Ask WHO they want to meet:
[QUESTION: {"text": "Who would you most like to connect with?", "options": ["Peers in my major", "Industry professionals", "Alumni in my field", "Professors & Faculty", "All of the above"]}]

STEP 5 — Ask about EVENT PREFERENCES:
[QUESTION: {"text": "What kind of events do you prefer for networking?", "options": ["Small group meetups", "Large conferences & fairs", "Mix of both", "Virtual events only"]}]

After the user answers Step 5, respond with a warm personalized summary of their goals, then emit this EXACT marker on its own line:
[GOAL_COMPLETE: {"primary_type": "career|social|both", "career_track": "their track or null", "social_intent": "their intent or null", "timeline": "their timeline", "who_to_meet": "their choice", "event_pref": "their preference"}]

Replace the values with what the user actually told you. Use null for unused fields.""",

    "networking": """You are a campus networking coach helping a student prepare for a specific event they RSVPed to.

You will receive context about:
- The event (name, date, time, organizer, description)
- Other RSVPed attendees (professionals and students, with their company/major/interests)
- The student's goal and target companies

Your job is to generate a focused EVENT PREP BRIEF:

## Who to Meet — Professionals
List 2-3 professionals attending. For each:
- Name, Company, Role
- Why they're relevant to the student's goal
- One conversation angle specific to their background

## Who to Meet — Students
List 2-3 students attending. For each:
- Name, Major, Year
- Shared interests or RSVPs
- What to talk about

## Conversation Angles
2-3 specific topics to bring up at this event, tied to the student's goal.

## Goal Fit
One sentence on how attending this event moves their metrics (referrals, connections, etc.).

Be specific and actionable. No generic advice. No elevator pitch templates.""",

    "daily_planner": """You are a campus life planner helping a student build their plan for today.

You will receive:
- Today's events (title, time, location, goal relevance score)
- The student's class schedule for today (class name, start time, end time)
- The student's active goals and milestones

Your job:
1. For each event today, determine if it conflicts with a class or fits in a free slot.
2. Output a prioritized list of events with:
   - FREE or CONFLICT status (and which class if conflict)
   - Why the event matters for their goal
   - Your recommendation: Accept or Review
3. End with one networking action and one habit/task.

Format your response as a structured daily plan. Be direct and time-aware.
Mention actual times (e.g. "2:00 PM — Tech Networking Mixer — FREE — 78% goal match").""",

    "progress_review": """You are a goal progress coach reviewing a student's Campus OS goal dashboard.
You have access to their milestones, the events Copilot recommended, and which ones they attended.

Your job:
1. Summarize progress honestly — what's going well, what's falling behind
2. Call out any events they skipped and what they missed
3. Recommend the single most impactful next action (an event, a reach-out, a habit)
4. Keep the tone encouraging but direct — no fluff

When you identify a specific upcoming event that would help, include it in your response with the format:
[SUGGEST_EVENT: <event title>] so the app can surface it as a dashboard suggestion card.""",
}


def _build_context(user_id: int, mode: str, db: Session, extra_context: dict = None) -> str:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return ""

    parts = [f"Student: {user.display_name}, {user.major or 'undeclared'}, Class of {user.grad_year or 'N/A'} at {user.university}."]

    goal = db.query(models.Goal).filter(models.Goal.user_id == user_id).first()
    if goal:
        parts.append(f"Goal type: {goal.primary_type}.")
        if goal.career_track:
            parts.append(f"Career track: {goal.career_track}.")
        if goal.social_intent:
            parts.append(f"Social intent: {goal.social_intent}.")
        if goal.interests:
            try:
                interests = json.loads(goal.interests)
                parts.append(f"Interests: {', '.join(interests)}.")
            except Exception:
                pass

    # Company preferences
    company_prefs = db.query(models.CompanyPreference).filter(
        models.CompanyPreference.user_id == user_id
    ).all()
    if company_prefs:
        prefs_str = ", ".join(
            f"{p.company_name} ({p.job_role})" if p.job_role else p.company_name
            for p in company_prefs
        )
        parts.append(f"Target companies: {prefs_str}.")

    if mode == "daily_planner":
        # Add today's events
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        today_events = (
            db.query(models.Event)
            .filter(models.Event.starts_at >= today_start, models.Event.starts_at < today_end)
            .filter(models.Event.status == "published")
            .all()
        )
        if today_events:
            event_strs = []
            for e in today_events:
                time_str = e.starts_at.strftime("%I:%M %p")
                event_strs.append(f'"{e.title}" at {time_str}, {e.location}')
            parts.append(f"Today's events: {'; '.join(event_strs)}.")

        # Add class schedule for today
        today_dow = datetime.utcnow().weekday()  # 0=Monday
        classes_today = db.query(models.ClassSchedule).filter(
            models.ClassSchedule.user_id == user_id,
            models.ClassSchedule.day_of_week == today_dow,
        ).all()
        if classes_today:
            class_strs = [f"{c.class_name} ({c.start_time}–{c.end_time})" for c in classes_today]
            parts.append(f"Classes today: {', '.join(class_strs)}.")
        else:
            parts.append("No classes today.")

    elif mode == "networking":
        # Add upcoming RSVPed events so AI can list them
        upcoming_rsvps = (
            db.query(models.RSVP)
            .join(models.Event)
            .filter(models.RSVP.user_id == user_id)
            .filter(models.Event.starts_at >= datetime.utcnow())
            .filter(models.Event.starts_at <= datetime.utcnow() + timedelta(days=14))
            .all()
        )
        if upcoming_rsvps:
            rsvp_strs = []
            for r in upcoming_rsvps[:5]:
                if r.event:
                    time_str = r.event.starts_at.strftime("%b %d, %I:%M %p")
                    rsvp_strs.append(f'"{r.event.title}" on {time_str}')
            parts.append(f"Upcoming RSVPs: {'; '.join(rsvp_strs)}.")

        # If specific event_id provided in extra_context, add attendee details
        if extra_context and extra_context.get("event_id"):
            event_id = extra_context["event_id"]
            event = db.query(models.Event).filter(models.Event.id == event_id).first()
            if event:
                parts.append(f"\nPreparing for event: {event.title} on {event.starts_at.strftime('%b %d, %I:%M %p')} at {event.location}.")
                if event.description:
                    parts.append(f"Event description: {event.description[:300]}.")
                # Get other attendees
                attendee_rsvps = db.query(models.RSVP).filter(
                    models.RSVP.event_id == event_id,
                    models.RSVP.user_id != user_id,
                ).limit(10).all()
                if attendee_rsvps:
                    attendee_strs = []
                    for ar in attendee_rsvps:
                        att = ar.user
                        if att:
                            attendee_strs.append(
                                f"{att.display_name} ({att.major or 'unknown major'}, Class of {att.grad_year or 'N/A'})"
                            )
                    parts.append(f"Other attendees: {'; '.join(attendee_strs)}.")
    else:
        # General: add upcoming RSVPs
        upcoming_rsvps = (
            db.query(models.RSVP)
            .join(models.Event)
            .filter(models.RSVP.user_id == user_id)
            .filter(models.Event.starts_at >= datetime.utcnow())
            .filter(models.Event.starts_at <= datetime.utcnow() + timedelta(days=7))
            .all()
        )
        if upcoming_rsvps:
            rsvp_titles = [r.event.title for r in upcoming_rsvps if r.event]
            parts.append(f"Upcoming RSVPs: {', '.join(rsvp_titles[:3])}.")

    return " ".join(parts)


def _build_dashboard_context(user_id: int, db: Session) -> str:
    """Build a dashboard summary string for the progress_review Copilot mode."""
    goal = db.query(models.Goal).filter(models.Goal.user_id == user_id).first()
    if not goal:
        return ""

    parts = []
    career_milestones = json.loads(goal.career_milestones or "[]")
    social_milestones = json.loads(goal.social_milestones or "[]")

    if career_milestones:
        parts.append("Career milestones: " + "; ".join(
            f"{m['title']} ({m.get('current_count', 0)}/{m['target_count']})" for m in career_milestones
        ))
    if social_milestones:
        parts.append("Social milestones: " + "; ".join(
            f"{m['title']} ({m.get('current_count', 0)}/{m['target_count']})" for m in social_milestones
        ))

    goal_events = db.query(models.GoalEvent).filter(models.GoalEvent.user_id == user_id).all()
    attended = [ge for ge in goal_events if ge.attended is True]
    skipped = [ge for ge in goal_events if ge.attended is False]
    pending = [ge for ge in goal_events if ge.attended is None]

    if attended:
        titles = [db.query(models.Event).filter(models.Event.id == ge.event_id).first().title for ge in attended[:3]]
        parts.append(f"Attended events: {', '.join(t for t in titles if t)}.")
    if skipped:
        titles = [db.query(models.Event).filter(models.Event.id == ge.event_id).first().title for ge in skipped[:3]]
        parts.append(f"Skipped events: {', '.join(t for t in titles if t)}.")
    if pending:
        titles = [db.query(models.Event).filter(models.Event.id == ge.event_id).first().title for ge in pending[:3]]
        parts.append(f"Upcoming dashboard events: {', '.join(t for t in titles if t)}.")

    return " ".join(parts)


import re

_SUGGEST_RE = re.compile(r"\[SUGGEST_EVENT:\s*([^\]]+)\]")
_GOAL_COMPLETE_RE = re.compile(r"\[GOAL_COMPLETE:\s*(\{[^]]+\})\]", re.DOTALL)


def _find_event_suggestion(text: str, db: Session):
    """Extract [SUGGEST_EVENT: title] markers and resolve to an event record."""
    match = _SUGGEST_RE.search(text)
    if not match:
        return None
    title_fragment = match.group(1).strip().lower()
    events = db.query(models.Event).filter(models.Event.status == "published").all()
    for event in events:
        if title_fragment in event.title.lower():
            return event
    return None


def _find_goal_complete(text: str):
    """Extract [GOAL_COMPLETE: {...}] marker and return parsed goal data."""
    match = _GOAL_COMPLETE_RE.search(text)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except Exception:
        return None


@router.post("/chat")
async def copilot_chat(payload: schemas.CopilotChatRequest, db: Session = Depends(get_db)):
    if not os.getenv("AZURE_OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="AZURE_OPENAI_API_KEY not configured")

    mode = payload.mode if payload.mode in SYSTEM_PROMPTS else "goal_setup"
    system_prompt = SYSTEM_PROMPTS[mode]

    user_context = _build_context(payload.user_id, mode, db, payload.context)
    if user_context:
        system_prompt += f"\n\nUser context: {user_context}"

    if mode == "progress_review":
        dashboard_ctx = _build_dashboard_context(payload.user_id, db)
        if dashboard_ctx:
            system_prompt += f"\n\nDashboard state: {dashboard_ctx}"

    if payload.context:
        system_prompt += f"\n\nAdditional context: {json.dumps(payload.context)}"

    messages = [{"role": "system", "content": system_prompt}]
    for msg in payload.messages:
        messages.append({"role": msg.role, "content": msg.content})

    # ── Log input ──────────────────────────────────────────────────────────────
    print("\n" + "="*60)
    print(f"[COPILOT] user_id={payload.user_id}  mode={mode}")
    print(f"[COPILOT] SYSTEM PROMPT:\n{system_prompt}")
    print(f"[COPILOT] MESSAGES ({len(messages)-1} turns):")
    for m in messages[1:]:  # skip system
        print(f"  [{m['role'].upper()}] {m['content']}")
    print("="*60)

    async def stream_response():
        full_text = ""
        stream = client.chat.completions.create(
            model=CHAT_MODEL,
            messages=messages,
            stream=True,
            max_tokens=600,
            temperature=0.7,
        )
        for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                full_text += delta
                yield f"data: {json.dumps({'content': delta})}\n\n"

        # ── Log output ─────────────────────────────────────────────────────────
        print(f"\n[COPILOT] RESPONSE:\n{full_text}")
        print("="*60 + "\n")

        # After streaming, check for event suggestion markers
        suggested_event = _find_event_suggestion(full_text, db)
        if suggested_event:
            suggestion_payload = {
                "event_id": suggested_event.id,
                "title": suggested_event.title,
                "location": suggested_event.location,
                "starts_at": suggested_event.starts_at.isoformat(),
                "contribution_label": "Suggested by Copilot for your goal",
            }
            yield f"data: {json.dumps({'suggestion': suggestion_payload})}\n\n"

        # Check for goal complete marker (emitted at end of goal_setup flow)
        goal_data = _find_goal_complete(full_text)
        if goal_data:
            yield f"data: {json.dumps({'goal_complete': goal_data})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(stream_response(), media_type="text/event-stream")


@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    if not os.getenv("AZURE_OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="AZURE_OPENAI_API_KEY not configured")

    audio_bytes = await file.read()
    suffix = ".m4a" if "m4a" in (file.content_type or "") else ".webm"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as f:
            transcript = whisper_client.audio.transcriptions.create(
                model=WHISPER_MODEL,
                file=(file.filename or f"audio{suffix}", f, "audio/m4a"),
            )
        return {"text": transcript.text}
    except Exception as e:
        import traceback
        traceback.print_exc()
        error_msg = str(e)
        if "404" in error_msg or "Resource not found" in error_msg:
            raise HTTPException(status_code=503, detail="No Whisper deployment found on your Azure resource.")
        raise HTTPException(status_code=500, detail=error_msg)
    finally:
        import os as _os
        _os.unlink(tmp_path)
