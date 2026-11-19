# Agent and contributor rules

BearRokk is a hackathon student opportunity finder. A manager Grok Bot reads a student's club or event request and coordinates worker bots (Club Scout and Event Scout). Each result explains why it fits, shows what is known and what is unknown, and links to the organizer's next step.

These rules apply to every agent and person working in this repo.

## Hard rules

- Do not use Claude for project work. Do not add a Claude co-author credit or a Claude trailer to a commit.
- Do not invent API endpoints, worker invocation methods, bot template URLs, or session exports. Before writing integration code, verify what the Grok Bot environment actually supports. When a workflow step is a manual handoff, say so explicitly.
- Check where any reused code came from, including the earlier separate BearRok prototype, and follow these rules for it. Name imported prototype code in pull requests and commit messages.

## Data rules

- Label prepared or sample examples visibly, in both the data and the UI. Live results must rest on real organizer evidence: a source URL plus the text behind each claim.
- Store event dates (start, end, and time zone) separately from registration or join deadlines.
- Keep unknown values as explicit unknowns. Never guess them. A missing deadline displays as "Registration deadline unknown."
- Apply each preference only to the opportunity it describes. In "online hackathon," "online" describes the event, not the club.
- Club cards answer how to join and when the club meets. Event cards answer when the event happens and by when to register.

## Workflow

- Start each task with the smallest change that has an observable result. In one or two sentences, say how we will know it works.
- Follow this repo's stack and conventions. While the repo is documentation only, choose the minimum setup a feature needs. Keep patches focused and files easy to review.
- Run the most relevant check available. Report what changed, how to try it, what was verified, and what still needs checking.
- Commits: stage only the relevant files, write a message that describes the actual change, keep normal Git timestamps, and push only when asked.

## Priorities

- A working manager-to-worker demo comes first. Build dashboard or Electron features only when they serve the requested milestone.
- Submission needs a share link for each bot template, a public README, a public Grok Bot session export, a public workflow video of up to 2 minutes, and a public slideshow.
