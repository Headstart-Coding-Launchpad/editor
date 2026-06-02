# Headstart Coding — Classroom REPL Platform
## Specification v3.0 — Current Behaviour

This document describes what the project **currently does**, not what was intended at the time of planning. Outdated planning artefacts (Open Items, Questions Before Build, Future Features) have been removed.

---

# Part 1 — Overview

## 1. System Description

A browser-based coding classroom tool for Headstart Coding live sessions and solo study. Supports Python, HTML/CSS/JS, and Scratch lessons. No backend server — fully static on GitHub Pages with Firebase Realtime Database for real-time sync.

Two applications in this repo:
- **Classroom App** — student/teacher coding environment at `/`
- **Lesson Builder** — teacher-facing lesson creation and testing tool at `/builder`

## 2. Tech Stack

| Concern | Solution |
|---|---|
| Framework | React (functional components + hooks) |
| Build | Vite |
| Hosting | GitHub Pages (static) |
| Real-time sync | Firebase Realtime Database (free tier) |
| Python execution | Pyodide (WASM) in a dedicated Web Worker |
| Web output | Sandboxed iframe with Blob URL virtual filesystem |
| Scratch blocks | Custom scratch-blocks (Blockly fork) with hand-rolled interpreter |
| Code editor | CodeMirror 6 |
| Markdown | react-markdown + rehype-highlight |
| Styling | CSS custom properties, shared global stylesheet |

## 3. URL Structure

| URL | Behaviour |
|---|---|
| `/` | Landing page — student enters lesson ID to navigate |
| `/lesson/:lessonId` | Solo student mode (no Firebase) |
| `/lesson/:lessonId?live=true` | Live student mode (joins Firebase session) |
| `/lesson/:lessonId?teacher=true` | Teacher view |
| `/lesson/:lessonId?teacher=true&present=true` | Teacher presentation view (StudentView watching teacherLive) |
| `/builder` | Lesson builder |

No room IDs. One session per lesson at a time. `?teacher=true` is the only auth mechanism.

---

# Part 2 — Lesson & Task Data Format

## 4. Lesson Envelope

```json
{
  "id": "python-intro",
  "type": "python",
  "title": "Introduction to Python",
  "description": "Short description shown on entry screen.",
  "level": 1,
  "tasks": [],
  "assetsPath": "/assets/lesson-id/",
  "assets": ["sprites/cat.png"],
  "sandboxStarter": "# Try something here\n",
  "sandboxStarterFiles": [...],
  "sandboxToolbox": "<xml>...</xml>",
  "sandboxSprites": [...],
  "sandboxBackdrops": [...]
}
```

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | Yes | string | Lowercase slug. Used in URLs and localStorage keys. |
| `type` | Yes | string | `python`, `html`, or `scratch` |
| `title` | Yes | string | Shown in teacher and student UI |
| `description` | Yes | string | Entry screen summary |
| `level` | No | number | Difficulty shown in TopBar badge |
| `tasks` | Yes | array | Flat or grouped task list |
| `assetsPath` | No | string | Base URL path for asset resolution |
| `assets` | No | string[] | Asset file paths for AssetBrowser |
| `sandboxStarter` | No | string | Python code or Scratch state pre-loaded in sandbox |
| `sandboxStarterFiles` | No | File[] | HTML files pre-loaded in sandbox |
| `sandboxToolbox` | No | string | Scratch XML toolbox for sandbox |
| `sandboxSprites` | No | Sprite[] | Sprites for sandbox |
| `sandboxBackdrops` | No | Backdrop[] | Backdrops for sandbox |

## 5. Task Types Overview

Every lesson type (Python, HTML, Scratch) can contain any mix of:
- **Code tasks** — type-specific editor
- **Information tasks** (`taskType: "information"`) — explainer only, no editor
- **Quiz tasks** (`taskType: "quiz"`) — interactive question, no editor
- **Groups** (`type: "group"`) — container holding ordered subtasks; subtask titles auto-derived from group name

