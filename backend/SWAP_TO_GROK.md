# Swap to Grok

**The agents are temporarily running on Claude. This is for testing only. The product runs on Grok, and this must be switched before the demo.**

Set up on 2026-11-18, to be swapped on 2026-11-19 once Grok access is available.

## What is temporary

`GROK_TRANSPORT=claude` in `backend/.env` makes every agent (master, search managers, worker fleet, validation, presentation) call Claude through the Claude Code CLI on the Claude account signed in on this machine. The code for it is one file, `src/claudeCli.ts`, plus the `claudeCli` block in `src/config.ts`. Nothing else in the agent system knows which model it is talking to.

While it is on:

- the backend start-up line reads `agents: TEST MODE on Claude`,
- the agent view at `/` and the console at `/console` show "Live agents on Claude (test)",
- Settings in the dashboard shows Grok as not connected, with a line saying the agents are on Claude for testing.

## How to swap

1. Get Grok working, one of:
   - **Subscription (planned):** install Grok Build (`curl -fsSL https://x.ai/cli/install.sh | bash`), run `grok login`, then set `GROK_TRANSPORT=cli` in `backend/.env`.
   - **API key:** put it in `XAI_API_KEY` in `backend/.env` and remove the `GROK_TRANSPORT` line.
2. In `backend/`, run `npm run grok:check`. It makes one small real call with web search and prints the answer.
3. Restart the backend. The start-up line should name Grok, and the pages should say "Live Grok agents".
4. Run one full search from `/console` and read the results before trusting it on stage.
5. Run `npm run roadmap:check`. It writes one career roadmap and one roadmap for a posting already applied to, for an invented student, and checks each has what the dashboard draws (open-ended directions, steps for after applying, the selection process, real links). If a check fails, the prompt in `src/roadmap.ts` is the place to adjust. The roadmap writer asks for `x_search` as well as `web_search`; if the account rejects that tool, remove it in `writeRoadmap`.
6. Open the dashboard's Roadmap page. The status line should change from "Grok is not connected" to "Written by Grok". Open each roadmap you plan to show once, so its written version is saved in the browser and appears at once on stage. "Rewrite" asks again.

## What to expect to fix on the Grok side

The Grok paths have never run against a real account, so the first call may need adjusting:

- `src/grokCli.ts`: the shape of `grok -p --output-format json` output is read by guesswork (`answerText`), and web search in that mode may need `GROK_CLI_ALWAYS_APPROVE=1`.
- `src/grok.ts`: the model names in `XAI_MODEL_NORMAL` and `XAI_MODEL_LOW` are untested, and each must support web search together with JSON output.
- Run sizes: with a CLI, a run is limited to `LIVE_MAX_JOBS` worker jobs (see `.env.example`) so it finishes in a few minutes. Every posting those jobs bring back is reviewed by two validation agents, so validation is about twice as many calls as there are postings.

## After the swap

In the desktop app, also remove the Claude test connection: `findClaudeCli` and the `claude` mode in `dashboard/electron/backend.cjs`, the `claude` mode in `dashboard/src/lib/desktopBridge.ts`, and the "Use Claude for testing" button in `dashboard/src/pages/Settings.tsx`. On the development laptop the packaged app was pre-set to it in `~/Library/Application Support/BearRok/connections.json`.

Delete `src/claudeCli.ts`, the `claudeCli` block in `src/config.ts`, the `claude` branch in `src/grok.ts`, `src/agents/grokBrain.ts` and `src/server.ts`, the "on Claude" wording in `public/index.html`, `public/console.html` and the dashboard's Settings page, and this file.
