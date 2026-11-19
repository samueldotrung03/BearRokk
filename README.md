# Student Opportunities

**An AI that hands opportunities to you, so you don’t have to go looking for them, and builds you a roadmap for reaching them.**

Student Opportunities is a tool for students, built on a system of Grok AI agents for a Grok hackathon. It covers more than internships: it brings you internships, career discovery, networking events, and other opportunities such as clubs, hackathons, research openings, and scholarships. The agents run constantly in the background. They search, keep the results up to date, and base everything on your preferences. You open the app and the opportunities are already there, presented as a feed like social media.

Finding an opportunity is only half of it. The app also creates a personal roadmap for each student: what to learn, in what order, and exactly which actions to take to get from where they are now to the career they want.

## The student problem

Most students know they should be building toward a career. Far fewer know which one, which opportunities lead to it, or how to get from where they are to an offer. Three difficulties compound each other.

**Figuring out a career path.** A first-year student who likes coding cannot easily tell whether that points to software engineering, data science, product, or research, or what each of those expects from an intern. Advice comes from scattered places: a senior’s story, a Reddit thread, a posting that lists ten requirements with no order to them. The student is left guessing what to learn first, which projects count, and when to start applying. Many find out about a deadline or a prerequisite only after it has passed.

**Locating opportunities efficiently.** Internships, networking events, career fairs, clubs, and programs are spread across company career pages, LinkedIn, Handshake, event sites, school newsletters, and community posts. The same opening is reposted in several places with different details, and listings stay up after they close. Finding what is real, open, and meant for someone at their level takes hours of searching that a student has to repeat every week.

**Getting anything personalized.** Job boards and event listings return the same keyword results to everyone. They do not know the student’s year, skills, interests, or which listings they already looked at and rejected. A freshman sees roles for juniors, and a student who has skipped every finance posting keeps getting shown finance. The search never gets better with use.

All three come from the same thing: the student has to do the looking. Students with a mentor or a well-connected network get a path and a shortlist handed to them. Everyone else gets a search box.

## The idea

Turn the search around. Instead of the student looking for opportunities, an AI finds them and brings them to the student, then shows the way to reach them.

- **It hands opportunities to you.** There is no query to write and no list of sites to check. The feed is filled before you open the app.
- **It runs constantly.** The agents keep working while you are away: finding new postings, dropping ones that have closed, and refreshing what you see.
- **It is based on your preferences.** What you tell the app about yourself, and what you do in it, decides what the agents look for. The more you use it, the better it fits.

- **It builds your roadmap.** Knowing an internship exists does not tell you how to get it. The app turns a goal into a step-by-step plan, and keeps that plan current as you make progress.

The student stays in charge of every decision about what to pursue and where to apply.

## What it brings you

- **Internships.** Openings that fit your year, skills, and interests.
- **Career discovery.** Paths and roles you may not have known to look for, based on what you like and what you are good at, with what each one expects.
- **Networking events.** Career fairs, company info sessions, meetups, and talks where you can meet people in the field.
- **Other opportunities.** Clubs, hackathons, research openings, scholarships, and programs.

## What the app does

The app has two halves that feed each other: a feed that brings opportunities to the student, and a roadmap that tells the student what to do about them.

### A feed that recommends opportunities like posts

Opportunities of every kind appear in one scrolling feed of cards, the way a social app shows posts. The student sets a few preferences to start: interests, class year, skills, and location. After that, the feed learns from history. Saving, dismissing, and opening cards teaches the app what the student wants, so similar opportunities rise and unwanted ones fall away. Each card says why it was recommended and links to the official posting or event page.

### A roadmap built for each student

Students struggle most with the question the feed alone cannot answer: “What do I actually need to do to get there?” The roadmap answers it.

- **It starts with career discovery.** For a student who does not yet know what to aim for, the app suggests career paths that match their interests and background and shows what each one involves.
- **It maps the path.** Once the student picks a path, a role, or a specific internship, the app works out what that goal requires, compares it with where the student is now, and lays out the steps in order.
- **Every step is an action.** The roadmap says what to learn and exactly what to do: take a course, build a project, join a club, go to a networking event, apply before a deadline.
- **It connects to the feed.** Steps link to real opportunities the agents have found, so the roadmap is something the student can act on today.
- **It keeps updating.** As the student completes steps or changes direction, the roadmap adjusts, and so does what the feed recommends.

## The Grok agent system

Grok powers every agent. The search for opportunities is automated: the agents start and repeat their work on their own, and are not just called when a user asks. The system has three levels.

```
              MASTER AGENT
   reads your profile, background, and memory
                    |
              MANAGER AGENTS
   organize the search, and design the feed and the roadmap
                    |
              WORKER AGENTS
   scrape the web and collect opportunity details
```

- **Master agent.** Reads the student’s profile, background, and memory of what they have done in the app. Decides what this student needs and passes that to the managers.
- **Manager agents.** Organize how the search is carried out and design how the results are presented to the student, both as feed cards and as roadmap steps. They command the workers.
- **Worker agents.** Go out to the web, scrape listings, and bring back the details of each internship, event, or other opportunity.

Results flow back up into the two things the student sees: the feed and the roadmap. The same agents that find opportunities also build and update each student’s roadmap. What the student does next is saved to memory, the master agent reads it on the next run, and the cycle continues.

## Team

Three people, provisional roles:

- **A · Agent backend and database.** The Grok agent system, memory, and storage.
- **B · Dashboard.** The feed, the cards, and the roadmap view.
- **C · Pitch website and demo.** The pitch page and the presentation.

The event is **Thursday, November 19, 2026**. Grok account access is expected around **2 p.m.**

## Open questions

- How much of the agent system runs live in the demo, and what is shown from prepared examples?
- Is the feed or the roadmap the centerpiece of the demo?
- What Grok access and budget will the team have?
- What is the submission time, and how long is the pitch?

## Status

This README describes the idea. An early backend prototype is in `backend/`; it predates the feed, career discovery, the roadmap, and the three-level agent system.
