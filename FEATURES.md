# FEATURES.md — Implemented Features

All features listed here are implemented in the current codebase. Replaces `Quiz Task.md` (superseded).

---

## Lesson Types

| Type | Editor | Execution |
|---|---|---|
| Python | Single CodeMirror editor | Pyodide in Web Worker |
| HTML/CSS/JS | Tabbed file editor | Sandboxed iframe with Blob URL virtual filesystem |
| Scratch | Multi-sprite Blockly workspaces + stage canvas | Custom block interpreter (scratch.js) |

---

## Task Types

| Type | `taskType` field | Description |
|---|---|---|
| Code | omit | Type-specific editor (Python / HTML / Scratch) |
| Information | `"information"` | Explainer only — no editor, no check |
| Quiz | `"quiz"` | Interactive question — no editor |
| Group | `type: "group"` | Container with ordered subtasks; subtask titles auto-derived |

---

## Quiz Sub-Types

| `quizType` | UI | Check |
|---|---|---|
| `multiple_choice` | Grid of colour-coded option buttons; option-level feedback text | `answer_equals` |
| `match` | Drag-and-drop pairs with shuffled tiles | `quiz_result` (all pairs correct) |
| `fill_blank` | Text with blanks — drag tiles in (`mode: "drag"`) or type (`mode: "type"`) | `quiz_result` (all blanks correct) |
| `short_answer` | Free-text input | `answer_equals`, `answer_contains`, `answer_matches_regex` |

---

## Check Types

### Python and HTML

| Type | Applies to | Mode | Description |
|---|---|---|---|
| `code_no_error` | Python | Run | Run completed without exception |
| `output_contains` | Python, HTML | Run | Output includes value (case-insensitive) |
| `output_equals` | Python, HTML | Run | Output exactly matches value (case-insensitive, trimmed) |
| `output_not_contains` | Python, HTML | Run | Output does not include value |
| `output_not_equals` | Python, HTML | Run | Output does not equal value |
| `output_matches_regex` | Python, HTML | Run | Output matches regex pattern (case-sensitive) |
| `output_line_count` | Python, HTML | Run | Output line count equals value |
| `output_not_empty` | Python, HTML | Run | Output is not empty |
| `output_empty` | Python, HTML | Run | Output is empty or whitespace-only |
| `code_contains` | Python, HTML | Run + Submit | Source includes value |
| `code_does_not_contain` | Python, HTML | Run + Submit | Source does not include value |
| `code_equals` | Python, HTML | Run + Submit | Source equals value |
| `code_not_equals` | Python, HTML | Run + Submit | Source does not equal value |
| `code_matches_regex` | Python, HTML | Run + Submit | Source matches regex pattern (case-sensitive) |
| `element_exists` | HTML | Run | CSS selector matches at least one element |
| `element_count` | HTML | Run | Selector match count equals value |
| `element_value` | HTML | Run | Element text/value contains value (case-insensitive) |
| `element_value_equals` | HTML | Run | Element text/value equals value |
| `element_value_not_contains` | HTML | Run | Element text/value does not contain value |
| `element_value_not_equals` | HTML | Run | Element text/value does not equal value |
| `element_value_matches_regex` | HTML | Run | Element text/value matches regex (case-sensitive) |
| `element_attribute` | HTML | Run | Element attribute equals value (or exists when value omitted) |
| `element_style_property` | HTML | Run | Element computed CSS property equals value (or exists when value omitted) |

### Variable (Python only, Run mode)

| Type | Description |
|---|---|
| `variable_exists` | Named variable exists in Python scope |
| `variable_type` | Variable type matches (`string`, `number`, `boolean`, `array`, `dictionary`) |
| `variable_equals` | Variable value equals expected |
| `variable_dict_contains` | Dictionary variable contains a value |
| `variable_dict_equals` | Dictionary variable equals expected dict |
| `variable_dict_key_value` | Dictionary variable key equals expected value |
| `variable_array_contains` | List variable contains a value |
| `variable_array_equals` | List variable equals expected list |
| `variable_array_nth_item` | List variable N-th item (0-indexed) equals expected value |

