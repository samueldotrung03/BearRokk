# Dashboard: feed, roadmap, career discovery

Owner: B. React 19, Vite, TypeScript, Tailwind CSS 4. Node 24+.

```
cd dashboard
npm install
npm run dev        # http://localhost:5173
npm test
npm run build      # typecheck, then production build in dist/
```

This is a design template. Everything on screen comes from `src/data/sample.ts`: invented
organizations, an invented student (Maya Tran), links to `example.org`, dates set relative to
today, and placeholder photos hotlinked from Unsplash (a card shows an icon panel if its photo
does not load). The header shows a
"Sample data" label on every page. Nothing calls the backend yet.

## Desktop app

The same dashboard runs as an Electron app (`electron/main.cjs`).

```
npm run app            # build, then open it in an Electron window
npm run app:dev        # Electron window on the dev server; run `npm run dev` first
npm run app:package    # build release/BearRok-darwin-arm64/BearRok.app
```

The window gives the page no Node access, and links to outside sites open in the system
browser. Loaded from a file, the app uses hash routes (`#/roadmap`); in the browser it keeps
normal paths. The packaged app is unsigned and uses Electron's default icon; `release/` is not
committed.

## Pages

| Route | Page | What it shows |
|---|---|---|
| `/` | Feed | Two tabs. **For you**: a TikTok-style reel, one opportunity per screen with Save, Like, Dislike, Details and Open; scroll, swipe, or use the arrow keys (or J and K). **Feed**: a board that fills the window without scrolling the page: compact photo tiles on the left and the roadmap on the right (progress, the next step with a tick box, what follows). Hovering a roadmap step lights up its card. Search, a Filters menu (type, format, closing within two weeks) and sorting by best match, deadline or newest. Under 1024px wide it stacks and scrolls |
| `/roadmap` | Roadmap | A goal picker for the four career paths, each with its own plan. "What this goal asks for" compares the goal's requirements with the student's skills and finished steps. Phases of action steps (learn, build, join, attend, apply), each linked to a feed opportunity, with the next one marked. Apply steps carry the application status. Cards the student saved or liked are offered as steps to add. Progress, upcoming deadlines, and a summary of where the student stands |
| `/applications` | Applications | Everything the student is applying to. Status (interested, to apply, applying, applied), deadline, what is ready, the questions with a draft box each, a checklist of materials, reminders at 7 days, 2 days and the day of the deadline, an "Add to Google Calendar" link and an `.ics` file. Submitting happens on the organizer's own page |
| `/discover` | Career discovery | Learn any career: type one (or pick the goal, a best match or a guide already researched) and the agents research a four-part guide: the basics, what people in the job share on X, what the interviews ask, how to start. The parts are tabs, one shown at a time (click, or press 1 to 4). Each part has "Add more", which opens a window where the student writes what they want more of, with three requests the agents suggest for them and their earlier asks on that part; the agents add only new items, and the window shows their progress. One line says what the agents are doing while parts fill in; "Search again" refreshes the whole guide. "Not sure? Find my path" opens the quiz and matches. Press / to search |
| `/saved` | Saved | Saved tiles in the same grid, soonest deadline first |
| `/agents` | Agents | Master, manager and worker agents with status, and an activity log |
| `/profile` | Profile | Four tabs, saved as you type and sent to the backend. **Experience** (`ProfileExperience.tsx`): upload a résumé (PDF or text, up to 5 MB, signed-in students only; the backend keeps the file and reads its text for the agents), LinkedIn and other links, and experience entries the student adds one at a time, each with type, role, organization, location, dates or "still doing this", what I did, skills used and a link, every field optional. **Career interests**: what to look for, about 45 fields as tick-lists in six groups with a top field and add-your-own, then roles, where I want to end up, what I want out of it, about me. **Restrictions**: rules no result may break (where, when, pay, who can apply, never show me). **Custom notes**: note files the student creates, titles and writes freely; the agents read them first and they override the other two tabs. The questions are in `src/data/preferences.ts` |
| `/settings` | Settings | **Connections**: Grok (status read from the backend), Google, Google Calendar and Google Sheets (each asks Google for that permission; Sheets can export the application tracker to a new spreadsheet). **On this computer**: switches for screen recording, full disk access and control. In the desktop app on a Mac these show what macOS has granted and open the right pane of System Settings; in a browser they only save the choice. No agent uses these three yet. **Agents and reminders**: how often agents search on their own, Run now, and when deadline reminders fire (sent to the backend). **Account and data**: change password, resend the confirmation email, sign out, download my data, clear history, delete account |
| `/signin` | Sign in | Real sign-in through Firebase (project `bearok-ef3fa`): Google, X, or email and password, plus create account and password reset. The rest of the app redirects here until someone signs in or chooses "Look around without an account" |
| `/signup` | Create an account | Four steps on the same layout as sign-in. **Account**: first and last name, email, password with live requirements, confirm. **About you**: school, major, class year, location. **Interests**: interests and skills. **Goals**: careers being considered, kinds of event to look for, and which other kinds of opportunity the agents should find. Set-up is required: an account from Google or X starts at step two, is asked to check its first and last name, and cannot reach the feed until it finishes |
| `/forgot-password` | Forgot password | Enter an email, get a reset link from Firebase, with a 30-second wait before sending again. The message is the same whether or not the address has an account |