## 6. Common Task Fields

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | Yes | integer | Sequential. Used in localStorage keys and carry references. |
| `title` | Yes | string | Shown in progress UI |
| `taskType` | No | string | Omit for code tasks; `"information"` or `"quiz"` for non-code |
| `explainer` | No | string | Markdown shown above editor. Required for information tasks. |
| `estimatedMinutes` | No | positive integer | Approximate duration used for builder totals and the live teacher countdown. |
| `check` | No | object or array | Completion check. Arrays require all checks to pass. |
| `interactionMode` | No | string | `"run"` (default) or `"submit"` |
| `hints` | No | string[] | Progressive hints revealed on demand |

## 7. Python Code Tasks

```json
{
  "id": 1,
  "title": "Hello World",
  "explainer": "Use `print()` to show output.",
  "starterCode": "print('Hello')\n",
  "completeCode": "print('Hello, World!')\n",
  "carryCodeFrom": null,
  "interactionMode": "run",
  "check": { "type": "output_contains", "value": "Hello" }
}
```

| Field | Notes |
|---|---|
| `starterCode` | Code loaded when no carry-through exists |
| `completeCode` | Reference solution — shown in builder, used by remote reset |
| `carryCodeFrom` | Task `id` to inherit prior saved code from. Takes priority over `starterCode`. |

Fallback chain: saved carry-through → `starterCode` → empty editor.

`interactionMode: "submit"` replaces Run with Submit; checks evaluate against code text only (no execution).

## 8. HTML/CSS/JS Code Tasks

```json
{
  "id": 1,
  "title": "Build a page",
  "explainer": "Add a heading.",
  "entryFile": "index.html",
  "completeEntryFile": "index.html",
  "carryCodeFrom": null,
  "starterFiles": [
    { "name": "index.html", "type": "html", "content": "..." },
    { "name": "style.css", "type": "css", "content": "..." }
  ],
  "completeFiles": [
    { "name": "index.html", "type": "html", "content": "..." }
  ],
  "check": [
    { "type": "element_exists", "selector": "h1" },
    { "type": "output_contains", "value": "Hello" }
  ]
}
```

File object: `{ name: string, type: "html"|"css"|"javascript", content: string }`

Carry-through is per-file matched by filename. Files not present in the carried task load from `starterFiles`.

`interactionMode: "submit"` replaces Run with Submit and hides the iframe preview; checks evaluate against source text only.

## 9. Scratch Code Tasks

```json
{
  "id": 1,
  "title": "Move the sprite",
  "explainer": "Make it move right.",
  "toolbox": "<xml>...</xml>",
  "sprites": [
    { "id": "sprite1", "name": "Sprite1", "type": "cat", "x": 0, "y": 0, "size": 100, "direction": 90 }
  ],
  "backdrops": [
    { "id": "backdrop1", "name": "Space", "image": "backdrops/space.png" },
    { "id": "backdrop2", "name": "Plain", "colour": "#ffffff" }
  ],
  "starterBlocks": { "sprite1": {} },
  "completeBlocks": { "sprite1": {} },
  "carryBlocksFrom": null,
  "check": {
    "type": "sprite_property",
    "evaluation": "after_run",
    "spriteName": "Sprite1",
    "property": "x",
    "operator": "greater_than",
    "value": 50
  }
}
```

Sprite: `{ id, name, type?, x?, y?, size?, direction?, rotationStyle?, visible?, costume?, costumes? }`
Backdrop: `{ id, name, colour?, image? }` — use `colour` for solid, `image` for file-based.  
Toolbox omitted or empty → full default toolbox.

The lesson builder loads reusable Scratch sprite presets from
`public/scratch-assets/sprites.json`. A selected preset is copied into task or
sandbox `sprites` with a new unique lesson sprite ID. Presets may provide
starting position, size, direction, `rotationStyle`, visibility and costumes.
Costume and backdrop images can be relative to lesson `assetsPath`, or use a
shared public root path such as `/assets/shared/sprites/rocket.png`.

## 10. Information Tasks

```json
{
  "id": 2,
  "taskType": "information",
  "title": "How loops work",
  "explainer": "A loop repeats code while a condition is true."
}
```

Explainer only. No editor, no check, no carry-through, no run button.

## 11. Quiz Tasks

All quiz tasks use `taskType: "quiz"`. Four sub-types via `quizType`.

### 11.1 Multiple Choice

