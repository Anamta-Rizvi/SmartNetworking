# 📘 Campus OS — Product Requirements Document

## 🚀 Overview

Campus OS is an intelligent campus platform that turns campus opportunities into **structured, measurable outcomes**. It combines:

- 📅 **Event Discovery** — aggregated, goal-ranked, color-coded by relevance
- 🤖 **AI Copilot** — structured goal setup → quantified milestones → event + connection recommendations
- 📊 **Goal Dashboard** — tracks referrals, events attended, connections made against AI-set targets
- 🗺️ **Live Campus Map** — events color-coded by goal relevance; friend RSVP presence
- 🤝 **Connections** — goal-driven suggestions + open name search

---

## 🎯 Vision

> Build an operating system for student life that converts campus opportunities into real outcomes — jobs and skills, **and** friendships, community, and repeat habits worth showing up for.

---

## ❗ Problem

Students:
- Attend events randomly without connecting them to outcomes
- Have no structured way to track progress toward career or social goals
- Struggle to identify *which* events, people, or resources will actually move them forward
- Waste time at low-relevance events without knowing it
- Can't see how close they are to hitting targets (referrals, connections, event attendance)

---

## 💡 Solution

Campus OS uses a **goal-first architecture**:
1. Copilot asks structured questions → understands the student's goal, timeline, and field
2. AI generates **quantified targets** (e.g. 15 referrals, 10 career events, 20 connections in 3 months)
3. Every event is **scored and weighted** against those targets
4. Map shows events **color-coded by goal relevance**
5. Dashboard tracks real progress toward each metric
6. Connection suggestions are **entirely goal-driven** (alumni, industry professionals, peers in same track)
7. Name search is **open** — finds any user regardless of goal alignment

---

# 🧩 Core Features

---

## 🤖 Copilot — Structured Goal Setup

**NOT free-form chat.** Goal Setup is a **fixed questionnaire flow** — one question at a time, with selectable options + optional free text for each answer.

### Questions (in order)

**Q1 — Primary Goal**
> "What's your main goal right now?"
- 🎯 Land a job / internship
- 🌱 Explore career options
- 🤝 Grow my professional network
- 🎉 Make friends and find community
- ⚡ All of the above

**Q2 — Timeline** *(if career goal selected)*
> "When do you need to achieve this by?"
- In the next month
- In the next 3 months
- By end of semester
- By graduation
- No deadline

**Q3 — Field / Industry** *(if career goal)*
> "What field are you targeting?"
- Software Engineering / Tech
- Finance / Investment Banking
- Consulting
- Product Management
- Marketing / Growth
- Healthcare / Life Sciences
- Other: [text input]

**Q4 — What kind of help do you need most?** *(if career goal)*
> "What's your biggest gap right now?"
- Getting referrals from professionals
- Building interviewing skills
- Finding mentors / advisors
- Meeting peers in the same field
- Understanding the industry better
- Multiple of the above

**Q5 — Social goal detail** *(if social or both)*
> "What kind of social life are you building?"
- Find people with shared hobbies
- Build a friend group to hang out with
- Meet people across different majors/backgrounds
- Join clubs or recurring communities
- Other: [text input]

**Q6 — Confirmation + Dashboard Creation**
> Copilot summarizes: "Based on your answers, here's your 3-month plan: [targets]. I'll track your progress and suggest the best events and people to help you hit these goals. Ready to start?"
- ✅ Looks good — Create my dashboard
- ✏️ Let me adjust something

### AI-Generated Targets (examples by goal type)

| Goal | Targets Generated |
|---|---|
| Land a job in 3 months | 15 referrals, 10 career events, 20 professional connections, 5 alumni conversations |
| Grow network (no deadline) | 5 events/month, 10 new connections/month |
| Make friends + find community | 3 social events/week, 8 new connections, 2 clubs joined |
| Explore career options | 2 info sessions/week, 5 professionals met, 3 fields explored |

Targets are stored as `GoalMilestone` records with `target_count`, `current_count`, `unit` (events / connections / referrals).

---

## 📊 Goal Dashboard

### Metrics tracked

**Career track**
- 🏆 Referrals received (`referral_count`)
- 📅 Career events attended (`career_events_attended`)
- 🤝 Professional connections made (`professional_connections`)
- 🎓 Alumni conversations had (`alumni_conversations`)
- 📝 Interview / workshop sessions attended

**Social track**
- 🎉 Social events attended
- 👥 New friends made
- 🏛️ Clubs / communities joined
- 🔁 Recurring event attendance (habit streak)

### Event Weightage System

Each event has a `contribution_score` (0–1) per goal type, computed when added to the dashboard:

| Event type | Referral weight | Career event weight | Connection weight |
|---|---|---|---|
| Career fair | 0.9 | 1.0 | 0.6 |
| Alumni networking | 0.8 | 0.7 | 0.8 |
| Industry panel | 0.5 | 0.8 | 0.4 |
| Workshop / skill | 0.2 | 0.7 | 0.2 |
| Social mixer | 0.1 | 0.1 | 0.7 |
| Hobby / club event | 0.0 | 0.0 | 0.5 (social) |

Attending a career fair with `referral_weight=0.9` and `referral_target=15` → contributes `0.9/15 = 6%` toward the referral milestone.

### Dashboard UI

- Progress bars per milestone (current / target with %)
- Event list: Upcoming / Pending confirmation / Attended
- "Did you go?" prompts for past events → if No, contribution is subtracted
- "Add to Dashboard" from event detail or Copilot suggestion card
- "Ask Copilot to review" → Progress Review mode

---

## 🗺️ Live Campus Map — Goal-Relevance Color Coding