## Sign-in

`src/auth/`. `AuthProvider` holds who is signed in; `useAuth()` gives pages the user, `getToken()` for backend calls, and `signOut()`. After sign-in the app asks the backend's `/api/auth/me` whether it accepts the token, and the Profile page shows the answer. The backend address is `VITE_API_URL`, default `http://localhost:8787`.

- The three account pages share `src/auth/ui.tsx` (the sky panel and card, fields, messages, buttons) so they look the same.
- Creating an account stores the name on the Firebase account, emails a link to confirm the address (asked for, not required), saves the profile in the app, and sends it to the backend, which starts that student's agents.
- Whether an account has been through "About you" is remembered per account in this browser (`src/auth/onboarding.ts`), so signing in on another device asks once more.
- The reset link opens Firebase's own page for choosing the new password.
- Google and email are switched on in Firebase. X is not yet, so that button reports "not switched on yet".
- The feed, roadmap and other pages still read sample data; only sign-in talks to the backend so far.
- Desktop app: Google and X sign-in open in the system browser, never in a window of the app. The app opens `<backend>/auth/desktop`, the student signs in there, and the backend hands the result to the app (`src/auth/desktop.ts`, `backend/src/desktopAuth.ts`). The backend must be running for this. Email sign-in happens in the app itself.
- The Google and X buttons are never locked while a sign-in is open elsewhere. Closing that window or tab leaves the button ready, and clicking it again starts over.

## Account menu

The round button at the top right of every page (`src/components/ProfileMenu.tsx`) opens a menu with Profile and Settings. It closes on Escape, on a click elsewhere, and when the page changes. Settings also sits above Profile at the bottom of the dock.

The logo is the team's artwork: a bear over a shield with a rising arrow, in blue and gold, with the background removed. It is a picture, not a vector: `src/assets/logo.png` (in the app), `public/favicon.png` (browser tab) and `electron/icon.png` (desktop app icon: the logo on a black rounded square), with `electron/icon.icns` built from `icon.png` using `sips` and `iconutil`. These were made from a 278px screenshot, so they are soft at large sizes; replace them from the original file when it is available.

Clicking an opportunity opens one window sized to the screen, so nothing scrolls on a laptop. It has three columns: the photo with the title, place, deadline and fit score; the reason it was recommended, key dates (found, last checked, start, deadline, reminders once it is tracked, and a Google Calendar link), what applying takes, and Save, Like, the official posting and the application status; and a side column with its place on the roadmap (the step before it, its own step and the one after, each with a tick box, or an "Add as a step" button) and an **Ask about this** bar. The bar's answers are built from the card's own data in `src/lib/ask.ts` and say so when the posting does not state something; in the product the question goes to Grok. Under 1024px wide the columns stack and the window scrolls.

The dock's small **Agents live** button opens a window with the week's usage, the agents working now and the latest activity.

## Navigation dock

`src/components/Dock.tsx`, styled in `src/index.css` (`.dock-*`, `.glass`).

- A liquid-glass sidebar that runs the full height of the window on the left. It is hidden by
  default, slides in over the page when the pointer reaches the left edge, and slides out
  shortly after the pointer leaves. A small handle on the edge marks the spot.
- It always shows the name beside each icon. A line separates the BearRok name from the pages.
  Each icon is a white Phosphor glyph on a glowing orb of three colors (set per page in
  `dockItems`); the colors swirl on hover and on the current page.
