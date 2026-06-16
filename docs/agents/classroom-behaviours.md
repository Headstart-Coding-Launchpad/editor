# Agent Reference: Classroom Behaviours

Load this when a task touches student/teacher classroom behaviour, live view, broadcast, sandbox, Pyodide, or carry-through.

## Code Carry-Through

- Check localStorage for `carryCodeFrom` before loading `starterCode`.
- HTML lessons carry each file independently by filename.
- Scratch `carryBlocksFrom` follows the same model.
- Fallback chain: saved carry, then starter content, then empty editor.

## Live View: `activeStudentView`

- Default expanded student view shows the last-run snapshot only; it does not stream.
- Streaming starts only when the teacher clicks "Go Live".
- On "Go Live", fetch once first, then set `activeStudentView`.
- While live, teacher sees the student's selected text/cursor plus short copy, paste, and click notices.
- Closing the modal by any route must clear `activeStudentView`: close button, outside click, Escape, or tab close.
- Firebase `onDisconnect` clears `activeStudentView` on unexpected teacher tab close.
- Only one student streams at a time.

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
