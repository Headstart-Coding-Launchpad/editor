# Agent Reference: Project Rules

Load this when a task touches architecture, shared modules, admin, CLI, dependencies, or platform-wide constraints.

## Tech Stack

| Concern | Solution |
|---|---|
| Framework | React functional components and hooks only; no class components |
| Build tool | Vite |
| Hosting | GitHub Pages |
| Real-time sync | Firebase Realtime Database for classroom session state |
| Auth | Firebase Authentication email/password for teachers and admins only |
| Database | Firebase Firestore for `lessons/` and `users/` |
| Cloud Functions | Firebase Cloud Functions for account management with custom claims |
| Python execution | Pyodide in a Web Worker for classroom and builder |
| Web output | Sandboxed iframe with Blob URL virtual filesystem |
| Scratch blocks | Custom scratch-blocks / Blockly fork with hand-rolled interpreter |
| Code editor | CodeMirror 6 |
| Markdown | `react-markdown` and `rehype-highlight` |
| Styling | CSS custom properties in `src/index.css` |
| Env vars | `.env` one level above repo root; loaded by `envDir: '../'` |

Do not add major dependencies without confirming with the user.

## Architecture Constraints

- No backend server or API should be added.
- Teachers and admins authenticate through Firebase Auth; `?teacher=true` is only a redirect hint to `/login`.
- Students remain login-less.
- Do not add auth requirements to student operations.
- Do not hardcode student limits.
- Do not add pip install support.
- Do not add file I/O support.
- Do not deviate from Firebase data model, localStorage key formats, URLs, or session-state semantics.

## Repository Shape

```text
/
├── src/
│   ├── app/        # Classroom components, views, hooks
│   ├── builder/    # Lesson builder components, views, hooks
│   ├── admin/      # Admin portal
│   ├── auth/       # Auth context and protected route
│   ├── modules/    # Lesson type modules (one folder per type + registry.js)
│   └── shared/     # Shared modules; do not duplicate this logic
├── cli/            # Lesson, topic, feedback, and asset CLI
├── functions/      # Firebase Cloud Functions
├── index.html      # App entry
└── vite.config.js
```

Use `docs/CODEBASE_MAP.md` to locate specific files. Search or open the relevant section instead of loading the full map by default.

## Adding a New Lesson Type

The app uses a module registry (`src/modules/registry.js`) so that each lesson type is self-contained. To add a new type:

1. Create `src/modules/<type>/` with four files:
   - `StudentWorkspace.jsx` — the student coding view (receives `lesson`, `task`, `cs`, and other display props)
   - `BuilderWorkspace.jsx` — the builder workspace (re-export or wrapper of the builder component)
   - `CheckEditor.jsx` — the check configuration UI (wraps an appropriate `CheckListEditor` variant)
   - `index.js` — the module definition (see the interface table in `docs/CODEBASE_MAP.md`)

2. Add the module to `src/modules/registry.js`:
   ```js
   import newTypeModule from './<type>/index.js'
   const MODULES = { python, html, scratch, filesystem, <type>: newTypeModule }
   ```

3. No changes to `LessonTaskContent.jsx`, `TaskEditor.jsx`, or `TaskOptionsSection.jsx` are required.

The contract test at `src/modules/__tests__/moduleInterface.test.js` will automatically validate the new module's interface.

## Shared Modules

All app sections should import cross-cutting shared logic from `src/shared/` and type-specific runtime logic from `src/modules/<type>/`. Do not duplicate:

- Pyodide execution
- iframe construction
- CodeMirror configuration
- check evaluation
- Markdown rendering
- Firebase file-key encoding
- task flattening/group helpers

Important shared files include `iframe.js`, `CodeEditor.jsx`, `markdown.jsx`, `fileKeys.js`, `taskUtils.js`, `lessonService.js`, and `workspaceData.js`. Important module files include `src/modules/python/pyodide.js`, `src/modules/python/pyodide.worker.js`, `src/modules/scratch/scratch.js`, `src/modules/scratch/scratchPersistence.js`, and `src/modules/checks.js`.

## Admin Portal

The `/admin` route is available only to users with the admin Firebase role.

8 tabs, defined in `src/admin/AdminPortal.jsx`'s `TABS` array:

- Lessons: browse all published Firestore lessons in one library (the older type-grouped/filtered view is hardcoded off — `LessonPanel.jsx`'s type-tab UI is dead code behind `{false && ...}`); expand lessons to view session reports and lesson/task feedback with counts and resolve actions; launch as teacher or copy student links; fork a lesson to a class.
- Levels: manage reusable levels (`LessonPanel.jsx` rendered with `view="levels"`, via `LevelManager`).
- Classes: manage class records used for lesson forks (`LessonPanel.jsx` rendered with `view="classes"`, via `ClassManager`).
- Sessions: Realtime Database `sessions` list filtered to non-`ended` states — lesson, state, paused flag, student/online counts, open duration; "Close Session" removes an abandoned session node.
- Topic Library: create, edit, and delete topics with Markdown description and syntax fields.
- Shared Assets: manage lesson-type-wide Firebase Storage files and Scratch default sprites in `lessonTypeAssets/{type}` with storage at `shared/{type}/assets/`.
- Accounts: create teacher/admin accounts, set roles, change other users' passwords, disable/enable, delete via Cloud Functions. Signed-in users change their own password through `/account`.
- Feedback: real-time list of `platformFeedback` plus lesson/task feedback; lesson/task feedback also appears under each lesson.

## CLI Tool

The `cli/` package manages lessons, tasks, topics, feedback, and assets against Firestore and Firebase Storage using Firebase Admin SDK (not browser auth). Agents should use this CLI directly.

**Storage model:**
- Lessons → Firestore `lessons/`
- Reusable levels → Firestore `lessonLevels/`
- Classes → Firestore `classes/`
- Topics → Firestore `topicLibrary/`
- Assets → Firebase Storage under `lessons/{lessonId}/assets/`; `lesson.storageAssets` is optional metadata, not the source-of-truth inventory

**Auth:**
- Set `GOOGLE_APPLICATION_CREDENTIALS` to a service account JSON file path.
- Download from Firebase Console > Project Settings > Service Accounts.
- Do not commit or copy service account keys.

```bash
cd cli && npm install
node cli/cli.mjs <command> <subcommand> [args]
```

Command groups:
- `lessons list|get|skeleton|validate|test-checks|upsert|delete|fork|forks|lineage|yaml-to-json|json-to-yaml|preflight|publish-yaml|topics`
- `tasks get|upsert|append`
- `topics list|get|upsert|upsert-library|yaml-to-json|json-to-yaml|publish-yaml|delete`
- `feedback platform|lesson|all|add-lesson|add-platform|archive-lesson|archive-platform|clear-lesson|clear-platform`
- `assets list|upload|delete`
- `levels list|upsert|delete`
- `classes list|upsert|archive`

`feedback` never hard-deletes: `archive-lesson`/`archive-platform` (single item) and `clear-lesson`/`clear-platform` (bulk, with optional filters) all set an `archived: true` flag rather than removing the document.

Lesson validation/upsert, task upsert/append, and topic upsert/upsert-library accept JSON or YAML as a file argument or via stdin. Output is JSON by default; pass `--format yaml` for YAML. Errors go to stderr with exit code 1.

Scratch toolbox XML validation is skipped server-side (no DOMParser in Node); use the builder preview to catch XML errors.
