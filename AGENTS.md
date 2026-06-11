# AGENTS.md — Headstart Coding Classroom REPL Platform

Quick-reference guide for Claude Code and Codex sessions. Read this at the start of every session.

For file roles: **CODEBASE_MAP.md**. For lesson JSON: **LESSON_SCHEMA.md**. For YAML lesson authoring: **YAML_LESSON_FORMAT.md**. For topic library: **TOPIC_LIBRARY_SCHEMA.md**. For platform features: **FEATURES.md**.

## Session Start Checklist

Do this at the start of every session, before writing any code:

- [ ] Read **CODEBASE_MAP.md** to orientate on the current file structure
- [ ] Run `gh pr list` — check for open PRs before starting new work
- [ ] Confirm you are on the correct branch (`git branch`)
- [ ] Run `npm test` — the suite must pass before touching anything

---

## Project Summary

A browser-based coding classroom tool for Headstart Coding live sessions and solo study.
One React app with four route-based sections, deployed as a single Vite build to GitHub Pages:

- **Classroom** — student/teacher coding environment at `/lesson/:lessonId`
- **Lesson Builder** — teacher tool for creating and testing lesson JSON at `/builder`
- **Admin Portal** — account and lesson management at `/admin` (admin role required)
- **Login** — Firebase Auth sign-in at `/login`

No backend server exists or should be added.

---

## Tech Stack

| Concern | Solution |
|---|---|
| Framework | React (functional components + hooks only — no class components) |
| Build tool | Vite |
| Hosting | GitHub Pages |
| Real-time sync | Firebase Realtime Database — classroom app session state |
| Auth | Firebase Authentication (email/password) — teachers and admins only; students remain login-less |
| Database | Firebase Firestore — lesson content (`lessons/`) and user accounts (`users/`) |
| Cloud Functions | Firebase Cloud Functions (Blaze) — account management with custom claims |
| Python execution | Pyodide (WASM) in a Web Worker — classroom app AND lesson builder |
| Web output | Sandboxed iframe with Blob URL virtual filesystem — classroom app AND lesson builder |
| Scratch blocks | Custom scratch-blocks (Blockly fork) with hand-rolled interpreter — classroom app only |
| Code editor | CodeMirror 6 |
| Markdown | react-markdown + rehype-highlight |
| Styling | CSS custom properties in a shared global stylesheet (`src/index.css`) |
| Env vars | `.env` lives one level above the repo root (`../`); loaded via `envDir: '../'` in `vite.config.js` — shared by all worktrees automatically |

Do not add any other major dependencies without confirming with the user.

---

## Hard Constraints

These rules are absolute — do not deviate regardless of context:

- Do not add a backend server or API
- Teachers and admins authenticate via Firebase Auth (email/password) — `?teacher=true` is now a redirect hint to `/login`, not direct access
- Students remain entirely login-less — do not require Firebase Auth for student operations
- Do not use `sessionStorage` for the Anonymous ID — use `localStorage`
- Do not write student code to Firebase per keystroke unless `activeStudentView` matches
- Do not re-render the iframe per keystroke during live view — only on Run
- Do not hardcode student limits
- Do not add pip install support
- Do not add file I/O support
- Do not deviate from Firebase data model or localStorage key formats
- Do not duplicate Pyodide, iframe, CodeMirror, checks, or Markdown logic — always use shared modules
- Do not store Firebase file keys with raw dots — always encode with `encodeFileKey`
- Do not add dependencies without confirming with the user

---

## Repository Structure

> Key directories only — see **CODEBASE_MAP.md** for every file and its role.

```
/
├── src/
│   ├── app/             # Classroom (components, views, hooks)
│   ├── builder/         # Lesson builder (components, views)
│   ├── admin/           # Admin portal (AccountManagement, LessonPanel, TopicLibraryPanel)
│   ├── auth/            # Auth context (AuthProvider, ProtectedRoute)
│   └── shared/          # Modules shared by all sections — never duplicate
├── cli/                 # CLI tool for lesson and topic library management
├── functions/           # Firebase Cloud Functions (account management)
├── index.html           # App entry (serves all routes via HashRouter)
└── vite.config.js
```

---

## Admin Portal

