# Student Opportunities

**An AI that hands opportunities to you, so you don’t have to go looking for them, and builds you a roadmap for reaching them.**

Student Opportunities is a tool for students, built on a system of Grok AI agents for a Grok hackathon. It covers more than internships: it brings you internships, career discovery, networking events, and other opportunities such as clubs, hackathons, research openings, and scholarships. The agents run constantly in the background. They search, keep the results up to date, and base everything on your preferences. You open the app and the opportunities are already there, in a feed you scroll like Reels. Finding an internship should feel as easy and as entertaining as scrolling social media.

Finding an opportunity is only half of it. The app also creates a personal roadmap for each student: what to learn, in what order, and exactly which actions to take to get from where they are now to the career they want.

It also manages the applications themselves. It collects each application’s prompts and deadlines, tracks the status of everything the student is pursuing, lets them apply from within the app, and sets reminders and Google Calendar entries automatically.

## The student problem

Most students know they should be building toward a career. Far fewer know which one, which opportunities lead to it, or how to get from where they are to an offer. Three difficulties compound each other.

**Figuring out a career path.** A first-year student who likes coding cannot easily tell whether that points to software engineering, data science, product, or research, or what each of those expects from an intern. Advice comes from scattered places: a senior’s story, a Reddit thread, a posting that lists ten requirements with no order to them. The student is left guessing what to learn first, which projects count, and when to start applying. Many find out about a deadline or a prerequisite only after it has passed.

**Locating opportunities efficiently.** Internships, networking events, career fairs, clubs, and programs are spread across company career pages, LinkedIn, Handshake, event sites, school newsletters, and community posts. The same opening is reposted in several places with different details, and listings stay up after they close. Finding what is real, open, and meant for someone at their level takes hours of searching that a student has to repeat every week.

**Getting anything personalized.** Job boards and event listings return the same keyword results to everyone. They do not know the student’s year, skills, interests, or which listings they already looked at and rejected. A freshman sees roles for juniors, and a student who has skipped every finance posting keeps getting shown finance. The search never gets better with use.

All three come from the same thing: the student has to do the looking. Students with a mentor or a well-connected network get a path and a shortlist handed to them. Everyone else gets a search box.

## The idea

Turn the search around. Instead of the student looking for opportunities, an AI finds them and brings them to the student, then shows the way to reach them.

- **It hands opportunities to you.** There is no query to write and no list of sites to check. The feed is filled before you open the app.
- **It feels like social media, not a job board.** Internships come to you one after another, the way Reels do. You scroll, react, and keep going. Looking for opportunities stops being a chore and becomes something you would open the app for.
- **It runs constantly.** The agents keep working while you are away: finding new postings, dropping ones that have closed, and refreshing what you see.
- **It adapts to you.** You save, like, or dislike what it shows you, and each decision changes what the AI recommends next. The longer you use it, the more it becomes your own.

- **It builds your roadmap.** Knowing an internship exists does not tell you how to get it. The app turns a goal into a step-by-step plan, and keeps that plan current as you make progress.
- **It manages your applications.** Prompts, deadlines, statuses, reminders, and calendar entries are all handled in one place.

The student stays in charge of every decision about what to pursue and where to apply.

## What it brings you

- **Internships.** Openings that fit your year, skills, and interests.
- **Career discovery.** Paths and roles you may not have known to look for, based on what you like and what you are good at, with what each one expects.
- **Networking events.** Career fairs, company info sessions, meetups, and talks where you can meet people in the field.
- **Other opportunities.** Clubs, hackathons, research openings, scholarships, and programs.

## What the app does

The app has three parts that feed each other: a social-media-style feed that hands opportunities to the student, a roadmap that tells the student how to get there, and an application manager that handles everything about applying.

### A feed you scroll like Reels

Job searching today is work: open a board, type keywords, set filters, read through long listings, repeat. Most students put it off. Meanwhile the same students scroll social media every day without effort, because the app does the choosing and every swipe brings something new.

The app brings that experience to opportunities.

- **Opportunities are handed to you, one after another.** Open the app and the first internship is already on screen. Scroll and the next one appears. There is nothing to search for.
- **Each one is quick to take in.** An opportunity is presented like a post, not a wall of text: what it is, who it is for, why it fits you, and when it is due. The full details and the official page are one tap away.
- **You react like you would to a post.** Save it, like it, or dislike it, and keep scrolling.
- **It is meant to be enjoyable.** The feed mixes internships with events, clubs, and career paths so there is always something fresh. A few minutes of scrolling is a few minutes of real progress on your career.
- **The recommendations are the product.** As with any social feed, what makes it work is that the next thing shown is something you want to see. That is what the adapting AI below is for.

### An AI that adapts to each student

Adapting to the user is the core of the product. Two students who open the app on the same day should see different feeds, and one student’s feed should look different a month later.

- **Preferences set the start.** The student tells the app a few things up front: interests, class year, skills, and location.
- **Save, like, or dislike.** Every card has these three actions. Saving keeps an opportunity for later, liking asks for more like it, and disliking asks for less.
- **Every decision counts.** Each action is a signal the AI learns from. Likes and saves pull similar opportunities up the feed. Dislikes push that kind down and teach the agents what to stop looking for.
- **It shapes the search, not just the order.** The student’s decisions are saved to memory and read by the master agent, so they change what the agents go out and find next.
- **It shapes the roadmap too.** What a student likes and saves shows where they are heading, and the roadmap follows.

