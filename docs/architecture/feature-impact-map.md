# Feature Impact Map

Use this before and during feature work. It lists the files and docs that usually change together so feature additions do not leave adjacent behavior, tests, or documentation behind.

This map is not a replacement for code search. It is the first pass for impact analysis. If a change reveals a new coupling, update this file in the same PR.

## Cross-Cutting Invariants

These constraints protect classroom reliability. Re-check them when a feature touches more than one surface.

- Do not add a backend server or API.
- Keep students login-less; teacher/admin auth must not become required for student operations.
- Store anonymous student identity in localStorage, not sessionStorage.
- Do not write student code to Firebase per keystroke unless `activeStudentView` matches.
- Render iframe output on Run, not on every live-view keystroke.
- Encode Firebase file keys with `encodeFileKey` / `decodeFileKey`; raw dotted keys are unsafe.
- Use shared Pyodide, iframe, CodeMirror, Markdown, check, file-key, task, and lesson service modules instead of duplicating logic.
- Keep CLI validation, Builder validation, authoring docs, and schema docs in sync when lesson fields change.

## Drift Watchlist

These areas are known to drift because the same concept appears in multiple surfaces:

- Lesson type support: registry, Builder UI, CLI validation, authoring docs, feature docs, and tests.
- Checks: runtime evaluators, builder editors, authoring docs, feedback hints, and schema validation.
- Student persistence: localStorage keys, module serializers, carry-through, personal sandbox, and RTDB live snapshots.
- Session model: `useSession`, database rules, teacher controls, student phase behavior, reports, and runtime docs.
- Assets: Storage paths, shared type assets, iframe URLs, builder/admin UI, CLI asset commands, and authoring docs.

## Lesson Type Modules

Changes include adding a lesson type, adding a module capability, changing student/builder/teacher behavior for a type, or changing carry-through/sandbox behavior.

Since module contract v2 (plan step 4.8, [ADR 0010](../adr/0010-module-contract-v2-and-work-slot.md)) this is mostly a **single-folder change**: core code reads the definition and never compares against a type name (ratchet at zero everywhere outside the plugin folders, Builder included; ESLint `no-restricted-syntax`).

- **Adding a lesson type:** `npm run new:module -- <type> "<Label>"` (`.claude/skills/new-module/SKILL.md`). It writes `src/modules/<type>/` and every registration and index line; then the work is in that folder, `docs/authoring/<type>.md`, the module's `KNOWN_GAPS` entries in `moduleTypeParity.test.js` and its `StudentViewModules.test.jsx` click-through.
- **Changing one module's behaviour:** `src/modules/<type>/` (definition groups, workspaces, checks, tests) and `docs/authoring/<type>.md`.
- **A new difference between modules** (a new capability or hook): `src/modules/defineModule.js` (validation + default), `src/modules/_template/definition.js`, every definition that turns it on, the one core consumer that reads it, `src/modules/__tests__/moduleDefinitions.test.js`, and `docs/architecture/lesson-type-modules.md`.

Usually changes with:

- `src/modules/<type>/`
- `src/modules/defineModule.js`, `src/modules/moduleContract.js`, `src/modules/_template/`
- `src/modules/definitions.js`, `src/modules/registry.js`, `src/modules/checks.js` (registration lines; the generator writes them)
- `src/modules/__tests__/moduleDefinitions.test.js`, `moduleTypeParity.test.js`, `moduleInterface.test.js`
- `src/app/views/__tests__/StudentViewModules.test.jsx`
- Builder behaviour comes from the definition's `authoring` group; `src/builder/` changes only for a new kind of Builder hook
- `docs/architecture/lesson-type-modules.md`
- `docs/authoring/<type>.md`
- `docs/FEATURES.md`
- `docs/CODEBASE_MAP.md`
- `docs/TESTING.md`

## Composed Lessons And Playgrounds

Changes include multi-workspace composed lessons, lesson-module-scoped carry-through/sandboxes, module routing for tasks, or the standalone Python/Arcade Kit/Electronics/Scratch playgrounds.

