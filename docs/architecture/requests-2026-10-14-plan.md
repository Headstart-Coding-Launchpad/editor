# Platform requests 2026-10-14: build plan

Agreed with Ryan on 2026-10-14. It covers the 20 requests in `docs/authoring/authoring-requests/2026-10-14-*.md`.

## How it's built

- Each package gets one branch and one PR.
- Integration happens on the `integrate/requests-2026-10-14` branch, in the worktree `C:\Users\rflem\Documents\LaunchPad\hsc-integration`.
- Each wave's agents branch from the integration branch. The lead merges the wave, runs the full suite once, and then starts the next wave.
- Parallel agents never run tests.

## Decisions (Ryan, 2026-10-14)

**Identity: class roster, matched by the tutor**
- Each class has a roster in Firestore, `classes/{classId}/roster/{rosterId}`. Entries hold a first name and initial only (e.g. "Jamie B.").
- Admins manage the roster in Admin → Classes. Tutors can add a "New student" during a session.
- Deleting an entry wipes its saved work and typing scores.
- Students still type their name on join; nothing changes for them.
- The tutor matches each joined student to a roster entry **by hand**, in a "Match students" panel. There's no auto-match and no suggestion.
- **Which class a session uses:** a class fork uses its own `fork.classId`. On a stock lesson, the tutor picks a class, or "No class", when starting the session.
- **Saving is tutor-mediated:** students never write to Firestore. The tutor's signed-in browser saves a matched student's work from what the tutor already receives: `currentCode`/`currentFiles`/Scratch state on Run, and submissions.
  - "Final code" therefore means the last Run or submission.
  - Work is only saved while a tutor tab is open.
- **Match records** live in a node only the teacher can write. They never go on `students/{anon}`, which students can write.
- **Saved work is keyed by source IDs:** `fork.sourceLessonId` (or the lessonId when not forked) and the source task id (`taskLinks[].sourceTaskId`). That way Lesson 12's fork finds Lesson 11's fork's work.
- Keep each document well under 1 MiB. Split Scratch state per sprite if needed.
- **Approved new Firebase data:**
  - Firestore: `roster`, its `work` and `typing` subcollections, and `sharedWork`.
  - RTDB: tutor-only roster matches, a carry inbox the tutor writes to, `sideQuestCode` (sent only while the tutor is viewing that student, per the activeStudentView rule; this reverses the 2026-10-09 "status only" call), example opens, and predictions.
- **Cross-lesson carry when the student isn't matched yet:** hold the task ("Waiting for your tutor to find your Lesson 11 work…"), with a tutor override to use the starter.
  - Solo mode, with no tutor: use the starter.
  - No scanning of localStorage, because of the shared-device risk.
- **Session reports stay anonymous** ("Student N"). Roster names stay on the tutor side only.

**Export**
- Formats: code files, pictures, real `.sb3`, and a name-hidden share link.
- **Live only**, from the StudentModal during the session.
- Zip library: **fflate** (approved dependency), loaded only when exporting.
- **Share link:**
  - It is opt-in per export, shows no name, and is a frozen snapshot in Firestore `sharedWork/{randomId}`.
  - It is public-read only while `expiresAt > request.time`, and lasts **30 days**. The tutor or an admin can revoke it.
  - The new public read-only route, e.g. `/share/:id`, is an approved URL addition.

**P6 visual learning**
- All six builds are in, staged by dependency.
- Stage coordinates: top-left origin, y down, 400×400.
- Python slow-mo records first, then plays back. `input()` is asked during recording, before playback, and its answers are shown at the right step.
- In Go Live, the teacher's recording (capped at 2,000 steps, with a size budget) is broadcast to students.

**Highlight**
- A live tutor menu (whole class, or one student from the StudentModal).
- A task-level `highlight` field.
- Run and Stop on every code module.
- Scratch's green flag, stop, Costumes and Sounds tabs, and toolbox categories.