### Scratch

| Type | Timing | Description |
|---|---|---|
| `block_used` | manual, after_run | Opcode present in any sprite workspace |
| `sprite_property` | manual, after_run, continuous | Sprite x/y/size/direction/visible satisfies operator + value |
| `variable_equals` | manual, after_run | Named variable equals expected value |

### Quiz

| Type | Description |
|---|---|
| `answer_equals` | Selected answer ID matches value |
| `answer_contains` | Free-text answer contains value |
| `answer_not_contains` | Free-text answer does not contain value |
| `answer_matches_regex` | Free-text answer matches regex pattern |
| `quiz_result` | All pairs/blanks answered correctly |

---

## Session Features

- Waiting room with auto-advance when teacher starts session
- Session pause/resume (`isPaused` — freezes student navigation without ending session)
- Session restart (clears all student nodes and resets to `waiting`)
- Session end → all students see end screen

---

## Teacher Features

### Session Management
- Create, start, pause/resume, end, restart session
- Share link button (copies `?live=true` URL)
- Lesson elapsed timer with planned total and per-task countdown that flashes when time expires

### Task Navigator
- Task list with group collapse
- Aggregate stats per task: run count, check passed count
- Click to advance whole class to any task
- Previous / Next navigation buttons
- Sandbox / Return to Lesson button
- Pause / Resume button

### Teacher Editor
- Starter / Complete code toggle (view reference solution)
- Python: CodeEditor + output panel + Run
- HTML: tabbed file editor + iframe preview + Run; Push to All in sandbox
- Scratch: multi-sprite workspace + stage canvas

### Student Grid
- Dynamic — no hard cap (soft max ~12)
- Per-card: name, online badge, run-status dot, check-passed badge, code/output/quiz preview
- Expand button → StudentModal

### StudentModal
- Full workspace view: code/output/iframe/quiz/Scratch stage
- Go Live / Stop Live (one-to-one keystroke streaming)
- Live code selection/cursor highlight plus copy, paste, and click activity notices
- Remote Reset to Starter (loads `starterCode`/`starterFiles`/`starterBlocks`)
- Remote Reset to Complete (loads `completeCode`/`completeFiles`/`completeBlocks`)
- Rename student
- Remove student

### Teacher Live Broadcast (teacherLive)
- Broadcasts teacher's (or a pinned student's) screen to **all** students simultaneously
- Activated via `?teacher=true&present=true` presentation window
- Broadcast code view includes live selection/cursor highlighting and activity notices
- Cleared on teacher disconnect via `onDisconnect`

### Sandbox Mode
- Freeform coding state — no task, no explainer, no checks
- Push to All (Python: pushes code string; HTML: pushes file set; Scratch: pushes block state)
- Students save current task code before entering; it is restored on exit
- Student editors accept student typing and running during sandbox

---

## Student Features

### Session Entry
- Landing page: enter lesson ID to navigate
- Choice screen: Wait for Teacher or Work Solo (when no active session)
- JoinSessionPrompt: modal to join a session that started while working solo
- Name entry with duplicate-suffix handling (`Jamie` → `Jamie-2`)
- Automatic session detection via timestamp comparison (returns to same session seamlessly)

### Lesson UI
- Top bar: lesson title, level badge, SOLO/LIVE/SANDBOX badge, student name, progress dots
- Task progress dots: clickable (past tasks), locked (future), current highlighted
- Collapsible explainer panel (Markdown with Scratch block visualization)
- Searchable topic library in explainers, with hover definitions and linked related topics
- Retro typing animation on Python output

### Task Navigation
- Live session: teacher-controlled; cannot advance past current task
- Solo mode: free navigation; one task ahead unlocked when check passes
- Previous tasks: viewable in read-only (red tint); re-runnable in solo mode

