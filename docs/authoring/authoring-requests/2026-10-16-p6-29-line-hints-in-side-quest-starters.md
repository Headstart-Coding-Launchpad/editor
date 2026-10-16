# Line hints (`#>`) don't work in side-quest starters (bug)

- **Status:** shipped
- **Kind:** bug
- **Requested by:** Lesson Gen agent (Ryan found it, filed straight to LaunchPad Dev, as with builds 1–25), 2026-10-16
- **Lessons blocked:** none, but every lesson's side quests use `#>` hints. Seen on the LG-P6 pilot Python Level 2B Lesson 8 (`qj8152siy2`, taught Tue 20 Oct).

## Need

Ryan (2026-10-16, clicking through `qj8152siy2`): "`#>` don't work in side quests for some reason."

`#>` line hints (`docs/authoring/python.md`, Line Hints) are how our starters say where to type ("Markers work in `codeStages` of every role and in the legacy `starterCode` / `completeCode`"). Our writer skills put them in side-quest `starter` code too, since a side quest is "its own scratch editor of the task's module". But the docs don't say whether a side quest's starter strips and shows them, and in the Draft they don't work.

Examples in `qj8152siy2`:
- Task 30 "Growing Circles", side quest "🪜 Circle Stairs": `#> Add y after x` above `circle(20, "orange", x)`, and a closing `#> Add 80 to y here`.
- Task 42 "Add a Turn" has a side quest with a `#>` line too.

Python Level 1 Lesson 8 (`caakmdqj5j`) and older lessons' side quests probably use them too.

## What's wanted

- A side quest's `starter` handles `#>` exactly as a code stage does: stripped from the code, shown as the 💡 gutter hint and faded text beside the next line, never run or saved, and re-attached when the student comes back.
- The same for `#@lock` and `#@lock-values` if they're cheap to support, or validation warns when a side-quest starter uses a marker it doesn't support. Today it's silent.
- `docs/authoring/AUTHORING_GUIDE.md`'s Side-quests section says which markers a side-quest starter takes.

## Checks wanted

- None (side quests are unchecked).

## Notes

- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Lesson plan - Python L2B Lesson 8 for loops.md`.
- If it's a quick fix, before Tue 20 Oct would help both pilots.

## Resolution

Shipped 2026-10-16. `buildSideQuestTask` (`src/shared/sideQuests.js`) strips the side-quest starter with `stripTaskLineHints`, as lesson tasks are, so `#>` hints (HTML `<!--> … -->`), `#@lock`, `#@lock-values`, `#@peek` and `#@count` markers work there: stripped, shown the same way, never run or saved. Documented in AUTHORING_GUIDE.md Side-quests and CHANGELOG. No validation warning was needed, since every marker is supported.
