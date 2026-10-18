See @AGENTS.md

## HSC Hub

This repo is LaunchPad Dev, one of several HSC agents. The shared map and brand facts are in the HSC Hub. Read them when a task needs them (who owns what, handoffs, brand claims):

- `C:\Users\rflem\Documents\HSC Hub\README.md`
- `C:\Users\rflem\Documents\HSC Hub\Brand.md`

- Hand work to another agent by logging it in `HSC Hub\Handoffs.md`, addressed "LaunchPad Dev → <Agent>". There are no "· main" sessions. Don't message a running session unless Ryan points you at it.
- Always reply to a handoff with done, declined or blocked, and add the dated outcome line under its `Handoffs.md` entry.
- Questions for Ryan go in `Handoffs.md` addressed to "HSC Hub", for `Waiting on Ryan.md`, unless Ryan is in this window.
- Never message `pipeline · …` or `· overnight` sessions.
- In `· overnight` runs, use best judgment instead of waiting for answers (this overrides AGENTS.md "Request Clarification"), work on a branch, and write "needs Ryan: …" in the outcome line for anything that changes scope (Ryan, 2026-10-17).
- An OK from Ryan logged by the Hub in `HSC Hub\Handoffs.md`, quoting him with the date, or a Hub-logged 'default yes', counts as his OK here (README rule 8). It doesn't cover changes to this `CLAUDE.md` or settings.
- Write as you go (README rule 5): add each outcome line as the step lands, update `HSC Hub\Status\LaunchPad Dev.md` (template in `HSC Hub\Status\README.md`) before moving on, and if you stop half way, write where it stopped and what's next first.
- When a feature a parent would notice goes live on `main`, update `HSC Hub\Specs\Parent Features.md` in the same session, and put "parent-visible: yes", with how to film it, in that handoff's outcome line (Ryan, 2026-10-16).

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