Event pins on the map are **color-coded by their relevance to the user's active goal**:

| Relevance score | Color | Meaning |
|---|---|---|
| 80–100% | 🟣 Purple (primary) | Directly advances your goal — high priority |
| 50–79% | 🟡 Amber | Partially relevant — worth considering |
| 20–49% | 🔵 Blue | Low relevance to your goal |
| < 20% | ⚫ Gray | Not relevant to your current goal |

Relevance is computed per-user from the event's tag overlap with the user's goal type, field, and milestone gaps.

Non-logged-in or no-goal users see all pins in the default purple.

---

## 🤝 Connections — Goal-Based Suggestions vs Open Search

### Connection Suggestions (goal-driven)
Suggestions shown on the Connections screen are **entirely based on the user's active goal**:

- **Career goal**: alumni in target field → industry professionals who attended goal-relevant events → peers with same major/track
- **Social goal**: users who RSVPed to same hobby/social events → users with overlapping interest tags → peers in same clubs
- Suggested user cards show **why** they're suggested: "Alumni in Software Engineering" / "Going to same career fair"

### Name / Email Search (open, goal-blind)
When the user types in the search box:
- Searches by name, email, or major across all users at the same university
- **No goal filtering** — if the user exists, they appear
- Results still show connection status (Connect / Pending / Connected)
- This is intentional: students often know who they want to reach; the AI should not block that

---

## 📅 Event Discovery

- Smart feed ranked by **goal relevance score** (highest relevance at top)
- Each event card shows a **relevance badge**: "⚡ 85% match to your career goal"
- Events can be added to Goal Dashboard directly from the card
- Tags drive both recommendation ranking and dashboard contribution scoring

---

## 🔔 Smart Notifications
- **Event proximity**: "You're 5 min from [Event]. Starts in 15."
- **Friend proximity**: "Alex is going to a career fair near you."
- **Goal nudge**: "You have a career fair tomorrow — it could add 12% toward your referral goal."
- **Schedule-aware**: No alerts during blocked schedule times
- **Privacy**: Each type independently togglable

---

## 📸 Social Layer (Post-MVP)
- Post photos/videos, tag events
- Live event feed

---

# 🧠 AI Components

- **Goal questionnaire engine**: structured Q&A → milestone generation → target numbers
- **Event relevance scorer**: per-user, per-event score based on goal type + field + milestone gaps
- **Dashboard contribution calculator**: event weight × milestone target → % contribution
- **Connection suggestion ranker**: goal-context scoring (alumni match, field match, event overlap)
- **Copilot Progress Review**: reads dashboard → narrative report + next best action
- **Event tagging**: auto-tag by type (career fair / networking / workshop / social / hobby)

---

# 🏗️ Architecture

- FastAPI + SQLAlchemy + SQLite (dev) → PostgreSQL (prod)
- React Native + Expo 54
- Zustand (client state) + React Query (server state)
- Azure OpenAI (GPT-4.1, Whisper)

**Key models:**
- `User`, `Goal`, `GoalMilestone` (quantified targets), `GoalEvent` (event-to-goal linkage with contribution score)
- `Event` (with `goal_relevance_score` computed per-user), `EventTag`
- `Connection` (bidirectional, pending/accepted/declined)
- `RSVP`, `UserInterest`, `UserLocation`, `NotificationPreference`

---

# 📱 Screens

## 🏠 Home
- "Your Next Move" (highest-relevance event)
- Today's plan
- Personalized feed ranked by goal relevance

## 🗺️ Map
- Events tab: pins color-coded by goal relevance (purple → amber → blue → gray)
- People tab: friends pinned at their RSVPed events
- Heatmap tab: event activity density
- Ghost mode FAB

## 🤖 Copilot
- **Goal Setup**: structured Q&A flow (not free-form), creates dashboard on completion
- Daily Plan, Networking, Elevator Pitch, Icebreaker, Follow-Up, Progress Review
- Suggestion cards: event + contribution label + "Add to Dashboard"

## 👤 Profile
- Avatar (uploadable)
- Goals summary → Goal Dashboard link
- Connections card → Connections screen
- Upcoming RSVPs
- Sign Out

## 📊 Goal Dashboard
- Milestone progress bars (referrals / events attended / connections / alumni convos)
- Event list by track (career / social)
- Contribution scores per event
- "Ask Copilot to review" button

## 🤝 Connections
- **Suggestions** (goal-based, shows reason)
- **Search** (name/email, open, no goal filter)
- Pending requests
- My connections (with remove)

## 📄 Event Detail
- Event info + tags
- Goal relevance badge + contribution estimate ("Adds ~8% toward referral goal")
- RSVP button
- Who's Going (with connection status)
- Add to Dashboard button

## 🎯 Onboarding
- Step 1: Account (name, email, major, grad year)
- Step 2: Copilot Goal Setup questionnaire
- Step 3: Interest tags (pre-selected based on goal answers)

---

# 🚀 MVP
- Structured Copilot goal setup → quantified milestones
- Goal Dashboard with referral / event / connection tracking
- Event relevance scoring + color-coded map pins
- Goal-based connection suggestions + open name search
- Event contribution weightage on dashboard

## 🔜 Post-MVP
- Alumni database integration
- Live user presence on map
- Peer proximity notifications (double opt-in)
- Social photo feed
- Org analytics dashboard

---

# 💰 Monetization
- Premium Copilot
- Sponsored events (with relevance disclosure)
- Org analytics + targeting tools

---

# 💣 Differentiation
> Unlike generic event apps, Campus OS connects every event and person to a **measurable goal outcome** — students always know *why* they're doing something and *how much closer* it gets them to what they actually want.
