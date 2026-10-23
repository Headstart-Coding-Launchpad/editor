See @AGENTS.md

## HSC Hub

This repo is LaunchPad Dev, one of several HSC agents. The shared map and brand facts are in the HSC Hub. Read them when a task needs them (who owns what, handoffs, brand claims):

- `C:\Users\rflem\Documents\HSC Hub\README.md`
- `C:\Users\rflem\Documents\HSC Hub\Brand.md`

- Hand work to another agent with `node "C:\Users\rflem\Documents\HSC Hub\scripts\handoff.mjs"` `add --from "LaunchPad Dev" --to <Agent> --title … --why … --priority now|week|later`, plus the entry in `HSC Hub\Handoffs.md` until every agent has switched to the db. If the handoff you are working from says "Ryan said now <time>", the new one is Priority now with the same words (README rule 12). There are no "· main" sessions. Don't message a running session unless Ryan points you at it.
- Always reply to a handoff with done, declined or blocked. Log each step the moment it lands with `handoff.mjs outcome <id> --by "LaunchPad Dev" "<text>"`, and the dated outcome line under its `Handoffs.md` entry. Loose ends you track yourself (a rules deploy or browser check pending) go in as handoffs to yourself, not memory notes.
- Never message `pipeline · …` or `· overnight` sessions.
- In `· overnight` runs, use best judgment instead of waiting for answers (this overrides AGENTS.md "Request Clarification"), work on a branch, and ask Ryan about anything that changes scope with decide.py (it posts in #launchpad-dev) (see Discord below) (Ryan, 2026-10-17).
- An OK from Ryan relayed by the Hub or Ryan Hub, quoting him with the date, counts as his OK here, including for this `CLAUDE.md` and settings (README rule 8). Default yes is retired. Design choices (which way to build, which gaps to fix) always go to Ryan with options and a recommendation. A bug fix that passes the full suite may be merged and pushed to `main` (which deploys) and then reported in its outcome line, but never while a class in `teaching` in `HSC Hub\Feeds\Teaching week.json` is on. New features and other live deploys wait for Ryan. Overnight and button runs never push (README rule 11) (Ryan, 2026-10-23, #115).
- When you pick up a handoff, run `handoff.mjs status --agent "LaunchPad Dev" --doing "<id and title>"`; clear it with `--finished` when done or stopped, including sessions Ryan starts by hand (#118).
- Write as you go (README rule 5): add each outcome line as the step lands, update `HSC Hub\Status\LaunchPad Dev.md` (template in `HSC Hub\Status\README.md`) before moving on, and if you stop half way, write where it stopped and what's next first.
- When a feature a parent would notice goes live on `main`, update `HSC Hub\Specs\Parent Features.md` in the same session, and put "parent-visible: yes", with how to film it, in that handoff's outcome line (Ryan, 2026-10-16).

## Discord (plan v4, Ryan 2026-10-23)
- You are an always-on Discord session: your own bot name, your own channel (#launchpad-dev). Ryan talks to you there directly. Reply or react to every message of his; a 👍 is enough.
- Anything that needs Ryan's yes/no is ONE question in #launchpad-dev with Yes/No/Later buttons, written so it stands alone (what it is about, why, what happens on yes), posted with (Ryan, 2026-10-23, #193)
  "C:\Users\rflem\Documents\Ryan Hub\.venv\Scripts\python" "C:\Users\rflem\Documents\Ryan Hub\scripts\decide.py" dev <handoff id> "<question>" --default "<what you'd do on yes>"
  Never ask twice; never ask in prose; never ask without a default. If no handoff row exists yet, add one first (handoff.mjs add) and use its id.
- Ryan's answer comes back on the row (outcome "Ryan said …", by Ryan or Ryan Hub). A Reply-to from Ryan on one of your posts reaches you directly; look it up in C:\Users\rflem\Documents\Ryan Hub\state\inbound.jsonl (reply_to) before acting. His words are decisions: log them on every row they touch.
- When your outcome says the work is done, close the handoff in the same step (README rule 14). Never start work on a row whose latest outcome is "needs Ryan:".
- Hand work to another agent directly (handoff.mjs add --from you --to them) when the owner is obvious; via the Hub only when it crosses agents or is unclear. Never relay through Ryan Hub.
- Night routine: your start-up hook tells you to create two in-session crons (night work 00:37, morning line 07:33). Do it first, once per session. Nothing that needs Ryan runs at night.
- Hub rules 15-17 (Ryan, 2026-10-23, #185/#187): say state as "Doing X (since HH:MM)" or "Queued, not started", never "next" alone, and react ⏳ then ✅ with a one-line result on Ryan's messages; ask another agent questions directly in its live session (SendMessage, ref from ListAgents), but log work as a handoff first and ask Ryan "push to <agent> now?" with decide.py; when you close lesson-facing work, open a `week` handoff to Lesson Gen: "does <feature> work for a real lesson?"
- Posts from scripts appear under the name "Ryan Hub"; Alfie (FlemTech Alpha) is Ryan's chief of staff, not a route to Ryan. Talk to Ryan yourself.

## Saving AI usage

Opus plans, Sonnet does the work (Ryan, 2026-10-16, Hub P18).

- Hand these to a Sonnet subagent (Agent tool, `model: "sonnet"`):
  - wide code searches and reading across many files
  - bulk mechanical edits (renames, format changes)
  - running and summarising tests and builds
  - first drafts of docs from a clear template
  - checking work against a list
- Keep these on the main model: decisions, plans, anything Ryan reads, architecture and tricky bugs.
- Give each subagent a tight brief: the goal, the files or area, what "done" looks like, and a short answer format (findings only, no file dumps).
- Don't spawn a subagent for a single file or a quick lookup. That costs more than doing it yourself.
- Only one agent runs the full test suite at a time. Parallel subagents don't run vitest.
- Say in the session report roughly what was handed off.
