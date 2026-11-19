# Agent system

Owner: A. Status: partly built. Section 9 says what exists.

The backend's job is to make the README true: Grok agents that run on their own, hand each student opportunities, adapt to what the student saves, likes and dislikes, build a roadmap, and manage applications. It is a multi-agent system: one master agent, several search managers working in parallel, and a fleet of worker agents. This document covers the agents, the data they share, the API the dashboard needs, and the order to build it in.

## 1. The run loop

One **run** is one pass of the whole agent system for one student. Runs start automatically.

```
   TRIGGER  (profile changed · enough new feedback · schedule · student request)
                                 |
                            MASTER AGENT
            reads profile, background, memory -> student brief
            decides how many search managers each category gets
                                 |
      +--------------+-----------+-----------+----------------+
      |              |                       |                |
   SEARCH         SEARCH                  SEARCH           SEARCH
   MANAGER 1      MANAGER 2               MANAGER 3        MANAGER 4
      +--------------+-----------+-----------+----------------+
                                 |
                          WORKER FLEET
        scouts  ->  extractors  ->  application readers
        (dozens of small Grok jobs running in parallel)
                                 |
                        VALIDATION AGENTS
             one per result, checks it against the brief
                                 |
                      PRESENTATION MANAGER
          scores the feed, writes reasons, updates the roadmap
                                 |
              feed · roadmap · applications · agent log
                                 |
          student saves / likes / dislikes -> MEMORY -> next run
```

Every agent is one Grok call with a fixed role, a JSON input and a JSON-schema output. Only workers and validators get the web search tool. Each agent writes to an activity log as it starts and finishes, which is what the dashboard's Agents page shows.

## 2. The agents

| Agent | How many per run | Input | Output |
|---|---|---|---|
| **Master** | 1 | Profile, background, memory summary, what changed since the last run | **Student brief:** goals, hard criteria (year, location, dates, eligibility), preferences, things to avoid. **Manager assignments:** which category and slice each search manager covers, and its share of the run budget |
| **Search manager** | Several, in parallel (4 slots to start) | Student brief and its own assignment, including what the other managers cover | **Jobs** for the fleet, then a merged set of candidates for its slice. Asks for more workers if results are thin |
| **Worker: scout** | Many | One search job | Leads: a title and a link |
| **Worker: extractor** | One per lead | One link | Details from the official page: organizer, type, eligibility, format, location, deadline, start time, preview image, with a quote and URL for each fact |
| **Worker: application reader** | One per kept opportunity | One application page | Prompts, required materials, deadline, each with its source quote |
| **Validator** | One per candidate, capped | One candidate and the student brief | **Verdict:** keep or reject with a reason, a corrected record, a fit score from 0 to 1, and which criteria it meets or misses |
| **Presentation manager** | 1 | Validated records, brief, memory | **Feed entries:** the "why you're seeing this" line and tags per card. **Roadmap changes:** steps to add, link or re-order |

Two more agents run on demand, not in every run:

| Agent | When | Output |
|---|---|---|
| **Career discovery** | Profile created or changed a lot | 3 to 5 career paths: what each is, why it fits, what it expects, first steps |
| **Roadmap builder** | Student sets or changes a goal | Phases and dated steps; steps link to validated opportunities when one fits |

### Custom notes come first

On the profile page the student can write custom notes: files with a title and free text. They are the highest-priority input in the whole system, above ticked fields, restrictions and reaction history.

- **Master agent:** reads the notes before the rest of the profile. What they ask for leads the brief, what they rule out goes into the things to avoid, and the notes are carried in the brief word for word (`brief.notes`) so no later agent works from a summary.
- **Search managers, validation agents, presentation manager:** each is told the notes override every other line of the brief. Validation checks them before any other criterion.
- **Feed ranking (`scoring.ts`):** a result a note rules out never reaches the feed, including results found before the note was written. A result a note asks for gets a boost larger than any swing from likes and dislikes, and its card says "Your notes ask for this".
- **Without Grok**, the simulated agents read notes by simple wording rules (`noteSignals`): words after "no", "not", "avoid", "skip", "don't show" or "already applied to" are ruled out, a capitalised name is ruled out as a name, and the remaining meaningful words are what is asked for. Live Grok reads the notes as written.