```json
{
  "id": 3,
  "taskType": "quiz",
  "quizType": "multiple_choice",
  "title": "Which is the CPU?",
  "explainer": "Which component is the brain of a computer?",
  "options": [
    { "id": "a", "text": "Hard Drive", "feedback": "Not quite — the hard drive stores data." },
    { "id": "b", "text": "CPU" }
  ],
  "check": { "type": "answer_equals", "value": "b" }
}
```

`options[].feedback` is optional — shown when a wrong answer is selected.

### 11.2 Match

```json
{
  "taskType": "quiz",
  "quizType": "match",
  "pairs": [
    { "id": "1", "prompt": "CPU", "answer": "Processes instructions" },
    { "id": "2", "prompt": "RAM", "answer": "Temporary memory" }
  ]
}
```

Student drags tiles to match prompts. All pairs must be correct to pass.

### 11.3 Fill Blank

```json
{
  "taskType": "quiz",
  "quizType": "fill_blank",
  "text": "A ___ repeats code while a condition is true.",
  "mode": "drag",
  "blanks": [{ "id": "1", "answer": "loop" }]
}
```

`mode`: `"drag"` (drag tiles into blanks) or `"type"` (student types answer).

### 11.4 Short Answer

```json
{
  "taskType": "quiz",
  "quizType": "short_answer",
  "explainer": "What does CPU stand for?",
  "check": { "type": "answer_contains", "value": "Central Processing Unit" }
}
```

## 12. Task Groups

Groups contain ordered subtasks. Subtask titles are auto-derived from the group name.

```json
{
  "id": "g-1234567890",
  "type": "group",
  "title": "Loops",
  "subtasks": [
    { "id": 1, "title": "Loops - 1", ... },
    { "id": 2, "title": "Loops - 2", ... }
  ]
}
```

Groups are collapsible in TaskNavigator and rendered as sections in progress dots.

## 13. Check Types

### Python and HTML

| Type | Python | HTML | Run | Submit | Description |
|---|---|---|---|---|---|
| `code_no_error` | ✅ | — | ✅ | — | Run status is `success` |
| `output_contains` | ✅ | ✅ | ✅ | — | Output includes value (case-insensitive) |
| `output_equals` | ✅ | ✅ | ✅ | — | Output matches value after trim (case-insensitive) |
| `output_line_count` | ✅ | ✅ | ✅ | — | Output has exactly N lines |
| `output_not_empty` | ✅ | ✅ | ✅ | — | Output is not empty |
| `output_empty` | ✅ | ✅ | ✅ | — | Output is empty or whitespace-only |
| `code_contains` | ✅ | ✅ | ✅ | ✅ | Source includes value (case-insensitive, ignoring whitespace outside quotes) |
| `code_does_not_contain` | ✅ | ✅ | ✅ | ✅ | Source does not include value (ignoring whitespace outside quotes) |
| `code_equals` | ✅ | ✅ | ✅ | ✅ | Source equals value (case-insensitive, ignoring whitespace outside quotes) |
| `element_exists` | — | ✅ | ✅ | — | CSS selector matches at least one element |
| `element_count` | — | ✅ | ✅ | — | Selector match count equals value |
| `element_value` | — | ✅ | ✅ | — | Element text/value contains value (case-insensitive) |

Submit mode accepts only: `code_contains`, `code_does_not_contain`, `code_equals`.

### Scratch

| Type | Evaluation options | Description |
|---|---|---|
| `block_used` | `manual`, `after_run` | Opcode is present in workspace |
| `sprite_property` | `manual`, `after_run`, `continuous` | Sprite property (x/y/size/direction/visible) satisfies operator + value |
| `variable_equals` | `manual`, `after_run` | Named variable equals expected value |

### Quiz

| Type | Description |
|---|---|
| `answer_equals` | Selected answer ID matches value |
| `answer_contains` | Free-text answer contains value |
| `answer_matches_regex` | Free-text answer matches regex pattern |
| `quiz_result` | All match/fill-blank pairs correct |

---

# Part 3 — Firebase Data Model

