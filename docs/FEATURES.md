# FEATURES.md — Platform Feature Reference

What the platform can do. For how to configure these features see **docs/authoring/AUTHORING_GUIDE.md** (YAML) or **docs/authoring/lesson-schema.md** (JSON reference).

---

## Lesson Types

New lessons are composed lessons: each code task selects one of the workspace types below, and the active workspace set is derived from the tasks used. Existing single-type lessons remain supported.

| Type | What students do |
|---|---|
| Python | Write and run Python code; output shown in a console panel |
| Arcade Kit | Build a small pixel-style Python game with a sandboxed canvas, keyboard input, named/uploaded or pixel-editor assets, tilemaps, and Run/Stop controls |
| Turtle | Write Python turtle-graphics commands that draw onto a responsive canvas; checks run on the finished drawing |
| HTML/CSS/JS | Write and run web pages across multiple tabbed files; output shown in an iframe preview |
| Scratch | Drag-and-drop block programming with a live stage canvas; costume and sprite dropdowns (switch costume, go to, glide, touching, distance to, create clone of) show a thumbnail preview of each option, and sprite dropdowns keep the selected sprite's thumbnail beside its name on the block |
| Filesystem | Navigate, create, rename, move, and delete files and folders in a virtual file manager |
| Desktop | A windowed desktop shell (icons, taskbar, draggable/resizable windows) hosting File Manager (with a Recycle Bin, search, and sort), Text Editor, Image Viewer, Paint, and a simulated Browser with a search engine |
| Electronics | Build and test breadboard-style circuits with guided checks |

---

## Task Types

- **Code task** — students write code or blocks; automatic completion checks run on each attempt. **Arcade Kit** evaluates its code checks each time the student presses Run game (game-state checks aren't supported yet — see `docs/authoring/arcade.md`'s Runtime Notes). **Python Turtle** tasks can combine code checks with drawing checks, and show a 🐢 marker at the turtle's position and heading.
- **Information task** — explainer text only; no editor or check
- **Badge Summary task** (`informationType: badges`, "Today's Coding Moments") — in a live session each student sees their own badges as a sticker sheet tumbling in one by one, then the class wall grouped by badge dropping into place (the teacher's and presentation wall's emoji tumble in, then the rows drop; first view only, later awards just drop in) ("🐛 Bug Hunter: Alex, Sam"; names only, no counts), with a warm line instead of an empty state for a student with none; the teacher sees a projector-friendly wall with **📋 Copy class summary** (plain text grouped by badge); skipped in solo
- **Quiz** — interactive question; no code editor
- **Group** — ordered container of subtasks

---

## Quiz Variants

- **Multiple choice** — grid of colour-coded option buttons with per-option feedback text
- **Match** — drag-and-drop pairs
- **Fill in the blank** — fill blanks by dragging tiles or typing
- **Short answer** — free-text response
- **Confidence** — 1–5 self-rating, no right/wrong answer

---

## Completion Checks

