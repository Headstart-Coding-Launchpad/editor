# Agent Reference: Classroom Behaviours

Load this when a task touches student/teacher classroom behaviour, live view, broadcast, sandbox, Pyodide, or carry-through.

## Code Carry-Through

- Check localStorage for the authored carry source before loading starter content.
- If the immediate carry source has no saved state, walk the authored carry chain to the first earlier source with saved state. If the chain ends without saved state, use the current task starter content.
- Authored carry references can cross group boundaries; groups do not limit carry resolution.
- Saved empty content counts as real saved state; do not walk past it.
- HTML lessons carry each current `starterFiles` file independently by filename. Files not named in the current task remain hidden.
- Python and HTML use `carryCodeFrom`; Scratch uses `carryBlocksFrom`; filesystem uses `carryFsFrom`; electronics uses `carryCircuitFrom`.
- Live students write `carryFallbackLog/{anonymousId}/{taskId}` when carry-through walks past the immediate source and finds an earlier saved state. Session reports surface this as per-student `carryFallback` metadata plus task-level `carryFallbackCount`/`carryFallbacks`.
- Teacher presentation and builder preview persist to an in-memory ephemeral store (`ephemeralStorage` in `studentStorage.js`, routed via `createStudentPersistence`) so carry-through works there without reading or polluting real localStorage. The store is cleared on each presentation/preview mount. All persistence in these modes keys off `effectiveIdentity` (`teacher-presenter` in presentation).

## Live View: `activeStudentView`

- Default expanded student view shows the last-run snapshot only; it does not stream.
- Streaming starts only when the teacher clicks "Go Live".
- On "Go Live", fetch once first, then set `activeStudentView`.
- While live, teacher sees the student's selected text/cursor plus short copy, paste, and click notices.
- Closing the modal by any route must clear `activeStudentView`: close button, outside click, Escape, or tab close.
- Firebase `onDisconnect` clears `activeStudentView` on unexpected teacher tab close.
- Only one student streams at a time.

## Teacher Code Highlights: `teacherHighlights`

- Independent of `activeStudentView`/`teacherLive` — a teacher watching a student live (`StudentModal`) can select a character range in the mirrored, read-only `CodeEditor` and tag it with an emoji + optional short note.
- Stored as a map at `sessions/{lessonId}/students/{anonymousId}/teacherHighlights/{highlightId}` (RTDB `push()` keys, so any number can coexist across files/lines) — written by `pushTeacherHighlight`/`removeTeacherHighlight` in `useSession.js`.
- Each entry: `{ file (encodeFileKey'd), from, to, emoji, note, createdAt }`. Python tasks use an empty string for `file` (single-file, no tabs).
- Renders as a `Decoration.mark` + clickable emoji badge (`teacherHighlightsField` in `src/shared/CodeEditor.jsx`) in **both** the teacher's mirror and the student's own editable editor — the same dual-instance path `remoteSelection` already uses.
- Clicking the emoji badge removes that highlight (`onHighlightDismiss`) — this lets the teacher retract their own highlight from the mirror, or the student dismiss it from their own editor. Either side writes the same RTDB removal.
- Ranges are character offsets valid for the document as of creation; CodeMirror remaps them through edits within the same browser session, but a highlight can drift if the student reloads after edits happened elsewhere in the file — accepted tradeoff for character-exact (vs line-snapped) precision.
- Cleared automatically on task advance (`setTaskId` nulls `teacherHighlights` alongside the other per-student teacher-owned fields).

## Teacher Live Broadcast: `teacherLive`

- Separate from `activeStudentView`.
- Broadcasts the teacher's or a pinned student's screen to all students.
- Opens through `?teacher=true&present=true`.
- Broadcast code views stream selection/cursor plus copy, paste, and click notices.
- `onDisconnect` clears `teacherLive` automatically.

## Teacher Timers

- A task may define `estimatedMinutes` as a positive integer.
- Builder displays the lesson-wide estimated total.
- Starting a session sets `startedAt` and `currentTaskStartedAt`.
- Moving the class to a task or returning from sandbox restarts `currentTaskStartedAt`.
- Teacher view shows lesson elapsed time and a countdown for timed active tasks.
- Expired task timers flash.

## Remote Reset

- Teacher writes `remoteResetAction` and `remoteResetPushedAt` to one student node.
- Actions are `starter`, `complete`, or `stage_N`.
- Student detects timestamp changes and applies reset silently.
- `stage_N` resolves against `task.codeStages[N]`:
  - Python uses `.code`.
  - HTML uses `.files` and `.entryFile`.
  - Scratch uses `.blocks`.
  - Filesystem uses `.fs`.

## Explainer Complete-Code Reveal

Swaps the task explainer panel's content between the normal explanation and a read-only rendering of the complete solution — distinct from Remote Reset, which replaces the student's actual editor content. Python only.

