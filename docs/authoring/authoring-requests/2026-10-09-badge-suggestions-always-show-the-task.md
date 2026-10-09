# Badge suggestions always show which task earned them

- **Status:** open
- **Kind:** tooling
- **Requested by:** Ryan (approved by Ryan), 2026-10-09
- **Lessons blocked:** none yet

## Need

Every badge suggestion stores a `taskId` (`src/badges/evaluate.js`), but `BadgeSuggestionsPanel` only shows `suggestion.reason`. The task appears only when a badge's `reasonText` happens to include `taskTitle`.

These suggestions never name a task:
- early_bird
- keyboard_wizard
- quiz_master
- resourceful_coder
- code_fixer's sandbox branch

Grouped suggestions show only student names. A tutor deciding whether to award a badge needs to know which task it came from.

## Checks wanted

- Every suggestion row (single and grouped) shows the task title, from `taskId` and not from `reasonText`, so new badges get it automatically.
- Sandbox suggestions say "Sandbox". Suggestions with no task say so plainly rather than leaving a blank.
- If a reason already includes the task title, the title isn't shown twice.
- Grouped suggestions that span several tasks show the task beside each student.

## Devices

The task title must be readable without hovering, so it works on tablets.

## Notes

Part of the 2026-10-09 principle: **tutors see what students are doing at all times (submitted or not) and can do something to assist.** Sibling requests filed the same day:
- confidence 1–10
- badge suggestion task names
- vocab and emoji badges
- tutor highlights a wrong arrange tile
- closable live-code reference
- live short-answer drafts

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
