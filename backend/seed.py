from database import SessionLocal, engine
import models
from datetime import datetime, timedelta

models.Base.metadata.create_all(bind=engine)

def seed():
    db = SessionLocal()

    if db.query(models.Tag).count() > 0 and db.query(models.User).count() > 0:
        print("Database already seeded.")
        db.close()
        return

    # --- Tags ---
    tags_data = [
        # Career
        ("software-engineering", "career"),
        ("product-management", "career"),
        ("consulting", "career"),
        ("finance", "career"),
        ("entrepreneurship", "career"),
        ("data-science", "career"),
        ("marketing", "career"),
        ("design", "career"),
        ("networking", "career"),
        # Social
        ("mixer", "social"),
        ("game-night", "social"),
        ("community", "social"),
        ("speed-friending", "social"),
        # Hobby
        ("photography", "hobby"),
        ("chess", "hobby"),
        ("climbing", "hobby"),
        ("music", "hobby"),
        ("cooking", "hobby"),
        ("gaming", "hobby"),
        ("hiking", "hobby"),
        ("art", "hobby"),
        ("film", "hobby"),
        # Academic
        ("research", "academic"),
        ("workshop", "academic"),
        ("lecture", "academic"),
        ("study-group", "academic"),
        # Wellness
        ("yoga", "wellness"),
        ("meditation", "wellness"),
        ("fitness", "wellness"),
        ("mental-health", "wellness"),
    ]

    tag_objects = {}
    if db.query(models.Tag).count() == 0:
        for name, category in tags_data:
            tag = models.Tag(name=name, category=category)
            db.add(tag)
            tag_objects[name] = tag
        db.flush()
    else:
        for tag in db.query(models.Tag).all():
            tag_objects[tag.name] = tag

    # --- Dummy Users ---
    dummy_users = [
        ("Priya Sharma", "priya.sharma@rutgers.edu", "Computer Science", 2027, ["software-engineering", "data-science", "chess"]),
        ("Marcus Johnson", "marcus.j@rutgers.edu", "Finance", 2026, ["finance", "consulting", "networking"]),
        ("Sofia Reyes", "sofia.r@rutgers.edu", "Psychology", 2028, ["yoga", "mental-health", "art"]),
        ("Ethan Kim", "ethan.kim@rutgers.edu", "Computer Science", 2027, ["software-engineering", "gaming", "music"]),
        ("Aisha Patel", "aisha.p@rutgers.edu", "Marketing", 2026, ["marketing", "photography", "mixer"]),
        ("Jordan Lee", "jordan.l@rutgers.edu", "Business", 2027, ["entrepreneurship", "networking", "consulting"]),
        ("Zoe Chen", "zoe.chen@rutgers.edu", "Design", 2028, ["design", "art", "film"]),
        ("Liam Torres", "liam.t@rutgers.edu", "Computer Science", 2026, ["software-engineering", "climbing", "hiking"]),
        ("Nadia Williams", "nadia.w@rutgers.edu", "Biology", 2027, ["research", "wellness", "meditation"]),
        ("Dev Anand", "dev.a@rutgers.edu", "Computer Science", 2027, ["data-science", "product-management", "chess"]),
        ("Maya Foster", "maya.f@rutgers.edu", "Communications", 2028, ["marketing", "film", "photography"]),
        ("Chris Park", "chris.p@rutgers.edu", "Finance", 2026, ["finance", "fitness", "networking"]),
    ]

    user_objects = []
    for display_name, email, major, grad_year, interest_names in dummy_users:
        user = models.User(
            display_name=display_name,
            email=email,
            major=major,
            grad_year=grad_year,
            university="Rutgers",
        )
        db.add(user)
        db.flush()

        for interest_name in interest_names:
            if interest_name in tag_objects:
                db.add(models.UserInterest(user_id=user.id, tag_id=tag_objects[interest_name].id))

        user_objects.append(user)

    db.flush()

    # --- Helper ---
    def dt(days_offset, hour, minute=0):
        base = datetime(2026, 4, 9)
        return base + timedelta(days=days_offset, hours=hour, minutes=minute)

    def add_event(title, description, location, organizer, starts_at, ends_at, tag_names, is_virtual=False, cover=None, rsvp_count=0, lat=None, lng=None):
        event = models.Event(
            title=title,
            description=description,
            location=location,
            organizer=organizer,
            starts_at=starts_at,
            ends_at=ends_at,
            is_virtual=is_virtual,
            cover_image_url=cover,
            rsvp_count=rsvp_count,
            lat=lat,
            lng=lng,
        )
        db.add(event)
        db.flush()
        for tag_name in tag_names:
            if tag_name in tag_objects:
                et = models.EventTag(event_id=event.id, tag_id=tag_objects[tag_name].id)
                db.add(et)
        return event

    # --- Events ---

    # Rutgers New Brunswick campus coordinate reference:
    # College Ave Student Center:   40.4986, -74.4470
    # Alexander Library:            40.5007, -74.4473
    # Hill Center (CS/Math):        40.5226, -74.4618
    # Rutgers Business School:      40.5001, -74.4460
    # Livingston Student Center:    40.5250, -74.4338
    # Rutgers SAC:                  40.5018, -74.4519
    # Hardenbergh Hall:             40.5009, -74.4451
    # Busch Student Center:         40.5233, -74.4661
    # Mason Gross School of Arts:   40.4981, -74.4417
    # Livingston Campus:            40.5250, -74.4338
    # Career Services (ASB II):     40.5007, -74.4479
    # Rutgers Athletic Center (RAC):40.5257, -74.4618
    # Zimmerli Art Museum:          40.4999, -74.4474
    # Douglass Campus Center:       40.4752, -74.4411

    # Day 0 — April 9
    add_event(
        "Tech Career Fair — Spring 2026",
        "Meet recruiters from 30+ top tech companies including Google, Meta, Stripe, and NJ startups. Bring resumes, wear business casual.",
        "College Ave Student Center, Rutgers",
        "Rutgers Career Services",
        dt(0, 10), dt(0, 15),
        ["software-engineering", "networking", "product-management", "data-science"],
        rsvp_count=312, lat=40.4986, lng=-74.4470,
    )
    add_event(
        "Chess Club Weekly Meetup",
        "Casual games for all skill levels. Beginners welcome — we'll teach you the basics. Blitz rounds at the end.",
        "Alexander Library, Room 201",
        "Rutgers Chess Club",
        dt(0, 18), dt(0, 20),
        ["chess", "community"],
        rsvp_count=24, lat=40.5007, lng=-74.4473,
    )
    add_event(
        "Morning Yoga on the Quad",
        "Start your Thursday right with a 45-minute flow session. Mats provided. All levels welcome.",
        "Livingston Student Center Lawn",
        "Rutgers Wellness Club",
        dt(0, 7, 30), dt(0, 8, 30),
        ["yoga", "wellness", "fitness"],
        rsvp_count=18, lat=40.5250, lng=-74.4338,
    )

    # Day 1 — April 10
    add_event(
        "Intro to Machine Learning Workshop",
        "Hands-on workshop covering ML fundamentals, scikit-learn, and a live kaggle mini-challenge. Bring a laptop.",
        "Hill Center, Room 116",
        "Rutgers AI Society",
        dt(1, 14), dt(1, 17),
        ["data-science", "software-engineering", "workshop"],
        rsvp_count=87, lat=40.5226, lng=-74.4618,
    )
    add_event(
        "Finance Networking Night",
        "Connect with professionals from Goldman Sachs, JP Morgan, and boutique banks. Panel + open networking. Business formal.",
        "Rutgers Business School, Levin Building",
        "Rutgers Finance Club",
        dt(1, 18, 30), dt(1, 21),
        ["finance", "networking", "consulting"],
        rsvp_count=145, lat=40.5001, lng=-74.4460,
    )
    add_event(
        "Photography Walk — New Brunswick",
        "Explore New Brunswick's streets and architecture through your lens. Any camera welcome — iPhone counts! Group debrief at a café after.",
        "Meet at George Street Corner",
        "Rutgers Photo Society",
        dt(1, 15), dt(1, 17, 30),
        ["photography", "art", "community"],
        rsvp_count=31, lat=40.4957, lng=-74.4510,
    )

    # Day 2 — April 11
    add_event(
        "Founder Stories: Building in NJ",
        "Three founders share honest stories — what worked, what failed, and how they kept going. Q&A + networking after.",
        "Rutgers Business School, Entrepreneurship Lab",
        "Rutgers Entrepreneurs",
        dt(2, 17), dt(2, 19, 30),
        ["entrepreneurship", "networking", "marketing"],
        rsvp_count=93, lat=40.5001, lng=-74.4460,
    )
    add_event(
        "Weekend Game Night",
        "Board games, card games, and a Mario Kart tournament. Come solo or bring friends. Pizza provided.",
        "Hardenbergh Hall Common Room",
        "Rutgers Social Club",
        dt(2, 19), dt(2, 23),
        ["game-night", "gaming", "community"],
        rsvp_count=56, lat=40.5009, lng=-74.4451,
    )
    add_event(
        "Open Mic Night",
        "Acoustic sets, spoken word, comedy — all welcome. Sign up for a 5-minute slot or just come to vibe.",
        "College Ave Student Center Underground",
        "Rutgers Arts Collective",
        dt(2, 20), dt(2, 23),
        ["music", "art", "community"],
        rsvp_count=72, lat=40.4986, lng=-74.4470,
    )

    # Day 3 — April 12
    add_event(
        "Sunday Meditation & Mindfulness",
        "Guided 30-minute meditation followed by a group journaling session. Cushions and tea provided.",
        "Rutgers SAC, Quiet Room",
        "Rutgers Mindfulness Club",
        dt(3, 10), dt(3, 11, 30),
        ["meditation", "mental-health", "wellness"],
        rsvp_count=21, lat=40.5018, lng=-74.4519,
    )
    add_event(
        "Cooking Class: Ramen from Scratch",
        "Learn to make tonkotsu broth, chashu pork, and soft-boiled eggs. Hands-on, all ingredients provided.",
        "Douglass Campus Center Kitchen Lab",
        "Rutgers Food & Culture Club",
        dt(3, 14), dt(3, 16, 30),
        ["cooking", "community", "hobby"],
        rsvp_count=28, lat=40.4752, lng=-74.4411,
    )

    # Day 4 — April 13
    add_event(
        "Product Management 101",
        "What does a PM actually do? A Google PM walks through the role, a mock PRD, and career paths. Q&A included.",
        "Zoom (Virtual)",
        "Rutgers Product Society",
        dt(4, 12), dt(4, 13, 30),
        ["product-management", "workshop", "software-engineering"],
        is_virtual=True, rsvp_count=204,
    )
    add_event(
        "Speed Friending — Meet New People",
        "Like speed dating but for friendships. Rotate through 10 conversations, 3 minutes each. Fun, low-pressure, and surprisingly effective.",
        "College Ave Student Center, 4th Floor Lounge",
        "Rutgers Social Connection",
        dt(4, 18), dt(4, 20),
        ["speed-friending", "mixer", "community"],
        rsvp_count=67, lat=40.4986, lng=-74.4470,
    )

    # Day 5 — April 14
    add_event(
        "UX Design Portfolio Workshop",
        "Review real portfolios, learn what recruiters look for, and get live feedback on your own work from a senior designer at Figma.",
        "Livingston Campus, Lucy Stone Hall",
        "Rutgers Design Guild",
        dt(5, 15), dt(5, 17, 30),
        ["design", "workshop", "product-management"],
        rsvp_count=49, lat=40.5250, lng=-74.4338,
    )
    add_event(
        "Rock Climbing Intro — Rail Bouldering",
        "First time? No problem. Experienced climbers will teach technique. Shoes and harness included.",
        "Rutgers RAC, Climbing Wall",
        "Rutgers Outdoor Adventure Club",
        dt(5, 16), dt(5, 19),
        ["climbing", "fitness", "community"],
        rsvp_count=22, lat=40.5257, lng=-74.4618,
    )
    add_event(
        "Consulting Case Practice Session",
        "Practice McKinsey-style cases with peers. Structured 45-minute pairs, then group debrief. Facilitator from a MBB firm.",
        "Rutgers Business School, Room 2-90",
        "Rutgers Consulting Club",
        dt(5, 17), dt(5, 19, 30),
        ["consulting", "networking", "workshop"],
        rsvp_count=61, lat=40.5001, lng=-74.4460,
    )

    # Day 6 — April 15
    add_event(
        "NJ Startup Mixer — Spring Edition",
        "300+ founders, engineers, and investors in one room. Hosted at a rooftop in New Brunswick. Open bar for the first hour.",
        "The Heldrich Hotel Rooftop, New Brunswick",
        "NJ Tech Alliance",
        dt(6, 19), dt(6, 22),
        ["entrepreneurship", "networking", "software-engineering"],
        rsvp_count=288, lat=40.4957, lng=-74.4490,
    )
    add_event(
        "Indie Film Screening + Discussion",
        "Screening of 'Past Lives' followed by a 30-minute director Q&A (recorded) and audience discussion. Popcorn provided.",
        "Mason Gross School of Arts, Black Box Theater",
        "Rutgers Film Society",
        dt(6, 18), dt(6, 21),
        ["film", "art", "community"],
        rsvp_count=85, lat=40.4981, lng=-74.4417,
    )

    # Day 7 — April 16
    add_event(
        "Data Science Career Panel",
        "Four data scientists from finance, healthcare, and tech share their paths and answer your questions.",
        "Hill Center, Room 124",
        "Rutgers Data Science Association",
        dt(7, 16), dt(7, 18),
        ["data-science", "networking", "research"],
        rsvp_count=112, lat=40.5226, lng=-74.4618,
    )
    add_event(
        "Hiking Trip — Delaware Water Gap",
        "10-mile moderate hike with scenic views. Bus leaves from College Ave at 8am. $12 for transport. Bring snacks and water.",
        "Departs from College Ave Student Center",
        "Rutgers Outdoor Adventure Club",
        dt(7, 8), dt(7, 18),
        ["hiking", "fitness", "community"],
        rsvp_count=34, lat=40.4986, lng=-74.4470,
    )

    # Day 8 — April 17
    add_event(
        "Marketing in the Age of AI",
        "How are brands using GPT, Midjourney, and personalization at scale? Panel of 3 CMOs + live demos.",
        "Zoom (Virtual)",
        "Rutgers Marketing Association",
        dt(8, 12), dt(8, 14),
        ["marketing", "workshop", "data-science"],
        is_virtual=True, rsvp_count=176,
    )
    add_event(
        "Art Journaling Drop-In",
        "No art experience needed. Supplies provided. A quiet 2-hour session to draw, collage, or just doodle while music plays.",
        "Zimmerli Art Museum, Workshop Room",
        "Rutgers Arts Collective",
        dt(8, 15), dt(8, 17),
        ["art", "mental-health", "wellness"],
        rsvp_count=19, lat=40.4999, lng=-74.4474,
    )
    add_event(
        "Hackathon Info Session — HackRU 2026",
        "Everything you need to know about HackRU: tracks, prizes, team formation, and tips from last year's winners.",
        "Busch Student Center, Main Hall",
        "HackRU Team",
        dt(8, 17), dt(8, 18, 30),
        ["software-engineering", "entrepreneurship", "workshop"],
        rsvp_count=143, lat=40.5233, lng=-74.4661,
    )

    # Day 9 — April 18
    add_event(
        "Internship Search Strategy Session",
        "Resume review + LinkedIn optimization + cold outreach templates. Bring your resume. Limited to 20 students.",
        "Career Services, ASB II",
        "Rutgers Career Services",
        dt(9, 13), dt(9, 15),
        ["networking", "workshop", "software-engineering"],
        rsvp_count=20, lat=40.5007, lng=-74.4479,
    )
    add_event(
        "Saturday Morning Run — Rutgers Campus",
        "5-mile easy run through campus. All paces welcome — we split into groups. Post-run coffee at Harvest Moon.",
        "Meet at College Ave Student Center Steps",
        "Rutgers Running Club",
        dt(9, 8), dt(9, 10),
        ["fitness", "community", "wellness"],
        rsvp_count=41, lat=40.4986, lng=-74.4470,
    )

    # Day 10 — April 19
    add_event(
        "Music Production Open Lab",
        "Ableton stations available. Bring headphones or use studio monitors. Experienced producers on hand for help. Drop in anytime.",
        "Mason Gross School of Arts, Studio B",
        "Rutgers Music Tech",
        dt(10, 14), dt(10, 18),
        ["music", "art", "workshop"],
        rsvp_count=33, lat=40.4981, lng=-74.4417,
    )
    add_event(
        "Venture Capital 101 — How Startups Get Funded",
        "A VC from Andreessen Horowitz breaks down term sheets, valuation, and how to get on a VC's radar as a student founder.",
        "Rutgers Business School, Levin Auditorium",
        "Rutgers Entrepreneurs",
        dt(10, 16), dt(10, 18),
        ["entrepreneurship", "finance", "networking"],
        rsvp_count=189, lat=40.5001, lng=-74.4460,
    )

    # Day 11 — April 20
    add_event(
        "Peer Tutoring — Algorithms & Data Structures",
        "TA-led group session covering graphs, dynamic programming, and common interview patterns. Bring questions.",
        "Hill Center, Room 312",
        "Rutgers CS Department",
        dt(11, 17), dt(11, 19),
        ["study-group", "software-engineering", "research"],
        rsvp_count=38, lat=40.5226, lng=-74.4618,
    )
    add_event(
        "International Food Festival",
        "Student orgs from 20+ countries serve traditional dishes. Free entry. Live performances throughout the afternoon.",
        "College Ave Student Center Plaza",
        "Rutgers Global Cultural Council",
        dt(11, 12), dt(11, 17),
        ["cooking", "community", "mixer"],
        rsvp_count=402, lat=40.4986, lng=-74.4470,
    )

    # Day 12 — April 21
    add_event(
        "UX Research Methods Workshop",
        "Learn user interviews, affinity mapping, and usability testing. Run a mini-study on a live prototype.",
        "Livingston Campus, Lucy Stone Hall",
        "Rutgers Design Guild",
        dt(12, 14), dt(12, 17),
        ["design", "research", "workshop"],
        rsvp_count=44, lat=40.5250, lng=-74.4338,
    )
    add_event(
        "Trivia Night — Mix & Match Teams",
        "Random team assignments = instant new friends. Categories: pop culture, science, NJ history, and memes.",
        "Busch Student Center Lounge",
        "Rutgers Residential Life",
        dt(12, 19), dt(12, 21, 30),
        ["game-night", "mixer", "community"],
        rsvp_count=79, lat=40.5233, lng=-74.4661,
    )

    # Day 13 — April 22
    add_event(
        "Wall Street Women in Finance Panel",
        "Five senior women in finance share their journeys, mentorship insights, and advice for breaking in.",
        "Rutgers Business School, Levin Auditorium",
        "Rutgers Women in Finance",
        dt(13, 17, 30), dt(13, 19, 30),
        ["finance", "networking", "consulting"],
        rsvp_count=167, lat=40.5001, lng=-74.4460,
    )
    add_event(
        "Sunset Quad Social — End of Week",
        "Wind down the week on the quad with good music, snacks, and no agenda. Just show up and meet people.",
        "College Ave Quad",
        "Rutgers Social Connection",
        dt(13, 18), dt(13, 21),
        ["mixer", "community", "speed-friending"],
        rsvp_count=95, lat=40.4992, lng=-74.4465,
    )

    # Day 14 — April 23
    add_event(
        "Intro to Meditation — 4-Week Series Kickoff",
        "Week 1 of a structured 4-week series on mindfulness and stress reduction. No experience needed. Free.",
        "Rutgers SAC, Quiet Room",
        "Rutgers Mindfulness Club",
        dt(14, 11), dt(14, 12, 30),
        ["meditation", "mental-health", "wellness"],
        rsvp_count=27, lat=40.5018, lng=-74.4519,
    )
    add_event(
        "HackRU 2026 — Opening Ceremony",
        "36-hour hackathon begins. Teams of 2–4. $30k in prizes. Tracks: climate, health, education, open. Food + caffeine covered.",
        "Livingston Student Center, Main Hall",
        "HackRU Team",
        dt(14, 17), dt(16, 17),
        ["software-engineering", "entrepreneurship", "design", "data-science"],
        rsvp_count=534, lat=40.5250, lng=-74.4338,
    )

    db.commit()
    db.close()
    print("Seeded database with tags and events.")


if __name__ == "__main__":
    seed()