- **Live (class-wide)**: `session.explainerShowComplete` (boolean, session root) — toggled by the teacher from a control in `TeacherView.jsx` itself, rendered above `TeacherEditorPanel`/`TeacherCodeTabs` rather than inside that tab strip (`setExplainerShowComplete` in `useSession.js`). Affects every connected live student at once; there is no per-student variant. Resets to `false` on `setTaskId`, `createSession`, and `endSession`.
- **Solo (self-serve)**: after interim `codeStages` are exhausted and `checkFailCount >= 2`, the student is offered "See complete code?" (`canOfferCompletePreview` in `StudentView.jsx`) before the existing "Load complete code into my editor" offer (`canOfferCompleteSolution`). Clicking preview sets local-only `completePreviewShown` state (`useCheckFeedback.js` / `cs.handlePreviewCompleteCode` in `useStudentCodeState.js`) — it does not touch the editor or mark the task solved. `completePreviewShown` resets on task change, code reset, or a passing check.
- Both paths feed a single `explainerShowsComplete` boolean into `LessonTaskContent.jsx`, which swaps `ExplainerPanel`'s `title`/`content` to a fenced ` ```python ` block of `task.completeCode` when true.
- Non-Python lesson types keep the original single-step "Load complete solution" offer (no preview step) since there's no read-only rendering for HTML/Scratch/filesystem solutions yet.

## Presenter Layout Toggle

- The presentation popup (`teacherPresentation`, `?teacher=true&present=true`) has a local-only three-way layout toggle in its top bar: **Explainer only / Both / Code only** (`presenterLayout` state in `StudentView.jsx`).
- Purely a display concern for that popup window — it hides/shows `LessonTaskContent`'s explainer pane and/or editor pane and is never persisted to Firebase or reflected to real students.

## Teacher-Forced Sandbox

- Student code is saved to localStorage before the editor clears on sandbox entry.
- Sandbox content is discarded on return to lesson and is never saved to localStorage.
- `sandboxCodePushedAt` and `sandboxFilesUpdatedAt` timestamps are change triggers.
- HTML sandbox stores files in Firebase `sandboxFiles` with `__dot__` encoded keys.
- Filesystem sandbox stores state as a JSON string in `sandboxCode`.

## Live Lesson Task Editing: `lessonOverrideTasks`

- `EditLessonModal` (launched from `TeacherSessionControls` → "Edit Lesson") reuses the builder's `TaskList`/`TaskEditor`/`GroupEditor`/`useBuilderState` to edit tasks without leaving TeacherView.
- Both TeacherView and StudentView compute an *effective* lesson via `applyLessonOverride(baseLesson, session?.lessonOverrideTasks)` — the fetched Firestore lesson with its `tasks` swapped for the live override when present. Every other lesson field is untouched.
- "Apply for This Session" (teacher or admin) calls `pushLessonOverride(tasks)`, writing to `sessions/{lessonId}/lessonOverrideTasks`. Currently connected students see the change immediately through their existing `useSession` listener — no page reload needed.
- "Save Permanently" (admin only) additionally calls `publishLessonTasks(lessonId, tasks)`, merge-writing `tasks` to the lesson's Firestore document, so future sessions start from the edited version too.
- Existing task IDs are never renumbered by this flow (`normalizeTasksForExport(tasks, { preserveIds: true })`) — `session.currentTaskId`, carry-through references, and student per-task localStorage keys all key off the original IDs and would desync if they changed mid-session. Only brand-new tasks get fresh IDs.
- "Reset to Original" calls `clearLessonOverride()`, reverting both views back to the canonical Firestore lesson.
- The override clears automatically on `createSession`/`endSession`, so a session restart always starts from the published lesson.

## Personal Sandbox

- Separate from teacher-forced `sandbox` session state.
- Available in both `lesson` and `solo` phases when the lesson defines sandbox starter content.
- Initial content comes from `lesson.sandboxStarterCode`, `lesson.sandboxStarterFiles`, or `lesson.sandboxStarterFs`.
- Persists in localStorage with pseudo-task ID `personalsandbox`.
- Survives task changes and teacher sandbox pushes.
- Solo mode shows "Open Sandbox" in navigation; closing returns to the lesson task.
- Live mode offers personal sandbox from `CheckFeedbackBanner` after a check passes.
- Teacher moving to the next task automatically returns live students to the lesson.
- Student writes `inPersonalSandbox: true` on entry and `null` on exit.
- Teacher sees personal sandbox state as a purple "Sandbox" badge in `StudentCard`.
- Task localStorage saves are skipped while in personal sandbox.
- Checks still run so the teacher can watch output, but results do not affect lesson progress.

## Pyodide

- Runs in a Web Worker and must not block the main thread.
- `stopPython()` terminates the worker to kill infinite loops.
- A replacement worker is pre-warmed immediately.
- `input()` is handled with a Python AST transform and resolves when `provideInput()` is called.

## File Key Encoding

- Firebase file keys cannot contain raw dots.
- Use `encodeFileKey` and `decodeFileKey` when reading/writing `currentFiles` or `sandboxFiles`.
- App state and localStorage use raw filenames with real dots.
