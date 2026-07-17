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

Usually changes with:

- `src/modules/<type>/`
- `src/modules/registry.js`
- `src/modules/__tests__/moduleInterface.test.js`
- `src/app/components/LessonTaskContent.jsx`
- `src/app/views/teacher/TeacherEditorPanel.jsx`
- `src/builder/components/TaskEditor.jsx`
- `src/builder/components/task-editor/TaskOptionsSection.jsx`
- `docs/architecture/lesson-type-modules.md`
- `docs/authoring/<type>.md`
- `docs/FEATURES.md`
- `docs/CODEBASE_MAP.md`
- `docs/TESTING.md`

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
- `docs/authoring/skills/*.md`
- `docs/FEATURES.md`
- builder and CLI validation tests

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
- `src/app/teacherSandboxContent.js`
- `src/app/studentLiveDisplay.js`
- `src/app/views/TeacherView.jsx`
- `src/app/views/teacher/TeacherEditorPanel.jsx`
- `src/app/components/StudentModal.jsx`
- `src/modules/<type>/TeacherLiveView.jsx`
- `docs/agents/classroom-behaviours.md`
- `docs/agents/runtime-model.md`
- `docs/architecture/runtime-flows.md`

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

Changes include admin tabs, authoring workflow, lesson management, session cleanup, topics, shared assets, accounts, feedback, or reports.

Usually changes with:

- `src/admin/`
- `src/shared/lessonService.js`
- `functions/index.js`
- `cli/authoring.mjs`
- `cli/feedback.mjs`
- `docs/agents/project-rules.md`
- `docs/authoring/skills/*.md`
- `docs/FEATURES.md`
- admin component tests

## CLI Workflows

Changes include command names, arguments, output format, validation, publishing, feedback, assets, authoring guidelines, or topic workflows.

Usually changes with:

- `cli/`
- `docs/agents/project-rules.md`
- `docs/authoring/skills/*.md`
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
- `docs/authoring/skills/hsc-assets.md`
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
- `src/admin/ReportsPanel.jsx`
- `src/admin/FeedbackPanel.jsx`
- `cli/feedback.mjs`
- `docs/authoring/skills/hsc-feedback.md`
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
