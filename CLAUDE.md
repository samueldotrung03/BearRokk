# BearRok

A student opportunities app built for a Grok hackathon (event day: Thursday, November 19, 2026). An AI hands opportunities to the student instead of the student searching: a Reels-style feed of internships, events, clubs and programs that adapts to what they save, like and dislike, a roadmap to the career they want, and an application manager. A system of Grok agents does the searching on its own.

The idea is described in `README.md`. Keep that file at idea level: no specs, formats or milestones.

## Team and ownership

Three people share this repo and push to `main`.

| Role | Owns | Folder |
|---|---|---|
| A: agent backend and database (Brian) | Agent system, ranking, sign-in backend, storage | `backend/` |
| B: dashboard (Gia Khanh) | The app's pages and design | `dashboard/` |
| C: pitch website and demo | Pitch page, presentation | not in this repo yet |

Sessions here are usually working as A. Changes inside `dashboard/` touch a teammate's code: keep their visual design and class conventions, say in the summary which of their files changed, and never force-push. Before pushing, fetch and merge; teammates push often, and B also pushes to the `dashboard-ui` branch. Push only when asked.

## Layout

```
backend/              TypeScript on Node 24+, run directly (no build step)
  AGENT_SYSTEM.md     design of the agent system, and what is and is not built. Read this first.
  src/agents/         the agent system
    system.ts         one student's state, run triggers, and the run itself
    fleet.ts          worker job queue: concurrency cap, budgets, retry, dedupe
    scoring.ts        memory, feed ranking, custom-note signals, manager slot split
    brain.ts          what each agent level must do
    simBrain.ts       simulated agents over catalog.ts (invented postings)
    grokBrain.ts      live Grok agents (written, never run against a real key)
    api.ts            HTTP API and live event stream under /api/students/
  src/roadmap.ts      the roadmap writer: request shape, prompt, and the Grok call
  src/careers/        career guides for the Career discovery page: guide.ts (research and storage), api.ts (/api/careers/guides)
  src/grok.ts         xAI API client;  grokCli.ts  the same through the Grok Build CLI
  src/auth.ts         Firebase sign-in verification;  desktopAuth.ts  sign-in through the system browser
  src/calendar.ts, sheets.ts, resume.ts   Google Calendar, Google Sheets, résumé reading
  src/pipeline.ts, coordinator.ts, workers.ts, validate.ts   the first prototype, still served at /api/searches
  public/index.html   animated view of an agent run;  console.html  testing console
dashboard/            React 19, Vite, TypeScript, Tailwind CSS 4; also runs as an Electron app
  README.md           every page and how it works
  src/auth/           sign-in, account set-up, Google connections
  src/data/preferences.ts   the profile page's questions
  src/pages/          one file per page
```

## Commands

```
cd backend   && npm install && npm run dev      # http://localhost:8787  ( /  agent view,  /console )
cd backend   && npm test && npx tsc --noEmit
cd dashboard && npm install && npm run dev      # http://localhost:5173
cd dashboard && npm test && npx tsc --noEmit
cd dashboard && npm run app:dev                 # Electron window on the dev server
```

Electron's binary is not downloaded by `npm install` on this machine (npm skips install scripts); run `node node_modules/electron/install.js` in `dashboard/` once.

Run both test suites and both type checks before saying something works, and check UI changes in a browser, not only by compiling.

## How the agent system works

Master agent (reads profile, background, memory) -> search managers (4 slots, split over the kinds of opportunity the student wants; one kind wanted means all four work on it) -> worker fleet (scouts, readers, application readers) -> validation agents -> presentation manager -> feed. Runs start on their own: on a profile change, after five reactions, or on a schedule.

Rules that are easy to break:

- **Custom notes come first.** A student's notes on the profile page outrank ticked fields, restrictions and reaction history, in the master's brief, in validation and in ranking. A result a note rules out never reaches the feed.
- **Restrictions are rules,** not preferences. A result that breaks one is rejected.
- **No guessed facts.** A date, deadline or pay figure with no source behind it is shown as unknown.
- **Background is background.** Résumé and experience add areas to search behind what the student asked for, never ahead.
- **Model tiers:** master, managers, validators and presentation on the normal tier; the worker fleet on the low tier (`XAI_MODEL_NORMAL`, `XAI_MODEL_LOW`).
- **Sample data is labelled.** Without Grok the agents are simulated; pages must not present invented activity as live.
- **The feed aims for at least 12 cards.** After a run, while the feed holds fewer (`FEED_MIN`, default 12), the agents start another search on their own (trigger `fill`), up to `FEED_FILL_MAX_RUNS` (default 4) in a row; a failed run is not repeated. A dislike that leaves the feed short starts one too.

## Services and settings

- **Firebase project** `bearok-ef3fa` ("Bearok"): Authentication with Google and email/password enabled, Firestore database created. X sign-in is accepted by the backend but not switched on in Firebase.
- **`backend/.env`** is git-ignored and holds the settings; `backend/.env.example` lists them. The Firebase web values are not secrets and are also in `dashboard/src/auth/firebase.ts`. Never commit a Grok key, a service account file, or an OAuth client secret.
- **Grok** is meant to run on a Grok subscription through the Grok Build CLI (`GROK_TRANSPORT=cli`), not the paid API. The API path stays for a deployed version.
- **Temporary: the agents can run on Claude for testing** (`GROK_TRANSPORT=claude`, through the Claude Code CLI on the local Claude account, in `backend/src/claudeCli.ts`). It was switched on locally on 2026-11-18 because Grok access had not arrived. It bills the Claude subscription signed in on this machine, never an API key (`claudeCli.ts` drops any `ANTHROPIC_` key before calling the CLI), and since 2026-11-19 runs the normal tier on Opus and the worker fleet on Sonnet (`CLAUDE_MODEL_NORMAL`, `CLAUDE_MODEL_LOW` in `backend/.env`). The swap to Grok is planned for later on 2026-11-19. It must be swapped to Grok before the demo; `backend/SWAP_TO_GROK.md` has the steps and what to delete afterwards. Do not present Claude output as Grok.
- **Lasting Google connection** (`backend/src/googleOAuth.ts`): with a "Desktop app" OAuth client named in `GOOGLE_OAUTH_CLIENT_FILE`, a student connects Calendar and Sheets once; the backend keeps Google's refresh token in the profile section of their memory and makes fresh access itself (`POST /api/students/me/google/connect`, `/auth/google/callback`, `/google/token`). Without that client the app falls back to one-session access, kept in the browser for up to 55 minutes. While the consent screen is in Testing mode, Google ends refresh tokens after 7 days.
- **Google Cloud** (same project): Calendar API and the `calendar.events` scope are set up; Sheets needs the Sheets API enabled and the `spreadsheets` scope added. The consent screen is in Testing mode, so only listed test users can sign in with Google.

## The downloadable desktop app

`cd dashboard && npm run app:package` builds `release/BearRok-darwin-arm64/BearRok.app` with the backend inside it (`scripts/bundle-backend.mjs` copies `backend/src` and `backend/public` and installs their packages without `firebase-admin`). On a student's laptop:

- `electron/backend.cjs` starts that backend on port 8787 with Electron's own Node, and restarts it when the Grok connection changes. If a backend already answers on 8787 (development), it uses that one and starts nothing.
- No secret ships. Sign-in tokens are checked against Google's public keys (`backend/src/idToken.ts`). The student's memory goes to Firestore under their own sign-in (`STUDENT_STORE=account`, `backend/src/store/userFirestore.ts`); `backend/firestore.rules` lets each account reach only `students/{its own id}`. Those rules must be published in the Firebase console for this to work.
- The student connects their own Grok in Settings: the Grok app for the command line on their subscription, or an xAI API key kept encrypted on their computer. Until then the agents are simulated. Temporary, for testing: Settings also offers "Use Claude for testing" when the Claude app for the command line is on the computer (Opus and Sonnet); it goes when Grok is swapped in.
- The app is not signed or notarised, so macOS warns on first open on another Mac. Google sign-in only works for accounts listed as test users while the consent screen is in Testing mode; email and password sign-in works for anyone.

## Not built or not proven

