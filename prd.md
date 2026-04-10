# 📘 Campus OS — README

## 🚀 Overview

Campus OS is an intelligent campus platform that combines:

- 📅 Event discovery (PulseCampus)
- 🤖 AI decision-making assistant (Campus Copilot)

It helps students move from **random participation → structured outcomes** by telling them:

> what to do, where to go, who to meet, and what to say.

The same system supports **career outcomes** (internships, skills, professional networking) and **social & community growth** (hobbies, casual meetups, meeting people for fun) so students are not limited to a recruiting-only lens.

---

## 🎯 Vision

> Build an operating system for student life that converts campus opportunities into real outcomes — jobs and skills, **and** friendships, community, and repeat habits worth showing up for.

---

## ❗ Problem

Students:
- Miss important events due to fragmented information
- Attend events randomly without clear outcomes
- Struggle with networking and follow-ups
- Lack structured guidance toward goals (internships, connections)
- Want **low-pressure ways to meet people** aligned with **interests and hobbies**, not only career mixers
- Find hobby and social events scattered across orgs, apps, and word of mouth — hard to discover and act on

---

## 💡 Solution

Campus OS:
1. Aggregates all relevant events
2. Personalizes discovery using AI
3. Recommends **high-ROI actions** for career goals and **high-fit actions** for social goals (hobby events, casual connection)
4. Guides execution (networking, follow-ups) with **context-aware** prompts — professional vs social / hobby settings
5. Tracks progress toward goals, including **social milestones** (e.g. try one new hobby event this month)

Goals and onboarding capture **interests, hobby tags, and optional social preferences** (framed as context and shared interests — not discriminatory filters) so recommendations and Copilot stay inclusive and safe.

---

# 🧩 Core Features

## 📅 Event Discovery (PulseCampus)
- Aggregation:
  - University events
  - Student org events
  - External platforms (Eventbrite, Meetup)
- AI Structuring:
  - Auto-tagging (tech, finance, career social, **hobby, community, casual social**)
  - Event type detection (networking, workshop, **club social, hobby meetup**)
  - Skill mapping (career) + **activity / interest mapping** (social)
- Smart Feed:
  - “For You” (blends career fit and **social-goal fit**)
  - “Today”
  - “Near You”
  - Optional emphasis: **career ROI vs social / hobby match** (user-tunable or goal-driven)

## 🔔 Smart Notifications
- **Event proximity**: "You're 5 min from [Event]. Starts in 15." Triggered within configurable radius (default 300 m)
- **Peer proximity**: "Someone interested in AI is nearby." Double opt-in required; fuzzy distance only ("nearby", not exact coordinates)
- **Friend proximity**: "Alex is at an event you saved."
- **Opportunistic discovery**: "A club you might like is meeting 2 buildings away right now."
- **Schedule-aware**: No proximity alerts during user's blocked schedule times
- **Standard reminders**: 15 min / 30 min pre-event reminders
- **Privacy**: Each notification type independently togglable; peer proximity requires mutual opt-in

## 🗺️ Live Campus Map
- **Opt-in presence map** showing events and students on campus
- **Event pins**: Tap to preview event + RSVP directly from map
- **Student pins**: Tap to see shared interests and mutual events (opt-in only)
- **Activity clusters**: When 5+ people at one location, pin pulses as a heatmap hotspot
- **Ghost Mode**: User sets visibility — `Everyone` | `Connections only` | `Off`
- **Time-limited sharing**: "Share location for 1 hr / 2 hr / Until I leave"
- **Fuzzy location**: Building-level precision by default (not exact GPS)
- **Map tabs**: `Events` | `People` | `Heatmap`

## 📊 Goal Progress Dashboard
**Concept**: After a Copilot conversation about goals, all suggested events appear on a structured dashboard — Copilot's memory of what it recommended and how well each recommendation paid off.

- **Dual-track**: Career dashboard + Social dashboard (if goal type is "both")
- **Milestones**: Set during onboarding or via Copilot (e.g. "Attend 3 networking events", "Join 1 hobby club"); displayed as progress chips
- **Events on dashboard**:
  - *Upcoming*: schedule fit indicator (🟢 fits your schedule / 🔴 conflicts)
  - *Past (unconfirmed)*: "Did you attend?" prompt — if No, event is removed and planned contribution is deducted
  - *Attended*: shows % contribution to goal milestone (e.g. "Added 12% toward networking milestone")
- **Copilot integration**: Copilot suggests an event mid-conversation → user sees a suggestion card → taps "Add to Dashboard" or dismisses
- **Progress Review mode**: New Copilot mode that reads dashboard state and produces a narrative progress report + next recommended action
- **Multiple goals**: Career and Social tracks tracked in parallel with separate progress bars