The admin portal (`/admin`) is accessible only to users with the admin Firebase role.

**Tabs:**
- **Accounts** — create teacher/admin accounts, set roles, disable/enable, delete (via Cloud Functions)
- **Lessons** — browse all Firestore lessons grouped by type and level; launch as teacher or copy student link
- **Topic Library** — create, edit, and delete topics with full Markdown description and syntax fields
- **Shared Assets** — manage lesson-type-wide Firebase Storage files and Scratch default sprites (`lessonTypeAssets/{type}` Firestore collection; storage at `shared/{type}/assets/`)

---

## CLI Tool (`cli/`)

The `cli/` sub-package is a CLI for managing lessons, tasks, topics, and assets against Firestore and Firebase Storage. It uses the Firebase Admin SDK — no browser auth needed.

**Storage model:** Lessons and topics live in **Firestore** (`lessons/` and `topicLibrary/` collections), not in local files.

**Auth:** Set `GOOGLE_APPLICATION_CREDENTIALS` to a service account JSON file path.
Download from: Firebase Console → Project Settings → Service Accounts → Generate new private key.

**Setup:**
1. `export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`
2. `cd cli && npm install`

**Usage:** `node cli/cli.mjs <command> <subcommand> [args]`

JSON data can be supplied as a file path argument or piped via stdin. All output is JSON to stdout; errors go to stderr with exit code 1.

**Lessons:**

| Command | Purpose |
|---|---|
| `lessons list` | List all lessons currently live in the app (from Firestore) |
| `lessons get <id>` | Fetch the full lesson JSON from Firestore |
| `lessons skeleton <id>` | Fetch lesson metadata + compact task list without task bodies |
| `lessons validate [file]` | Validate a lesson JSON — exits 1 if invalid. Does not require credentials. |
| `lessons upsert [file]` | Publish a lesson JSON to Firestore — validates first |
| `lessons delete <id>` | Permanently delete a lesson from Firestore |
| `lessons yaml-to-json [file]` | Convert YAML lesson to JSON + validate. Does not require credentials. |
| `lessons publish-yaml [file]` | Convert YAML, validate, and publish to Firestore in one step |

**Tasks:**

| Command | Purpose |
|---|---|
| `tasks get <lessonId> <taskIndex>` | Fetch one task by 1-based flat index — groups are transparent |
| `tasks upsert <lessonId> <taskIndex> [file]` | Replace one task by flat index; validates the full lesson before writing |
| `tasks append <lessonId> [file] [--group <title>]` | Append a new task to the lesson (or a named group); validates before writing |

**Topics:**

| Command | Purpose |
|---|---|
| `topics list` | List all topics in the live topic library |
| `topics get <id>` | Fetch a full topic from Firestore |
| `topics upsert [file]` | Create or update a topic in the topic library |
| `topics delete <id>` | Permanently delete a topic from Firestore |

**Assets:**

| Command | Purpose |
|---|---|
| `assets list <lessonId>` | List `storageAssets` for a lesson |
| `assets upload <lessonId> <filepath> [--filename <name>] [--mime-type <type>]` | Upload a local file to Firebase Storage; MIME type auto-detected from extension |
| `assets delete <lessonId> <filename>` | Delete a file from Firebase Storage and remove it from `storageAssets` |

**Note:** Scratch toolbox XML validation is skipped server-side (no `DOMParser` in Node.js) — use the builder preview to catch XML errors.

---

## Shared Modules — Critical

All app sections import from `src/shared/`. Never duplicate Pyodide, iframe, CodeMirror, checks, or Markdown logic — always use the shared modules. See **CODEBASE_MAP.md** for the full list of shared modules and their exports.

---

## Firebase Data Model

**Critical — do not deviate from this structure.**