### Model tiers

Each level runs on a model matched to its job. The master, the managers and the validators run on the normal tier. The fleet is many small jobs, so it gets the cheapest, which is where most of the calls and most of the cost are.

| Level | Model tier | Default (`backend/.env` to change) |
|---|---|---|
| Master agent | Normal | `XAI_MODEL_NORMAL`, `grok-4.5` |
| Search managers | Normal | `XAI_MODEL_NORMAL` |
| Worker fleet (scouts, readers, application readers) | Low | `XAI_MODEL_LOW`, `grok-4.3` |
| Validation agents | Normal | `XAI_MODEL_NORMAL` |
| Presentation manager | Normal | `XAI_MODEL_NORMAL` |

The default names come from xAI's model list and are not yet tested: each one has to support web search together with JSON output on the team's account, which needs checking when the key arrives.

### Two ways to reach Grok

Set `GROK_TRANSPORT` in `backend/.env`. The agents are the same either way; only the piece that sends a prompt and reads the answer changes.

| | `api` (default) | `cli` |
|---|---|---|
| How | The xAI API over HTTPS (`src/grok.ts`) | The Grok Build CLI on this machine, `grok -p` (`src/grokCli.ts`) |
| Paid by | API credits, per call, `XAI_API_KEY` | The Grok subscription of whoever ran `grok login` |
| Good for | A deployed app with many students | Building and demoing on one laptop |
| Structured answers | Enforced by the API with a JSON schema | Asked for in the prompt, checked on return, one retry |
| Model tiers | `XAI_MODEL_*` | `GROK_CLI_MODEL_*`, otherwise the CLI's default for every level |
| At once | 8 worker calls | 3 CLI processes (`GROK_CLI_CONCURRENCY`) |

Cautions for `cli`:

- Grok Build is a coding agent that can read files and run commands. Each call runs in an empty temporary folder and the prompt tells it to use web search only. `GROK_CLI_ALWAYS_APPROVE=1` lets it use tools without asking, which web search may need; that also removes the approval step for anything a web page might talk it into, so turn it on only on a machine and account you are comfortable with.
- Every student's agents run on one person's subscription and its limits.
- Whether xAI's terms allow running an app this way has not been checked.
- Not yet run against the real CLI: its JSON output format and whether web search works in headless mode still need testing.

### Search managers scale to what the student wants

Search managers are not fixed one per category. Every run has the same number of manager slots, and the master decides how to fill them.

The categories are internships, events and networking, clubs and communities, and programs (research, scholarships, hackathons).

- **Student wants everything:** one manager per category.
- **Student wants only some categories:** the unused slots go to the categories they do want. Nothing is spent searching for types the student does not care about.
- **Student wants one category:** every slot becomes a manager for that category, each covering a different slice of it.

Example: a student wants internships but not events. The master launches four internship search managers and no events manager.

```
                          MASTER AGENT
               "this student wants internships only"
                               |
     +--------------+----------+----------+--------------+
     |              |                     |              |
 INTERNSHIP     INTERNSHIP           INTERNSHIP      INTERNSHIP
 MGR 1          MGR 2                MGR 3           MGR 4
 by field:      by employer type:    by location:    by source:
 software, data startups, big tech   near campus,    career pages,
                                     remote          program lists
     +--------------+----------+----------+--------------+
                               |
                         WORKER FLEET
```

The master splits a category along whichever lines fit the profile: field or role, employer type, location, or source. A student who wants two categories gets a mixed split, for example three internship managers and one clubs manager, following how much they engage with each.

