# FEATURES.md — Platform Feature Reference

What the platform can do. For how to configure these features see **docs/authoring/AUTHORING_GUIDE.md** (YAML) or **docs/authoring/lesson-schema.md** (JSON reference).

---

## Lesson Types

New lessons are composed lessons: each code task selects one of the workspace types below, and the active workspace set is derived from the tasks used. Existing single-type lessons remain supported.

| Type | What students do |
|---|---|
| Python | Write and run Python code; output shown in a console panel; coloured block brackets show which lines each `:` line controls (Blocks button to hide them per device; tasks can turn them off with `showBlocks: false`) |
| Arcade Kit | Build a small pixel-style Python game with a sandboxed canvas, keyboard input, named/uploaded or pixel-editor assets, tilemaps, and Run/Stop controls |
| Turtle | Write Python turtle-graphics commands that draw onto a responsive canvas; checks run on the finished drawing |
| HTML/CSS/JS | Write and run web pages across multiple tabbed files; output shown in an iframe preview |
| Scratch | Drag-and-drop block programming with a live stage canvas; costume and sprite dropdowns (switch costume, go to, glide, touching, distance to, create clone of) show a thumbnail preview of each option, and sprite dropdowns keep the selected sprite's thumbnail beside its name on the block; optional Costumes and Sounds tabs (per task) where students can add emoji/library costumes and synth or sound-file sounds to any sprite |
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
- **Short answer** — free-text response; an open one (no check) with `showResponses: teacher_picks` lets the teacher pick answers from the student cards (📺 Show) to put on the presentation window, anonymous unless the teacher turns a name on
- **Confidence** — 1–10 self-rating, no right/wrong answer
- **Poll** — pick the option you prefer (2–6 options), no right/wrong answer, changeable; in a live lesson students see the class split (percentages, not names) after choosing and the presentation shows it live, unless the task sets `showResults: false`; the teacher sees each choice on the student cards and the counts in the session report

---

## Completion Checks

Evaluated automatically on Run or Submit. Pass or fail shows a strip docked at the bottom of the output panel (Python/Turtle console and result pane, HTML and Arcade preview, Scratch stage) — absolutely positioned inside the panel so it never covers the editor, Run/Reset or file tabs and never moves the layout; it stays until dismissed or the next result, scrolls if the hint is long, and on Scratch's Blocks/Stage tabs a dot on the Stage tab shows a result is waiting. Quizzes and panels with no output area keep a small floating corner popup (auto-dismisses after 45s); fail shows a hint from the first failing check. A specific wrong-pattern hint can be shown if the student's answer matches a known incorrect pattern. The popup is hidden while a student is watching a teacher/peer broadcast ("Go Live to Students") — that's not their own check result.

Checks can verify:

- **Python / HTML**: output content, code content
- **HTML only**: element existence, element count, element text/value, element attributes, computed CSS styles
- **Python only**: variable existence, type, and value (including lists and dicts)
- **Scratch**: block usage, sprite position/size/direction/visibility, variable values
- **Filesystem**: file and directory existence, which directory is currently open
- **Desktop**: filesystem checks (as above) plus Recycle Bin membership, window open/closed/minimized/maximized state, a window moved into a screen zone or resized, two windows arranged side by side, simulated-browser page visits, and search-engine query matching
- **Quiz**: correct answer match
- **Demo tasks** (Python, Turtle, Arcade Kit, Electronics, HTML, Scratch): that the student pressed Run (Run game, or Scratch's green flag) at least once — `run_attempted`, optionally requiring a run without an error

After the same hint appears twice in a row, solo students can optionally view the complete reference code (if defined on the task).

---

## Session Features

- **Waiting room** — students wait until the teacher starts; auto-advance on start
- **Video call** — the teacher sets a call link for the session (shown in the waiting room); "Send to all" pops a join prompt for every student, including those in the waiting room or still entering their name, and "Send Video Call Link" in a student's More menu pops it for one student (waiting room or any task)
- **Pause/resume** — freezes student navigation without ending the session
- **Live class poll** (hidden by default; Account Settings > "Show extra class tools (quick polls, Coding Paused, Edit Lesson)" brings it back, along with Pause Coding and Edit Lesson; the countdown is always shown) — the teacher's "📊 Poll" button (top bar, while the session runs) asks the class a quick single-choice question (2–6 options) with no lesson change. Students get a card in the corner of their screen they can answer while they work (and change until the poll closes, or minimise); the teacher's popover shows the live tally, who chose what and who hasn't answered, with **Close poll**, **Show results to the class** (on by default: the presentation shows live percentages and students see them once they have voted; tick **Keep results private** when launching to hide them), **Remove from screens** and **New poll** (one poll at a time; launching closes the open one). The presentation window shows the question, the answer count and, for a public poll, live result bars. Every poll — question, options, each student's choice, counts and times — is in the session report and its YAML export
- **Sandbox mode** — freeform coding with no tasks or checks; teacher can push code/files to all students. Each visit (when, after which task, the teacher's pushes and each student's last sandbox code) is archived teacher-side for the session report
- **Live badge signals** (the tutor's suggestions panel and picker are in the Student Grid section; the student celebration is under Student Features, "Coding moments") — first-occurrence topic opens, keyboard shortcuts, accepted autocomplete suggestions, the first run of code with an emoji in a string or HTML text, time to first edit, complete-code views, and sandbox run/error/fix counts are recorded per student during a live session (never in solo, previews or the presentation window, and never any code); see `docs/architecture/live-badges-plan.md`
- **Need Help** — a persistent "✋ Help" button in the top bar during any live lesson, always available (not tied to a failed check); marks the student's card for the teacher until dismissed
- **Session end** — all students see an end screen, with their own coding moments (live badges) as a sticker sheet; a student who reloads within 3 hours of the end gets the end screen back

---

## Teacher Features

### Session Controls
- Create, start, pause/resume, sandbox, end, and restart sessions
- Share a live join link with students
- Lesson elapsed timer and per-task countdown that flashes when time expires
- ⏱ Class countdown: the teacher starts a countdown (1/2/5/10 min presets or custom minutes), can add a minute or stop it, and every student screen and the presentation window shows the time left. At zero students get a "Time's up!" banner and a gentle chime (respecting their mute and the tutor's Sounds off); nothing is locked. It keeps running across task changes until the teacher stops it or the session ends
- Ending a session ends it immediately for students; the report shown afterwards offers an optional 1-5 star rating plus "what worked well" / "what didn't work, or was broken" notes, saved onto that session's report
- The session report shows how many references (support stages) were opened per task — count, students, and teacher vs student — and which ones each student opened
- Live badges in the session report: a **Coding moments** section (the class wall grouped by badge, **Copy class summary** with student labels, and suggested / awarded / auto / manual / dismissed / revoked counts per badge); new task columns (time to first edit median and range, students with a console error, Topic Library opens student vs tutor-sent, and the first real pass with how long after the task opened); per student their moments, topics opened, shortcuts, personal- and teacher-sandbox activity, and per task their first edit, error runs, different failed tries and "first real pass in class"; quiz-group first-try scores with the class median; and each teacher-sandbox visit as a "possible lesson gap" callout ("The class spent 14 min in the teacher sandbox after …") that expands to the tutor's explainer and pushes and each student's last sandbox code. All of it is in the YAML export. A report near Firestore's 1 MiB limit drops the students' sandbox code first and says so
- ✨ Highlight Class: pulse one control on every student's screen for the task the class is on: Run or Stop (Python, Turtle, Arcade, Electronics; HTML Run), or on Scratch the green flag, stop sign, Costumes or Sounds tab, or a block category heading (Motion, Looks, …). A ring pulses around it until the student uses it, or for 20 seconds (a still outline with reduced motion); a control on a hidden tab pulses that tab instead. **Stop highlighting** ends it. A task can also pulse a control when it opens (`highlight`)
- Rate any task live, while teaching it: a "⭐ Rate this task" button in the teacher's top bar (showing "⭐ N" once rated) opens a popover that lets the teacher give the current task a 1-5 star rating plus "what worked well" / "what didn't work" notes as the class works through it, rather than waiting until the session ends. Each task's rating is folded into that task's row in the session report

### What Students Are Doing
- Each student card has a "Now:" line for what the student is doing: 🤝 helping Sam / helped by Ali, 👀 looking at or ▶ trying the work on show, 📤 viewing shared work, 📖 reading a topic, 🧪 in their own sandbox
- A one-line class strip above the cards sums it up ("🤝 Hal → Sam · 👀 6 looking at Sam's work"); hover for names, click to outline those cards
- Card status chips are single icons (✓ ✕ ⚠ 💬 ✋ 💤 📋 ⛶ 📤 💡 🪟 ✏️), with the words on hover
- A run that crashed shows ⚠ Error (hover for the error line), separately from ✕ Failed (ran, but the check didn't pass); the grid header counts errored students on their own
- See the hint each student is being shown: a 💬 chip on the card (hover for the hint, how many times in a row they've failed, and any "Want a hint?" offer they haven't opened; "Your hint" when it's your override), the same hint in a "Amy sees" panel at the top of the student's modal, and a "Common hints right now" list above the cards when two or more students are seeing the same hint (click to outline them). Live lesson tasks only; cleared when they pass or the task changes

### Task Navigator
- Task list with group collapse
- Aggregate run count and check-passed count per task
- Advance the whole class to any task with one click
- Previous/Next navigation and Sandbox toggle

### Student Progress Counts
- Match and Fill in the Gaps tasks show a teacher-only "🧩 3/5 filled · 2 correct" badge on each student card and in the student modal header, updating live as the student works
- Code Arrange tasks show "🧩 4/6 slots filled" (arrangements are marked by running the code, so there is no per-slot correct count); indent-mode tasks show "2/5 lines moved"
- Code Arrange on Turtle (course mode too) and on the Python Stage: the tile board sits in the Turtle or Python workspace in the editor's place, so Run plays the drawing, course maps or Stage exactly as on a code task (animation, Skip, slow-mo, name tags, the result tabs on smaller screens), with Turtle, course and Stage checks
- Code Arrange indent mode (`arrangeMode: indent`, Python and Turtle): the lines stay in order and students slide each one left or right (drag, ← → buttons or arrow keys) to set its depth, with the same coloured block brackets as the Python editor; "fix the indent" tasks start some lines at the wrong depth
- Students never see these counts
- "✏️ Edit answers" in the student modal lets the teacher drag, type, or move that student's Match / Fill in the Gaps / Code Arrange items directly; changes appear on the student's screen live with a short "Your teacher updated your answer" note
- "👀 Highlight tiles" in the student modal (Code Arrange, Match, Fill in the Gaps drag mode): tap a placed tile, or an empty blank, to outline it in red on the student's screen as "👀 Look again", with an optional short note; tap it again to remove it, or **Clear all**. Several can be on at once. It goes as soon as the student moves that tile (or drops one into the highlighted blank), and on the next task. The student card shows a 👀 chip while one is on. It changes nothing about completion or attempts; the session report lists each one per student task (`tutorTileHighlights`). Taps only, so it works from a tablet
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
- Live badges (tutor side): "🏅 Suggestions (n)" in the grid header's ⋯ menu opens the **Badge suggestions** panel above the teacher editor, grouped by student, each suggestion naming the task it came from (its title, "Sandbox" or "No task", beside the student's name on an "Award all" row that spans tasks), with one-click Award / Dismiss, an "Announce" tick (on by default), "Award all" when several students earned the same badge, and the session's **Auto-award high-confidence badges** and **Sounds off** toggles. Each card shows a teacher-only "🏅 n" count with a dot while a suggestion is waiting (never shown to students or the presentation window). "☑ Select" (⋯ menu) picks several cards to award one badge to all of them at once. **One tap:** when the rules have a suggestion for an online student, their card shows an "Award <badge>" pill (ranked best first: a rule that matched on the current task, then the most recent, then the badge fewer classmates hold). Tapping it awards at once and shows an **Undo** toast for 6 seconds that revokes it; the pill is absent when nothing is suggested. Icon-only card buttons (🔔, 👍) have a label that appears on long-press on a touch screen

### Student Actions (per student)
- Go Live / Stop Live — one-to-one keystroke streaming with selection highlight and activity indicators
- Remote Reset — silently replace student's code with starter code, complete code, or a named intermediate stage
- Rename and remove students
- One-line modal header: the student's name then small status chips ("Ryan · AWAY · LIVE · 🏅 2"), ← → to switch student, **Support ▾** (Reveal and Set stage sections), ▶ Run on student, **More ▾** and ✕
- Nudge (More menu) — draw the student's attention back to the lesson
- 👍 thumbs up (StudentCard and StudentModal header, online students) — the student sees a brief "👍 You're on the right track!" toast with a gentle chime (respecting their mute and the tutor's Sounds off) that disappears after about 2.5s. Private to that student: not a badge, not shown to the class, not in session reports. Reloads don't replay it; the button confirms ✓ and is disabled for 2s to avoid spamming
- Go Live for All, Focus (highlight or switch a tab on the student's screen) and Highlight (pulse Run, Stop, the green flag, a Scratch tab or block category on just that student's screen) are in the More menu; Stop Live stays in the header while broadcasting
- **One-student header** shows only the common actions with visible words: 🏅 **Award <top badge>** (one tap with Undo; with nothing suggested it reads "Award badge" and opens the picker), 👍 **Thumbs up**, 📺 **Show to class** and ✉ **Help** (message the student), plus ← → and ✕ (labelled, 44px on touch). Everything else is in one **More** menu: Nudge, Go Live for All ("Take over every screen"), Share a copy, edit code, topic, video call link, fullscreen, **Mark the task** (Pass / Fail with a hint, formerly the Override menu), **Their screen and answers** (Run on student, Edit answers, Highlight tiles), **Support** (Reveal and Set stage), Export work and **Point at their screen** (Focus and Highlight merged). Edit answers and Highlight tiles show a "Done" button in the header while switched on
- 🏅 Award badge (the picker, opened from the header button when nothing is suggested) — a picker with a purple header and a light body, grouped into **Suggested now** (the rules' pending suggestions for this student, best first, each with the reason), **Other badges with a rule**, **Tutor-awarded** and **Admin badges** (full names with a short line saying what each is for, badges already held greyed). Click a badge to select it and see what it's for, then press **Award**; "Announce to class" is on by default. Revoke an awarded one silently; the header shows the student's teacher-only badge count
- "Show on every task" reference (in the Support menu's Reveal section): first hint, all hints, or the solution opens automatically for that student on every task for the rest of the session
- Teacher's live code as a reference (while Presentation View is on the task): **Reveal live code** shows it for the current task only and drops off on the next task; **📌 Keep showing live code** pins it on every task until turned off ("📌 Live code: kept on"). The Live tab in the teacher's code panel has the class versions: **Reveal live code to all** and **📌 Keep showing live code to class**. While a class pin is on, **📌 Live code on · Turn off** in the session toolbar turns it off from anywhere, and the student's Support menu can hide it for that one student (**📌 Show class live code again** undoes that). Students can't close it themselves
- "📋 Pasted" badge when a student pastes a large chunk (40+ characters or 3+ lines) into their editor — flagged, not blocked; also counted in the session report
- The output panel in the student modal opens automatically when the student's run produces output or asks for input
- Approve or decline a student's request to share their workspace with the class, after previewing the exact snapshot
- Share a student's workspace with the class without them asking ("Share this with the class")
- 🎁 **Export work** (More menu, tutor-only, live only) — for Student of the Week: download this task or the whole lesson from what the tutor already has (the live mirror on the current task, the latest logged attempt elsewhere). **Code files**: Python/Turtle `.py`; HTML `.zip` of the files plus a single self-contained `.html` (stylesheets and scripts inlined); Scratch a real `.sb3` that opens in Scratch 3 (costumes drawn to PNG, sounds as WAV/MP3, variables, broadcasts and menus translated; blocks Scratch has no match for are listed) plus a LaunchPad JSON copy of the raw state. **Pictures** (PNG): the Turtle drawing, the Scratch stage, each sprite's scripts as blocks and every costume. File names use the task title and date; the student's first name only when "Include first name in file names" is ticked (off by default). One file downloads as itself, several as one `.zip`. Nothing is sent to the student
- **Share link** (opt-in per export, current task only) — a frozen, name-hidden, read-only snapshot at `/share/:id` for showing the class: Python code and output, Turtle code and drawing, HTML preview (sandboxed) and files, or the Scratch project in a read-only workspace whose green flag runs it. Lasts 30 days; the tutor can Revoke it from the export dialog and admins from Admin ▸ Shared Work. Snapshots over ~900 KB are refused with a message (the downloads still work)

### Workspace Sharing
- On tasks authored with `allowSharing`, students can offer their work to the whole class
- Every share is teacher-approved before anyone else sees it; declining is silent
- Approved shares collect in a "Shared work" gallery, tagged by task, and persist until the teacher removes them
- Classmates open a share as a non-destructive copy they can edit and run; their own work is untouched, with an explicit "Copy to my editor" if they want it
- Supported on all lesson types except quiz and information tasks

### Teacher Broadcast
- Broadcast teacher's or a pinned student's screen to all students simultaneously
- Available via a separate presentation window
- **📺 Show to class (keep coding)**: show a student's work without locking anyone. Classmates keep coding; the bar says "📺 Look at Sam's work!" with 👀 Look and ▶ Try it (a copy they can run: nothing saved, nothing copied out)

### Peer Help
Student screens are made for 9-year-olds: big buttons, few words, fixed choices only. The teacher's side has the detail.
- On Python, Turtle, HTML and Scratch tasks, ✋ Help is still one tap; a bubble then asks "Can a classmate help too? 👍 Yes / No thanks"
- The teacher checks the student's work first, then offers it to classmates who finished the task; neither student sees the other's name
- Finished students see "🤝 Can you help a classmate? Yes! / Not now"; the first to say yes makes a three-line helper promise (😊 kind, 💡 clues not answers, 👀 teacher can see)
- The helper sees the classmate's code, big, with 👍 Good / 👎 Look again / 💡 Hint on every line (Scratch: every script). 💡 opens up to six big hint cards (the lesson's `peerHints` first). "▶ Run their code" shows what it does
- The stuck student's card lists what arrived and on which line, with "Thanks 👍" and a small 🚩 on each, and one big "I'm OK now". 🚩 hides it, ends the help and alerts the teacher, who can stop that student helping for the day
- 🤝 Peer help menu: who is helping whom, alerts, and End all peer help; everything is kept in the session report
- Suggested changes and notes (teacher-approved) are built but switched off (`PEER_HELP_EDITS_AND_NOTES` in `src/shared/peerHelp.js`)

### Presentation Annotations
- In the presentation window, a small floating toolbar lets the teacher annotate information tasks (standard, recap, introduction, images included) and code tasks' explainers, and every student sees it live (whole class only)
- **🔴 Pointer**: a dot that follows the teacher's mouse; **✏️ Ink**: freehand marks that fade a few seconds later; **🖍️ Highlight**: selected text highlighted on every screen until clicked again, cleared or the task changes; **Clear** removes everything; Escape leaves a tool
- Marks land on the same content (word, list item, part of an image) on every screen size, not the same pixels
- If the teacher points somewhere a student has scrolled away from, a "👆 Teacher is pointing here" chip appears; clicking it scrolls there (never automatic). Pointing at a code task's explainer opens it for students who had it collapsed
- Cleared on every task change and when the session or presentation window ends; respects reduced motion (no fades)

### Edit Lesson (hidden by default; shown by the "Show extra class tools" setting in Account Settings)
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
- Lesson title, level badge, "Lesson N" (when the lesson has a `lessonNumber`), and mode indicator (solo / live / sandbox)
- Task progress dots — clickable for past tasks, locked for future tasks, current highlighted
- Collapsible explainer panel with Markdown formatting, inline topic definitions (not on Scratch lessons — the topic library is disabled there), and Scratch block visualisation
- Explainer text is not selectable/copyable for students (teacher and builder previews are unaffected)
- First-view entrances: when a task first appears the explainer drops in, its bullets (and an information task's) slide in one after another, and quiz answers rise in one by one. They play once per task on each screen (student, presentation window, teacher view, Builder preview), never on a revisit, a ▲/▼ toggle or a Builder edit, and become a short fade under reduced motion
- Retro typing animation on Python output
- Turtle course mode (`course`): the turtle becomes a vehicle (turtle, car, rover, boat or drone, drawn top-down) driven round a grid maze or a free track with walls, a goal and pickups. Sensors (`wall_ahead()`, `wall_left()`, `wall_right()`, `at_goal()`, `on_pickup()`, `collected()`), a faint trail, crashes that bump and stop the program with a plain, announced message, several maps played in turn with a tick or cross each, and course checks (goal reached, no crash, pickups, at most N moves). The tutor card shows "Reached goal", "Crashed" or "2/3 maps"; Go Live plays the presenter's run; the session report counts runs, goals, crashes and pickups
- Name-tag panel (`showVariables`, Python and Turtle): after Run (or the first time the program reaches a `#@peek` line, marked in the editor by a dashed ⏸ "The tags show the values here" band and headed "Values just before line N" in the panel) the student sees a name tag per variable with a type label and its value (quoted text, indexed list tiles, dict rows, "changed" marks). Lists and dicts are drawn as what they hold (colour swatches, number bars, 2D pictures and tables, dict cards; `visuals: false` turns it off, `stageLists` sets how a `grid()` list shows), with per-item change marks and the exact value one tap away. Three modes: view; predict (fill the tags in before running, ✓ / ✗ on Run, `variables_predicted` check, predictions in the session report; each tag's answer box fits the value — True / False buttons, a number field with the numeric keypad, a quoted text box or the author's choices — and `predictType` tags ask for the type label instead, checked by `types_predicted`); target (target tags turn green when matched). The tutor sees the panel and the predictions live on the card and in StudentModal, and Go Live broadcasts it
- Run counts (`runCounts`, `#@count`, Python and Turtle, with or without the name-tag panel): up to three marked lines; `predict` puts a "How many times will this run?" number box at the end of each in the editor, Run waits until every box is filled (predict mode's lock), then each reads "ran 3 times ✓" / "ran 1 time ✗ · you said 3" (read aloud as "Line 3 ran 4 times. You predicted 4: right."); `show` just reads "ran 3 times" after each Run. `runs_predicted` and `line_run_count` checks; the tutor chip counts the boxes, StudentModal and Go Live show them, and the report records each prediction with its real count (`runCountPredictions`, off-by-ones per line)
- Linked name tags (`showVariables.link`, on by default): each tag and every real use of its variable in the editor share one of six colours and a small number (never colour alone; strings, comments, attributes and keyword names are skipped); hovering, focusing or tapping a tag strengthens the marks in the code and vice versa. Also in StudentModal's code view and Go Live
- Python Stage (prototype): `from stage import *` gives a Python task a 400 × 400 drawing pane beside (or above) the console — size-first, centre-anchored `circle`, `square`, `rect`, `polygon` (with `angle=` clockwise, `opacity=`, `outline=`, `width=`, `colour=None`), plus `background`, `line`, `text`, `stamp`, `grid` (2D lists, or a flat list with `width=`, as pixel art), `clear` and `hue(n)` colours; CSS, hex and PICO-8 colours; top-left origin, y down; plain-English errors for the old position-first order; friendly errors naming the argument. A task's `stageTarget` adds a faint ghost to draw over and, after Run, a Differences view described in words. Checks: `stage_matches_target`, `stage_shape_count`, `stage_colour_used`, `stage_pixel` (a point, a grid row and column, or an `index` in a flat grid), `stage_text_shown`. Screen-reader description of the drawing. The tutor sees the drawing on the card and in StudentModal, and Go Live broadcasts it
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

### Side-quests
- On Python, Turtle and HTML code tasks with `sideQuests`, a student who passes sees "🎉 You've finished! Try a side-quest" with up to three side-quests (🏆 Mini challenge, 🐞 Debug it, 🤔 Predict, then run)
- Live: only while the class is still on that task; solo: after a pass
- Each opens in its own scratch editor of the task's module: its own instructions and starter, nothing checked, and the task's code (and what the next task carries) never changes. Its code is kept on the device for the session
- **✓ I've done it!** is self-reported and recorded; when the teacher moves the class on, the side-quest closes and the student moves on as normal
- Tutor view: a 🗺️ Side-quests panel under the task lists the current task's side-quests (title, kind, explainer, starter) with On it now / Done / Probably stuck counts (2 error runs in a row, or no Run for 5 minutes); clicking a count lists the students, and a student (or their card's 🗺️ chip) opens their StudentModal on a read-only Side-quest view (status, code, output/drawing/preview), switchable with Main task. Side-quest code reaches the tutor on every Run, and live while the tutor watches that student
- The teacher's card shows "🗺️ on side-quest 2/3 · ✓1"; the session report lists each side-quest opened (runs, error runs, done); 🗺️ Side Quester is suggested after 2 (lesson-tunable) are marked done
- Solo study log: a real solo student's arrival, each checked Run (first-attempt passes) and reaching the complete screen go to `soloLog/{lessonId}/{studentId}` (counts and times only). Admin ▸ Solo & side-quests lists, per class and lesson, who did the Solo Challenge (started, finished, first-attempt passes) and each side-quest opened in ended sessions, with a no-names download; `lessons solo-log <id>` reads it anonymised

### HTML Inspector
- On HTML tasks with `inspector` enabled, an **🔍 Inspect** button on the preview. Pointing at (or tapping) part of the page outlines it with labelled, colour-blind-safe bands for margin, border, padding and content with px sizes; clicking or tapping chooses it
- A side panel (a bottom sheet on narrow screens; 44 px touch targets; screen-reader readable) shows the element's tag, id and classes; **Box** (the nested boxes and sizes), **Why this …?** (every rule that sets a chosen property, strongest first, the winner highlighted and each loser struck through with a plain-words reason: less specific, earlier in the file, overridden by !important, beaten by the style attribute, or inherited from a parent) and **Layout** (flex main/cross axes and gaps; grid lines and gaps, drawn over the page)
- Drawn by the classroom over the preview; nothing is added to the student's page, so element checks are unchanged. The preview still only re-renders on Run, and the choice is found again after each Run
- Go Live: the tutor's inspect mode, chosen element and property show on every student's screen. The tutor can inspect a student's page in the student modal. The session report records each student's use per task
- Builder: Task options → HTML Inspector (start in inspect mode, pre-selected element, sections); the Builder preview has the Inspector too

### Live Scrubbing (Python, Turtle, HTML)
- On code tasks with `scrub` enabled, numbers and colours in the code are live controls: every draggable number carries an always-visible dashed "you can change this" box (shared with `#@lock-values` values); hovering a number underlines it (ew-resize cursor) and dragging left/right changes it (whole numbers stay whole, decimals step by their last place, CSS units kept); on a tablet a tap opens a slider beside it (− / + buttons, 44 px+); Alt+Enter opens it from the keyboard
- Colour strings and CSS colours get a swatch; clicking or tapping opens a picker with colour-blind-safe colours first, then common names, then a hex box (text labels throughout). A name stays a name, hex stays hex
- While a value moves, drawing programs re-run as a throttled preview, about every 200 ms while the drag keeps moving (Turtle, Python with the Stage, HTML/CSS in the student's own preview): no attempt, checks, save or tutor update, and never overlapping the last run. Programs with `input()` replay the answers from the student's last Run ("Using your last answers: …"), or show "Press Run and answer the questions first"; Python without the Stage shows "Press Run to see it"
- When a drag, slider step or colour pick ends, the task's checks run once exactly as a Run (attempt logged with `source: 'scrub'`, result shown, tutor card updated); `scrub.checkOnRelease: false` turns it off
- `runOnOpen` (Python, Turtle; default on with `scrub`) runs the code once as a preview when the task opens, so the picture shows straight away: no checks, no attempt, not a Run; never for `input()` programs
- When the drag or popover ends the value is one real edit (saved, sent to a watching tutor, one Undo step), counted as an edit rather than typed characters. Per-line slider ranges via `scrub.ranges`; the session report counts each student's scrubs per task
- Builder: Task options → Live scrubbing (numbers, colours, ranges by line)

### Locked Lines, Hidden Setup and Puzzles (Python, Turtle)
- `#@lock-values` locks a line except its values (plain string contents, empty strings too, and numbers): the values get a dashed "you can change this" box, the cursor snaps into them, and anything else on the line is read-only ("Only the values on this line can change")
- `#@lock` marker lines (or `puzzle.onlyEdit`) lock lines of starter code: greyed with a 🔒 Locked tag; no typing, deleting, cutting, pasting over or re-indenting, but new lines can go before, between and after them. Arrow keys skip them; a typing attempt or tap shows "This line is locked" (screen-reader announced) and the touch keyboard stays shut there. Locks survive saves, support stages and Reset, and show in StudentModal, Go Live and stage references
- `setupCode` runs before the student's code on every Run in the same program, never shown; its variables show in the name-tag panel and checks see them; student line numbers are unchanged and a setup error shows only "This task's setup has a problem — tell your tutor." `setupNote` is a line above the editor
- `puzzle.maxLines` shows a live "3 / 4 lines" counter and the `max_lines` check enforces it; `puzzle.par` shows "Solved at par ⭐" / "Solved in 2 changes (par 1)" after a pass. The tutor's card shows "Solved at par" / "Over line limit"; the session report adds `linesUsed` and `changesFromStarter`
- Builder: `max_lines` checks show as their own row in the check editor; the fields are authored in lesson YAML

### Scratch Slow-mo
- On Scratch tasks with `slowMo` enabled, four big buttons under the stage (icon + word, 44 px+ for tablets): **Slow-mo** (run at the speed slider's blocks a second), **Pause**, **Step** (one block) and **Restart**
- The running block glows in each running script (a still outline with reduced motion), and the stage redraws after every block, so two quick costume switches show both
- Step with several scripts: one block per Step, the scripts taking turns (round-robin)
- A timeline strip under the stage records one card per step (costume picture, backdrop, x, y, variables; screen-reader labels); swipe through it, tap a card to see the stage at that moment, then "Back to now"
- A slow-mo run is a green-flag run, so checks work as normal. Go Live: the tutor's controls drive the glow, stage and step the class sees; a tutor watching a student sees their glow and step. The session report records each student's use per task
- Builder: Scratch setup → Student additions → Slow-mo

### Python and Turtle Slow-mo
- On Python and Turtle tasks with `slowMo` enabled, Run reads **▶ Run (slow-mo)** and plays the run at the slider's lines a second (0.25–4); once it is playing, big buttons above the code (icon + word, 44 px+): **Pause** (turning into **Play** while paused), **Step**, **Step back**, **Restart** and **⏭ Finish** (straight to the end, checks as for Run). The run shortcut, a Code Arrange board's Run and the tutor's remote Run do the same; the predict-mode Run lock still applies. `slowMo.separateButton: true` keeps the older layout: a plain Run beside a **🐢 Slow-mo** button
- Record, then replay: the whole run is recorded first (up to 2,000 lines; `input()` is asked while it records), then played back, so Step back is exact
- The line that just ran is highlighted; each loop header shows "pass 3 of 4" (or "pass 3" when the count isn't written in the code); name tags update step by step, a changed tag pulses once with its earlier values struck through; output grows line by line; the Stage and Turtle drawing build up step by step; the task's question shows while paused
- The recorded run is the run: checks, the attempt and the tutor's card update once, as for Run. Editing the code ends slow-mo. A runaway program stops at 2,000 steps with "Slow-mo stops after 2,000 steps. Is there a loop that never ends?"
- Go Live: the presenter's recording goes to every screen once and their controls drive the step the class sees. The session report records each student's use per task. Reduced motion: no pulses; a live region reads each step
- Builder: task editor → Slow-mo (on/off, starting speed, name tags, question, separate Slow-mo button)

### Python and Turtle Screen Layout
- Wide desktops: the editor, then the Stage / turtle picture, the console and the name-tag panel side by side
- Tablets, 1366 × 768 Chromebooks and small laptops: the editor on the left and one result pane with tabs **Picture · Tags · Console** (only the tabs the task has); portrait screens and phones put the editor above the tabs
- Predict / target tasks open on Tags (the code and the empty tags together, kept above a tablet's on-screen keyboard); a `stageTarget` task opens on the Picture with its ghost. After Run the pane switches to the Picture if the program drew, Tags in predict / target mode, otherwise the Console (an error before any drawing shows the Console)
- Slow-mo (and predict / target mode once there is a picture) shows the Picture and Tags together under one tab
- The Console tab counts unseen lines (or shows **!** for an error) while hidden; switching tabs never loses a drawing or the output
- Tabs: arrow keys, 44 px targets, labelled regions, a polite announcement after Run; Go Live follows the same rules
- Optional task hint `layout: { firstPane: picture | tags | console }`

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
- ID, title, description, stage, a reusable referenced level, an optional lesson number (position within the level), and ordered tasks with per-task workspace selection (new lessons)
- The Builder opens straight on the lesson in the link (`#/builder?load=<lessonId>`, as Admin's Edit links pass). With no lesson it shows a plain "Open a lesson" list in the shared LaunchPad order (level, then `lessonNumber`, each Solo Challenge indented under its parent) as "9 · Title", with a Draft flag. The header has a Back button (to Admin, or the app), Account and All lessons
- Hand-building tools are hidden unless the URL has `?advanced=1`: New blank lesson, Open a lesson file (JSON), Upload file, the Lesson type badge, Sandbox starter and a task's module picker. Admin's "New lesson" opens with the flag. Kept by default: viewing tasks, editing intents and text, task feedback, Draft on/off, Preview, Print, Download, Save
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
- Highlight a control (Task options, code tasks with controls): pick Run, Stop, a Scratch control or block category to pulse when the task opens (`highlight`)
- Side-quests (Task options, Python/Turtle/HTML): up to three per code task, each a title, kind, Markdown explainer and starter
- HTML Inspector (Task options, HTML): enable, start in inspect mode, pre-selected element and sections
- Live scrubbing (Task options, Python/Turtle/HTML): numbers, colours and per-line slider ranges
- Badge hints (authoring metadata): toggle which live badges this task may also suggest (`badgeHints.suggest`, pattern badges only) or never suggest (`badgeHints.suppress`), with a read-only note of the badges the task's `taskActivity` pattern already triggers

### Scratch Tools
- Starter/complete workspace tabs with isolated state
- Sprite panel: add/remove, costumes, sounds (built-in synth or audio file), and initial stage properties
- Student additions: Costumes / Sounds tabs and whether students may add costumes or sounds
- Slow-mo (on/off, starting speed, timeline fields)
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
- **Lesson management**: browse all published lessons in one library (not grouped by type), grouped by level and ordered within a level by `lessonNumber` (shown as "9 · Title"; unnumbered lessons after, by title); group stock lessons with class forks and Solo Challenges; expand each lesson to view report and feedback counts, session reports, and lesson/task feedback with resolve actions; launch as teacher, preview as a student (ephemeral — nothing is saved), copy student links, or create/overwrite a class fork
- **Class rosters**: each class (Admin → Classes → Students) has a list of students, first name and initial only, that admins add, rename and delete (deleting also deletes that student's saved work and typing scores). In a live session the tutor opens **👥 Match students** (Student Grid ⋯ menu, or the "👥 n unmatched" / "👥 Pick class" chip), picks the class for a stock lesson (a class fork uses its own class; "No class" saves nothing), and matches each joined student to their name by hand, or adds a **New student**. Students still just type their name. While matched, the tutor's browser saves each student's last Run or submission (Python, Turtle, HTML, Scratch) to their roster entry, keyed by the stock lesson and task so later lessons can find it; nothing is saved per keystroke and only while a tutor tab is open. Cards show a 👥? marker for unmatched students and the StudentModal header shows the matched name — tutor-only; reports stay anonymous
- **Typing history**: for matched students, the tutor's browser keeps every finished Keyboard typing score (`type_text`, `type_code`, falling words: speed, accuracy, corrections) on their class-list entry, once each, across lessons. On a typing task the card shows `📈 Last 62 · Best 75 cpm · first 40` and the StudentModal a **📈 Typing history** list; students see "Last time: 62 cpm, 91% · Best: 75 cpm" beside items with `showHistory: true` and "You went from 40 to 75 characters a minute." when they beat their first lesson. The session report puts each matched student's score next to their previous one (anonymised), and Admin → Classes → Students → **Typing** lists a student's scores for parents' progress conversations
- **Two-lesson projects (cross-lesson carry)**: a task with `carryCodeFromLesson` (Python, Turtle, HTML) or `carryBlocksFromLesson` (Scratch) starts each student from their own saved work on a task of an earlier lesson. The tutor's browser reads a matched student's roster work and hands it to them through a teacher-written carry inbox; students never read the roster or scan their device. An unmatched student on that task sees "⏳ Waiting for your tutor to find your Lesson N work…" instead of the workspace until the tutor matches them or chooses **Use the starter** (per student in the StudentModal, or for all unmatched students in Match students). Cards show ⏳, the Match students panel highlights the waiting unmatched students, and the grid's roster chip counts them. Nothing saved, "No class", solo study, the presentation window and the Builder preview use the starter; a student with their own work for the task keeps it. The session report records each student's outcome (`crossLessonCarry`)
- **Level management**: its own Admin tab (`Levels`) for creating and editing the reusable levels lessons can reference
- **Class management**: create and archive admin-only class records used for reusable lesson forks
- **Session management**: see every live or waiting session left open across the platform (lesson, state, paused flag, student/online counts, how long it's been open) and close any of them remotely, for cases where a teacher left a session running without ending it
- **Topic library**: create, edit, and delete topics with full Markdown description and syntax fields; type filters come from the lesson module registry
- **Shared assets**: manage lesson-type-wide Firebase Storage files and Scratch default sprites, backdrops and sounds, shared across every lesson of a given type
- **Badges**: see every built-in live badge with its exact rule (rule-backed or tutor-only, auto-awardable), and add, edit, archive or restore manual-only badges that reach tutors' award pickers with no deploy; ids and emoji are checked for clashes on save, and archived badges still show wherever they were awarded
- **Shared work**: every share link tutors made with Export work (title, module, date, live/expired/revoked, days left), with Revoke for live ones
- **Version footer**: the bottom of every Admin tab shows `LaunchPad vMAJOR.MINOR.BUILD · commit · built date` (BUILD rises on every merge to `main`), with a Copy button for bug reports; clicking the version opens "What's new" milestone release notes

---

## Feedback

### After-class feedback (teacher)

One step after every way of ending a session: a 1-5 rating, "What worked well", "What didn't work", and optional notes about individual tasks.

- **End Session** opens the session report with the step at the top; **End & Go to Home** shows the step (with Skip) before leaving.
- It can be added or edited later from a past report (Reports in the session, or Admin > Lessons): **Add feedback** / **Edit feedback**.
- The rating and notes become `teacherFeedback` on that run's report; each task note is stored in `lessons/{lessonId}/feedback` with the task and a `reportId` linking it to the run (read by the feedback CLI, Builder task panel and Admin).
- The per-task rating panel during the lesson is separate and unchanged. The in-session Feedback button was removed from the live tutor header. Bug reports stay reachable through **Report a problem** in the session controls (Menu), which opens only the Platform Feedback form (the Builder preview still has the full modal).

### Viewing and deleting feedback (admin)

The Admin Portal's **Feedback** tab still shows three sub-tabs. Lesson and task feedback also appears under each lesson in the **Lessons** tab, with open/total counts and the same resolve/archive action:

- **Platform** — all entries from `platformFeedback`, sorted newest-first; each card shows email, date, lesson/task context, and text; admins can archive individual items (archived feedback is hidden, not deleted)
- **Lesson** — lesson-level entries from across all lesson subcollections (no task ID)
- **Task** — task-scoped entries from across all lesson subcollections (has task ID)

Lesson/task cards link to the lesson in the builder.

### Viewing feedback in the builder

The builder's **Task Feedback Panel** shows submitted lesson and task feedback for the currently selected task, so authors can review comments without leaving the builder.

### CLI management

The CLI can list, add, archive, and bulk-archive feedback items in both collections; archiving never deletes. Deleting a lesson (Admin or `lessons delete`) does delete its lesson feedback, along with its session reports, and so does re-creating a class fork with `lessons fork`. See `docs/authoring/feedback-cli.md`.

---

## CLI Features

- Manage live lessons, reusable levels, classes, tasks, topics, assets, and feedback through `node cli/cli.mjs`
- Convert lesson and topic-library YAML to JSON for validation and publishing
- Test a lesson's source-code completion and feedback checks against named JSON/YAML student-code cases
- Fetch lessons, topics, tasks, assets, and feedback as JSON or YAML with `--format yaml`; `lessons list` uses the shared lesson order (level, then `lessonNumber`, Solo Challenges after their parent) and includes `lessonNumber` and `companionOf`
- Read, add, archive, and bulk-archive platform and per-lesson feedback from Firestore via the CLI
- Create/list/delete reusable lesson levels with `node cli/cli.mjs levels`
- Create/archive classes and create/list/inspect lesson forks with `node cli/cli.mjs classes` and `node cli/cli.mjs lessons fork`