**Built on X’s recommendation algorithm.** The plan is to base this on the algorithm X uses for its For You feed, which xAI has published as open source ([xai-org/x-algorithm](https://github.com/xai-org/x-algorithm), Apache 2.0 license). That system predicts how likely a person is to take each action on a post, positive ones such as liking and negative ones such as “not interested”, and ranks the feed by combining those predictions. The same idea applies here with opportunities in place of posts, and save, like, and dislike as the actions. It is a proven design for feeds that learn from behavior, and it comes from the same company as Grok.

### A roadmap built for each student

Students struggle most with the question the feed alone cannot answer: “What do I actually need to do to get there?” The roadmap answers it.

- **It starts with career discovery.** For a student who does not yet know what to aim for, the app suggests career paths that match their interests and background and shows what each one involves.
- **It maps the path.** Once the student picks a path, a role, or a specific internship, the app works out what that goal requires, compares it with where the student is now, and lays out the steps in order.
- **Every step is an action.** The roadmap says what to learn and exactly what to do: take a course, build a project, join a club, go to a networking event, apply before a deadline.
- **It connects to the feed.** Steps link to real opportunities the agents have found, so the roadmap is something the student can act on today.
- **It keeps updating.** As the student completes steps or changes direction, the roadmap adjusts, and so does what the feed recommends.

### Application management, all in one place

Finding an opportunity still leaves the work of applying: collecting the prompts, remembering the deadlines, and keeping track of where each application stands. The app manages all of it, so the student never needs a separate spreadsheet, notes file, or calendar.

- **It gathers what each application needs.** The agents scrape the application prompts, questions, requirements, and deadlines for every opportunity and keep them with it.
- **It keeps track of everything.** Every opportunity the student is pursuing is in one list, with its status, its deadline, and what is still left to do.
- **The student can apply from within the app.** The prompts and materials are in front of them, and they work on the application without leaving.
- **The student marks a status.** Each opportunity is marked as *interested*, *to apply*, *applying*, or *applied*.
- **Reminders and calendar are automatic.** When something is marked *to apply* or *applying*, the AI sets reminders and adds the deadlines to the student’s Google Calendar on its own.

Everything involved in setting up and managing an application is handled by this app.

## The Grok agent system

Grok powers every agent. The search for opportunities is automated: the agents start and repeat their work on their own, and are not just called when a user asks. The system has four levels.

```
              MASTER AGENT
   reads your profile, background, and memory
                    |
              MANAGER AGENTS
   organize the search, and design the feed and the roadmap
                    |
              WORKER AGENTS
   scrape the web and collect opportunity details
                    |
             VALIDATION AGENTS
   check the work against the student's criteria
```

- **Master agent.** Reads the student’s profile, background, and memory of what they have done in the app. Decides what this student needs and passes that to the managers.
- **Manager agents.** Organize how the search is carried out and design how the results are presented to the student, both as feed cards and as roadmap steps. They command the workers.
- **Worker agents.** Go out to the web, scrape listings, and bring back the details of each internship, event, or other opportunity.
- **Validation agents.** Take what the workers bring back and check it before the student sees it. They make sure each opportunity actually meets the student’s criteria and is what the student is looking for, and that it is real and still open. Anything that fails is sent back or dropped.

Only validated results flow back up into the two things the student sees: the feed and the roadmap. The same agents that find opportunities also build and update each student’s roadmap. What the student does next is saved to memory, the master agent reads it on the next run, and the cycle continues.

## Team

Three people, provisional roles:

- **A · Agent backend and database.** The Grok agent system, the recommendation algorithm, application tracking with reminders and Google Calendar, memory, and storage.
- **B · Dashboard.** The feed, the cards with save, like, and dislike, the roadmap view, and the application manager.
- **C · Pitch website and demo.** The pitch page and the presentation.

The event is **Thursday, November 19, 2026**. Grok account access is expected around **2 p.m.**

## Open questions

- How much of the agent system runs live in the demo, and what is shown from prepared examples?
- Is the feed or the roadmap the centerpiece of the demo?
- How much of X’s algorithm can be adapted in the time available, and what simpler ranking stands in for the rest?
- What Grok access and budget will the team have?
- What is the submission time, and how long is the pitch?

## Status

The agent system is built in `backend/` and can be watched running: `cd backend && npm install && npm run dev`, then open http://localhost:8787/. Until Grok is connected it runs on simulated agents and sample data. Sign-in, the application manager and custom notes are built in the backend; the roadmap and career discovery are not. See `backend/AGENT_SYSTEM.md`.

The dashboard is in `dashboard/` (reel feed, roadmap, career discovery, saved, agents, a tabbed profile, settings, and sign-in with account set-up): `cd dashboard && npm install && npm run dev`, then open http://localhost:5173/. Sign-in, the profile and settings talk to the backend; the feed, roadmap and agents pages still show sample data. See `dashboard/README.md`.
