# Lesson screenshot command (CLI): PNG of a task's editor/output/Stage at a set width

- **Status:** shipped
- **Kind:** tooling
- **Requested by:** Ryan (approved by Ryan), 2026-10-17
- **Lessons blocked:** none yet

## Need

Lessons use screenshots of LaunchPad itself (Tooling Introductions for the name-tag panel and the Stage, Shared work moments, editor + output examples). Attach assets generates images and diagrams but can't make screenshots, so every visual lesson waits on Ryan taking them by hand (Python L1 Lesson 8 and L2B Lesson 8, 2026-10-16). Lesson Gen took L1 Lesson 8's three by a one-off Playwright script on 2026-10-17 (throwaway lesson copy, HSC Audit test tutor, made-up students), but a script outside the platform breaks whenever LaunchPad's pages change. Needed: a CLI command, owned and kept working by LaunchPad Dev, that takes a lesson task (its code, inputs, view) and returns a PNG at a set width. Attach assets then calls it for every Suggested Screenshot in Images.md, and only captures it can't do (other sites, Ryan's own logins) stay on Ryan's list.

Closest existing capability: none in lessons capabilities. Nearest was LaunchPad Dev's scripts/hsc-audit/run-visual-review.mjs, which screenshots one fixed test lesson and can't take a lesson id, task, code or inputs.

## Checks wanted

- For a Python task, the PNG shows the editor with the given code and the output/Stage/name-tag panel after Run, matching what a student sees at that width.
- Works on a Draft lesson, and writes no session reports, live-session data or student records onto the real lesson.
- Signs in with the test account only; no real class or student names can appear.
- Scratch tasks capture blocks + stage; HTML tasks capture editor + preview; Turtle captures the canvas.
- Multi-student views (Shared work, tutor grid) can be captured with made-up test students.
- When a selector breaks after a UI change, the command fails loudly with the task named, rather than writing a wrong image; a LaunchPad Dev test covers it.

## Devices

Desktop 1440x900 by default; tablet 1024x768 (touch) as an option.

## Shipped (2026-10-17)

`node cli/cli.mjs lessons screenshot <lessonId> --task <id>` (or `--spec shots.json`). See [lesson-screenshot-cli.md](../lesson-screenshot-cli.md).

- Student views render on a new no-session `#/shot` page: the lesson is handed to the page, so Drafts work and nothing is written to Firebase (no test account needed). `--code`, `--code-stage complete`, `--run`, `--inputs`, `--click`, crops (`workspace`, `instructions`, `editor`, `output`, `console`, `stage`), desktop or tablet.
- Session views (`tutor`, `tutor-grid`, `student-modal`, `shared-work`, `student-live`) run on a throwaway Draft copy with the test tutor and made-up `Test …` students; the copy and its data are deleted afterwards.
- A shot that can't find its panel fails with the task named and writes no file. `cli/lesson-screenshot-input.test.js` checks the panel hooks stay in the app.
- Not built: name-tag prediction filling (`--predict`). Use `--click` for buttons, or ask if a task needs typed predictions.