```json
{
  "sessions": {
    "{lessonId}": {
      "state": "waiting | active | sandbox | ended",
      "currentTaskId": 1,
      "createdAt": 1234567890,
      "startedAt": "1234567890 | null",
      "currentTaskStartedAt": "1234567890 | null",
      "endedAt": "1234567890 | null",
      "isPaused": false,
      "activeStudentView": "{anonymousId} | null",
      "teacherLive": {
        "active": true,
        "source": "teacher | student",
        "sourceStudentId": "uuid | null",
        "sourceStudentName": "Jamie | null",
        "taskId": 1,
        "lessonType": "python",
        "code": "...",
        "files": { "index__dot__html": "..." },
        "output": "...",
        "runStatus": "success | error | stopped | submitted | null",
        "checkPassed": true,
        "selection": { "from": 0, "to": 5, "file": "index.html" },
        "activity": { "type": "copy | paste | click", "at": 1234567890, "file": "index.html" },
        "updatedAt": 1234567890
      },
      "sandboxCode": "string | null",
      "sandboxCodePushedAt": 1234567890,
      "sandboxFiles": { "index__dot__html": "..." },
      "sandboxFilesUpdatedAt": 1234567890,
      "joiningStudents": {
        "{tempId}": { "joinedAt": 1234567890 }
      },
      "students": {
        "{anonymousId}": {
          "displayName": "Jamie",
          "joinedAt": 1234567890,
          "online": true,
          "currentCode": "string",
          "currentFiles": { "index__dot__html": "..." },
          "currentOutput": "string",
          "currentAnswer": "b",
          "currentActiveFile": "index.html",
          "currentSelection": { "from": 0, "to": 5, "file": "index.html" },
          "currentActivity": { "type": "copy | paste | click", "at": 1234567890, "file": "index.html" },
          "lastRunStatus": "success | error | null",
          "checkPassed": true,
          "lastRunAt": 1234567890,
          "remoteResetAction": "starter | complete | stage_0 | stage_1 | ...",
          "remoteResetPushedAt": 1234567890,
          "inPersonalSandbox": "true | null",
          "checkOverridePassed": "boolean | null",
          "checkOverrideHint": "string | null",
          "checkOverridePushedAt": "number | null"
        }
      }
    }
  }
}
```

**File key encoding:** Firebase keys cannot contain dots. `index.html` is stored as `index__dot__html`. Always use `encodeFileKey`/`decodeFileKey` from `useSession.js`. App state and localStorage use the real filenames.

### Write rules

- Teacher writes: `state`, `currentTaskId`, `startedAt`, `currentTaskStartedAt`, `endedAt`, `isPaused`, `activeStudentView`, `teacherLive`, `sandboxCode`, `sandboxCodePushedAt`, `sandboxFiles`, `sandboxFilesUpdatedAt`, any student's `displayName`, student node removal
- Teacher — remote reset: `remoteResetAction` + `remoteResetPushedAt` on individual student node
- Teacher — check override: `checkOverridePassed` + `checkOverrideHint` + `checkOverridePushedAt` on individual student node; cleared by `setTaskId`
- Student (on run): own `currentCode`/`currentFiles`, `currentOutput`, `lastRunStatus`, `checkPassed`, `lastRunAt`
- Student (when watched — Python): `currentCode` per keystroke, `currentOutput` line by line during run, `currentSelection`/`currentActivity` editor interactions
- Student (when watched — HTML): `currentFiles` per active-tab keystroke, `currentActiveFile`/`currentSelection`/`currentActivity` editor interactions
- Student (quiz): `currentAnswer` on submit; also written incrementally for match/fill_blank as tiles are placed
- Student (personal sandbox): own `inPersonalSandbox` — set to `true` on entry, `null` on exit
- Student (name-entry): writes own `joiningStudents/{tempId}` on entering name-entry phase; removed on joining or leaving
- Firebase v1 security rules are open read/write — do not add authentication logic

### onDisconnect handlers

- `activeStudentView` cleared when teacher disconnects
- `teacherLive` set to null when teacher disconnects
- Student `online` **key removed** on disconnect (not set to false)
- Session node deleted when teacher calls `endSession()` and disconnects
- `joiningStudents/{tempId}` **key removed** on disconnect (set via `onDisconnect().remove()`)

---

## localStorage Keys

**Critical — do not deviate from these key formats.**