**Scratch "still building"**
- While the workspace equals what the task **opened with** (after carry), or has a loose non-hat block, after_block_placed **failures** show no fail or hint and log no attempt.
- **Passes always count**, even with a loose block.

**Other calls**
- Falling words: points only, no lives. It always runs the full time.
- "See example" is a Markdown fence.

## Packages and waves

### Wave 1 (8 agents)

**W1-a: Docs and taskActivity patterns** (`fix/docs-feedback-check-direction`)
- `python.md`: switch the Code Structure feedback example to `nested_in`.
- `lesson-schema.md` Indent example: correct the direction, and fix the malformed `- check: {...}` shape, which `normalizeChecks` silently drops.
- State plainly that a feedback check matches when its check passes.
- Add the `quiz_which_construct_fits` and `quiz_poll` patterns, with docs.

**W1-b: Scratch fixes** (`fix/scratch-eager-checks-library-backdrop`)
- *Still building:*
  - Add a pure helper, shared so the CLI can reuse it.
  - The baseline is the workspace as it loaded when the task opened, compared by structure: ignore block ids and positions.
  - A block is "loose" if it is a top-level block with a previous or output connection.
  - Gate the fail path, `evaluateIdleFeedback`, hints and `logAttempt`. Passes are not gated.
- *Sprite library:* always portal the picker (an ancestor clips it) and keep it within the viewport. Check at 1366×768 and at 150% zoom.
- *`backdrops[].current: true`:*
  - Use one helper at every site (`ScratchWorkspace.jsx` ~1009, 1091, 1276, 2538), and in `TeacherLiveView` and the scratch-render CLI.
  - Add a Builder control.
  - Warn in validation when more than one backdrop is current.

**W1-c: See example** (`feature/explainer-see-example`)
- An `example` code fence renders a button that opens a wide, portalled modal with highlighted code.
- Log example opens per student per task; the report records them.
- The tutor card or modal shows "opened example".

**W1-d: Side-quest tutor view** (`feature/side-quest-tutor-view`)
- A teacher panel lists the current task's side quests, with counts of students on each, done, and probably stuck.
- The card chip opens the StudentModal side-quest view, which shows the read-only side-quest code with the tutor's tools.
- Side-quest code syncs on Run, and on keystrokes only while activeStudentView matches.
- Includes RTDB rules and rules tests.

**W1-e: Keyboard modes** (`feature/keyboard-type-code-falling-words`)
- **`type_code`:**
  - Multi-line, with its own validator and limits.
  - At the start of a line, Tab counts as 4 spaces for Python and 2 for HTML. No auto-indent.
  - Per item, record accuracy, characters a minute, corrections and time. Supports `minAccuracy` and `targetCpm`.
  - The on-screen keyboard is blocked.
- **`falling_words`:**
  - Runs for `durationSeconds`, with points only. Tokens may contain symbols and spaces. It always completes.
  - Record tokens cleared and missed, accuracy and characters a minute.
  - Respect reduced motion.
- Put each mode's logic in pure files and add Builder and CLI capabilities.
- Shape the results so W3-b can read them.

**W1-f: P6-1 name tags** (`feature/python-variables-panel`)
- Add `showVariables` (modes `view`, `predict` and `target`) on Python and Turtle.
- **Variable capture in the worker:**
  - Read the `__hs_run__` frame's `f_locals`, filtered to the student's file. That also works when the run errors.
  - Hide functions, modules, classes, dunders, names imported from `stage`/`turtle`, and anything in `hide`.
- **`#@peek` marker:**
  - Strip it at lesson load, like `#>`.
  - Re-anchor it after edits and send it to the worker as a line number.
  - Capture the variables the first time that line runs.
- Add a `variables_predicted` check using forgiving comparison, and report each prediction.
- Sync the panel to the teacher card and Go Live, sending an explicit `null` when cleared.
- The panel component takes a **sequence** of snapshots, so W3-c can drive it.
- Build the frame capture so W3-c can reuse it.

