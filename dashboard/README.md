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

## Pages

| Route | Page | What it shows |
|---|---|---|
| `/` | Feed | Pinterest-style grid of photo tiles with the reason for each, save and dismiss, filters; a tile opens its details. Roadmap, deadline and agent tiles are mixed in |
| `/roadmap` | Roadmap | Phases and steps toward the chosen goal, each linked to a feed opportunity when there is one |
| `/discover` | Career discovery | Paths that fit the student, what each expects, "Make this my goal" |
| `/saved` | Saved | Saved tiles in the same grid, soonest deadline first |
| `/agents` | Agents | Master, manager and worker agents with status, and an activity log |
| `/profile` | Profile | The persona, class year, interests, skills, location, and the history the agents read |

## Navigation dock

`src/components/Dock.tsx`, styled in `src/index.css` (`.dock-*`, `.glass`).

- Hidden by default. It slides in when the pointer reaches the left edge of the window and
  slides out shortly after the pointer leaves it. A small handle on the edge marks the spot.
- It shows for a moment on first load, opens when a link inside it gets keyboard focus, and
  closes on Escape.
- The pin at the bottom of the dock, or the button next to the logo, keeps it open. The page
  moves over to make room, and the choice is remembered in `localStorage`.
- Icons grow under the pointer, as in the macOS Dock. This is off when the system asks for
  reduced motion.
- On touch screens it stays visible; under 640 px wide it becomes a bar along the bottom.

## Design

Visual direction follows cluely.com: a blue sky header fading into a pale canvas, EB Garamond
for page titles, Geist for everything else, white rounded cards, a glossy blue primary button.
Tokens (colors, fonts, shadows) are in the `@theme` block at the top of `src/index.css`.

## State

`src/state/store.ts` holds what the student did: saved, dismissed and opened cards, finished
roadmap steps, the goal, and the profile. It is kept in `localStorage` under
`bearrok.dashboard.v2`. `rankFeed` orders the feed by the agent's score, raised for types the
student saves or opens and lowered for types they dismiss.

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
