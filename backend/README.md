# Backend: coordinator, Grok workers, validation, storage

Owner: A. TypeScript on Node 24+, no build step.

```
cd backend
npm install
npm run dev        # http://localhost:8787
npm test
```

With no configuration it runs in **prepared** mode: the rule-based coordinator and the two records in
`fixtures/prepared.json`, stored in `.data/store.json`. Copy `.env.example` to `.env` to switch on:

| Setting | Effect |
|---|---|
| `XAI_API_KEY` | Live search. Coordinator, search workers and validator all call Grok (`/v1/responses`, `web_search` tool, JSON-schema output). Run `npm run grok:check` first to confirm the account supports it. |
| `FIREBASE_SERVICE_ACCOUNT` | Path to the service account JSON. Searches and results are written to Firestore instead of the local file. |

## What happens to a request

1. **Coordinate** (`src/coordinator.ts`). The request becomes one brief per worker, with requirements kept apart from preferences and each constraint attached to the type it was said about. At most one follow-up question, only when the answer changes a search.
2. **Discover** (`src/workers.ts`). One worker per type runs in parallel. Each candidate carries the quote and URL behind every claim. One worker failing does not fail the search.
3. **Validate** (`src/validate.ts`, `src/workers.ts`).
   - Repeat announcements are merged into one record; the other pages go to `alsoSeenAt`.
   - A schedule, date or deadline with no quote behind it is set to null.
   - Live only: a second Grok pass opens the organizer page and corrects or rejects the lead.
   - Events that are past, outside the requested dates, or closed are dropped. Event date and registration deadline are never copied into each other; conflicts go to `uncertainties`.
   - Live only: the sign-up link is fetched. Dead links are dropped; pages that block bots are kept and flagged.
4. **Store** (`src/store/`). The search document is updated at every stage; results are saved when validation ends.

## API for the dashboard

All responses are JSON. CORS is open. Types are in `src/types.ts` (zod schemas, importable).

| Call | Body | Returns |
|---|---|---|
| `POST /api/searches` | `{ "request": "...", "mode": "auto" \| "prepared" \| "live" }` (`mode` optional) | `201 { search, opportunities: [] }` |
| `POST /api/searches/:id/follow-up` | `{ "answer": "..." }` (empty string skips the question) | `{ search, opportunities: [] }` |
| `GET /api/searches/:id` | | `{ search, opportunities }` Poll this about once a second. |
| `GET /api/searches` | | `{ searches }` latest 20 |
| `GET /api/health` | | `{ ok, store, live, model }` |

Errors are `{ "error": "message" }` with 400, 404 or 409.

### Search states (`search.status`)

| Status | Show |
|---|---|
| `scoping` | Reading the request. |
| `needs_follow_up` | `search.summary` and `search.followUp.question`. Send the answer to `/follow-up`. |
| `searching` | Progress per worker from `search.workers[]`: `type`, `status` (`pending`, `running`, `done`, `failed`), `candidateCount`. |
| `validating` | Checking candidates against organizer pages. |
| `complete` | Cards from `opportunities`. |
| `empty` | Nothing passed validation. Not an error. |
| `failed` | `search.error`. |

`search.origin` is `prepared` or `live` and every opportunity repeats it. Label prepared results on screen.

### Card fields

A full response for the demo request is in `fixtures/example-response.json`.

Both types: `title`, `type`, `organizer`, `sourceUrl`, `actionUrl`, `format` (`online`, `in_person`, `hybrid`), `location`, `fitExplanation`, `lastCheckedAt`, `evidence[]` (`field`, `quote`, `url`), `unknowns[]`, `uncertainties[]`, `alsoSeenAt[]`, `linkCheck`.

- Club: `club.meetingSchedule`, `club.membershipIntake`, `club.acceptingMembers`. `event` is null.
- Event: `event.startTime`, `event.endTime`, `event.timeZone`, `event.registrationDeadline`, `event.registrationOpen`. `club` is null.

Any field can be null. `unknowns` lists the important missing ones with display text, for example
`{ "field": "registrationDeadline", "label": "Registration deadline unknown" }`. Show those labels rather than hiding the row.

### Firestore layout

`searches/{id}` holds the search document. `searches/{id}/opportunities/{oppId}` holds one document per card, same shapes as the API.

## Still placeholders

- `fixtures/prepared.json` holds two invented records on `example.org`. Replace them with the real club and event once C has checked them by hand.
- The Grok calls follow the xAI docs but have not run against a real key yet.
