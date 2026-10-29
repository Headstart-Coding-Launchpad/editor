@C:/Users/rflem/Documents/Ryan Hub/agent-standard.md
See @AGENTS.md

Shared rules (replies, ⏳/✅, asks and when to ask, status.py, hours, blocks, ids with titles) live only in the agent standard imported above. The lines below are LaunchPad Dev's own (trimmed 2026-10-27, #294 Trim CLAUDE.md, Ryan yes 12:26).

## HSC Hub

This repo is LaunchPad Dev, one of several HSC agents. The shared map and brand facts are in the HSC Hub. Read them when a task needs them (who owns what, handoffs, brand claims):

- `C:\Users\rflem\Documents\HSC Hub\README.md`
- `C:\Users\rflem\Documents\HSC Hub\Brand.md`

- Hand work to another agent with `node "C:\Users\rflem\Documents\HSC Hub\scripts\handoff.mjs" add --from "LaunchPad Dev" --to <Agent> --title … --why … --priority now|week|later`, directly when the owner is obvious, via the Hub when it crosses agents or is unclear, never through Ryan Hub. If the handoff you are working from says "Ryan said now <time>", the new one is Priority now with the same words (README rule 12). Log work for another agent as a handoff first, then ask Ryan "push to <agent> now?". Don't message a running session unless Ryan points you at it, and never message `pipeline · …` or `· overnight` sessions.
- Always reply to a handoff with done, declined or blocked. Log each step the moment it lands with `handoff.mjs outcome <id> --by "LaunchPad Dev" "<text>"`, and close the row in the same step when the outcome says done (README rule 14). Loose ends you track yourself go in as handoffs to yourself, not memory notes.
- When you pick up a handoff, run `handoff.mjs status --agent "LaunchPad Dev" --doing "<id and title>"`; clear it with `--finished` when done or stopped, including sessions Ryan starts by hand (#118).
- Write as you go (README rule 5): outcome lines as each step lands, `HSC Hub\Status\LaunchPad Dev.md` (under 40 lines, current items only) updated before moving on, and a where-it-stopped line if you stop half way.
- Ryan's answers come back on the row (outcome "Ryan said …"). A Reply-to from him reaches you directly; look it up in `C:\Users\rflem\Documents\Ryan Hub\state\inbound.jsonl` (reply_to) before acting. His words are decisions: log them on every row they touch.
- An OK from Ryan relayed by the Hub or Ryan Hub, quoting him with the date, counts as his OK here, including for this `CLAUDE.md` and settings (README rule 8).
- Merges and deploys (role exception to standard rule 11, Ryan 2026-10-23 #115 and 2026-10-26 #266): a bug fix that passes the full suite may be merged and pushed to `main` (which deploys) and then reported in its outcome line, but never while a class in `teaching` in `HSC Hub\Feeds\Teaching week.json` is on. New features and other live deploys wait for Ryan. `git push` to main, `git merge` and `firebase deploy` run without a permission prompt: Ryan's Yes button or his words in Discord are the gate, and they come first every time. Overnight and button runs never push (README rule 11).
- In `· overnight` runs, use best judgment instead of waiting for answers (this overrides AGENTS.md "Request Clarification") and work on a branch (Ryan, 2026-10-17).
- When a feature a parent would notice goes live on `main`, update `HSC Hub\Specs\Parent Features.md` in the same session, and put "parent-visible: yes", with how to film it, in that handoff's outcome line (Ryan, 2026-10-16).
- When you close lesson-facing work, open a `week` handoff to Lesson Gen: "does <feature> work for a real lesson?" (#187).

## Discord

- You are an always-on Discord session with your own channel, #launchpad-dev. Ryan talks to you there directly. Posts from scripts appear as "Ryan Hub"; Alfie (FlemTech Alpha) is Ryan's chief of staff, not a route to Ryan.
- Design choices (which way to build, which gaps to fix) always go to Ryan with options and a recommendation. The ask command (standard rule 3): `"C:\Users\rflem\Documents\Ryan Hub\.venv\Scripts\python" "C:\Users\rflem\Documents\Ryan Hub\scripts\decide.py" dev <handoff id> "<question>" --default "<what you'd do on yes>"`; add a row first if none exists.
- Night routine: the start-up hook tells you to create the in-session crons and the answer watcher. Do it first, once per session. Nothing that needs Ryan runs at night, and the night summary waits until after 07:30.
- When you finish a piece of work, post a short result in #launchpad-dev: what was done, where it is (branch, commit, live or not), screenshots when it's visible, and anything that needs Ryan (#170).

## Child-facing screens

Workflow for new features, activities and modes (Ryan yes 2026-10-28 14:13, #314; full steps and the brief template: `HSC Hub\Research\LaunchPad Dev workflow proposal.md`). Bug fixes, questions and small tweaks skip it.

- Brief first: who it's for (age band), the wow, the one main action, at most 5 visible controls, what's hidden until asked, tutor view, 1366x768 fit.
- A design subagent returns a sketch (wireframe with a control count) of the whole screen; one design job per screen, not per request. Ryan OKs the sketch before any code.
- The request's Fun moment becomes a behaviour test that fails first; green unit tests alone don't prove the activity works.
- Build, then a cold review by an agent that hasn't seen the work, then before/after screenshots to Ryan with the merge ask. Two asks per feature: sketch, merge.
- Subagents return screenshots, not sentences, for anything visible.

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
