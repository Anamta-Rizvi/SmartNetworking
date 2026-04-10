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
    "goal_setup": """You are a friendly campus life advisor helping a student set up their goals on Campus OS.
Guide them through:
1. Whether they're focused on career (internships, skills, networking), social (hobbies, friendships, community), or both.
2. If career: what field/track they're pursuing and their timeline.
3. If social: what kinds of activities or communities interest them.
4. Optional: any preferences about who they'd like to meet.

Be warm, conversational, and concise. Ask one question at a time. When you have enough info, summarize their goals clearly.""",

    "networking": """You are a campus networking coach helping a student prepare to connect with someone at an event.
Given context about who they're meeting (name, role, company, shared event), generate:
- 2-3 personalized conversation starters
- A clear, 30-second elevator pitch tailored to the student's background and goals
- One thoughtful question to ask the other person

Be specific, professional but warm. Avoid generic advice.""",

    "elevator_pitch": """You are a career coach helping a student craft a sharp, authentic elevator pitch.
Generate a 30-second pitch (about 75 words) that is:
- Professional and confident, not stiff
- Specific about their skills, experience, and what they're looking for
- Ending with a clear ask or transition

Tailor it to the context they provide (role, company, event type).""",

    "icebreaker": """You are a social coach helping a student start low-pressure conversations at campus social or hobby events.
Generate 3 casual, genuine icebreakers that:
- Are specific to the event type or shared interest
- Feel natural, not scripted
- Invite a real conversation rather than a yes/no answer

Keep it light, friendly, and fun.""",

    "followup": """You are an assistant helping a student write a follow-up message after meeting someone at a campus event.
Write a short, warm follow-up (3-5 sentences) that:
- References something specific from the conversation
- Reiterates genuine interest in staying connected
- Includes a clear next step (coffee chat, LinkedIn, collaboration)

Avoid generic phrases like 'It was great meeting you.' Be specific.""",

    "daily_planner": """You are a campus life planner helping a student make the most of their day.
Given their goals and upcoming events, generate a short prioritized daily plan:
- Top 1-2 events they should attend and why
- One networking or social action to take
- One small habit or task that moves them toward their goal

Be direct and specific. No fluff.""",
}


def _build_context(user_id: int, db: Session) -> str:
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


@router.post("/chat")
async def copilot_chat(payload: schemas.CopilotChatRequest, db: Session = Depends(get_db)):
    if not os.getenv("AZURE_OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="AZURE_OPENAI_API_KEY not configured")

    mode = payload.mode if payload.mode in SYSTEM_PROMPTS else "goal_setup"
    system_prompt = SYSTEM_PROMPTS[mode]

    user_context = _build_context(payload.user_id, db)
    if user_context:
        system_prompt += f"\n\nUser context: {user_context}"

    if payload.context:
        system_prompt += f"\n\nAdditional context: {json.dumps(payload.context)}"

    messages = [{"role": "system", "content": system_prompt}]
    for msg in payload.messages:
        messages.append({"role": msg.role, "content": msg.content})

    async def stream_response():
        stream = client.chat.completions.create(
            model=CHAT_MODEL,
            messages=messages,
            stream=True,
            max_tokens=600,
            temperature=0.7,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield f"data: {json.dumps({'content': delta})}\n\n"
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
