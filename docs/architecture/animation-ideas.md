# Animation Ideas

Status: **ideas only, nothing built.** A short list of places where a celebration-style moment,
like the live-badge card and class toast (see [live-badges-plan.md](live-badges-plan.md)), could
help later. Each one needs its own design pass before it's built.

## Principle

**Calm by default, celebrate real achievements, respect reduced motion.**

- **Calm by default.** Most of a lesson is focused work. Motion is the exception, never ambient
  decoration, and it never covers the editor, steals focus or blocks a click.
- **Celebrate real achievements.** A moment marks something the student actually did (a first
  pass, a finished lesson), never just opening a page or clicking a button. There are no points,
  streaks or comparisons.
- **Respect reduced motion.** `prefers-reduced-motion` always gets a plain fade or nothing. Every
  moment is also announced through a polite live region, so it doesn't depend on seeing it.
- **Short and quiet.** About a second of movement, then something still. Sound only where there's
  a mute (and the tutor's Sounds off) to go with it.
- **Reuse, don't add.** CSS keyframes in `src/index.css` (the `sv-badge-*` card, shine and toast
  are the reference), no animation library.

## Candidates

| Moment | Where | Idea |
|---|---|---|
| All checks passed | `CheckFeedbackBanner` | One shine sweep across the pass banner the first time a task's checks all pass. Not repeated on later re-runs. |
| First successful run | Python / Turtle / HTML output | A brief glow on the output panel's edge the first time a student's code runs without an error in a lesson. |
| Lesson complete | Solo lesson-complete screen | The sticker-sheet flip-in (as on the session-end screen) for the student's moments, plus a gentle title entrance. |
| Session end | `SessionEndedScreen` | Already flips the moments in. Could stagger a short "you made N things today" line, with no totals compared to anyone else. |
| Task group finished | Task progress dots | The group's dot fills with a small pulse when its last subtask passes. |
| Shared work approved | Student who shared | A small card like the badge card, "Your work is on the class screen", instead of silence. |
| Quiz all correct | Quiz tasks | The options settle with a soft stagger when every answer is right. |
| Scratch project runs | Scratch stage | A one-off glow around the stage the first time the green flag runs a script the student built. |
| Teacher side | Student card | A soft pulse on a card when that student passes, useful at a glance across a big class. It must stay subtle, because teachers watch the grid all lesson. |

## Not these

- Confetti, fireworks or full-screen overlays.
- Anything tied to speed, ranking or "first".
- Looping or idle animation.
- Motion on every keystroke or every run.