- The space between the pages and Profile holds a live panel: pages the agents read this week,
  today's Grok budget, and counts for the feed, saved cards and roadmap progress. The agent
  numbers are sample values from `agentUsage` in `src/data/sample.ts`; the three counts are
  real app state. The panel is hidden in windows under 700 px tall.
- It shows for a moment on first load, opens when a link inside it gets keyboard focus, and
  closes on Escape.
- The pin at the bottom, or the button next to the logo, keeps it open. Pinned, the page moves
  over to make room, and the choice is remembered in `localStorage`.
- On touch screens it stays visible; under 640 px wide it becomes a bar of icons along the bottom.

## Design

Type, colors, the primary button and the "b." logo match the pitch site: Instrument Serif for
page titles, DM Sans for everything else, navy ink `#152b43`, and a flat blue `#245bd8` button
with a 9 px radius. The blue sky header and white rounded cards follow cluely.com. Tokens are
in the `@theme` block at the top of `src/index.css`.

## State

`src/state/store.ts` holds what the student did: saved, liked, dismissed (disliked) and opened
cards, finished roadmap steps, feed cards added to the roadmap, applications (status, draft
answers, materials gathered), the goal, and the profile. The application rules (reminders,
progress, calendar link and `.ics` file) are in `src/lib/applications.ts` and follow section 6 of
`backend/AGENT_SYSTEM.md`. It is kept in `localStorage` under
`bearrok.dashboard.v3`.

## Feed ranking

`src/state/ranking.ts` orders the feed. It follows the stages of the open-source X/Twitter
recommendation algorithm (github.com/twitter/the-algorithm) at a size that fits in one file.
None of that repository's code is used: it is Scala behind trained models, and it is licensed
AGPL-3.0, which would put the same license on this project.

| Twitter stage | Here |
|---|---|
| Candidate sources, in-network and out-of-network | A card is in-network when the student saved or opened its type, or the roadmap needs it. The rest are out-of-network and scaled by 0.75 |
| Visibility filtering | Dismissed cards and passed deadlines are dropped |
| Heavy ranker: weighted sum of predicted actions | `0.5 * P(open) + 1 * P(save) - 1.6 * P(dismiss)`, estimated from the agent's fit score and the student's history with that type |
| Heuristics | Boosts for the next roadmap step, deadlines within 7 and 14 days, and recent finds |
| Author diversity | Each card of a type already placed lowers the next one of that type |

The feed keeps its order while the student scrolls. "Refresh feed" on the last screen ranks it
again with what they saved and skipped. Each card shows up to two of the ranker's reasons, such
as "On your roadmap" or "Closing soon".

## Connecting the backend

`src/types.ts` reuses the backend's field names where they overlap (`sourceUrl`, `actionUrl`,
`format`, `fitExplanation`, `lastCheckedAt`, `unknowns`, `origin`). Differences to settle with A:

- The backend has two types, `club` and `event`. The dashboard also has `internship`,
  `hackathon`, `research` and `scholarship`.
- The dashboard card has one `deadline` and one `startTime`. The backend nests these in
  `event.registrationDeadline` and `event.startTime`, and has `club.meetingSchedule`.
- `baseScore`, `tags`, `foundAt`, `image` and `imageAspect` do not exist in the backend yet. The
  photo is meant to be the posting's own preview image, collected by the workers.
- Roadmaps, career paths, agent status and the student's history have no API yet.

To go live, replace the imports from `src/data/sample.ts` with fetches that return the same shapes.

## Roadmap built from what people actually did

The Roadmap page shows where the plan comes from. For each goal there is a set of profiles of people who got that role (`pathProfiles` in `src/data/sample.ts`), each with what they did beforehand and the roadmap steps that history matches. `src/lib/pathways.ts` counts how many of them did each step, splits the steps into common (60% or more) and rare (under 35%), and orders the steps inside each phase with the most common first. The page shows the counts as bars, a "N of M people did this" chip on every step, and the individual paths behind a "See the paths" button.

Every profile here is invented sample data, and no names are kept. Nothing reads LinkedIn yet. In the product this is a job for a profiles worker in the backend fleet, which would need a permitted source of profile data (LinkedIn does not allow scraping, so that means its official API, a licensed data provider, or profiles students share themselves).

## A roadmap per opportunity, only when asked

