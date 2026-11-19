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
| `/discover` | Career discovery | Paths that fit the student, what each expects, "Make this my goal" |
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