- Live Grok has never run: no key or CLI login yet. The live agent chain itself has run, on Claude (see above). `npm run grok:check` in `backend/` is the first thing to run when there is one.
- Each student's memory is stored under their account id and reloaded when they connect (`Store.loadStudent` / `saveStudent`; `AgentSystem.memorySnapshot` / `restore`). It has two sections: the profile the student wrote, and what the app learned (reactions, found and rejected postings, searches run, run history, applications). Since 2026-11-19 it is in Firestore (`students/{id}/memory/profile` and `learned`), through the service account key at `backend/service-account.json` (git-ignored; `FIREBASE_SERVICE_ACCOUNT` in `backend/.env` points at it). Without that setting the backend falls back to the local file `backend/.data/store.json`. Each section is one document, so it is limited to 1 MB; a large résumé file stored in the profile section is the likeliest thing to hit that. Postings are stored during the search: as pending the moment a reader returns one, and in the feed the moment its reviews keep it (reviews run alongside the searching). A run that stops part way loses only pages still being read; the next run reviews what was left pending.
- The dashboard's feed, saved, applications and agents pages and the dock's agent panel read the backend through `dashboard/src/state/live.tsx` and send reactions back. They show only what the agents found: with no results yet, or the backend unreachable, they are empty and say why. The sample cards are still in `dashboard/src/data/sample.ts` but are no longer shown on those pages. The roadmap page is still sample data, and its own steps still link to sample opportunities. Career discovery reads its guides from the backend; its "Find my path" quiz and matches still rank the sample paths. The dashboard ranks the cards itself (`src/state/ranking.ts`); the backend's ranking only reaches the screen through each card's starting score and through what the backend leaves out. Application statuses are kept with the account: every status change in the app is sent to the backend's application manager (`live.setStatus`), which sets reminders and, with Google Calendar connected, the calendar event; the app takes the account's statuses, saves and likes when it connects. The Saved page's Sheet view shows the backend's tracker rows (`GET /api/students/:id/sheet`) and writes them to one linked Google Sheet (`POST .../sheet/sync`) while Google Sheets is connected; the link is kept in the profile section of the student's memory.
- The roadmap writer exists (`backend/src/roadmap.ts`, `POST /api/students/:id/roadmap`): one normal-tier call with web search that writes a roadmap from the student's profile, a career goal or one posting, and how people got in. For a career it is told to lay out open-ended options and related paths, not a sequence, and the route adds the text of the student's uploaded résumé. The posting form has run once on the Claude test path; the career form and Grok have never run. With no model connected it answers 503 and the dashboard shows its own rule-built draft, labelled as such. For a posting it also asks for the organizer's selection process, with X search; that field and `npm run roadmap:check` in `backend/` have only been tried on the Claude test path, if at all. A career request can carry the options the student picked, and the writer then builds the roadmap from those; that form has not run on Grok.
- Career discovery does (`backend/src/careers/`, since 2026-11-19): for any career a student types, one normal-tier call plans a guide and four low-tier calls research its sections in parallel (basics, what people in the job share on X, how to start, what the interviews ask), each section saved as it finishes, with one retry. Guides are shared by every student and kept in `backend/.data/career-guides.json`; "Search again" refreshes one, and "Add more" on one part (`POST /api/careers/guides/:slug/sections/:section/more`) asks that part's researcher for new items only, given what is already there, and merges them without repeats; if it finds nothing the part keeps what it had. Only Grok can read X: on Claude the X section is written as sample stories with made-up people and labelled as samples. A guide in progress is lost if the backend restarts (watch mode restarts it on every backend file edit).
- Not yet tried with real accounts: Google sign-in through the dashboard, a Google Calendar event, a Google Sheets export, PDF upload from the browser.

Keep this section and `backend/AGENT_SYSTEM.md` current when something here changes.

## Working conventions

- Plain language in anything a student reads. No emoji anywhere in the product or the docs.
- Comments say what the code is for or why, not what changed.
- Each feature gets a test that would fail if the feature broke; backend tests are in `backend/test/`, dashboard tests sit next to the code.
- Test accounts made against the real Firebase project are deleted when the test is done.