Evaluated automatically on Run or Submit. Pass or fail shows a small floating popup (top-center, auto-dismisses after 45s or via its own close button — doesn't push the workspace around); fail shows a hint from the first failing check. A specific wrong-pattern hint can be shown if the student's answer matches a known incorrect pattern. The popup is hidden while a student is watching a teacher/peer broadcast ("Go Live to Students") — that's not their own check result.

Checks can verify:

- **Python / HTML**: output content, code content
- **HTML only**: element existence, element count, element text/value, element attributes, computed CSS styles
- **Python only**: variable existence, type, and value (including lists and dicts)
- **Scratch**: block usage, sprite position/size/direction/visibility, variable values
- **Filesystem**: file and directory existence, which directory is currently open
- **Desktop**: filesystem checks (as above) plus Recycle Bin membership, window open/closed/minimized/maximized state, a window moved into a screen zone or resized, two windows arranged side by side, simulated-browser page visits, and search-engine query matching
- **Quiz**: correct answer match

After the same hint appears twice in a row, solo students can optionally view the complete reference code (if defined on the task).

---

## Session Features

- **Waiting room** — students wait until the teacher starts; auto-advance on start
- **Video call** — the teacher sets a call link for the session (shown in the waiting room); "Send to all" pops a join prompt for every student, including those in the waiting room or still entering their name, and "Send Video Call Link" in a student's More menu pops it for one student (waiting room or any task)
- **Pause/resume** — freezes student navigation without ending the session
- **Sandbox mode** — freeform coding with no tasks or checks; teacher can push code/files to all students. Each visit (when, after which task, the teacher's pushes and each student's last sandbox code) is archived teacher-side for the session report
- **Live badge signals** (the tutor's suggestions panel and picker are in the Student Grid section; the student celebration is under Student Features, "Coding moments") — first-occurrence topic opens, keyboard shortcuts, time to first edit, complete-code views, and sandbox run/error/fix counts are recorded per student during a live session (never in solo, previews or the presentation window, and never any code); see `docs/architecture/live-badges-plan.md`
- **Need Help** — a persistent "✋ Help" button in the top bar during any live lesson, always available (not tied to a failed check); marks the student's card for the teacher until dismissed
- **Session end** — all students see an end screen, with their own coding moments (live badges) as a sticker sheet; a student who reloads within 3 hours of the end gets the end screen back

---

## Teacher Features

### Session Controls
- Create, start, pause/resume, sandbox, end, and restart sessions
- Share a live join link with students
- Lesson elapsed timer and per-task countdown that flashes when time expires
- Ending a session ends it immediately for students; the report shown afterwards offers an optional 1-5 star rating plus "what worked well" / "what didn't work, or was broken" notes, saved onto that session's report
- The session report shows how many references (support stages) were opened per task — count, students, and teacher vs student — and which ones each student opened
- Live badges in the session report: a **Coding moments** section (the class wall grouped by badge, **Copy class summary** with student labels, and suggested / awarded / auto / manual / dismissed / revoked counts per badge); new task columns (time to first edit median and range, students with a console error, Topic Library opens student vs tutor-sent, and the first real pass with how long after the task opened); per student their moments, topics opened, shortcuts, personal- and teacher-sandbox activity, and per task their first edit, error runs, different failed tries and "first real pass in class"; quiz-group first-try scores with the class median; and each teacher-sandbox visit as a "possible lesson gap" callout ("The class spent 14 min in the teacher sandbox after …") that expands to the tutor's explainer and pushes and each student's last sandbox code. All of it is in the YAML export. A report near Firestore's 1 MiB limit drops the students' sandbox code first and says so
- Rate any task live, while teaching it: a "⭐ Rate this task" button in the teacher's top bar (showing "⭐ N" once rated) opens a popover that lets the teacher give the current task a 1-5 star rating plus "what worked well" / "what didn't work" notes as the class works through it, rather than waiting until the session ends. Each task's rating is folded into that task's row in the session report

### Task Navigator
- Task list with group collapse
- Aggregate run count and check-passed count per task
- Advance the whole class to any task with one click
- Previous/Next navigation and Sandbox toggle

### Student Progress Counts
- Match and Fill in the Gaps tasks show a teacher-only "🧩 3/5 filled · 2 correct" badge on each student card and in the student modal header, updating live as the student works
- Code Arrange tasks show "🧩 4/6 slots filled" (arrangements are marked by running the code, so there is no per-slot correct count)
- Students never see these counts
- "✏️ Edit answers" in the student modal lets the teacher drag, type, or move that student's Match / Fill in the Gaps / Code Arrange items directly; changes appear on the student's screen live with a short "Your teacher updated your answer" note
- "▶ Run on student" in the student modal runs that student's current code on their own device (Python, Turtle, Arcade, HTML, Scratch green flag, Electronics), exactly as if they had pressed Run; the output mirrors back to the teacher
- A pass reached after a teacher edit looks like a normal pass to the student, but is marked "Teacher assisted" on the student card, in the modal, and in the session report

### Teacher Editor
- Starter and complete code toggle (view reference solution)
- Python: editor + output panel + run
- HTML: tabbed editor + iframe preview + run; push code/files to all students in sandbox
- Scratch: multi-sprite workspace + stage canvas

### Student Grid
- Cards per student: name, online status, run status, check status, code/output/quiz preview. While the session is waiting, the card's badge says "Waiting" and its dot still shows whether that student is online, away or offline
- **Joining list**: students still on the name screen are listed above the cards as they type ("Jamie (typing…)", or "Someone (typing…)" before they type), with a **Pull in** button that opens a small editor prefilled with the typed name. Confirming joins that student with the (editable) name on their own device, exactly as if they had pressed Join (a taken name still gets a "-2" suffix), into the waiting room or the lesson. **Hide names** masks the typed names, e.g. while the screen is projected
- Click to expand to full student workspace view — on every task, information tasks included (the modal shows the task as the student sees it: the explainer, the introduction's lesson title, the recap, or the Badge Summary wall, with the badge, nudge, message and video-call controls still available)
- One-line grid header: "Students (n)", ⛶ Fullscreen All, a ⋯ menu (🔔 Nudge Away (n), 🏅 Suggestions (n), ☑ Select, 📖 Reference) and the › collapse. A small dot on ⋯ means someone is Away or a badge suggestion is waiting
- "Away" badge when a connected student's window isn't focused, with a 🔔 button to nudge them; "🔔 Nudge Away (n)" in the grid header's ⋯ menu nudges every Away student at once. A nudge shows the student a banner and plays a chime, and while their window is unfocused flashes the tab title/favicon and (if they allowed it) shows an OS notification
- Live badges (tutor side): "🏅 Suggestions (n)" in the grid header's ⋯ menu opens the **Badge suggestions** panel above the teacher editor, grouped by student, with one-click Award / Dismiss, an "Announce" tick (on by default), "Award all" when several students earned the same badge, and the session's **Auto-award high-confidence badges** and **Sounds off** toggles. Each card shows a teacher-only "🏅 n" count with a dot while a suggestion is waiting (never shown to students or the presentation window). "☑ Select" (⋯ menu) picks several cards to award one badge to all of them at once

### Student Actions (per student)
- Go Live / Stop Live — one-to-one keystroke streaming with selection highlight and activity indicators
- Remote Reset — silently replace student's code with starter code, complete code, or a named intermediate stage
- Rename and remove students
- One-line modal header: the student's name then small status chips ("Ryan · AWAY · LIVE · 🏅 2"), ← → to switch student, **Support ▾** (Reveal and Set stage sections), ▶ Run on student, **More ▾** and ✕
- Nudge (More menu) — draw the student's attention back to the lesson
- 👍 thumbs up (StudentCard and StudentModal header, online students) — the student sees a brief "👍 You're on the right track!" toast with a gentle chime (respecting their mute and the tutor's Sounds off) that disappears after about 2.5s. Private to that student: not a badge, not shown to the class, not in session reports. Reloads don't replay it; the button confirms ✓ and is disabled for 2s to avoid spamming
- Go Live for All and Focus (highlight or switch a tab on the student's screen) are in the More menu; Stop Live stays in the header while broadcasting
- 🏅 Award badge (More menu) — a picker with a purple header and a light body, grouped into **Suggested by rules**, **Tutor-awarded** and **Admin badges** (full names, badges already held greyed). Click a badge to select it and see what it's for, then press **Award**; "Announce to class" is on by default. Revoke an awarded one silently; the header shows the student's teacher-only badge count
- "Show on every task" reference (in the Support menu's Reveal section): first hint, all hints, or the solution opens automatically for that student on every task for the rest of the session
- "📋 Pasted" badge when a student pastes a large chunk (40+ characters or 3+ lines) into their editor — flagged, not blocked; also counted in the session report
- The output panel in the student modal opens automatically when the student's run produces output or asks for input
- Approve or decline a student's request to share their workspace with the class, after previewing the exact snapshot
- Share a student's workspace with the class without them asking ("Share this with the class")

### Workspace Sharing
- On tasks authored with `allowSharing`, students can offer their work to the whole class
- Every share is teacher-approved before anyone else sees it; declining is silent
- Approved shares collect in a "Shared work" gallery, tagged by task, and persist until the teacher removes them
- Classmates open a share as a non-destructive copy they can edit and run; their own work is untouched, with an explicit "Copy to my editor" if they want it
- Supported on all lesson types except quiz and information tasks

### Teacher Broadcast
- Broadcast teacher's or a pinned student's screen to all students simultaneously
- Available via a separate presentation window

### Edit Lesson
- "Edit Lesson" button opens the builder's task list/editor (add, duplicate, delete, reorder, group) in a modal without leaving the session
- Teachers: "Apply for This Session" broadcasts the edited tasks live to connected students for the current session only — never written to Firestore, and cleared on session end/restart
- Admins: same session-only option, plus "Save Permanently" which also publishes the change to the lesson's Firestore document
- "Reset to Original" discards any session edits and reverts to the published lesson

---

## Student Features

### Session Entry
- Enter a lesson ID on the landing page
- Choose to wait for teacher or work solo when no live session is active
- Prompted to join a live session that starts while working solo
- Name entry with automatic duplicate-suffix handling

### Lesson UI
- One-row top bar that never wraps or changes height: title and LIVE, the 🎖️ moments button, ✋ Help, 📤 Share, the task dots (they shrink, then scroll sideways, with 12+ tasks) and the student's name as a small chip
- Lesson title, level badge, and mode indicator (solo / live / sandbox)
- Task progress dots — clickable for past tasks, locked for future tasks, current highlighted
- Collapsible explainer panel with Markdown formatting, inline topic definitions (not on Scratch lessons — the topic library is disabled there), and Scratch block visualisation
- Explainer text is not selectable/copyable for students (teacher and builder previews are unaffected)
- First-view entrances: when a task first appears the explainer drops in, its bullets (and an information task's) slide in one after another, and quiz answers rise in one by one. They play once per task on each screen (student, presentation window, teacher view, Builder preview), never on a revisit, a ▲/▼ toggle or a Builder edit, and become a short fade under reduced motion
- Retro typing animation on Python output
- Line hints: authors attach short instructions to lines of Python, Turtle and HTML starter code (`#> …` / `<!--> … -->` marker lines). The editor shows a 💡 in the gutter (hover for the text) and the hint in faded text after the line; hints are never part of the student's code (not saved, run, checked, carried or mirrored), follow their line through edits, disappear when the line is deleted, and re-attach to matching lines when saved code is reloaded. Read-only stage references show them too, and so does the teacher's student window (Python and Turtle code, HTML files — computed from the lesson, display only), with a header chip counting the hints still on the student's code; a hint on a line the student changed is gone for the teacher too

### Task Navigation
- **Live mode**: teacher controls the current task; students cannot advance past it
- **Solo mode**: free navigation; one task ahead unlocks after the check passes; previous tasks are viewable in read-only

### Coding moments (live badges)
- When the tutor awards a student a badge, a small card drops down top-centre, just under the top bar (emoji, title and blurb, with a flip and one shine sweep), for about 2.5 s, then docks into the compact **🎖️** moments button in the top bar (no count). Its popover lists their own badges and holds the speaker toggle. A subtle two-note chime plays; the speaker toggle is the same device-wide Sounds mute as the top-bar 🔊 button, and the tutor's **Sounds off** silences it for the class
- A short, gentle rising chime plays the first time a task's checks pass while the student is watching (solo and live). Arriving on a task that was already passed, a reload, a later fail → pass on the same task, and a pass from "Show complete" stay silent; it never plays on the teacher view, the presentation window or the Builder preview
- **🔊 / 🔇 Sounds** button in the student top bar (solo and live; not in the presentation window or previews): one mute for the badge and complete chimes, remembered on that device (`headstart_sounds_muted`). Disabled with "Your teacher has turned sounds off" while the tutor's **Sounds off** is on. The teacher nudge chime isn't affected
- The card never takes focus or blocks the page around it, so typing carries on underneath; it is announced politely to screen readers, and `prefers-reduced-motion` gets a plain fade. Several awards at once queue one after another
- Every classmate (and the presentation window, scaled up) sees a silent toast slide in at the bottom-left with a soft glow, "🎖️ Alex earned a badge: 🐛 Bug Hunter", for about 4 s, with the blurb on hover; a bulk award shows one toast, "🎖️ 12 students earned a badge: ⌨️ Keyboard Wizard". Not shown when the tutor unticked Announce, never shown to the recipient, and toasts beyond a short queue are dropped
- A revoked badge disappears from the moments popover silently. Awards already made when the page loads are never replayed (they're just in the popover)
- A **Badge Summary** task (see Task Types) shows the student's own moments and the class wall at the end of the lesson
- No totals, ranks or comparisons are shown to students anywhere

### Personal Sandbox
- Available after a check passes (live mode) or via the nav bar (solo mode)
- Returns to the lesson when the student closes it or the teacher advances the class

### input() Support (Python)
- Execution pauses; an inline input field appears in the output panel
- Multiple sequential input calls handled in sequence

### Python Code Backups
- Python work remains automatically saved only in the current browser/device while a learner works anonymously
- Download the current Python task at any time as a `.launchpad` file
- At the end of a live session, learners who edited Python tasks are reminded to download all of their saved code tasks in one `.launchpad` file
- Download current Python code from personal or teacher-managed lesson sandboxes
- Open a `.launchpad` file or choose a sandbox type from the landing page (Python currently); both use the same focused Python editor with Run and Download controls

---

## Lesson Builder Features

### Lesson Configuration
- ID, title, description, stage, a reusable referenced level, and ordered tasks with per-task workspace selection (new lessons)
- Forked lessons show their stock lesson and class lineage in Lesson Details
- Asset list for the in-lesson asset browser
- Independent sandbox state per workspace type used in the lesson

### Task Management
- All task types: code (all lesson types), information, and quiz (all variants)
- Task groups with drag-reorder and independent subtask titles
- Duplicate and delete tasks

### Task Editor
- Markdown explainer with live preview
- Topic-library link picker with auto-suggestions for recognised topics
- Optional estimated minutes per task; lesson total shown in the task list
- Starter and complete code/files/filesystem per lesson type
- Carry-through: bring code or filesystem state from a previous task as the starter
- Filesystem: visual editor for starter and complete states, and a filesystem check builder
- Checks: type-filtered list with run/submit mode; tested/untested flag per check
- Badge hints (authoring metadata): toggle which live badges this task may also suggest (`badgeHints.suggest`, pattern badges only) or never suggest (`badgeHints.suppress`), with a read-only note of the badges the task's `taskActivity` pattern already triggers

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
- Admins can save the current lesson to Firestore without leaving the builder
- Validation: errors block download and warnings require confirmation, but neither blocks saving to Firestore

### Preview
- Renders the full student view with the current lesson so teachers can test the student experience

---

## Admin Portal Features

- **Account management**: create teacher/admin accounts, set roles, change other users' passwords, disable/enable, delete. Signed-in users can change their own password from Account settings.
- **Lesson management**: browse all published lessons in one library (not grouped by type); group stock lessons with class forks; expand each lesson to view report and feedback counts, session reports, and lesson/task feedback with resolve actions; launch as teacher, preview as a student (ephemeral — nothing is saved), copy student links, or create/overwrite a class fork
- **Level management**: its own Admin tab (`Levels`) for creating and editing the reusable levels lessons can reference
- **Class management**: create and archive admin-only class records used for reusable lesson forks
- **Session management**: see every live or waiting session left open across the platform (lesson, state, paused flag, student/online counts, how long it's been open) and close any of them remotely, for cases where a teacher left a session running without ending it
- **Topic library**: create, edit, and delete topics with full Markdown description and syntax fields; type filters come from the lesson module registry
- **Shared assets**: manage lesson-type-wide Firebase Storage files and Scratch default sprites, shared across every lesson of a given type
- **Badges**: see every built-in live badge with its exact rule (rule-backed or tutor-only, auto-awardable), and add, edit, archive or restore manual-only badges that reach tutors' award pickers with no deploy; ids and emoji are checked for clashes on save, and archived badges still show wherever they were awarded
- **Version footer**: the bottom of every Admin tab shows `LaunchPad vMAJOR.MINOR.BUILD · commit · built date` (BUILD rises on every merge to `main`), with a Copy button for bug reports; clicking the version opens "What's new" milestone release notes

---

## Feedback

### Submitting feedback (teacher in-session)

Teachers can open the Feedback modal at any point during a session. It has three tabs:

- **Lesson Feedback** — general feedback about the lesson as a whole; stored in `lessons/{lessonId}/feedback` and visible in the builder's task panel
- **Task Feedback** — feedback specific to the current task (tab only shown when a task is active); stored in the same subcollection with the task ID attached
- **Platform Feedback** — bug reports and feature suggestions about the platform itself; stored in the `platformFeedback` top-level collection, visible only to admins

Each submission captures the teacher's email, the lesson and task context, the feedback text, and a timestamp.

### Viewing and deleting feedback (admin)

The Admin Portal's **Feedback** tab still shows three sub-tabs. Lesson and task feedback also appears under each lesson in the **Lessons** tab, with open/total counts and the same resolve/archive action:

- **Platform** — all entries from `platformFeedback`, sorted newest-first; each card shows email, date, lesson/task context, and text; admins can archive individual items (archived feedback is hidden, not deleted)
- **Lesson** — lesson-level entries from across all lesson subcollections (no task ID)
- **Task** — task-scoped entries from across all lesson subcollections (has task ID)

Lesson/task cards link to the lesson in the builder.

### Viewing feedback in the builder

The builder's **Task Feedback Panel** shows submitted lesson and task feedback for the currently selected task, so authors can review comments without leaving the builder.

### CLI management

The CLI can list, add, archive, and bulk-archive feedback items in both collections; nothing is hard-deleted. See `docs/authoring/feedback-cli.md`.

---

## CLI Features

- Manage live lessons, reusable levels, classes, tasks, topics, assets, and feedback through `node cli/cli.mjs`
- Convert lesson and topic-library YAML to JSON for validation and publishing
- Test a lesson's source-code completion and feedback checks against named JSON/YAML student-code cases
- Fetch lessons, topics, tasks, assets, and feedback as JSON or YAML with `--format yaml`
- Read, add, archive, and bulk-archive platform and per-lesson feedback from Firestore via the CLI
- Create/list/delete reusable lesson levels with `node cli/cli.mjs levels`
- Create/archive classes and create/list/inspect lesson forks with `node cli/cli.mjs classes` and `node cli/cli.mjs lessons fork`