An opportunity's window does not show a roadmap by default. It has a **Start the roadmap** button, and the student decides. Pressing it builds a plan for that one opportunity in `buildOpportunityRoadmap` (`src/lib/roadmap.ts`) from the posting's own details: read the posting, any skill it names that is missing from the profile, one step per required material, one per application question, a review, and submitting, with dates worked back from the deadline and never in the past. Hackathons, events and clubs get their own steps (register, find a team, attend, follow up). The steps have tick boxes in the window, appear as their own card on the Roadmap page, count toward progress, and can be removed from either place, which also clears their done marks.

## Video in the For you reel, and a feed that reacts

Each For you card plays a short muted, looping clip (`video` on the opportunity) instead of a still photo. Only the card on screen plays; clicking the picture pauses it, a thin bar shows progress, and the photo is the poster and the fallback when a clip is missing or fails. The sample clips are free stock videos loaded from Mixkit, so they need a network connection.

The ranking runs again on every save, like and dislike. Cards the student already scrolled past keep their place; everything below the current card is re-ranked at once. A reaction counts in full for the same type and at half strength for sibling types (internship, research and scholarship are one family; event, hackathon and club the other).

## Feed filters

The Filters panel on the Feed tab filters by type, deadline window (this week, two weeks, a month, or no deadline), format, lowest fit score, and "only show" rules (saved, liked, on my roadmap, new today). Every choice shows how many cards it would leave given the search and the other filters, and a choice that would leave none is dimmed. Active filters appear as removable chips under the toolbar. The logic is in `src/lib/filters.ts`.

## Calendar

The Calendar page (`/calendar`) puts everything with a date on one month view: application deadlines, the reminders before them, start times, and roadmap steps, including the steps of any roadmap started for a single opportunity. `src/lib/calendar.ts` builds the list from the store. Each item is either **have to do** (orange: the student marked the opportunity "To apply" or "Applying", or already applied) or **should do** (blue: a roadmap step, or something saved or liked), and carries a sentence on why it is there. Picking a day shows its items with that reason, a tick box for roadmap steps, and links to the details, the roadmap or the applications. Tiles at the top count this week's items and anything overdue.

## AI features on every page

All of these are generated locally by rules over the sample data, each behind one function or interface that a Grok call can replace, and each page says so in a small line.

- **Ask BearRok** (button in the corner or Cmd/Ctrl+K, `src/lib/assistant.ts`): answers from the feed, roadmap, applications and calendar, and offers the next action as a button. Nothing changes until the button is pressed.
- **Command-/ launcher** (`src/components/Spotlight.tsx`, `src/lib/spotlight.ts`): a Spotlight-style search over pages, opportunities, roadmap steps and quick actions, with a preview pane and keyboard control.
- **Feed roadmap panel** (`src/lib/roadmapMatch.ts`): a coach line on what to do first and why, and the opportunities in the feed that would cover unfinished roadmap steps. Feed cards are a fixed 216 by 288.
- **Roadmap** (`src/lib/roadmapx/`): "Ask your roadmap" coach, Plan my week, readiness score, timeline view, "why this step" drawer with notes and resources, milestones, copy as text.
- **Career discovery** (`src/pages/Discover.tsx`, `src/components/discover/CareerGuide.tsx`, `src/lib/discover/guide.ts`): a career search and a four-part guide from `/api/careers/guides`, polled every two seconds while the agents research it or add more to a part. The parts are tabs (`role="tablist"`, arrow keys and 1 to 4); under each title a line says how many items it holds and what the last "Add more" found. The basics lead with the technical skills, grouped as tools, methods, knowledge and credentials, then a typical day, specialties, education, pay and outlook. What people say opens with a two-sentence summary over every post, and stories can be filtered by topic. Interview questions sit under their format with what a strong answer shows, and each format links ("How to prepare") to the steps of how to start that prepare for it (`prepares`); steps say when to do them. The "Add more" window is `src/components/discover/AskAgents.tsx`; a guest is named by an id kept in the browser so they see only their own asks. The "Find my path" quiz and match list sit behind a toggle; choosing a match opens its guide. The path detail view, "Ask about this career" and the compare table are no longer on the page (their components remain in `src/components/discover/`).
- **Applications** (`src/lib/apps/`): "Outline my answer" and "Check my draft" on every question (outlines use only profile and posting facts and leave marked blanks), readiness score, "What to do next", board view, follow-up checklist, notes, one .ics export.
- **Calendar** (`src/lib/cal/`): Today's brief, Plan my week with accept and undo, clash warnings, month, week and agenda views, personal items, filters, .ics export.
- **Agents** (`src/lib/agents/`): a live map of the hierarchy (master, search managers, scouts and readers, validators, presentation) with pulses along the connectors, driven by a seeded run engine with Run, Pause, speed and Reset. "Tell your agents" turns a typed instruction into the master agent's brief; a validation funnel shows what was dropped and why; usage, budget and memory cards. The run is a simulation on sample data and the page says so. A chip shows whether the backend on port 8787 is reachable.

