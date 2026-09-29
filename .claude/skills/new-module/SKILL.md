---
name: new-module
description: Build a new workspace module (a lesson type such as python, turtle, filesystem, desktop) for the Headstart Coding platform from the scaffold, end to end. Use when asked to "build a new module", "add a lesson type", "new workspace module", "make a <X> workspace", or when an authoring request (docs/authoring/authoring-requests/*.md) has Kind module. For bounded exercises with a defined target use the new-activity skill instead.
---

# New workspace module

Request → decide → scaffold → implement → test → document → verify → close, one module per
branch. Read the docs linked below instead of guessing; this skill is only the order of work.

Key references:

- Contract (every definition group, the generic work slot, what core code reads):
  `docs/architecture/lesson-type-modules.md`
- Why it is shaped this way: `docs/adr/0010-module-contract-v2-and-work-slot.md`
- Plan, decision test, definition of done: `docs/architecture/modular-activities-plan.md`
- Worked examples: `src/modules/filesystem/` (structured state checked on every change),
  `src/modules/turtle/` (runtime module), `src/modules/arcade/` (workspace runs and reports)
- Runtime data model (must not change): `docs/agents/runtime-model.md`; rules: `AGENTS.md`

## 1. Start from the request

1. If there is a request file in `docs/authoring/authoring-requests/`, read it (need, example
   task, checks, devices, blocked lessons). If the idea came from a lesson agent without one,
   write it from the conversation using that folder's README template.
2. Apply the **Workspace module vs Activity** test (plan, "The Model"): does a later task build
   on what the student made? Would a teacher demo freely in it? Is there a real free-play mode?
   All "no" → stop: it is an activity (new-activity skill).
3. Run `node cli/cli.mjs lessons capabilities` and confirm the gap is real: not a new check type
   or a mode/option on an existing module (those go into that module's folder).
4. Ask the user about anything that changes scope before writing code: what the student builds,
   how it is checked (on change, on run, by the workspace), whether it runs code (a runtime),
   teacher live edit, playground, device needs. Create a `feature/<type>-module` branch; set the
   request's status to `planned`.

## 2. Scaffold

```bash
npm run new:module -- <type> "<Label>" --dry-run
npm run new:module -- <type> "<Label>"
```

`<type>` becomes the lesson `type` (lowercase, single underscores; the generator rejects reserved
words, activity names and names core code already compares against). The scaffold is a working
"write some text, press **Check**" module: registered, documented, in the ratchet and ESLint
rule, with its parity gaps recorded and a StudentView click-through, so `npm test` passes before
you change anything. Every place to change is marked `TODO(new-module)` (in the module folder,
`docs/authoring/<type>.md`, `moduleTypeParity.test.js` and `StudentViewModules.test.jsx`).

## 3. Implement the definition (`src/modules/<type>/definition.js`)

Decide every group, keeping the file pure (no JSX/React/DOM/runtimes, `.js` import extensions):

1. **`meta`**: label, icon, picker copy, `language` (`'python'`/`'html'`/null), `playground`
   (true needs `lifecycle.playgroundTask`), `surfaceLabels`, `teacherEditCopy`.
2. **`capabilities`**: every UI gate (explainer layout, panes, stage reveal, mirrors, card
   summary, focus panes, teacher editor, topic library, teacher layout flags) and `run`
   (`'runtime'` + `runResult` + a UI `runtime`, `'preview'`, `'workspace'`, `'none'`). Core code
   reads these instead of your type name, so never add a branch on `'<type>'` outside the folder.
3. **Work shape**: pick the storage record (`recordStorage({ workKey, taskMeta })`, or
   `perFileStorage()` for files) and wire (`codeStringWire`, `jsonWire`, `filesWire`) from
   `moduleContract.js`; the localStorage/RTDB shapes are then fixed (runtime-model.md).
4. **`lifecycle`**: `resetTarget`, `hasComplete`, `teacherCompleteTab`, `sandboxStarter`,
   `composedSandboxFields`, `hasPersonalSandbox`, `playgroundTask`.
5. **`checking` + `workSlot`**: trigger (`'change'` for discrete edits only — every change writes
   a run; `'run'`; `'workspace'`), `buildContext`, and the slot (field form for a structured
   state, hook form / `codeWorkSlot` / `filesWorkSlot` otherwise) with its flags (`taskReset`,
   `teacherEdit` ⇔ `capabilities.teacherEditor`, …; `teacherStarter` only if the teacher's
   Starter tab must differ from `starter`).
6. **Authoring + validation**: task fields, stages, carry-through, `validateTask` (messages
   worded `Task N …`), `hasStarterContent`, `hasCheckValue`.

## 4. Workspace and teacher UIs

- `StudentWorkspace.jsx`: edits through `cs` only (`cs.handleCodeChange` for a code string,
  `cs.handleWorkChange(next, { moduleType })` for structured work; runs through `cs.handleRun` /
  `cs.handleWorkspaceRun` / `cs.reportRun`). Never write to Firebase or storage directly, never
  rebuild a preview per keystroke. Read-only while viewing an earlier task, during a forced
  teacher broadcast and while the teacher edits. Controls ≥ 44px, keyboard access, visible focus
  (`docs/UI_STYLE_GUIDE.md`); touch works.
- `TeacherLiveView.jsx`: read-only display state (teacher tabs, StudentModal mirror, shared
  snapshots); editable in the teacher sandbox via `onChange`.
- `BuilderWorkspace.jsx` + `CheckEditor.jsx`: author the fields the definition reads; offer only
  checks the module evaluates. Don't touch app code (StudentView, TeacherView, hooks,
  src/builder); if the module truly needs a new core hook, add a capability/definition field
  (with a default in `defineModule.js`) and ask first.

## 5. Checks

Core code checks work against `buildContext(work).code`. Module check types go in
`src/modules/<type>/checks.js` (`CHECKS`, owner `module:<type>`, unique ids), with Builder fields,
`validateTask` rules and docs. Keep `checkRegistryParity` green.

## 6. Tests (in `src/modules/<type>/__tests__/`)

- `definition.test.js`: work sources, storage/wire round trips, validation messages, checks.
- `workspace.test.jsx`: every control, read-only modes, the exact work each interaction produces.
- `studentView.test.jsx`: the **real StudentView click-through** (for a `'runtime'` module: Run
  to completion, then Run and **Stop**); also update the module's entry in
  `src/app/views/__tests__/StudentViewModules.test.jsx`.
- Resolve every `KNOWN_GAPS` entry for the type in `moduleTypeParity.test.js`: implement the
  surface or keep an honest `Intentional:` reason. Never add allowlist entries or raise the
  type-branch ratchet to get green.

## 7. Docs

- `docs/authoring/<type>.md`: rewrite fully; keep one **complete, valid** example lesson
  (`authoringDocExamples.test.js`), task fields, checks, teacher tools, limits.
- `docs/authoring/validation-errors.md` (`### <Label>` rows, `validationErrorsDoc.test.js`),
  `docs/MODULE_FEATURE_MATRIX.md` row, `docs/FEATURES.md`, `docs/authoring/CHANGELOG.md` entry;
  refresh the rows the generator added to `docs/README.md`, `docs/CODEBASE_MAP.md`, `AGENTS.md`.

## 8. Verify (all must pass)

```bash
npm test                     # re-run once if a jsdom test times out under load
npx eslint src cli scripts   # 0 errors (npm run lint also walks .claude/worktrees)
npx prettier --write <changed files> && npm run format:check
npm run docs:check
npx vite build
node cli/cli.mjs lessons capabilities   # the module is listed; definition.js stays Node-safe
```

Then ask the user to check in a **real browser** (jsdom misses pointer-stacking, layout and
iframe bugs): student solo and live lesson (edit, check, reset, reload keeps work, carry-through
to the next task); personal sandbox; teacher TeacherView Starter/stage/Complete tabs and Send to
all; student card + watch (StudentModal); remote reset to each stage; Run on student; teacher
sandbox go live / push / reset; share with class; teacher presentation broadcast; a composed
lesson with the module between other modules; Builder create/edit/preview; playground if any;
touch/tablet.

## 9. Close the loop

Update the request file: status `shipped` (or `planned` with the PR link until merged) and fill
in **Resolution** with the PR, module type and docs link. Commit on the feature branch; don't
push or open a PR unless asked.