**W1-g: Highlight controls** (`feature/highlight-ui-controls`)
- New control targets:
  - `run` and `stop` on every module.
  - On Scratch: `green_flag`, `stop`, `costumes_tab`, `sounds_tab` and `category:<name>`.
- Workspace changes are limited to `data-highlight-target` attributes plus one shared overlay or pulse hook.
- A tutor "Highlight ▸" menu, for the whole class (TeacherView) and per student (StudentModal).
- A task field, `highlight: {target}`.
- The highlight dismisses on use or after 20 s. With reduced motion it's a static outline.
- Validation rejects unknown targets.

**W1-h: P6-5 HTML Inspector** (`feature/html-inspector`)
- Add the `inspector` field.
- Draw the overlay from the parent page (the iframe is same-origin), with box bands and px values.
- **Cascade walker:**
  - Walks `document.styleSheets`. Cross-origin sheets throw, so skip them and say so.
  - Covers specificity, source order, inheritance and inline styles.
  - Gives its reasons in plain words.
- Draw flex and grid axes, gaps and grid lines.
- On narrow screens the panel becomes a bottom sheet.
- Sync the selection in Go Live, and record use in the report.

### Wave 2 (4 agents)

**W2-a: Scratch test-checks** (`feature/scratch-test-check-cases`)
- `--cases` entries can be `blocks`, or a `stage` plus `edits` (`appendBlock`, `replaceOpcode`, `setField`, `removeBlock`), with `expect`.
- Evaluate Support stages, and flag any that pass completion.
- Report the "still building" state.

**W2-b: Class roster** (`feature/class-roster`)
- **Roster:**
  - Roster CRUD in Admin, plus "New student" in-session.
  - The Firestore rule is not public-read. Teachers and admins have read/write; the parent `classes` collection stays as it is.
- **Matching:**
  - Pick a class for stock-lesson sessions.
  - The "Match students" panel (manual) writes a teacher-only RTDB match node.
- **Saving work:**
  - The tutor's client writes `roster/{id}/work/{sourceLessonId}__{sourceTaskId}`.
  - It writes on Run, on submission and when the student leaves a task, for Python, Turtle, HTML and Scratch.
- Includes rules and rules tests.

**W2-c: Export** (`feature/export-student-work`)
- An "Export work" option in the StudentModal, for one task or the lesson, using what was run or submitted.
- **Code files:** `.py`; HTML as a `.zip` or single-file `.html`; Scratch as `.sb3` and LaunchPad JSON.
- **The `.sb3` translator:**
  - Uses shadow blocks for menus and an MD5 implementation for asset names.
  - Turns emoji costumes into PNG or SVG.
  - Lists any blocks it couldn't map.
  - Storage CORS must allow the Pages origin.
- **Pictures:** stage and turtle PNGs, block-script PNGs and costume PNGs.
- The share link and the `/share/:id` viewer, with rule-enforced expiry and revoke.
- Uses fflate, loaded on demand.

**W2-d: P6-2 Stage** (`feature/python-stage`)
- **Engine and setup:**
  - Put the engine in `src/shared/stage/`, to keep open the pane, own-workspace and Turtle-extension options.
  - Register `stage` in `sys.modules` at worker init, rather than prepending code (which would break error lines).
- Record the draw commands, and draw them in a pane that appears once the code draws. On narrow screens it stacks above the console.
- Include the library from the request, with CSS, hex and PICO-8 colours.
- **Target and diff:**
  - `stageTarget` gives a ghost overlay and a diff toggle.
  - Use a pure-JS rasteriser, since jsdom has no canvas. Text and emoji are compared by command, not by pixel.
- **Checks:**
  - Add the five stage checks.
  - Hints name the colour.
  - In the CLI they report "needs a run".