## Every field, not only technology

- **14 career paths in five fields** (technology, finance and business, science, engineering and health, policy, law and society, media and creative). The four technology paths are in `src/data/sample.ts`; the other ten are compact specs in `src/data/fields.ts`, expanded into the same shapes: a roadmap, sample profiles for the "what people actually did" evidence, discovery details and step hours.
- **Roadmap goal picker:** pick a field, then a goal in it. **Career discovery:** a seven-question quiz that never assumes coding, the top matches with "Show all fields", and compare across fields.
- **Sample opportunities for every field** are in `src/data/opportunities-more.ts`, with `opportunityPaths` recording which paths each one leads toward.
- **The feed follows the goal** (`src/state/ranking.ts`): an opportunity that leads to the chosen career is boosted and labelled "Toward your goal", one from another field is pushed down, and anything open to all majors is left alone.
- While the backend runs simulated agents, the feed shows this sample set together with the backend's cards; real agent results are shown on their own. A backend card with no picture gets a stock clip for its type.

## Today, explanations, notifications and personal start

- **Dashboard** (`/today`, `src/pages/Today.tsx`, `src/lib/today/`, `src/components/today/`, `src/styles/dashboard.css`): the one place to keep track of everything. Four headline tiles (due this week, applications, roadmap, saved), then two columns. Left: the application pipeline by stage with readiness, what the goal asks for and which of it is met, profile strength, and new opportunities. Right: the next seven days with what is coming up and a box to add a reminder (the same reminders the Calendar keeps), the roadmap's next steps (tick them off in place), and what the agents are doing. Every card links to the page that owns it.
- **"Why this?"** on each reel card (`explain` in `src/state/ranking.ts`, `src/components/WhyThis.tsx`): the reasons behind the card's rank, taken from the same numbers the score uses, with "Show me less like this".
- **Field filter** in the Feed's Filters (`src/lib/filters.ts`), with a "My field" shortcut for the current goal's field.
- **Agents page shows the backend's run** when the backend has one (`src/lib/agents/fromLive.ts`), labelled by what ran it: Grok, the Claude test set-up, or simulated agents. With no backend it plays the local simulation.
- **Notifications** (`src/lib/notify/`, `src/components/DeadlineNotifier.tsx`): system notifications for deadlines, reminders, events and roadmap steps, switched on in Settings. Off by default; permission is only asked when the student switches it on.
- **Personal start** (`src/lib/personalize.ts`): a signed-in student's profile and field set the starting goal, and each account keeps its own saved state (`bearrok.dashboard.v3.<uid>`). A guest sees the sample student. Settings has "Start a clean demo".
- The sidebar, the Command-/ launcher and the Ask BearRok panel share one dark glass style; Command (or Ctrl) with 1 to 9 opens the first nine pages.
- **Keyboard shortcuts** (`src/lib/shortcuts.ts`, `src/components/ShortcutSettings.tsx`): Settings lists every shortcut (launcher, Ask BearRok, each page) and lets the student record a different one, remove one, or go back to the defaults. Only changes are saved (`bearrok.shortcuts`). The sidebar and the Ask button no longer show shortcut hints.
- **Light and dark** (`src/lib/theme.ts`, `src/styles/theme.css`, `src/components/ThemePicker.tsx`): the student picks Light, Dark or Match system on the sign-in pages or in Settings. The choice is kept on the device (`bearrok.theme`) and applied as `data-theme` on `<html>` before the first paint. Colors come from tokens in `theme.css`; each page stylesheet ends with a "Dark theme" block. New styles should use the tokens (`--surface`, `--color-line`, `--color-ink`, `--brand-text`) so they work in both.
- **Roadmap written for the student** (`src/pages/Roadmap.tsx`, `src/components/journey/`, `src/lib/roadmapx/journey.ts`, `src/styles/journey.css`): the student sets nothing up. There is one roadmap to their career goal and one for every job or program they track (the best few from the feed when they track none). A job roadmap checks the skills the posting names against the profile and experience, turns each missing one into a step, adds what at least half of the people who got similar roles did, then the application's own parts worked back from its date; once the application is marked applied it becomes what to do while waiting. A career roadmap is all recommendations, ranked by how many people who reached the goal did each thing, and any of them can be set aside with "Not for me". The page shows the work in four stages, the qualification check, and the paths of the people the roadmap rests on. Two looks: **Journey**, a road in perspective drawn with CSS 3D transforms, and **Overview**, the whole scope in quiet columns. Each roadmap takes its color from its career path. The comparison runs by fixed rules over sample paths, and the page says so; the backend has no roadmap builder yet. The earlier page with the coach and week plan is at `/roadmap/list`.
- **Roadmaps written by Grok** (`src/lib/roadmapx/ai.ts`, `src/state/aiRoadmap.ts`): for each roadmap the page sends the signed-in student's profile, experience, notes and restrictions, the goal or posting, and the application's status to the backend's roadmap writer, and draws the answer in the same Journey and Overview. The rule-built draft shows at once and is replaced when the written one arrives; a line above the roadmap always says which is on screen and never calls Claude's test output Grok's. Answers are kept in the browser per distinct request, so ticking a step does not ask again while a profile or status change does. Roadmaps are listed as Career, Going for, and Applied, with a search box once there are three or more.
- **Careers are explored, not prescribed** (`src/components/journey/CareerMap.tsx`, `careerJourney`, `careerSearch`, `relatedPaths` in `src/lib/roadmapx/journey.ts`): a career roadmap is a map with the goal in the middle, directions around it (skills, projects, communities, experiences, opportunities) and options in each, in no order; nothing is required and any option can be set aside. A search box suggests careers as the student types a career, role, skill or interest, with how much of each their profile already shows; any career can be opened without changing the goal, and "Make this my goal" commits to it. A typed career the app does not hold opens an empty map that only the backend's writer can fill. "Paths next to this one" lists neighbouring careers with how each connects. Postings keep the ordered Journey.
- **The career map is exhaustive and long**: beyond the main options it holds every skill the career expects, every posting, club and event in the feed for that career, and every line from the timelines of the people the map rests on ("What people actually did", with how many did each). It is drawn as a long page with a trunk and branches so it can hold any number of options, the detail card stays in view while scrolling, and the career search lists every career the app holds.
- **Careers are a board to pick from** (`src/components/journey/CareerMap.tsx`): the career view has no line or sequence. Options sit in clusters by kind, each marked "pick any, or none"; a plus adds one to "My path", a tray that stays in view and can be changed at any time. "See the mix that worked for someone" lights up the options one real path used and names the sections that person skipped, so it is plain that nothing is required.
- **The Toward line is the student's own.** The pencil on the board's goal lets them reword where a career roadmap leads; it is kept per career (`bearrok.roadmap.toward`) and is the goal sent to the roadmap writer.
- **Career and Applied tabs open in place.** Clicking a tab turns it into its search box where it stands, with the list beneath; the page does not scroll.
- **What a written roadmap adds for a posting:** a "What their process looks like" card with the stages the writer could source. It is absent for the rule-built draft and for careers.
- **Ask about this** on any step opens the assistant with that step and goal as the question.
- **My path on the Dashboard:** the Dashboard's roadmap card lists what the student added to their path, and falls back to the options most people took.
- **Build my roadmap.** When the student has picked from a career board, "Build my roadmap" in the My path tray turns the picks into the 3D journey, grouped by category (`planJourney` in `src/lib/roadmapx/journey.ts`). Each step has a "What to do" checklist, and "What else to do in each category" under it gives the next step and further recommendations per category, plus the categories left out. The picks are sent to the roadmap writer as `chosen`; its actions and recommendations replace the rule-built ones (`aiPlan` in `ai.ts`) and the picks themselves never change. "Change my picks" goes back to the board.
- **How to start, as a road.** In Career discovery, the "How to start" part of a guide has a "See these steps as a roadmap" button. It hands the guide's steps to the Roadmap page (`bearrok.roadmap.guides`, by career title) and opens them there as the 3D journey, in the guide's order and grouped by when the guide says to do them (`guideJourney` in `src/lib/roadmapx/journey.ts`). No hours are shown because the guide gives none, and sample steps are labelled as sample.