| Key | Value |
|---|---|
| `headstart_identity` | `{ anonymousId, displayName, lastSessionTimestamp }` |
| `headstart_{lessonId}_{taskId}_{anonymousId}` | `{ code?, output?, runStatus?, state? }` — Python/Scratch |
| `headstart_{lessonId}_{taskId}_{filename}_{anonymousId}` | `{ content }` — HTML per-file |
| `headstart_{lessonId}_personalsandbox_{anonymousId}` | `{ code?, state? }` — personal sandbox Python/Scratch; `{ fs }` — personal sandbox Filesystem |
| `headstart_{lessonId}_personalsandbox_{filename}_{anonymousId}` | `{ content }` — personal sandbox HTML per-file |
| `headstart_builder_current` | Full lesson JSON object |

---

## URL Structure

| URL | Behaviour |
|---|---|
| `/` | Landing page — student enters lesson ID |
| `/login` | Email/password sign-in page for teachers and admins; reads `?redirect` param |
| `/admin` | Admin portal — account and lesson management (admin role required) |
| `/lesson/:lessonId` | Solo student mode |
| `/lesson/:lessonId?live=true` | Live student mode (joins Firebase session) |
| `/lesson/:lessonId?teacher=true` | Teacher view — requires Firebase Auth (teacher or admin role); redirects to `/login` if unauthenticated |
| `/lesson/:lessonId?teacher=true&present=true` | Teacher presentation (StudentView watching teacherLive) — also requires auth |
| `/builder` | Lesson builder |

No room IDs. One session per lesson. `?teacher=true` is a redirect hint — Firebase Auth enforces access.

---

## Session States

| State | Meaning |
|---|---|
| `waiting` | Session created — students in waiting room |
| `active` | Live lesson — teacher controls current task |
| `sandbox` | Freeform mode — no task, no checks |
| `ended` | Session finished |
| *(any + `isPaused: true`)* | Freezes student navigation without changing state — overlays any of the above |

---

## Identity Model

- Anonymous ID: random UUID generated on first visit, stored in `localStorage`
- Display Name: separate — teacher can rename without affecting keys or localStorage
- Session timestamp comparison: stored `lastSessionTimestamp` vs Firebase `createdAt`
  - Match → same session → skip name entry, restore work
  - Differ → new session → fresh name entry, new Anonymous ID
- Duplicate names get numeric suffix: `Jamie` → `Jamie-2` → `Jamie-3`

---

## Key Behaviours — Do Not Get These Wrong

### Code carry-through
- Check localStorage for `carryCodeFrom` task ID before loading `starterCode`
- Per-file for HTML lessons — carry each file independently by filename
- Scratch: `carryBlocksFrom` works identically
- Fallback chain: saved carry → starterCode/starterFiles → empty editor

### Live view (activeStudentView)
- Default expanded view shows last-run snapshot only — no streaming
- Streaming activates only when teacher clicks "Go Live"
- On "Go Live": one-time fetch first, then set `activeStudentView`
- While live, the teacher sees the student's selected text/cursor and short copy, paste, and click notices
- Closing modal by ANY means (button, click outside, Escape, tab close) must clear `activeStudentView`
- Firebase `onDisconnect` clears `activeStudentView` on unexpected tab close
- Only one student streams at a time

### Teacher live broadcast (teacherLive)
- Separate from `activeStudentView` — broadcasts teacher's or a student's screen to ALL students
- Opens via `?teacher=true&present=true` presentation window
- Broadcast code views stream selection/cursor and copy, paste, and click notices
- `onDisconnect` clears `teacherLive` automatically

### Teacher timers
- A task may define `estimatedMinutes` as a positive integer; the builder displays their lesson-wide total
- Starting a session sets `startedAt` and `currentTaskStartedAt`
- Moving the class to a task or returning from sandbox restarts `currentTaskStartedAt`
- Teacher view shows lesson elapsed time and a countdown for timed active tasks; expired task timers flash

### Remote reset
- Teacher writes `remoteResetAction` ("starter", "complete", or "stage_N") + `remoteResetPushedAt` to student node
- Student detects timestamp change and applies reset silently (no prompt)
- `stage_N` actions resolve against `task.codeStages[N]` (Python: `.code`, HTML: `.files`/`.entryFile`, Scratch: `.blocks`, Filesystem: `.fs`)