- Add a screen-reader description, sync to the teacher card and Go Live, and keep the drawing serialisable.

### Wave 3 (4 agents)

**W3-a: Cross-lesson carry** (`feature/carry-from-lesson`)
- New fields `carryCodeFromLesson` and `carryBlocksFromLesson`, each `{lesson, task}`.
- When the tutor matches a student, the tutor client reads the roster work and writes it to the student's carry inbox.
- The task holds until then, with an override to use the starter.
- Falls back to the starter when nothing is saved, and logs that in `carryFallbackLog`.
- Includes validation, a Builder field and docs.

**W3-b: Typing history** (`feature/typing-history`)
- The tutor client appends matched students' keyboard results to `roster/{id}/typing`. Results from before the match are flushed once the student is matched.
- The tutor client also pushes each student's last and best scores to the student, for `showHistory` and a trend line.
- The card and StudentModal show last and best.
- The report shows each score next to the previous one, anonymised.

**W3-c: P6-3 Python slow-mo** (`feature/python-slow-mo`)
- **Recording:**
  - Install `settrace` before `__hs_run__`, and record lines from the student's file only (Turtle is offset by +2).
  - Each step records the line, any changed variables, output so far, and the turtle or stage command index.
  - Cap at 2,000 steps, with a plain message.
  - `input()` is asked during recording.
- **Playback:**
  - Controls: Slow-mo, Pause, Step, Step back, Restart, and a 0.25–4× speed slider.
  - Highlight the current line, and show a loop pass counter.
  - The name tags (from W1-f) update step by step. Output appears progressively, and the stage and turtle draw step by step.
  - Show the optional `question` when paused.
- Go Live broadcasts the recording and the step index.
- Report whether slow-mo was used and how many steps were viewed. Respect reduced motion.

**W3-d: P6-6 Scratch slow-mo** (`feature/scratch-slow-mo`)
- Add an `onBlockStart` hook in `runBlock`, and make the running blocks glow.
- **Step:** a global gate moves round-robin, one block per step across the ready scripts.
- Redraw the stage after every block.
- A timeline of snapshots you can swipe and click.
- Three or four large buttons, with icons and words.
- Go Live sync, report, and reduced motion.

### Wave 4 (1 agent)

**W4-a: P6-4 scrubbing** (`feature/editor-scrubbing`)
- Uses the `scrub` fields `numbers`, `colours` and `ranges`.
- CodeMirror 6 widgets or handlers for dragging numbers. On touch, a tap opens a slider; arrow keys also work.
- The colour picker shows named, colour-blind-safe colours first.
- **Live re-runs** happen only for Turtle, Stage and HTML/CSS.
  - They are debounced **preview runs**: no attempt log, no checks, and no `currentCode` write until the drag ends.
  - "Press Run" is shown when the code uses `input()`.
  - Skip a re-run while the previous one is still going.
  - The teacher's live view updates only when the drag ends, which keeps "render only on Run".
- Skip Arcade.
- Edits are real edits once the drag ends. Scrub interactions are recorded in the report.

## Rules for every agent

- Follow the AGENTS.md constraints, and answer the three tutor-visibility questions in the PR body.
- Use the kits and registries (definitions, `CHECKS`, `liveExtras`). No inline `lesson.type` checks.
- **Hotspots:**
  - In `lessonReport.js`, `useTeacherLivePublish.js` and `useStudentCodeState.js`, add your own helper file plus a small hook-up, so merges stay simple.
  - Live payload fields send an explicit `null` when cleared.
- **Docs:** update docs/authoring and the CHANGELOG (with the `Affects · Existing lessons · Resolves` tag line), and set the request to `Status: shipped` with a Resolution.
- Run prettier, eslint on touched files, and `npm run docs:check`. **Do not run tests**, though you may write them.
- If a change touches rules, add rules tests and say "rules deploy needed" in the PR body.
