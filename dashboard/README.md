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
| `/` | Feed | Two tabs. **For you**: a TikTok-style reel, one opportunity per screen with Save, Not for me, Details and Open; scroll, swipe, or use the arrow keys (or J and K). **Feed**: everything in a scrolling grid of cards, with search, a Filters menu (type, format, closing within two weeks) and sorting by best match, deadline or newest |
| `/roadmap` | Roadmap | Phases and steps toward the chosen goal, each linked to a feed opportunity when there is one |
| `/discover` | Career discovery | Paths that fit the student, what each expects, "Make this my goal" |
| `/saved` | Saved | Saved tiles in the same grid, soonest deadline first |
| `/agents` | Agents | Master, manager and worker agents with status, and an activity log |
| `/profile` | Profile | The persona, class year, interests, skills, location, and the history the agents read |
| `/signin` | Sign in | Mock sign-in screen. Nothing typed is sent or saved; any button goes to the feed |

The logo is the team's artwork: a bear over a shield with a rising arrow, in blue and gold, with the background removed. It is a picture, not a vector: `src/assets/logo.png` (in the app), `public/favicon.png` (browser tab) and `electron/icon.png` (desktop app icon: the logo on a black rounded square), with `electron/icon.icns` built from `icon.png` using `sips` and `iconutil`. These were made from a 278px screenshot, so they are soft at large sizes; replace them from the original file when it is available.

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

`src/state/store.ts` holds what the student did: saved, dismissed and opened cards, finished
roadmap steps, the goal, and the profile. It is kept in `localStorage` under
`bearrok.dashboard.v2`.

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