### Completion Checks
- Evaluated automatically on Run or Submit
- Pass: green banner + Firebase `checkPassed` updated
- Fail: feedback banner shows the hint from the first failed check that carries a `hint` field; if the completion check fails and any `incorrectChecks` entry passes (detecting a specific wrong pattern), its hint is shown instead
- "See complete code" unlocked in solo mode after the same hint appears 2+ times in a row, when `completeCode`/`completeFiles`/`completeBlocks` is defined on the task

### Code Editing
- Python: CodeMirror with Pyodide status (loading → ready → error)
- HTML: tabbed editor with optional asset browser drawer (AssetBrowser)
- Scratch: multi-sprite Blockly workspace with stage canvas
- Quiz: polymorphic QuizTask component

### Sync (when watched by teacher)
- Python: code synced per keystroke, output streamed line by line during run
- HTML: active-tab files synced per keystroke
- Python/HTML: selection, cursor position, copy/paste, and click activity synced during live viewing
- Quiz: answer synced on submit
- Completely silent — no student-facing indicator

### Remote Reset
- Silently applied when teacher pushes reset; student sees code replace with no prompt

### Teacher Live Broadcast (receiving)
- `isForcedTeacherLive = true`: student's editor replaced with broadcast view
- Student cannot interact while receiving broadcast

### input() (Python)
- Execution pauses; inline input field appears in output panel
- Multiple sequential calls handled in sequence

---

## Lesson Builder Features

### Lesson Configuration
- ID, type (python/html/scratch), title, description, level
- Asset path and asset list (for AssetBrowser)
- Sandbox starter: Python code, HTML files, Scratch state, toolbox, sprites, backdrops
- Scratch sprite preset picker backed by reusable `public/scratch-assets/sprites.json` definitions

### Task Management
- All task types: code (all 3 lesson types), information, quiz (all 4 sub-types)
- Task groups with drag-reorder and auto-titled subtasks
- Duplicate task
- Delete task with confirmation

### Task Editor
- Explainer editor with Edit / Preview tabs (live Markdown rendering)
- Topic-library link picker and recognised-topic link suggestions in Markdown fields
- Optional estimated minutes per task with summed lesson duration in the task list
- Starter code / starter files (per lesson type)
- Complete code / complete files (reference solution)
- Carry-through configuration (`carryCodeFrom`, `carryBlocksFrom`)
- Interaction mode: run or submit
- Check editor with all supported check types filtered by lesson type and interaction mode
- `_checkTested` flag tracks whether check has been verified

### Scratch Tools
- Starter / Complete workspace tabs with isolated state
- Unified starter sprite panel (add/remove, appearance, costumes, and initial stage metadata)
- Backdrop manager (colour or image)
- Toolbox XML editor (block category toggles)

### Execution & Testing
- Python: Pyodide execution with `input()` support and check verification
- HTML: iframe execution with check verification (element and output checks)
- Scratch: workspace execution with manual check evaluation
- After run: check result shown (✅ pass / ⚠️ fail)

### Export & Import
- Download JSON: filename `{lessonId}.json`, task IDs normalized sequentially
- Upload JSON: validates structure, populates all fields
- Auto-save to localStorage on every change
- Restore prompt on page load if in-progress lesson found
- `beforeunload` warning on unsaved changes

### Validation
- Errors (block download): missing ID/title, invalid ID format, no tasks, invalid estimated minutes, empty check value, quiz < 2 options, no correct answer, duplicate HTML filenames, invalid carry reference
- Warnings (confirm download): no starter code, untested check

### Preview
- PreviewView renders full StudentView with current lesson for teacher to test student experience

---

## Shared Infrastructure

- CodeMirror shared config: language switching and read-only toggle via compartments (no remount)
- Pyodide Web Worker: terminate-on-stop, pre-warm after each run
- Blob URL virtual filesystem: cross-reference rewriting, CSP injection, console interceptor
- Markdown renderer: tables, callouts (warning/error/success/info), code blocks, Scratch block display
- Shared topic-library JSON loader, type-filtered search, hover cards and library dialog
- Task group utilities: flatten, progress tracking, auto-title subtasks
- Responsive layout via `useIsMobile` hook (640px breakpoint)
- SplitPane: draggable [15%, 85%] clamped, collapsible right pane
