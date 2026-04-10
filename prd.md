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

## 🔔 Notifications
- 15 min / 30 min reminders
- Proximity-based alerts
- Smart prioritization

## 🗺️ Map Layer
- Live campus map
- Event markers
- Heatmap of activity

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
- Services: Event, User, Notification, Recommendation, Copilot, Location

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
- Nearby events
- Heatmap

## ➕ Create/Post
- Create events
- Upload content

## 📸 Feed
- Event activity

## 🤖 Copilot
- Recommendations
- Scripts

## 👤 Profile
- Goals (**by type**: career vs social), linked interests / hobbies
- Progress toward **both** goal tracks

## 📄 Event Detail
- Info + AI reasoning (**career fit and/or social / hobby fit** — e.g. “Matches your music / climbing goal”)

## 🔔 Notifications
- Alerts

## 🎯 Onboarding
- **Interests + hobby chips**
- **Goals** with **goal type** (career vs social) and short milestones
- Optional one-line **social preference** (“I want to meet people who…” — interests / context; policy-safe framing)

---

# 🚀 MVP
- Event feed (with **basic hobby / social tagging** where possible)
- Notifications
- **Goal input**: goal type (career / social), **interests / hobbies**, optional social preference line; **feed ranking** uses these signals at a minimal level

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