## 14. Session Structure

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
        "code": "print('hello')",
        "files": { "index__dot__html": "..." },
        "activeFile": "index.html",
        "output": "hello\n",
        "runStatus": "success | error | stopped | submitted | null",
        "checkPassed": true,
        "checkAttempted": true,
        "checkSuggestion": "hint text",
        "selection": { "from": 0, "to": 5, "file": "index.html" },
        "activity": { "type": "copy | paste | click", "at": 1234567890, "file": "index.html" },
        "answer": "b",
        "updatedAt": 1234567890
      },
      "sandboxCode": "# sandbox code",
      "sandboxCodePushedAt": 1234567890,
      "sandboxFiles": { "index__dot__html": "..." },
      "sandboxFilesUpdatedAt": 1234567890,
      "students": {
        "{anonymousId}": {
          "displayName": "Jamie",
          "joinedAt": 1234567890,
          "online": true,
          "currentCode": "print('hello')",
          "currentFiles": { "index__dot__html": "..." },
          "currentOutput": "hello\n",
          "currentAnswer": "b",
          "currentActiveFile": "index.html",
          "currentSelection": { "from": 0, "to": 5, "file": "index.html" },
          "currentActivity": { "type": "copy | paste | click", "at": 1234567890, "file": "index.html" },
          "lastRunStatus": "success | error | null",
          "checkPassed": true,
          "lastRunAt": 1234567890,
          "remoteResetAction": "starter | complete",
          "remoteResetPushedAt": 1234567890
        }
      }
    }
  }
}
```

**File key encoding:** Firebase keys cannot contain dots. `index.html` is stored as `index__dot__html`. Always use `encodeFileKey`/`decodeFileKey` from `useSession.js`. This applies to `currentFiles`, `sandboxFiles`. localStorage and app state use the real filenames.

## 15. Write Rules

| Writer | Fields |
|---|---|
| Teacher | `state`, `currentTaskId`, `startedAt`, `currentTaskStartedAt`, `endedAt`, `isPaused`, `activeStudentView`, `teacherLive`, `sandboxCode`, `sandboxCodePushedAt`, `sandboxFiles`, `sandboxFilesUpdatedAt`, any student's `displayName` |
| Teacher — student management | Remove student node; push `remoteResetAction` + `remoteResetPushedAt` to individual student |
| Student — on run | `currentCode`/`currentFiles`, `currentOutput`, `lastRunStatus`, `checkPassed`, `lastRunAt` |
| Student — when watched (Python) | `currentCode` per keystroke; `currentOutput` line by line during run; `currentSelection` and `currentActivity` editor interactions |
| Student — when watched (HTML) | `currentFiles` per active-tab keystroke; `currentActiveFile`, `currentSelection`, and `currentActivity` editor interactions |
| Student — quiz | `currentAnswer` on submit |
| System on join | `displayName`, `joinedAt`, `online: true` with `onDisconnect` to remove `online` key |

## 16. onDisconnect Handlers

- `activeStudentView` cleared when teacher disconnects
- `teacherLive` set to null when teacher disconnects
- Student `online` key removed on disconnect (not set to false — disappears from presence)
- Full session node deleted when teacher calls `endSession()` and then disconnects

## 17. Firebase Security Rules (v1)

```json
{
  "rules": {
    "sessions": {
      "$lessonId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

Open read/write. Security by obscurity of the teacher URL only.

---

# Part 4 — Identity & localStorage

## 18. Anonymous Identity

- **Anonymous ID:** random UUID generated on first visit, stored in `localStorage`
- **Display Name:** entered once per session, stored alongside Anonymous ID
- **Session Timestamp:** compared to Firebase `createdAt` to detect new sessions

Session detection logic on page load:
- `lastSessionTimestamp` matches Firebase `createdAt` → same session → skip name entry, restore work
- Timestamps differ → new session → fresh name entry, new Anonymous ID generated

Duplicate names get a numeric suffix: `Jamie` → `Jamie-2` → `Jamie-3`

## 19. localStorage Keys

| Key | Value |
|---|---|
| `headstart_identity` | `{ anonymousId, displayName, lastSessionTimestamp }` |
| `headstart_{lessonId}_{taskId}_{anonymousId}` | `{ code?, output?, runStatus?, state? }` — Python / Scratch |
| `headstart_{lessonId}_{taskId}_{filename}_{anonymousId}` | `{ content }` — HTML per-file |
| `headstart_builder_current` | Full lesson JSON object |

Note: Scratch saves workspace state under the `state` field in the Python-keyed entry.

---

# Part 5 — Session Lifecycle

## 20. Session States

| State | Meaning |
|---|---|
| `waiting` | Session created; teacher hasn't started yet — students in waiting room |
| `active` | Live lesson in progress — teacher controls current task |
| `sandbox` | Freeform mode — no task, checks disabled |
| `ended` | Session finished — students see end screen |

`isPaused: true` can overlay any active/sandbox state to freeze student navigation.

## 21. Teacher Session Flow

1. Open `/lesson/:lessonId?teacher=true`
2. App creates or reads existing Firebase session
3. Share link button copies `/lesson/:lessonId?live=true` to clipboard
4. "Start Session" → `state: "active"` → releases waiting students to Task 1
5. Navigate tasks, activate sandbox, pause/resume as needed
6. "End Session" → `state: "ended"` → all students see end screen
7. "Restart Session" → deletes all student data, resets to `waiting`

## 22. Student Entry Flows

**Returning student (same session):** timestamps match → skip name entry → restore work  
**Returning student (new session):** timestamps differ → new UUID → name entry  
**First visit:** no localStorage → name entry → join session  
**No active session:** choice screen — Work Solo or Wait for Teacher  
**Session starts during solo work:** JoinSessionPrompt modal appears — student can join or continue solo

---

# Part 6 — Teacher View

## 23. Layout

```
┌─────────────────────────────────────────────────────────┐
│ Top Bar: Lesson title | Session status | Share Link btn  │
├──────────────┬──────────────────────────┬────────────────┤
│ Task Nav     │   Teacher Editor         │ Student Grid   │
│ (left panel) │   (centre panel)         │ (right panel)  │
└──────────────┴──────────────────────────┴────────────────┘
```

Both left and right panels are collapsible. Layout adapts on mobile.

After a session starts, a timer strip shows elapsed lesson time and the summed planned duration when task estimates exist. Timed active tasks show a countdown; moving the class to a task or returning from sandbox restarts that countdown, and it flashes after reaching zero.

## 24. Task Navigator (left panel)

- Scrollable task list with group collapse support
- Aggregate stats per task: run count, check passed count
- Click a task → advances whole class to that task
- Previous / Next buttons
- Sandbox / Return to Lesson button
- Pause / Resume button

## 25. Teacher Editor (centre panel)

- Starter / Complete code toggle (view reference solution or starter)
- **Python:** single CodeEditor + output panel + Run button
- **HTML:** tabbed editor + iframe preview + Run button; Push to All in sandbox
- **Scratch:** multi-sprite blocks workspace + stage canvas
- Explainer rendered above editor in lesson mode

## 26. Student Grid (right panel)

- Dynamic grid — no hard cap (soft max ~12 for UI comfort)
- Per-card: name, online badge, run-status dot, check-passed badge, code/output/quiz snippet
- Expand button → StudentModal

## 27. StudentModal

Default: last-run snapshot (code, output/iframe/quiz/Scratch stage)  
"Go Live": one-time fetch then `activeStudentView` set → student streams per keystroke

Live code view paints the student's selection/cursor and briefly reports copy, paste, and editor-click activity.
Close by any means (button, outside click, Escape, tab close) clears `activeStudentView` immediately.

Teacher actions: Rename, Remove Student, Go Live / Stop Live, Reset to Starter, Reset to Complete.

## 28. Teacher Live Broadcast (teacherLive)

Separate from `activeStudentView`. Broadcasts to **all** students simultaneously.

- Teacher opens `?teacher=true&present=true` window
- Presentation window acts as a StudentView watching `teacherLive`
- All students get `isForcedTeacherLive = true` → their editors replaced with the broadcast view
- Source can be teacher's own work or a pinned student's stream
- Broadcast code views include streamed selection/cursor plus copy, paste, and editor-click activity notices
- `onDisconnect` clears `teacherLive` automatically; only one broadcast at a time
- Ending the teacher session closes the presentation window

## 29. Remote Reset

Teacher can silently reset an individual student from StudentModal:
- "Reset to Starter" → loads `starterCode`/`starterFiles`/`starterBlocks`
- "Reset to Complete" → loads `completeCode`/`completeFiles`/`completeBlocks`

Mechanism: teacher writes `remoteResetAction` + `remoteResetPushedAt` to student node. Student detects `remoteResetPushedAt` change and applies the action without any prompt.

---

# Part 7 — Student View

## 30. Phase State Machine

`StudentView` progresses through phases:  
`loading` → `waiting` → `name-entry` → `lesson` | `sandbox` | `solo` → `ended`

`?live=true` URL param enables live mode. Absence means solo mode. `isSolo` is set at load and does not change mid-session.

## 31. Task Navigation

**Live session:** teacher-controlled. Student cannot advance past current task.  
**Solo mode:** free navigation; can move one task ahead if current check has passed (or has no check).  
**Builder preview:** unrestricted task navigation so teachers can inspect any task without completing checks.
Previously visited tasks: viewable in read-only mode (red editor tint), but re-runnable in solo mode.

## 32. Completion Checks

- Evaluated automatically on Run (or Submit for `interactionMode: "submit"`)
- **Pass:** green banner + `checkPassed` written to Firebase
- **Fail (live session):** no negative feedback on first attempt; hint shown after repeated failure; "Show complete code" unlocked after 2+ repeated failures
- `repeatedSuggestionCount` tracks how many times the same failing suggestion has been shown

## 33. input() Handling (Python)

- Execution pauses on `input()` call
- Inline input field appears in output panel with `>` prompt
- Multiple sequential calls handled in sequence
- During live view: prompt text visible to teacher in real time

## 34. Code Carry-Through

```
Task loads with carryCodeFrom set:
→ Check localStorage for headstart_{lessonId}_{carryFromId}_{anonymousId}
→ Found: load saved code
→ Not found: fall back to starterCode / starterFiles
→ Neither: empty editor
```

HTML: per-file by filename. Scratch: `carryBlocksFrom` works identically.

## 35. Sync Behaviour

| Condition | Code/Files | Output |
|---|---|---|
| Not watched | On run | On run |
| Watched — Python | Per keystroke | Line by line during run |
| Watched — HTML | Per active-tab keystroke | On run |
| Quiz | On submit | — |

Sync is silent — no UI indicator on student side.

---

# Part 8 — Sandbox Mode

## 36. Sandbox Flow

1. Teacher enters sandbox → `state: "sandbox"` emitted to Firebase
2. Students save current task code to localStorage before editor clears
3. Students see plain editor — no explainer, no progress dots, no checks
4. Teacher types code → "Push to All" → `sandboxCode`/`sandboxFiles` + timestamp written
5. Students detect timestamp change → load pushed content immediately (no prompt)
6. Teacher "Return to Lesson" → `state: "active"` → students restore from localStorage; sandbox content discarded

`sandboxCodePushedAt` / `sandboxFilesUpdatedAt` timestamps are the change triggers, not the code values. Ensures a repeated push of identical content still fires.

---

# Part 9 — Solo Mode

No Firebase. Student works at their own pace.

| Feature | Live session | Solo mode |
|---|---|---|
| Task navigation | Teacher-controlled | Free (one ahead if unchecked) |
| Previous tasks | Read-only, no re-run | Fully editable, re-runnable |
| Sandbox | Teacher-activated | Not available |
| Firebase | Active | None |
| Name entry | Required first visit | Not required |
| Keystroke/output sync | When watched | Never |

---

# Part 10 — Pyodide Integration

- Runs in a dedicated Web Worker (`pyodide.worker.js`) — main thread never blocked
- Loaded once per page session; a replacement worker is pre-warmed after each run
- `stopPython()` terminates the worker immediately (kills infinite loops); replacement pre-warmed in background
- `input()` intercepted via Python AST transform: user code wrapped in an async function; `_hs_input()` posts a message and awaits a Promise resolved when `provideInput()` is called
- CDN: `https://cdn.jsdelivr.net/pyodide/v0.26.4/full/`
- Only stdlib; no pip installs

Worker message protocol:
- Main → Worker: `{ type: 'init' | 'run' | 'input', code?, value? }`
- Worker → Main: `{ type: 'progress' | 'ready' | 'load_error' | 'output' | 'input_required' | 'done' }`

---

# Part 11 — iframe Virtual Filesystem

`buildIframeSrc(files, entryFile, options) → string | null` in `src/shared/iframe.js`:

1. Listed asset references in HTML `href`/`src` attributes and CSS `url(...)` values are rewritten to their static lesson asset URLs
2. Each editable file is converted to a Blob URL
3. HTML entry file references to other editable files are rewritten to Blob URLs
4. CSP injected — blocks fetch, XHR, WebSocket except `ws://localhost:5173`
5. Console interceptor injected — posts `{ source: 'hsc-console', level, args }` via postMessage
6. Rewritten HTML injected into sandboxed iframe

Sandbox attributes: `allow-scripts allow-same-origin` only. No `allow-forms`, `allow-top-navigation`, `allow-popups`.

`waitForIframeText(timeout=1500)` listens for `__hsc_text__` postMessage — used by check evaluation to get iframe body text.

---

# Part 12 — Scratch Integration

Custom scratch-blocks implementation — **not scratch-vm**. Block logic and execution are hand-rolled.

## 37. Architecture

- One Blockly workspace per sprite, stored in a ref map
- Block definitions (~62 blocks) in `src/shared/scratch.js`
- Sprite state: `{ x, y, direction, size, visible, bubble, bubbleType, rotationStyle, costume }`
- Stage bounds: x ∈ [-240, 240], y ∈ [-180, 180]; sprite radius = (size / 100) × 24
- Broadcasts resolved across all sprites in `allSprites` array

## 38. State Management

```javascript
createRunContext(workspace, state, onUpdate, signal, allSprites, costumes)
createSpriteState()    // → { x, y, direction, size, visible, bubble, ... }
createRunSignal()      // → { stopped, keysPressed, mouseDown, mouseX, mouseY, answer, ask, ... }
```

State maintained in refs for performance; React state updated only for canvas re-render.

## 39. Scratch Check Evaluation

- `block_used`: static parse of workspace for opcode
- `sprite_property`: reads from sprite state ref at eval time
- `variable_equals`: reads from signal variables
- Evaluation: `manual` (button), `after_run` (after flag scripts complete), `continuous` (per frame tick)

## 40. Multi-Sprite Workspaces

- Each sprite has its own Blockly workspace
- `suppressChangeRef` prevents feedback loops during programmatic workspace load/reset
- Workspace disposed on unmount
- Blockly uses 'zelos' renderer, 24px grid, snap enabled

---

# Part 13 — Lesson Builder

## 41. Overview

Full-featured lesson authoring tool. Includes live code execution (Python via Pyodide, HTML via iframe, Scratch via workspace). Teacher tests tasks and verifies checks before downloading JSON.

## 42. Layout

```
┌─────────────────────────────────────────────────────────┐
│ Top Bar: Builder title | New | Upload | Download | Save  │
├──────────────┬──────────────────────────────────────────┤
│ Lesson Meta  │                                          │
│              │  Task Editor                             │
│ Task List    │                                          │
└──────────────┴──────────────────────────────────────────┘
```

## 43. Task Editor

Supports all task types: code (Python/HTML/Scratch), information, quiz (all 4 sub-types).

Task type switching (`taskType`, `quizType`) clears incompatible fields. Interaction mode switching (`run` / `submit`) filters checks to only compatible types.
Each task accepts optional estimated minutes; the task-list header shows their lesson-wide total.
Markdown entry fields provide searchable topic-library insertion and prompt authors to link recognised topic terms.
Complete-code tabs for Python and HTML can be reset from the current starter content.

Quiz builders:
- Multiple choice: options list with text inputs and correct-answer radio
- Match: pairs list with prompt + answer inputs
- Fill blank: text with `___` placeholders + blank answer inputs + mode toggle
- Short answer: check type/value fields

Scratch: starter/complete tabs with separate workspace state, a unified starter sprite panel (add, appearance, costumes, and initial stage metadata), backdrop manager, toolbox XML editor, and copying tested complete/stage sprite presentation state into starter defaults.

## 44. Execution & Check Verification

After Run, if task has a check:
- Check evaluated against actual output
- ✅ Green: "Check passes — students will see the completion banner"
- ⚠️ Amber: "Check does not pass — review your check value"
- `_checkTested` flag set; warning emitted on export if still untested

## 45. Validation & Export

Validation runs continuously. Errors block download. Warnings prompt confirmation.

Key **errors**: missing ID/title, invalid ID format, no tasks, task missing title, invalid estimated minutes, quiz < 2 options, no correct answer selected, empty check value, duplicate HTML filenames, invalid carry reference.
Key **warnings**: no starter code, untested check.

Export: `normalizeTasksForExport()` remaps task IDs sequentially (1, 2, 3…) regardless of internal IDs. Filename: `{lessonId}.json`. Pretty-printed JSON.

## 46. State Persistence

- Lesson auto-saved to `localStorage['headstart_builder_current']` on every change
- Restore prompt on page load if in-progress lesson found
- `beforeunload` warning if lesson has unsaved changes (dirty flag)

---

# Part 14 — Shared Modules Reference

## 47. Module Summary

| Module | Key exports |
|---|---|
| `src/shared/CodeEditor.jsx` | `CodeEditor({ value, language, readOnly, onChange, style })` — never remounts |
| `src/shared/SplitPane.jsx` | `SplitPane({ left, right, defaultSplit?, rightCollapsed?, ... })` |
| `src/shared/AssetBrowser.jsx` | `AssetBrowser({ assetsPath, assets, copyMode })` |
| `src/shared/TopicLibraryView.jsx` | Topic-link hover preview and searchable library dialog |
| `src/shared/topicLibrary.js` | Loads `public/assets/topic-library.json`; search, wiki-link expansion and author suggestions |
| `src/shared/checks.js` | `evaluateCheckResults(check, output, context)`, `evaluateSingleCheck(...)`, `CHECK_TYPES` |
| `src/shared/codemirror.js` | `createBaseExtensions(type, readOnly)`, `headstartTheme`, `headstartHighlight`, `getTabSize(type)` |
| `src/shared/firebase.js` | `db` — Firebase Realtime Database reference |
| `src/shared/iframe.js` | `buildIframeSrc(files, entryFile, options)`, `waitForIframeText(timeout)` |
| `src/shared/markdown.jsx` | `MarkdownRenderer({ content, title, style, topicType?, showLibrary? })`, `InlineMarkdown({ content })` |
| `src/shared/pyodide.js` | `initPyodide(onProgress?)`, `runPython(code, callbacks)`, `stopPython()`, `provideInput(value)`, `isPyodideReady()` |
| `src/shared/pyodide.worker.js` | Web Worker — Pyodide loader, async input() wrapper, stdout streamer |
| `src/shared/scratch.js` | `createRunContext()`, `createSpriteState()`, `createRunSignal()`, block definitions, check evaluation |
| `src/shared/taskUtils.js` | `flattenTasks(tasks)`, `getProgressItems(tasks)`, `updateSubtaskTitles(tasks)` |
| `src/shared/useIsMobile.js` | `useIsMobile(breakpoint=640) → boolean` |

---

# Part 15 — Brand & Theming

## 48. CSS Custom Properties

```css
:root {
  --colour-primary:         #6222CC;
  --colour-primary-dark:    #4e1aa3;
  --colour-secondary:       #FBA504;
  --colour-secondary-dark:  #e09400;
  --colour-text:            rgb(58, 59, 60);
  --colour-text-on-primary: #ffffff;
  --colour-text-on-secondary: #ffffff;

  --font-title: 'Montserrat', sans-serif;
  --font-body:  'Quicksand', sans-serif;
  --font-code:  'JetBrains Mono', monospace;

  --font-weight-title:       700;
  --font-weight-body:        400;
  --font-weight-body-medium: 600;
}
```

Google Fonts:
```css
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700&family=Quicksand:wght@400;600&family=JetBrains+Mono&display=swap');
```

## 49. Colour Usage

| Element | Colour |
|---|---|
| Section backgrounds, top bars | `--colour-primary` (#6222CC) |
| Primary buttons (Run, Download, Start) | `--colour-secondary` (#FBA504) |
| Status success | `#22c55e` |
| Status error | `#ef4444` |
| Status not run | `#9ca3af` |
| Read-only editor tint | `rgba(239, 68, 68, 0.08)` |
| Card backgrounds | White |

## 50. Typography Rules

- Montserrat Bold: page titles and section headings only
- Quicksand: all body text, labels, button text, UI copy
- JetBrains Mono: all code — editors and explainer code blocks
- Never use Inter, Roboto, Arial, or system fonts

---

*Specification v3.0 — reflects current codebase as of May 2026 doc audit.*