### Sandbox mode
- Student code saved to localStorage BEFORE editor clears on sandbox entry
- Sandbox content discarded on return to lesson — never saved to localStorage
- `sandboxCodePushedAt` / `sandboxFilesUpdatedAt` timestamps used as change triggers (not the values)
- HTML sandbox: files stored with `__dot__` encoding in Firebase via `sandboxFiles`
- Filesystem sandbox: state stored as JSON string in `sandboxCode` (same channel as Python/Scratch)

### Personal sandbox
- Separate from the teacher-forced `sandbox` session state — available in both `lesson` and `solo` phases
- Uses `lesson.sandboxStarterCode` / `lesson.sandboxStarterFiles` / `lesson.sandboxStarterFs` as initial content on first entry; only offered when the lesson has these fields
- State persists in localStorage using a special pseudo-task-id key `personalsandbox` — survives task changes and teacher sandbox pushes
- **Solo mode**: "Open Sandbox" button in the nav bar; "Close Sandbox" returns to the lesson task
- **Live mode**: offered via `CheckFeedbackBanner` after a check passes; teacher moving to the next task automatically pulls the student back to the lesson
- Student writes `inPersonalSandbox: true` to their Firebase node on entry (cleared to `null` on exit) — visible to teacher in `StudentCard` as a purple "Sandbox" badge
- Task localStorage saves are skipped during personal sandbox; saves go to the `personalsandbox` key instead
- Checks still run (teacher can watch output) but results do not affect lesson progress

### Pyodide
- Runs in a Web Worker — never blocks the main thread
- `stopPython()` terminates the worker to kill infinite loops; replacement pre-warmed immediately
- `input()` handled via Python AST transform; resolved when `provideInput()` is called

### File key encoding (Firebase)
- Always use `encodeFileKey`/`decodeFileKey` from `useSession.js` when reading/writing `currentFiles` or `sandboxFiles`
- App state and localStorage use raw filenames with real dots
- *(Rule also stated in the Firebase Data Model section above — both locations are intentional reminders)*

---

## Git Workflow

When implementing any new feature, always create a branch before writing any code:

```bash
git checkout -b feature/<short-kebab-case-description>
```

All feature work happens on this branch — never commit directly to `main`. Keep branches focused: one feature per branch.

**Branch naming conventions:**
- `feature/` — new functionality
- `fix/` — bug fixes
- `refactor/` — code restructuring with no behaviour change

When the feature is complete, commit with a descriptive message and push to remote:

```bash
git push -u origin feature/<branch-name>
```

Then open a pull request using the GitHub CLI:

```bash
gh pr create --title "<Feature title>" --body "<summary of what was implemented, any non-obvious decisions made, and how to verify it works>"
```

Do not merge the PR — leave it open for review.

### Responding to PR review comments

When asked to handle or address a comment on a pull request, always reply directly to that comment thread — even before starting work — to acknowledge what will be done. Once the commit is made, post a follow-up reply on the same thread explaining what was changed and which commit addresses it:

```bash
# Reply to a specific review comment thread
gh api repos/{owner}/{repo}/pulls/comments/{comment_id}/replies \
  --method POST --field body="Addressed in <commit-sha>: <brief explanation of what was changed>"

# Or post a general PR comment (use when replying to a top-level review, not a line comment)
gh pr comment <pr-number> --body "Addressed in <commit-sha>: <brief explanation of what was changed>"
```

### Code review

When running `/code-review` on a PR number (e.g. `/code-review https://github.com/.../pull/123`), always post the findings as a comment on that PR when the review is complete:

```bash
gh pr comment <pr-number> --repo Headstart-Coding-Launchpad/editor --body "<findings>"
```

Format the comment as a markdown list of findings, one section per bug, with severity emoji (🔴 high / 🟠 medium / 🟡 low), the file and approximate line, a one-sentence summary, a concrete failure scenario, and a suggested fix where applicable. End the comment with `*Review performed by Claude Code (claude-sonnet-4-6)*`.

If the review target is a local branch diff rather than a PR number, skip the comment step.

### Worktrees

All worktrees share the same `.env` file automatically — it lives one level above the repo root (`../`) and all worktrees resolve it via `envDir: '../'` in `vite.config.js`. Do not create, copy, or write a `.env` file inside a worktree or the main repo directory.

After `gh pr create` completes successfully, exit and remove the worktree using the ExitWorktree tool (or `git worktree remove <path>`). This keeps the repo tidy and signals that the branch is in review.

