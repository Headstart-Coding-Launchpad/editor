---
name: new-activity
description: Build a new classroom activity (taskType activity) for the Headstart Coding platform from the scaffold, end to end. Use when asked to "build a new activity", "add an activity", "make a <X> activity", implement an authoring request for an activity or an activity mode (docs/authoring/authoring-requests/*.md), or when a lesson needs a bounded exercise the platform lacks. Not for workspace modules (see the new-module skill).
---

# New activity

Scaffold → implement → verify → document, one activity per branch. Read the docs linked below
instead of guessing; this skill is only the order of work.

Key references:

- Contract, data flow and write rules: `docs/architecture/activities.md`
- Plan, decision test, definition of done: `docs/architecture/modular-activities-plan.md`
- Worked example: `src/activities/binary/` + `docs/authoring/activities/binary.md`
- UI rules: `docs/UI_STYLE_GUIDE.md`; project rules: `AGENTS.md`

## 1. Start from the request

1. If there is a request file in `docs/authoring/authoring-requests/`, read it (need, example
   task, checks, devices, blocked lessons). If there isn't one and the idea came from a lesson
   agent, ask for one or write it from the conversation using that folder's README template.
2. Apply the **Workspace module vs Activity** test (plan, "The Model"): does a later task build
   on what the student made? Would a teacher demo freely in it? Is there a real free-play mode?
   Any "yes" → stop: it is a module (new-module skill), or a mode/check on an existing one.
3. Run `node cli/cli.mjs lessons capabilities` and confirm the gap is real: not a new mode of an
   existing activity, a quiz sub-type, or a check type. A new *mode* goes into the existing
   activity folder, not the scaffold.
4. Ask the user about anything that changes scope (modes, grading rules, device policy) before
   writing code. Create a `feature/<id>-activity` branch; set the request's status to `planned`.

## 2. Scaffold

```bash
npm run new:activity -- <id> "<Label>" --category computing|digital_skills|quiz|code --dry-run
npm run new:activity -- <id> "<Label>" --category ...
```

`<id>` becomes `activityType` (lowercase, underscores). The scaffold is a working "type the
answer" activity, already registered and documented, so `npm test` passes before you change
anything. Every place to change is marked `TODO(new-activity)`.

## 3. Implement (in `src/activities/<id>/`)

1. **`<id>.js` (pure logic):** task fields, `validate<Id>Task` (every message worded
   `Task N: …` / `Task N item M: …`), `solutionFor`, `gradeItem` with hints for ages 8–14
   (short, plain words, point at the actual mistake, never give the answer away), `gradeTask`.
   Node-safe: no React/DOM.
2. **`definition.js`:** `defaultTask` must pass its own validation; `initialState` /
   `solutionState` small (< 2 KB serialised) and versioned (`v: 1`); `classifyChange` returns
   `'continuous'` for anything per keystroke or per pointer move, `'discrete'` otherwise;
   `requires` + `touchFallback` (`equivalent` / `virtual_keyboard` / `block`); icon, description,
   `summarize`, `printHtml`. Set `completion: 'auto'` only if the activity finishes itself.
   List any task field that stores the answer (not the question) in `sealedFields`, so it is
   obfuscated in the public lesson document (`src/shared/lessonSeal.js`).
   Declare the task shape in `fields` (`src/shared/fieldSpec.js`): every task field, with
   `required` / `authored`, `values`, per-item `itemFields`, and `modeField` + `modes` for an
   activity with modes. `lessons capabilities` prints it for lesson agents;
   `src/activities/__tests__/fields.test.js` checks each `required` field against
   `validateTask` and the doc page's first `| Field | Required |` table against `fields.task`.
3. **`ui.jsx`:** controlled `StudentView({ task, state, onChange, onSubmit, readOnly, device })`.
   Never write to Firebase or storage. Controls ≥ 44px, full keyboard access, visible focus,
   `prefers-reduced-motion`, `act-` classes (add new ones to `src/index.css` in the `act-`
   namespace). Touch: honour `device.touch` / `device.virtualKeyboard`; pointer code uses
   Pointer Events. `readOnly` must render the teacher view (no Check button, marks shown).
   Show a correct answer with the shared `ActivityCorrect` (`src/activities/ui/ActivityCorrect.jsx`,
   "✓ Correct" or custom text as children; `SpinTick` for a bare ✓), whose ✓ spins once when it
   appears. Render it only while the answer is correct; don't hand-roll a "✓ Correct" line.
4. Do not touch app code (StudentView, TeacherView, hooks): `ActivityHost` and
   `useActivityState` already handle persistence, sync, grading, reset and teacher edits. If
   the activity truly needs a host change, stop and ask.

## 4. Tests (in `src/activities/<id>/__tests__/`)

- `<id>.test.js`: one test per validation message and per hint; grading edge cases.
- `ui.test.jsx` (via `src/test/activityUiHarness.jsx`): every control, keyboard use, readOnly,
  device fallbacks, the exact state produced.
- `studentView.test.jsx`: the **real StudentView click-through**. Drive the real controls,
  assert `writeStudentRun` / `writeStudentAnswer` and that no Run button appears.
- `src/activities/__tests__/activityInterface.test.js` checks the contract automatically. Never
  add allowlist entries to make a contract or ratchet test pass.

## 5. Docs

- `docs/authoring/activities/<id>.md`: rewrite fully; keep one **complete, valid** example
  lesson (validated by `authoringDocExamples.test.js`), field tables, marking/hints, teacher tools,
  devices.
- `docs/authoring/validation-errors.md`: one row per message in the `### <Label>` section
  (`validationErrorsDoc.test.js` fails on any missing message).
- `docs/authoring/CHANGELOG.md`: new dated entry. Refresh the `docs/README.md` and
  `docs/CODEBASE_MAP.md` rows the generator added if the description changed.

## 6. Verify (all must pass)

```bash
npm test                 # re-run once if a jsdom test times out under load
npx eslint src cli scripts  # 0 errors (npm run lint also walks .claude/worktrees)
npx prettier --write <changed files> && npm run format:check
npm run docs:check
npx vite build
node cli/cli.mjs lessons capabilities   # the activity is listed; CLI imports stay Node-safe
```

Then ask the user to check in a **real browser** (jsdom misses pointer-stacking and touch bugs):
student solo and live lesson; pointer, drag, keyboard, touch/tablet (and the on-screen keyboard
if used); teacher card summary + device badge, student modal view, **Edit answers**,
Stage → Start again / Complete (show answers); teacher Presentation View broadcast; Builder
preview; a composed lesson with the activity between two code tasks.

## 7. Close the loop

Update the request file: status `shipped` (or `planned` with the PR link until merged) and fill
in **Resolution** with the PR, activity id and docs link. Commit on the feature branch; don't
push or open a PR unless asked.
