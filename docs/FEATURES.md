# FEATURES.md — Platform Feature Reference

What the platform can do. For how to configure these features see **docs/authoring/AUTHORING_GUIDE.md** (YAML) or **docs/authoring/lesson-schema.md** (JSON reference).

---

## Lesson Types

| Type | What students do |
|---|---|
| Python | Write and run Python code; output shown in a console panel |
| HTML/CSS/JS | Write and run web pages across multiple tabbed files; output shown in an iframe preview |
| Scratch | Drag-and-drop block programming with a live stage canvas |
| Filesystem | Navigate, create, rename, move, and delete files and folders in a virtual file manager |

---

## Task Types

- **Code task** — students write code or blocks; automatic completion checks run on each attempt
- **Information task** — explainer text only; no editor or check
- **Quiz** — interactive question; no code editor
- **Group** — ordered container of subtasks

---

## Quiz Variants

- **Multiple choice** — grid of colour-coded option buttons with per-option feedback text
- **Match** — drag-and-drop pairs
- **Fill in the blank** — fill blanks by dragging tiles or typing
- **Short answer** — free-text response

---

## Completion Checks

Evaluated automatically on Run or Submit. Pass shows a green banner; fail shows a hint from the first failing check. A specific wrong-pattern hint can be shown if the student's answer matches a known incorrect pattern.

Checks can verify:

- **Python / HTML**: output content, code content
- **HTML only**: element existence, element count, element text/value, element attributes, computed CSS styles
- **Python only**: variable existence, type, and value (including lists and dicts)
- **Scratch**: block usage, sprite position/size/direction/visibility, variable values
- **Filesystem**: file and directory existence, which directory is currently open
- **Quiz**: correct answer match

After the same hint appears twice in a row, solo students can optionally view the complete reference code (if defined on the task).

---

## Session Features

- **Waiting room** — students wait until the teacher starts; auto-advance on start
- **Pause/resume** — freezes student navigation without ending the session
- **Sandbox mode** — freeform coding with no tasks or checks; teacher can push code/files to all students
- **Session end** — all students see an end screen

---

## Teacher Features

### Session Controls
- Create, start, pause/resume, sandbox, end, and restart sessions
- Share a live join link with students
- Lesson elapsed timer and per-task countdown that flashes when time expires

### Task Navigator
- Task list with group collapse
- Aggregate run count and check-passed count per task
- Advance the whole class to any task with one click
- Previous/Next navigation and Sandbox toggle

### Teacher Editor
- Starter and complete code toggle (view reference solution)
- Python: editor + output panel + run
- HTML: tabbed editor + iframe preview + run; push code/files to all students in sandbox
- Scratch: multi-sprite workspace + stage canvas

### Student Grid
- Cards per student: name, online status, run status, check status, code/output/quiz preview
- Click to expand to full student workspace view

### Student Actions (per student)
- Go Live / Stop Live — one-to-one keystroke streaming with selection highlight and activity indicators
- Remote Reset — silently replace student's code with starter code, complete code, or a named intermediate stage
- Rename and remove students

### Teacher Broadcast
- Broadcast teacher's or a pinned student's screen to all students simultaneously
- Available via a separate presentation window

---

## Student Features

### Session Entry
- Enter a lesson ID on the landing page
- Choose to wait for teacher or work solo when no live session is active
- Prompted to join a live session that starts while working solo
- Name entry with automatic duplicate-suffix handling

### Lesson UI
- Lesson title, level badge, and mode indicator (solo / live / sandbox)
- Task progress dots — clickable for past tasks, locked for future tasks, current highlighted
- Collapsible explainer panel with Markdown formatting, inline topic definitions, and Scratch block visualisation
- Retro typing animation on Python output

### Task Navigation
- **Live mode**: teacher controls the current task; students cannot advance past it
- **Solo mode**: free navigation; one task ahead unlocks after the check passes; previous tasks are viewable in read-only

### Personal Sandbox
- Available after a check passes (live mode) or via the nav bar (solo mode)
- Returns to the lesson when the student closes it or the teacher advances the class

### input() Support (Python)
- Execution pauses; an inline input field appears in the output panel
- Multiple sequential input calls handled in sequence

---

## Lesson Builder Features

### Lesson Configuration
- ID, lesson type, title, description, and level
- Asset list for the in-lesson asset browser
- Sandbox starter: code, HTML files, Scratch state, toolbox, sprites, and backdrops

### Task Management
- All task types: code (all lesson types), information, and quiz (all variants)
- Task groups with drag-reorder and auto-titled subtasks
- Duplicate and delete tasks

### Task Editor
- Markdown explainer with live preview
- Topic-library link picker with auto-suggestions for recognised topics
- Optional estimated minutes per task; lesson total shown in the task list
- Starter and complete code/files/filesystem per lesson type
- Carry-through: bring code or filesystem state from a previous task as the starter
- Filesystem: visual editor for starter and complete states, and a filesystem check builder
- Checks: type-filtered list with run/submit mode; tested/untested flag per check

### Scratch Tools
- Starter/complete workspace tabs with isolated state
- Sprite panel: add/remove, costumes, and initial stage properties
- Backdrop manager
- Toolbox editor with block category toggles

### Execution and Testing
- Run code and verify checks pass before publishing
- Check result shown per run (pass / fail)

### Export, Import, and Validation
- Download lesson as JSON
- Upload and restore from JSON
- Auto-save to localStorage; restore prompt on next load
- Validation: errors block download; warnings require confirmation

### Preview
- Renders the full student view with the current lesson so teachers can test the student experience

---

## Admin Portal Features

- **Account management**: create teacher/admin accounts, set roles, disable/enable, delete
- **Lesson management**: browse all lessons by type and level; launch as teacher or copy student link
- **Topic library**: create, edit, and delete topics with full Markdown description and syntax fields

---

## Feedback

### Submitting feedback (teacher in-session)

Teachers can open the Feedback modal at any point during a session. It has three tabs:

- **Lesson Feedback** — general feedback about the lesson as a whole; stored in `lessons/{lessonId}/feedback` and visible in the builder's task panel
- **Task Feedback** — feedback specific to the current task (tab only shown when a task is active); stored in the same subcollection with the task ID attached
- **Platform Feedback** — bug reports and feature suggestions about the platform itself; stored in the `platformFeedback` top-level collection, visible only to admins

Each submission captures the teacher's email, the lesson and task context, the feedback text, and a timestamp.

### Viewing and deleting feedback (admin)

The Admin Portal's **Feedback** tab shows three sub-tabs:

- **Platform** — all entries from `platformFeedback`, sorted newest-first; each card shows email, date, lesson/task context, and text; admins can delete individual items
- **Lesson** — lesson-level entries from across all lesson subcollections (no task ID)
- **Task** — task-scoped entries from across all lesson subcollections (has task ID)

Lesson/task cards link to the lesson in the builder.

### Viewing feedback in the builder

The builder's **Task Feedback Panel** shows submitted lesson and task feedback for the currently selected task, so authors can review comments without leaving the builder.

### CLI management

The CLI can list, create, delete, and bulk-clear feedback items in both collections. See `docs/skills/hsc-feedback.md` for full command reference.

---

## CLI Features

- Manage live lessons, tasks, topics, assets, and feedback through `node cli/cli.mjs`
- Convert lesson and topic-library YAML to JSON for validation and publishing
- Fetch lessons, topics, tasks, assets, and feedback as JSON or YAML with `--format yaml`
- Read, create, delete, and bulk-clear platform and per-lesson feedback from Firestore via the CLI