---

## Testing

Read **TESTING.md** for full detail on tool choices, layer definitions, coverage thresholds, and what NOT to test.

### Standing instructions — follow these on every session that touches tests or code

**Test runner:** `npm test` (Vitest, unit + component). `npm run test:e2e` (Playwright, E2E). Never run tests via a raw `node` or `vite` command.

**Where tests live:**
- Unit and component tests: `src/**/__tests__/*.test.{js,jsx}` — mirroring source directory layout
- E2E tests: `e2e/*.spec.js`
- No co-located test files (never `src/shared/checks.test.js` next to `checks.js`)

**Before writing a new test file:**
1. Read the source file you are testing — never assume function signatures
2. Check whether a `__tests__/` directory already exists for that location; if not, create it
3. Mock at the module boundary, not inside the implementation

**Mock rules:**
- Firebase: `vi.mock('firebase/database', ...)` — never let tests hit the real database
- localStorage: use jsdom's built-in; call `localStorage.clear()` in `beforeEach`
- `window.matchMedia`: already mocked globally in `src/test/setup.js`
- `URL.createObjectURL` / `URL.revokeObjectURL`: already mocked globally in `src/test/setup.js`
- `crypto.randomUUID`: already mocked globally in `src/test/setup.js`
- Pyodide / Web Worker: mock the `pyodide.js` manager interface with `vi.mock`; never import the worker directly in tests
- `react-router-dom`: mock `useNavigate`, `useParams`, `useSearchParams` as needed per component

**Which test layer to use:**
- Pure functions → unit test
- React components or hooks → component test
- Critical user journeys that don't require Firebase → E2E test only
- If it exports pure functions → add a unit test file in the matching `__tests__/` directory
- If it is a React component or hook → add a component test file
- If it changes a critical user journey → consider whether an E2E test needs updating

**Coverage thresholds** are set deliberately low while complex components (StudentView, TeacherView, useSession, builder views) remain untested. Do not raise thresholds until the corresponding tests exist. See the phase table in TESTING.md.

**Do not test:**
- Firebase `onDisconnect` behaviour (requires real network disconnection)
- Pyodide WASM execution (Web Worker; test the `pyodide.js` interface only via mock)
- Scratch VM rendering (canvas-based, not jsdom-compatible)
- CodeMirror `EditorView` internals (test config factories only)

**E2E tests (Playwright):**
- Only cover flows that do NOT require Firebase — solo student flows and builder flows
- Firebase-dependent flows (live session, remote reset, activeStudentView) require Firebase Emulator and are out of scope until that infrastructure is set up
- Base URL: `http://localhost:5173/editor/` — the Vite base is `/editor/`, not `/`
- Hash routes: use `page.goto('#/lesson/:lessonId')` — Playwright prepends the baseURL

**When the test suite fails in CI or before a build:**
- `npm test` exits non-zero → `npm run build` will also fail (via `prebuild` lifecycle hook)
- Fix the failing tests before merging or deploying — do not lower thresholds to make the build pass

---

## Doc Hygiene

After any significant change, update the relevant docs before closing the task:
- **CODEBASE_MAP.md** — when files are added, moved, or removed
- **LESSON_SCHEMA.md** — when lesson JSON fields or check types change
- **YAML_LESSON_FORMAT.md** — when YAML conversion rules or shorthands change (e.g. new task type shorthand, new check alias)
- **TOPIC_LIBRARY_SCHEMA.md** — when topic structure changes
- **FEATURES.md** — when a new user-facing feature is added or removed
- **TESTING.md** — when test strategy or coverage thresholds change
- **This file (AGENTS.md)** — when Firebase model, localStorage keys, URLs, session states, or key behaviours change

**"Significant change" means:** a new component, hook, or module is created; a Firebase field is added or removed; a URL parameter changes; a behaviour listed in Key Behaviours changes; or any section of this file becomes inaccurate.

When a library or CDN module is added, removed, or upgraded to a new major version, update **LICENSES.md** with the package name, version, and license. Check the license in the package's `package.json` or repository — pay particular attention to copyleft licenses (AGPL, GPL) before adding anything new.

---

*Last updated: June 2026*
