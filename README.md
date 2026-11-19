# Student Opportunities

A student asks for the opportunities they want. A coordinating agent scopes the request, delegates discovery to Grok search agents, and brings back listings the student can check and act on. **The hackathon demo covers clubs and events.**

## The student problem

A first-year student looking for a club, hackathon, scholarship, or research opening may need to check Luma, Devpost, school posts, and Reddit. The announcement, the organizer’s instructions, and the deadline can be on different pages. The student has to piece together what is open, when to act, and whether it fits their interests.

The product should do that discovery and checking for them. Each student sets the scope of their own search. Campus, class year, and student group are optional context. The student makes the final decision about joining, registering, or applying.

## One student visit

**Example demo request:** “I want to join a beginner-friendly coding club and attend an online hackathon next month.”

1. The dashboard asks what the student wants to find. The coordinator summarizes the request and asks a follow-up only where an answer would change the search. In this example, “online” describes the hackathon. A useful follow-up is “Should the club also meet online, or do you want one near you?”
2. One Grok worker looks for clubs accepting members. Another looks for upcoming events matching the time window. A hackathon fits the event category.
3. The dashboard returns a club and an event when the evidence supports them. A club card should answer **“How do I join, and when does it meet?”** An event card should answer **“When does it happen, and by when do I need to register?”**
4. The student opens the organizer’s page and decides what to do. If the organizer lists an event date but omits a registration deadline, the dashboard says **“Registration deadline unknown.”**

The team reports having skills for reading and evaluating résumés. Those could help personalize later searches. The proposed demo works from the student’s request alone. Résumé integration, review of extracted details, and permission to store those details are open decisions.

## Agent and data flow

| Responsibility | Proposed behavior | What the next stage receives |
|---|---|---|
| Coordinate the request | Identify opportunity types, interests, date range, and any location or eligibility constraint the student supplies. Keep the original wording available for review. | A brief for each search worker that distinguishes requirements from preferences. |
| Discover candidates | Use Grok’s web search for club and event leads. Candidate sources include public school or club pages, Luma, Devpost, and Reddit. Use X search when relevant and available. Coverage of individual sites needs a live check. | Candidate URL, organizer if known, and the source text behind each relevant claim. |
| Validate | Follow the lead to the organizer or official event listing. Check whether joining or registration is open, distinguish event dates from deadlines, and merge repeat announcements. When sources conflict, show what remains uncertain. | One record per opportunity with an organizer link, last-checked time, and evidence for the displayed details. |
| Store and present | Keep the search scope, run status, validated listings, and their sources in the database. The dashboard uses one result format for both prepared examples and live search. | Cards showing why a result fits, what is unknown, and where the student can act. Each result set identifies its origin. |

**Proposed handoff for the dashboard and backend.** Agree on one sample club card and one event card before parallel work starts. Both carry title, type, organizer, source URL, join or registration URL when available, location or online format, fit explanation, and last-checked time. The club adds meeting schedule and membership intake. The event adds start time, time zone, and registration deadline. Missing fields stay visibly unknown. The database engine, hosting, and provider configuration are open.

## Three-person work split

Assignments below are provisional. The team has two Claude Max seats and one teammate with regular Claude and ChatGPT credits. Use skill and availability to pick names, then use tool access as a tie-breaker.

| Proposed owner | Work owned | First handoff |
|---|---|---|
| **A · Agent backend and database** (Max) | Own the request coordinator, Grok workers, validation, and persistence. Keeping source evidence and storage together gives one person responsibility for what a result claims. | Give B the two example records and search states. At account handover, test one live request through to a stored result. |
| **B · Dashboard UI/UX and integration** (Max) | Own the student’s question, follow-up, progress, cards, and organizer links. Show prepared, live, empty, and failed searches clearly. | Build the demo journey against the agreed examples so dashboard work can proceed before Grok access. Later connect the same view to A’s results. |
| **C · Pitch website UI/UX and demo** (regular Claude and ChatGPT credits) | Own the pitch page, the transition into the dashboard, and the presentation. Select and manually check the example club and event, recording their source links and dates. | Give A and B the two sources early. Show the fragmented search in the opening, then let the dashboard demonstrate the student’s decision. Own rehearsal and the fallback recording. |

## Key milestones

The event is **Thursday, November 19, 2026**. Grok account access is expected around **2 p.m.** Pacific time is assumed for this draft. The exact submission time and the kind of access the team will receive still need confirmation. These are proposed work windows.

| When | Milestone | Evidence to move on |
|---|---|---|
| Wed, Nov 18 · planning | All three agree on names, one demo query, card fields, and the handoff between the pitch and dashboard. | Everyone can describe the same student journey. C has identified a real club page and a real event page to check. |
| Thu, Nov 19 · before expected access | A prepares the discovery and storage path around sample records. B and C prepare the dashboard and pitch walkthrough using the manually checked listings. | The team can rehearse from the pitch through both cards to the organizer links. Prepared data is labeled, and a missing deadline stays unknown. |
| Around 2 p.m. · account handover | A checks whether the handover includes API credentials, search-tool access, and usable allowance. B and C continue the rehearsal. | A records what the account actually supports. If available, one worker returns a real candidate and its source. |
| After access · before the rehearsal cutoff | A and B trace one live student request through discovery, validation, storage, and display. C compares the displayed facts with the source. | A judge can follow a displayed claim back to the organizer. Record which parts ran live and how long the search took. |
| Before submission · time open | C runs the timed pitch with A and B. Choose the live or prepared path based on the rehearsal and time remaining. | A complete walkthrough is ready even if live search fails. Any recording or prepared result is labeled accurately. |

## What the demo should prove

- **Grok Use.** Follow one student constraint from the coordinator’s brief to a worker query and a source-backed result. If the team receives only an interactive login, it can show a manual Grok search separately and identify the dashboard examples as prepared.
- **Student Use.** Ask a first-year student to choose a club or event from the results and explain their next step. Check whether they can distinguish a meeting or event time from a deadline and find the organizer’s instructions.
- **Validation.** Use a duplicate announcement or a missing deadline to demonstrate one judgment the system makes. Record the actual source and result when available.

| Planning detail | Confirmed value |
|---|---|
| Event name and official judging requirements | |
| Submission time, time zone, presentation length, and rehearsal cutoff | |
| Names for A, B, and C | |
| Grok API and search access, available budget | |
| Database and deployment target | |

## Questions for the team

1. What is the submission time and time zone, how long is the pitch, and does judging require a live API call? These answers determine how long A and B can spend on live integration.
2. Who is strongest at backend and data work, who can own dashboard integration, and who wants to pitch? When can each person start?
3. Who is providing the 2 p.m. account, and can they confirm whether it includes a developer API key, enabled search tools, and a spending allowance?
4. Which real club and event should anchor rehearsal? Are there organizer pages the team already trusts, and what evidence should qualify a result for display if the original page is unavailable?
5. Is résumé evaluation required on stage? If so, where are the existing skills, what inputs do they need, and can the demonstration use a sample résumé?
6. Does the dashboard need to remember individual students between visits, or is saving searches and results for the demo sufficient? Which database or hosting setup does someone on the team already know?

## Planning references

The product direction comes from the team’s November 18 clarification and the supplied *Student Opportunity Platform: Brainstorming & Architecture Summary*. The *Luyten* README supplies the structure for describing the student problem, one complete journey, system responsibilities, evidence, and milestones.

This is the first README for BearRokk.