Usually changes with:

- `src/shared/composedLesson.js`
- `src/shared/lessonLevels.js`
- `src/builder/components/TaskEditor.jsx`
- `src/builder/views/BuilderView.jsx`
- `src/builder/App.jsx`
- `src/app/components/StudentModal.jsx`
- `src/app/views/StudentView.jsx`
- `docs/architecture/composed-lessons-spec.md`
- `docs/authoring/AUTHORING_GUIDE.md`
- `docs/FEATURES.md`

## Completion And Feedback Checks

Changes include new check types, operator aliases, feedback suggestions, or builder check editor behavior.

Usually changes with:

- `src/modules/checks.js`
- `src/modules/<type>/checks.js`
- `src/shared/checkHelpers.js`
- `src/builder/components/task-editor/CheckEditors.jsx`
- `src/builder/components/task-editor/check-editors/checkEditorUtils.js`
- `src/modules/<type>/CheckEditor.jsx`
- `src/modules/**/__tests__/checks.test.js`
- `docs/authoring/<type>.md`
- `docs/authoring/quiz-tasks.md`
- `docs/authoring/lesson-schema.md`
- `docs/FEATURES.md`

## Lesson Schema And YAML Authoring

Changes include task fields, lesson fields, draft fields, topic proposal fields, validation rules, or YAML shorthand.

Usually changes with:

- `src/builder/lessonUtils.js`
- `cli/validate.mjs`
- `cli/yaml-converter.mjs`
- `cli/structured-input.mjs`
- `src/shared/lessonService.js`
- `docs/authoring/lesson-schema.md`
- `docs/authoring/lesson-schema-yaml.md`
- `docs/authoring/AUTHORING_GUIDE.md`
- relevant `docs/authoring/*.md`
- relevant authoring workflow doc (`docs/authoring/AUTHORING_GUIDE.md`, `validation-errors.md`, `feedback-cli.md`)
- `docs/FEATURES.md`
- builder and CLI validation tests

## Live Badges

Changes include a badge definition, a rule helper, the timeline event shapes, the `taskActivity` vocabulary, `badgeOptions` / `badgeHints`, or the Keyboard Wizard shortcut list.

Usually changes with:

- `src/badges/` (definitions, `rules.js`, `timeline.js`, `evaluate.js`, `registry.pure.js`)
- `src/shared/taskActivity.js` (pattern ids are stored by badges and reports: add aliases, never rename)
- `src/shared/lessonValidation.js` and `src/badges/validation.js`
- `cli/capabilities.mjs`
- `docs/authoring/badges.md`, `validation-errors.md`, `CHANGELOG.md`
- `docs/architecture/live-badges-plan.md`
- `src/badges/__tests__/` (every rule-backed badge's `examples` run in `badgeRegistry.test.js`)

A change to the **recorded badge data** (a new signal, or a new field on `badges`, `badgeSettings`, `studentSignals`, `sessionArchive`, `attemptLog.error` or `pasteLog.firstAt`) needs its own data-model sign-off, then usually changes with:

- `src/app/hooks/useSession.js` (the writers) and `database.rules.json` + `tests/rules/database.rules.test.js` (every new path: students write only their own signals, never `badges` or `sessionArchive`)
- `src/badges/signals.js`, `src/badges/sessionArchive.js` (values, keys, caps)
- `src/app/hooks/useStudentBadgeSignals.js` (student gating: never the presentation window, a preview or solo) and its call sites in `useStudentCodeState.js`, `runWithRuntime.js`, `StudentView.jsx`
- `src/shared/badgeSignalsContext.js` consumers: `CodeEditor.jsx` (`onUserEdit`), `ScratchWorkspace.jsx`, `markdown.jsx`, `TopicLibraryView.jsx`
- `src/app/hooks/useSandboxArchiveSnapshots.js` and `TeacherView.jsx` (teacher-side sandbox snapshots)
- `createSession` / `endSession` resets, and the "Badge data" section of `docs/agents/runtime-model.md` (paths, writers, lifetimes, the mapping to timeline events)
- `docs/agents/classroom-behaviours.md` (sandbox archiving)
- `src/app/hooks/__tests__/useSession.badges.test.js`, `useStudentBadgeSignals.test.js`, `useStudentCodeState.badges.test.js`

## Firebase And Session Model

Changes include Realtime Database paths, Firestore collections, Storage paths, security rules, session state transitions, or who can write a field.

Usually changes with:

- `src/app/hooks/useSession.js`
- `src/shared/firebase.js`
- `src/shared/lessonService.js`
- `database.rules.json`
- `firestore.rules`
- `storage.rules`
- `functions/index.js`
- `cli/firebase.mjs`
- `docs/agents/runtime-model.md`
- `docs/agents/project-rules.md`
- `docs/architecture/runtime-flows.md`
- Firebase-mocked hook and service tests

## Student Identity And Persistence

Changes include anonymous identity, display names, localStorage keys, saved work, personal sandbox, carry-through, or student state serialization.

Usually changes with:

- `src/app/studentStorage.js`
- `src/app/studentTaskContent.js`
- `src/app/studentLiveDisplay.js`
- `src/app/hooks/useIdentity.js`
- `src/app/hooks/useStudentCodeState.js`
- `src/app/hooks/createStudentPersistence.js`
- `src/modules/<type>/index.js` serializer/deserializer fields
- `docs/agents/runtime-model.md`
- `docs/agents/classroom-behaviours.md`
- `docs/architecture/runtime-flows.md`
- localStorage and student state tests

## Teacher Live View And Sandbox

Changes include active student view, teacher broadcast, sandbox staging/live state, remote reset, presentation windows, or live iframe behavior.

Usually changes with:

- `src/app/hooks/useSession.js`
- `src/app/hooks/useTeacherLivePublish.js`
- `src/app/teacherLivePayload.js`
- `src/app/teacherSandboxWork.js`
- `src/app/studentLiveDisplay.js`
- `src/app/views/TeacherView.jsx`
- `src/app/views/teacher/TeacherEditorPanel.jsx`
- `src/app/components/StudentModal.jsx`
- `src/modules/<type>/TeacherLiveView.jsx`
- `docs/agents/classroom-behaviours.md`
- `docs/agents/runtime-model.md`
- `docs/architecture/runtime-flows.md`

## Workspace Sharing

Changes include the student share button, the teacher approval flow, the shared-work gallery, the non-destructive viewer, or the `allowSharing` task field.

Two invariants that constrain almost every change here:

- Workspace content must never be stored under `sessions/{lessonId}` — the whole session node streams to every client. Content goes in `sharedWorkspacePayloads/{lessonId}`, read on demand; only the small index belongs in the session node.
- Snapshots must be written by the sharer's own client. A teacher cannot build one, because `currentCode` is only fresh while `activeStudentView` matches.

Usually changes with:

- `src/app/sharedWorkspacePayload.js`
- `src/app/hooks/useSession.js`
- `src/app/hooks/useStudentCodeState.js` (`buildShareSnapshot`)
- `src/app/views/StudentView.jsx`
- `src/app/views/TeacherView.jsx`
- `src/app/components/SharedWorkspacePanel.jsx`
- `src/app/components/SharedWorkspacePreview.jsx`
- `src/app/components/SharedWorkspaceViewer.jsx`
- `src/app/components/StudentCard.jsx`
- `src/app/components/StudentGrid.jsx`
- `src/app/components/StudentModal.jsx`
- `src/app/components/student-modal/ShareRequestPanel.jsx`
- `src/app/components/TeacherSessionControls.jsx`
- `src/shared/taskUtils.js` (`canTaskAllowSharing` / `isSharingAllowed`)
- `database.rules.json`
- `cli/validate.mjs` and `src/builder/lessonUtils.js` (both validate `allowSharing`)
- `src/builder/components/task-editor/TaskOptionsSection.jsx`
- `docs/agents/runtime-model.md`
- `docs/agents/classroom-behaviours.md`
- `docs/authoring/lesson-schema.md`, `lesson-schema-yaml.md`, `CHANGELOG.md`
- `docs/MODULE_FEATURE_MATRIX.md`

## Builder

Changes include task editing, lesson metadata, preview, validation, publish/export, assets, or topic suggestions.

Usually changes with:

- `src/builder/App.jsx`
- `src/builder/views/BuilderView.jsx`
- `src/builder/hooks/useBuilderState.js`
- `src/builder/hooks/useTaskEditorState.js`
- `src/builder/lessonUtils.js`
- `src/builder/components/`
- `src/shared/lessonService.js`
- `docs/authoring/AUTHORING_GUIDE.md`
- `docs/authoring/lesson-schema.md`
- `docs/FEATURES.md`
- `docs/TESTING.md`

## Admin Portal

Changes include admin tabs, lesson management, reusable levels, session cleanup, topics, shared assets, accounts, feedback, or reports.

Usually changes with:

- `src/admin/`
- `src/shared/lessonService.js`
- `functions/index.js`
- `cli/levels.mjs`
- `cli/feedback.mjs`
- `docs/agents/project-rules.md`
- relevant authoring workflow doc (`docs/authoring/AUTHORING_GUIDE.md`, `validation-errors.md`, `feedback-cli.md`)
- `docs/FEATURES.md`
- admin component tests

## CLI Workflows

Changes include command names, arguments, output format, validation, publishing, feedback, assets, reusable levels, or topic workflows.

Usually changes with:

- `cli/`
- `docs/agents/project-rules.md`
- relevant authoring workflow doc (`docs/authoring/AUTHORING_GUIDE.md`, `validation-errors.md`, `feedback-cli.md`)
- `docs/authoring/AUTHORING_GUIDE.md`
- `docs/authoring/TOPIC_LIBRARY_SCHEMA.md`
- `docs/CODEBASE_MAP.md`
- CLI tests

## Assets And Storage

Changes include lesson assets, shared type assets, Scratch assets, iframe asset URLs, or Storage rules.

Usually changes with:

- `src/shared/assetPaths.js`
- `src/shared/useAssets.js`
- `src/shared/useTypeAssets.js`
- `src/shared/AssetBrowser.jsx`
- `src/shared/AssetPicker.jsx`
- `src/admin/SharedAssetsPanel.jsx`
- `src/builder/components/lesson-meta/`
- `cli/assets.mjs`
- `storage.rules`
- `docs/authoring/AUTHORING_GUIDE.md`
- `docs/authoring/lesson-assets-cli.md`
- `docs/FEATURES.md`

## Auth, Roles, And Accounts

Changes include teacher/admin login, protected routes, custom claims, user management, disabled accounts, or role checks.

Usually changes with:

- `src/auth/`
- `src/app/views/LessonRoute.jsx`
- `src/admin/AccountManagement.jsx`
- `functions/index.js`
- `firestore.rules`
- `docs/agents/project-rules.md`
- `docs/agents/runtime-model.md`
- auth and admin tests

## Reports And Feedback

Changes include session report shape, report display, YAML export, lesson feedback, platform feedback, or archive behavior.

Usually changes with:

- `src/shared/lessonReport.js`
- `src/app/components/TeacherReportModal.jsx`
- `src/app/components/TeacherReportsPanel.jsx`
- `src/admin/LessonPanel.jsx`
- `src/admin/FeedbackPanel.jsx`
- `cli/feedback.mjs`
- `docs/agents/project-rules.md`
- `docs/FEATURES.md`
- report and feedback tests

## Testing And CI

Changes include test strategy, thresholds, setup mocks, Playwright config, npm scripts, or CI workflow.

Usually changes with:

- `src/test/setup.js`
- `vitest.config.js`
- `playwright.config.js`
- `.github/workflows/`
- `package.json`
- `docs/TESTING.md`
- `docs/agents/workflows.md`