## 📸 Social Layer
- Post photos/videos
- Tag events
- Live event feed

## 🤖 Copilot
- **Goal setup** with **goal type / track** (e.g. career vs social) and milestones for both
- Daily planner
- **Recommendations** weighted by active goals (career ROI vs social / hobby fit)
- Networking assistant
- Conversation generator (**adapts tone**: elevator pitch vs low-pressure hobby / social icebreakers)
- Follow-up assistant
- Outcome tracking (professional and **social-goal completion**)

## 🌆 NYC / External Events
- Curated high-value events
- Travel-aware suggestions

## 🏢 Organization Dashboard
- Event management
- Analytics
- Targeting tools

---

# 🧠 AI Components
- Event tagging (career + **hobby / social dimensions**)
- Recommendation engine: **multi-objective or weighted scoring** when users have both career and social goals
- User modeling: skills and career intent **plus** hobbies, social intent, optional “who I’d like to meet” (interests / context, moderated where needed)
- Copilot reasoning (**career fit vs social fit** explanations)

---

# 🏗️ Architecture
- PostgreSQL, Redis, Kafka, Milvus
- Services: Event, User, Notification, Recommendation, Copilot, Location, **GoalProgress**
- **New models**: `UserLocation` (opt-in presence), `NotificationPreference`, `GoalEvent` (event-to-goal linkage)
- **Background task**: Geofencing via Expo TaskManager — polls nearby events/peers, fires local notifications
- **Copilot suggestion action**: Structured `suggestion` payload alongside chat response for dashboard integration

---

# 📊 Success Metrics
- Engagement (DAU/MAU)
- Conversion (attendance rate)
- Retention
- Outcome metrics (career)
- **Social-goal completion** (e.g. milestones hit)
- **Repeat attendance** at hobby / social-tagged events
- **Connections or follow-ups initiated** (if tracked)

---

# 📱 Screens

## 🏠 Home
- Your Next Move
- Today’s Plan
- Personalized events

## 🗺️ Map
- Tab bar: Events | People | Heatmap
- Event pins (tappable → preview + RSVP)
- Student pins (opt-in, tappable → shared interests)
- Activity heatmap overlay
- Ghost mode FAB (bottom-left)
- Location sharing duration sheet (1 hr / 2 hr / Until I leave / Off)

## ➕ Create/Post
- Create events
- Upload content

## 📸 Feed
- Event activity

## 🤖 Copilot
- Modes: Goal Setup, Daily Plan, Networking, Elevator Pitch, Icebreaker, Follow-Up, **Progress Review**
- Goal suggestion cards (event + contribution label + "Add to Dashboard" / Dismiss)
- Scripts and conversation prompts

## 👤 Profile
- Goals (**by type**: career vs social), linked interests / hobbies
- Goal Progress summary card → links to full Goal Dashboard
- Progress toward **both** goal tracks

## 📄 Event Detail
- Info + AI reasoning (**career fit and/or social / hobby fit** — e.g. “Matches your music / climbing goal”)
- “Add to Goal Dashboard” action (if Copilot hasn't already suggested it)

## 📊 Goal Dashboard
- Career Track: progress bar, milestone chips, event list (upcoming / awaiting confirmation / attended)
- Social Track: same structure (shown if goal type is “both”)
- “Ask Copilot to review” → opens Copilot in Progress Review mode

## 🔔 Notifications
- Per-type toggles (event proximity, peer proximity, friend proximity, reminders)
- Proximity radius setting (default 300 m)
- Schedule-aware blocking

## 🎯 Onboarding
- **Interests + hobby chips**
- **Goals** with **goal type** (career vs social) and short milestones
- Optional one-line **social preference** (“I want to meet people who…” — interests / context; policy-safe framing)

---

# 🚀 MVP
- Event feed (with **basic hobby / social tagging** where possible)
- Standard notifications (15/30 min reminders + event proximity)
- **Goal input**: goal type (career / social), **interests / hobbies**, optional social preference line; **feed ranking** uses these signals at a minimal level
- **Map**: events-only view (pins + heatmap); no live user presence yet
- **Goal Dashboard**: single-track milestone + event tracking with attendance confirmation

## 🔜 Post-MVP
- Live user presence on map (student pins, ghost mode)
- Peer proximity notifications (double opt-in)
- Dual-track dashboard (career + social in parallel)
- Progress Review Copilot mode

---

# 💰 Monetization
- Premium Copilot
- Sponsored events
- Org analytics

---

# 💣 Differentiation
> A system that converts campus opportunities into **structured outcomes** — not only jobs and skills, but also **community, hobbies, and real social growth** students actually want.

---

## 👨‍💻 Author
Shikhar