The master reads the wanted categories from the types selected in the profile, from a typed request such as "internships only", and from memory. A student who keeps disliking events gets fewer event slots on the next run, then none.

Managers on the same category will find some of the same postings. Each assignment says what the other managers cover, and the fleet's shared dedupe (below) stops the same page being read twice.

### How the worker fleet runs

- **Job queue.** Managers do not call workers directly. They put jobs on a shared queue and the fleet pulls from it. One scout's leads fan out into many extractor jobs, so a run can have dozens of workers going.
- **Concurrency cap.** A fixed number of workers run at once (starting value 8), to stay inside Grok's rate limits.
- **Budgets.** Each run has a maximum number of jobs, split across managers by the master. A demo run is capped at about 20 worker jobs so it finishes on stage.
- **Retries.** A failed job is retried once and then reported. One failure never sinks a run.
- **Shared dedupe.** Before an extractor opens a page, the queue checks whether any worker already has that link, including under another manager. Reposts are merged before validation.
- **Activity log.** Every agent records when it starts, what it found, and when it finishes.

### What validation checks

1. **Criteria:** every hard criterion in the brief holds (open to this class year, right location or remote, inside the date window).
2. **Intent:** it is the kind of thing the student is looking for, not just a keyword match.
3. **Real and open:** the official page exists, the deadline has not passed, it is not a repost of something already stored.
4. **Evidence:** dates and deadlines have a quote behind them. Anything unsupported becomes "unknown" instead of a guess.

Rejected candidates are kept with their reason so the log can show the judgment, and so the same lead is not re-checked every run.

## 3. What starts a run

| Trigger | Rule (starting values, to tune) |
|---|---|
| Profile created or edited | Run immediately |
| Feedback | After 5 new save, like or dislike actions, or 1 new goal |
| Schedule | Every few hours per active student; for the demo, a button or a short timer so it happens on stage |
| Student request | A typed request becomes extra input to the master agent |

One run per student at a time; a trigger that arrives mid-run is queued once. A run has a hard budget (maximum worker jobs, maximum validations, timeout) so scheduled runs cannot drain the Grok allowance.

## 4. Memory and data

Firestore, one document tree per student.

| Collection | Holds |
|---|---|
| `students/{id}` | Profile and background: name, school, year, major, location, interests, skills, wanted categories, résumé text if provided |
| `students/{id}/interactions` | One document per action: opportunity, action (`save`, `like`, `dislike`, `open`, `apply`, `step_done`), time |
| `students/{id}/memory` | A rolling summary the master agent reads: affinities by type, field and tag, things to avoid, opportunities already shown |
| `students/{id}/feed` | Scored feed entries: opportunity id, score, reason, shown or not |
| `students/{id}/applications` | Status, deadline, prompts, reminder and calendar state |
| `students/{id}/roadmap` | Goal, phases, steps, done flags |
| `opportunities/{id}` | Validated records shared across students, with evidence and last-checked time |
| `runs/{id}`, `runs/{id}/jobs`, `runs/{id}/events` | One run's status and manager assignments, the fleet's job queue, and the activity log |

Interactions are raw and never rewritten. The memory summary is recomputed from them, so the scoring can change without losing history.

## 5. Recommendations

Modeled on the design of X's open-source For You algorithm ([xai-org/x-algorithm](https://github.com/xai-org/x-algorithm)): for each item, estimate how likely the person is to take each action, then combine those estimates with weights, positive for good actions and negative for bad ones.

```
score = 1.0·P(apply) + 0.6·P(save) + 0.4·P(like) + 0.1·P(open) − 1.0·P(dislike)
```

Then, as X does, adjust the list: lower repeated items from the same organizer or type so the feed stays varied, raise items with a near deadline, drop anything already seen or disliked.

Where the probabilities come from, in two steps:

- **First version (hackathon):** computed, not a trained model. Each student has affinities for features of an opportunity (type, field, tags, format, organizer). Every action moves the affinities of that card's features up or down. P(action) is built from the validator's fit score plus those affinities. This is cheap, instant, and visibly reacts to a like or dislike.
- **Later:** replace the computed estimate with a learned one once there is real interaction data. X uses a trained transformer for this; that needs data and time this project does not have yet.

The weights above are starting guesses. This is the X design at small scale, not X's code or model, and the pitch should say so.

Feedback also changes the **search**, not only the order: the memory summary the master agent reads includes what the student keeps liking and disliking, so the next brief asks for more of one and none of the other, and the master moves search manager slots toward the categories the student engages with.

## 6. Application manager

| Part | Plan |
|---|---|
| Statuses | `interested`, `to_apply`, `applying`, `applied`. Set by the student from a card or the application list |
| Prompts and requirements | An application reader from the fleet reads the application page and extracts questions, required materials, and the deadline, each with its source quote. Pages behind a login are marked "sign in on the employer's site to see the questions" |
| Applying in the app | The student drafts answers next to the prompts and the app tracks what is finished. Submitting still happens on the employer's own page, opened from the app |
| Reminders | When a status becomes `to_apply` or `applying`, reminders are created automatically: 7 days, 2 days and the day of the deadline. Removed when it becomes `applied` |
| Google Calendar | Same trigger adds the deadline to the student's calendar. Needs Google sign-in with calendar permission. Fallback that needs no sign-in: an "Add to Google Calendar" link and an `.ics` file per deadline |
| Unknown deadline | No calendar entry is invented. The app asks the student to confirm a date |

## 7. API for the dashboard

Shapes follow `dashboard/src/types.ts` so connecting is a mapping, not a redesign.

| Call | Purpose |
|---|---|
| `GET/PUT /api/students/:id/profile` | Profile; a change triggers a run |
| `GET /api/students/:id/feed` | Ranked cards with reasons |
| `POST /api/students/:id/interactions` | `{ opportunityId, action }`; re-ranks at once and may trigger a run |
| `GET /api/students/:id/career-paths` | Career discovery |
| `GET/PUT /api/students/:id/roadmap` | Roadmap, set goal, mark step done |
| `GET /api/students/:id/applications`, `PUT .../:oppId` | Application list, set status, save drafts |
| `GET /api/students/:id/agents` | Current agent statuses and activity log for the Agents page |
| `POST /api/students/:id/runs` | Start a run by hand (demo button) |

Changes needed to match the dashboard:

- Opportunity types grow from `club`, `event` to also `internship`, `hackathon`, `research`, `scholarship`.
- One flat `deadline` and `startTime` on every card, in place of the nested `club` and `event` objects.
- New card fields: `baseScore` (the validator's fit score), `tags`, `foundAt`, `image`.
- The dashboard has save and dismiss today; it needs like and dislike added (B).

## 8. Build order

The event is Thursday, November 19, and the Grok key arrives around 2 p.m. Everything must also run without the key, on prepared data, so the demo has a fallback.

| Step | What | Result |
|---|---|---|
| 1 | Widen the types to match the dashboard; student profile, interactions and feed in the store; the feed and interactions API | Dashboard can switch from sample data to the backend |
| 2 | Scoring from section 5 and the memory summary | A like or dislike visibly re-orders the feed |
| 3 | The multi-agent run in prepared mode: master with manager assignments, several search managers, the job queue and worker fleet, validators, presentation manager, activity log | Agents page shows a real run; automatic triggers work; an internships-only student gets four internship managers |
| 4 | Live Grok for every agent, tested against the key | One real run end to end, with real internships |
| 5 | Roadmap builder and career discovery | Roadmap and discovery pages are live |
| 6 | Application statuses, reminders, calendar link | Application manager works, without Google sign-in |
| Later | Google Calendar sign-in, drafting answers, scheduled runs for many students, a learned ranking model | |

Steps 1 to 3 need no key and come first. If time runs out, steps 5 and 6 stay on prepared examples and are labeled as such.

## 9. What already exists

**Built (in `src/agents/`, watch it at http://localhost:8787/ after `npm run dev`):** the run loop from section 1 with the master agent, four search manager slots that scale to the student's categories, the worker fleet (job queue, concurrency cap, budgets, one retry, shared dedupe), validation agents, application readers, the presentation manager, memory and the scoring from section 5, automatic runs on profile change, on five reactions and on a timer, and a live event stream. Without a Grok key the agents are simulated: the same roles and data flow, with decisions made by rules over an invented catalog (`src/agents/catalog.ts`). The live Grok version of every agent is written (`src/agents/grokBrain.ts`) but has never run against a real key.

**Sign-in with Google or with email and password (backend only):** built on Firebase Authentication, project `bearok-ef3fa`. The frontend signs the student in with either method and sends the Firebase ID token as `Authorization: Bearer <token>` (or `?token=` on the live stream). The backend verifies it and gives that student their own agent system under `/api/students/me/`. `GET /api/auth/config` returns the Firebase settings the frontend needs, and `GET /api/auth/me` returns the signed-in user. No sign-in screen is included. The demo student under `/api/students/demo/` stays open. `GET /api/auth/me` also says which method was used and whether an email address has been verified. It switches on when `FIREBASE_WEB_API_KEY` and `FIREBASE_PROJECT_ID` are set in `backend/.env`.

**Application manager (backend only):** built. `PUT /api/students/:id/applications/:oppId` sets the status (`interested`, `to_apply`, `applying`, `applied`), saves draft answers, or supplies a deadline the posting did not state. `GET .../applications` lists them, soonest deadline first, with the prompts and materials the application readers collected. Marking `to_apply` or `applying` creates reminders on its own (a week before, two days before, the day of) and an "Add to Google Calendar" link. If the request carries the student's Google access token in `X-Google-Access-Token` (the frontend gets it at Google sign-in by asking for the `calendar.events` permission), the deadline is put on their Google Calendar as an all-day event with the same three reminders, and removed again when the status becomes `applied`. The token is used for that call and not stored. A posting with no deadline gets no reminder and is flagged `needsDeadline`. The Google Calendar call is tested against a stand-in, not yet against a real account. Reminders are data for the frontend to show; nothing sends an email or notification.

**Not built:** roadmap builder, career discovery, saving agent-system state to Firestore (it is held in memory and lost on restart), and the dashboard connection.

**Earlier prototype, still present:** In `backend/` today: one coordinator, two Grok search workers (clubs and events), deterministic validation (merging reposts, dropping unsupported dates, date and link checks), a Grok verify pass, a Firestore store and a local-file store, an HTTP API driven by a typed request, and 12 passing tests. The live Grok calls and Firestore have never run against real credentials.

Reused as is: the Grok client, the stores, the evidence rules, the deterministic validation, the prepared/live split. The coordinator becomes the master agent. The two search workers become scouts and extractors. The verify pass becomes the validation agent. New: the search managers and their assignment by the master, the job queue and fleet, the presentation manager, memory, scoring, triggers, the activity log, roadmap, career discovery, and applications.

## 10. Risks and open decisions

- **Time and cost per run.** A fleet means many Grok calls: a full run could be 30 to 60, most of them with web search, and take a few minutes. Rate limits are unknown until the account arrives; the concurrency cap is the control. The feed must show stored results instantly and update when the run finishes.
- **Sites that block reading.** LinkedIn and Handshake need a login. Workers will favor employer career pages and public listings.
- **Grok access is unconfirmed.** If the account has no API key or no search tool, the agents run on prepared data and the pitch says so.
- **Google Calendar.** Full automatic sync needs Google sign-in and an approved permission screen. Decide whether the calendar link fallback is enough for the demo.
- **Sign-in.** Decide between one demo student and real accounts. One demo student is assumed above.
- **Cover images.** The dashboard wants a photo per card. Posting preview images are often missing; a fallback per type is needed.
