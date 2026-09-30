# Live Student Badges Plan

Status: **Approved for implementation (2026-09-30).** Interviewed and revised on 2026-09-30, then reviewed cold by a fresh
agent against the code and revised again. Branch `feature/live-badges`. Delivered as seven focused PRs
(see [PR sequence](#pr-sequence)).

**Implementation status:** all seven PRs, plus a polish PR 8 from hands-on testing, are **implemented; awaiting real-browser verification**
(see [Real-browser checks](#real-browser-checks-jsdom-cant-catch-these)):

| PR | Scope | Number |
|---|---|---|
| 1 | Foundations (`taskActivity.js`, registry, rules, authoring validation) | #388 |
| 2 | Live data (signals, decisions, sandbox archive) | #389 |
| 3 | Engine (`liveTimeline.js`, `useBadgeSuggestions`) | #390 |
| 4 | Tutor UI (`BadgeSuggestionsPanel`, `BadgeAwardDialog`, `badgeDisplay.js`) | #391 |
| 5 | Celebration (`celebration.js`, `useBadgeCelebrations`, card, toast, pill, sticker sheet) | #392 |
| 6 | Summary and report (`informationType: badges`, `badgeSummary.js`, `reportMetrics.js`) | #393 |
| 7 | Admin and scaffold (`badgeCatalogue`, Admin → Badges, catalogue snapshot on awards, Builder Badge hints, `npm run new:badge`, `new-badge` skill, [ADR 0011](../adr/0011-live-badges-registry-and-rules.md)) | #394 |
| 8 | Polish from testing: smaller top-centre celebration card, bigger "earned a badge" class toast, grouped select-then-Award picker, one-row student top bar (icon-only 🎖️ button with the mute inside), one-line grid header (⋯ menu) and student modal header (Support / More), readable light-surface buttons, [animation ideas](animation-ideas.md) | #395 |

PR 7 deviations: an awarded catalogue badge copies `{ emoji, title, blurb }` onto its decision
(`decision.badge`), because students can't read Firestore `badgeCatalogue`; and the Builder's Badge
hints field shows (read-only) which badges the task's pattern triggers, a small slice of the
"Builder showing which badges a task can suggest" idea listed under
[Considered, not in v1](#considered-not-in-v1).

Source brief: "Live Student Badges". It recognises good learning behaviour as it happens, keeps the
tutor in control, and has no points, totals, rankings or leaderboard.

> **Core principle:** make good learning behaviours visible, rewarding and socially engaging without
> turning coding into a competition.

## Decisions

These are fixed for this plan.

| Topic | Decision |
|---|---|
| Modes | **Live only for v1.** Rules *suggest* and the tutor decides. Solo badges are deferred (see [Later](#later)); the engine is built so solo can be added without rework. |
| Manual awards | **Every badge can be awarded manually by the tutor**, rule-backed ones included. Rules only add automatic suggestions. |
| Auto-award | Suggest by default. A tutor session toggle, **Auto-award high-confidence badges**, lets badges marked `autoAwardable` skip the click. Any award can be revoked. |
| Task kind | **Parse the existing `taskActivity` string** into the Glossary pattern it names. No lesson re-tagging. A per-task `badgeHints` override covers edge cases. |
| "First in class" | Bug Hunter, Code Builder and Code Detective are suggested for the first student in the class to do it, per task. The announcement never says "first": it reads "Alex · Bug Hunter". |
| Other rules | Code Fixer after a real console error; Persistence after 2+ failed tries with different code; Resourceful Coder on opening the Topic Library; Keyboard Wizard on a shortcut from a short list; Ready to Code on a real edit within 10 s; Quiz Master at 80%+ right first time. |
| Tutor-only | Knowledge Builder and Project Explorer (quizzes are single pass/fail questions, and students can't move ahead in live mode), plus the judgement badges. |
| Lesson-specific badges | **Not part of this system.** The brief's §6 badges, and the content workspace's concept, capstone and Level badges, stay separate. |
| Announcements | Every award announces to the class by default (the tutor can untick it). A bulk award produces **one merged toast**. |
| History | **Session only**: the session report and the end-of-lesson summary. No cross-lesson sticker book. |
| Adding badges | A code registry (rules, scaffold, skill) for built-in badges, plus an Admin-editable catalogue of manual-only badges that needs no deploy. |
| Class wall | **Grouped by badge** ("🐛 Bug Hunter: Alex, Sam"), never by student, so the layout never invites comparison (a determined reader could still tally names). |
| Animation | CSS badge flip plus shine, and a **subtle** two-note chime. No new dependencies. The rest of the app stays calm. |
| Sandboxes | Signal badges count in sandboxes. The report records the teacher sandbox in full, as a possible lesson gap, and personal sandboxes as activity only. |
| Data model | Approved: RTDB `sessions/{lessonId}/badges`, `badgeSettings` and `studentSignals`; a top-level RTDB `sessionArchive/{lessonId}` for sandbox code (added after the review, approved 2026-09-30); `attemptLog.error` and `pasteLog.firstAt`; Firestore `badgeCatalogue`. Details are [below](#data-model). The solo localStorage key was approved but is deferred along with solo. |

## What the codebase gives us (verified)

- **No event stream.** The teacher's client already subscribes to the whole `sessions/{lessonId}` node
  (`useSession.js:78-84`). A teacher-side engine can derive most signals from that snapshot, using
  `attemptLog`, `supportRevealLog`, `overrideLog`, `pasteLog` and `teacherAssisted`.
- **`taskActivity` is free text** (`src/shared/taskFields.js:39`, validated only as a string in
  `src/shared/draftLesson.js:30`). Its vocabulary lives in the content workspace (`guides/Task Intent
  Format.md`, `Lesson Format Glossary.md`), and this plan brings it into the platform.
- **`attemptLog` is written only for checked tasks in the lesson phase** (`runWithRuntime.js:285-298`),
  from seven call sites in `useStudentCodeState.js`.
  - Its de-duplication only compares a submission with the *previous* one, held in a browser-tab
    cache (`useSession.js:881-904`). That cache is empty after a reload.
  - So separate entries **don't** guarantee different code; rules must de-duplicate by hash
    themselves.
  - A passing entry carries a server `passedAt`, which gives first-in-class ordering.
- **Complete-code views aren't logged.**
  - "Show complete code" (`useStudentCodeState.js:2376-2392`) and the student's complete preview
    (`:2370`) are local only.
  - A teacher remote reset to the complete code isn't logged either.
  - Only the teacher's auto-reveal "solution" setting reaches `supportRevealLog`.
  - The guard therefore needs a new signal.
- **`pasteLog`** holds `{ count, chars, lastAt }`, with `lastAt` overwritten (`useSession.js:1063-1071`),
  so "a paste before the pass" can't be ordered without a new `firstAt`.
- **The Topic Library** only syncs the topic open *right now*. The library button, related-topic pills
  and `InlineMarkdown` cards report nothing.
- **Runtime errors** appear only as the latest `lastRunStatus`, which is overwritten.
- **`CodeEditor.jsx`** fires `onChange` on *any* document change (`:271-274`). That includes the value
  sync when code is loaded by task switch, carry-through or a sandbox push (`:334-344`). "First edit"
  needs a real-input callback.
- **Clocks differ:**
  - `taskStartTimes` is the teacher's `Date.now()` (`useSession.js:203-209`).
  - `lastActivityAt` is a throttled heartbeat that also fires on mouse moves.
  - Ready to Code therefore times on the student's own device.
- **Sandbox runs already write `currentCode`** (`runWithRuntime.js:266-278`), which the teacher
  receives. Sandbox content is currently discarded ("never saved", `classroom-behaviours.md:191`);
  this plan changes that for the teacher sandbox and updates that doc.
- **Payload rule:** everything under `sessions/{lessonId}` streams to every client, which is why
  `sharedWorkspacePayloads` sits outside it (`runtime-model.md:311`). Code blobs must not go in it.
- **The presentation window** has its own id and `teacherPresentation` flag. Presence reporting is gated
  on it (`useStudentPresenceReporting.js:28`), and every new writer must be gated the same way.
- **`endSession`** nulls `students`, `overrideLog`, `supportRevealLog` and `taskRatingLog`
  (`useSession.js:140-162`), but not `attemptLog`, `carryFallbackLog` or `taskStartTimes`. The report is
  built synchronously *before* `endSession` (`TeacherView.jsx:395-397`).
- **`snap.val()`** builds a new object tree on every write, so memoising by reference never hits.

## Architecture

```
  teacher client:  session snapshot ──► buildLiveTimelines() ──► evaluateBadgeRules(classTimelines)
                                                              (pure, deterministic)
                                                                        │
                                   suggestions[] { badgeId, studentId, taskId, reason }
                                                                        │
                         minus decided keys → Suggestions panel → Award / Dismiss (or auto-award)
                                                                        │
                                          badges log → student celebration + class toast
```

- **Rules read timelines, not Firebase.** A *timeline* is a normalised, ordered event list per student.
  Every event carries `context: 'task' | 'sandbox' | 'personal'`.
  - `attempt { taskId, passed, firstTry, error, assisted, submissionHash, at }`
  - `sandbox_run { error, submissionHash, at }`
  - `topic_open { topicId, taskId, source: student|teacher, at }`
  - `reveal { taskId, stage, complete }`
  - `complete_shown { taskId, at }`
  - `paste { taskId, firstAt }`
  - `override { taskId }`
  - `shortcut { shortcutId, at }`
  - `first_edit { taskId, elapsedMs }`
- **Timeline scope.**
  - Timelines are built only for students on the current roster, so removed students can't hold a
    first-in-class slot.
  - Only tasks still in the (possibly session-edited) lesson are included, which covers tasks removed
    via Edit Lesson.
- **Rule inputs and outputs.** Rules receive every student's timeline, so the first-in-class rules can
  compare students. Rules never touch Firebase or React, so a later solo timeline builder can reuse them
  unchanged.
- **Suggestions are not stored.** They are recomputed from the snapshot, so they survive a teacher
  reload. Only *decisions* (awarded, dismissed, revoked) are written.
- **Where it runs:** `TeacherView` via `useBadgeSuggestions(session, lesson)`, memoised on a serialised
  per-student input key (not object identity).
- **Composed lessons.** Tasks resolve through the per-task effective lesson, never `lesson.type`.

### Central anti-gaming guards

A pass is **not real** if any of these hold, and every rule inherits this. The data for each guard is
named in brackets.
- teacher-assisted (`teacherAssisted` on the attempt)
- teacher override or move-on (`overrideLog`)
- complete code shown or previewed, or a teacher reset to complete, before the pass (`studentSignals.completeShown`)
- the complete stage revealed before the pass (`supportRevealLog`)
- a large paste on that task before the pass (`pasteLog.firstAt`)

The presentation window and Builder preview never write signals.

Each badge is suggested **at most once per student per lesson**. Nothing rewards run counts, code
volume or time on platform. Ready to Code and the first-in-class badges do reward being quick; that was
a deliberate choice on 2026-09-30.

### First-in-class: the exact computation

A pure function of passes, so a later award or dismissal never moves an earlier suggestion.

1. List the qualifying tasks for the badge, ordered by each task's earliest qualifying real pass.
2. For each task in that order, the winner is its earliest qualifying student who:
   - hasn't already been picked for this badge earlier in the same computation, and
   - had no decision on this badge dated before this task's earliest pass.
3. Remove winners whose `badges/{id}/{badgeId}` key is already decided.

A **dismissal uses up the task**: nobody else is suggested for it. A later task can still go to someone
else.

## Task kind: `taskActivity` parser

- **New `src/shared/taskActivity.js`,** the platform copy of the Glossary vocabulary:
  - `TASK_ACTIVITY_FORMATS`: Information, Quiz, Code Task, Arrange Task, Activity.
  - `TASK_ACTIVITY_PATTERNS`: Complete Example, Meaningful Change, Copy the Code, Debug Code Task,
    Challenge (Open-Ended), Take It Further, Make It Your Own, the `Quiz:` patterns, and so on.
  - `parseTaskActivity(str)` returns `{ format, pattern, known }`. It tolerates case, whitespace, and
    `,` vs `:` separators.
- **Validator:** a **warning**, not an error, for an unrecognised pattern. The message is listed in
  `validation-errors.md`.
- **`lessons capabilities`** lists the patterns.
- **Coverage audit (PR1):** a one-off script counts published lessons' tasks per recognised pattern,
  and whether each has a `check` (attempts are logged only for checked tasks). The results are
  reviewed before PR3.
  - The author confirmed that Challenge (Open-Ended) tasks do have checks; the audit verifies coverage across the other patterns.
- **Content workspace follow-up (outside this repo):** `guides/Task Intent Format.md` should point at
  this file as the source of truth.

## Badge catalogue

### Registry (code)

- **Definition files:** `src/badges/definitions/<id>.js` export `defineBadge({...})`:
  ```js
  export default defineBadge({
    id: 'bug_hunter',
    emoji: '🐛',
    title: 'Bug Hunter',
    blurb: 'Found and fixed a bug.',          // student card and toast hover
    rule: firstInClassOnPattern('debug_code_task'),
    reasonText: ({ taskTitle }) => `First to fix the bug in “${taskTitle}”`,
    autoAwardable: true,                      // eligible for the auto-award toggle
    examples: [                               // run by one generic test for every badge
      { name: 'earliest real pass wins', timelines: {...}, expect: [['alex', 't3']] },
      { name: 'assisted pass ignored', timelines: {...}, expect: [] },
    ],
  })
  ```
  - Tutor-only badges omit `rule`.
  - `reasonText` gets plain values captured at compute time, and the reason is stored on the decision,
    so a task later removed by Edit Lesson can't break it.
- **Registry files:** `src/badges/registry.pure.js` (Node-safe) and `src/badges/registry.js`, mirroring
  the activities registry.
- **Rule helpers** in `src/badges/rules.js`:
  - `firstInClassOnPattern` (with a `firstTryOnly` option)
  - `realPassOnPattern`
  - `errorThenPass`
  - `uniqueFailsThenPass`
  - `anySignal`
  - `firstEditWithin`
  - `quizGroupFirstTry`

### Admin catalogue (Firestore, manual-only)

- **Storage:** `badgeCatalogue/{id}` holds `{ emoji, title, blurb, archived, updatedAt, updatedBy }`.
- **Access:** admin write, teacher read.
- **Admin Portal:** a new **Badges** tab lists registry badges (read-only) and lets admins add, edit
  or archive manual ones.
- **Ids and emoji:** ids must not collide with registry ids, and emoji must be unique across all
  badges. Both are enforced on save.
- **Archiving:** archived badges leave the picker but still render in old reports.

### Lesson authoring

Lessons define no badges; they can only tune the built-in rules.

```yaml
badgeOptions:                     # optional, lesson envelope
  quizMasterThreshold: 0.8        # default 0.8
  quizMasterMinQuizzes: 3         # default 3
  persistenceMinFails: 2          # default 2 unique failed submissions
  readyToCodeSeconds: 10          # default 10
```

```yaml
badgeHints:                       # optional, per task
  suggest: [bug_hunter]           # treat a real pass here as that badge's trigger
  suppress: [code_fixer]          # never suggest this badge from this task
```

- **Validation errors:** unknown badge ids in `badgeHints`, and out-of-range `badgeOptions`
  (a threshold outside 0–1, or a count below 1).
- **Docs:** `lesson-schema.md`, `lesson-schema-yaml.md`, a new `docs/authoring/badges.md` (pattern →
  badge, and badge × module coverage), and a CHANGELOG entry.
- **Builder:** a "Badge hints" field on the task editor. `badgeOptions` is YAML-only in v1.

## The v1 badge set

Definitions used below:
- A **real pass** is a passing `attemptLog` entry with none of the [guards](#central-anti-gaming-guards).
- A task's **pattern** comes from its `taskActivity`, and `badgeHints` can add or suppress badges.
- A **quiz group** is a lesson task group (`type: group`) containing at least `quizMasterMinQuizzes`
  graded quiz tasks.
- A **graded quiz** is multiple choice, match, fill in the blanks, or short answer with a check.
  Confidence checks are excluded.

| Badge | Suggested when (exactly) | Reason the tutor sees | Auto-awardable |
|---|---|---|---|
| 🐛 Bug Hunter | [First in class](#first-in-class-the-exact-computation) by earliest real pass on a `Debug Code Task` | "First to fix the bug in *Task 6*" | ✅ |
| 📋 Code Builder | First in class by earliest real pass on a `Copy the Code` task (Complete Example excluded: nothing to type) | "First to build *Task 3* from the example" | ✅ |
| 🔍 Code Detective | First in class among students whose **first** attempt was correct on a `Quiz: What Is the Error?` / `Quiz: Fix a Common Bug` task | "First to spot the error in *Task 8*, first try" | ✅ |
| 🔓 Challenge Solver | A real pass on a `Challenge (Open-Ended)` task, with no support stage revealed on it before the pass (checked tasks only) | "Solved *Task 9* without references" | ✅ |
| 🎯 Quiz Master | In a quiz group, at least `quizMasterThreshold` of its graded quizzes were right on the first attempt. Evaluated once the student has attempted all of them, or the tutor has advanced past the group; unattempted questions count as not right | "End Quiz: 4 of 5 right first time" | ✅ |
| 🔧 Code Fixer | **Task:** an attempt with `error: true`, then a later real pass with a different `submissionHash`, on a non-Debug task. **Sandbox:** a `sandbox_run` with an error, then a later error-free run with different code. The earliest occurrence supplies the reason | "Fixed a *NameError* in *Task 5*" / "Fixed an error in the sandbox" | – |
| 🔨 Persistence | On a code or Code Arrange task (no quizzes), at least `persistenceMinFails` **unique** failed `submissionHash` values, then a real pass | "3 different tries, then passed *Task 5*" | – |
| 📚 Resourceful Coder | A `topic_open` with `source: student` (library button, topic link or topic card), in a task or a sandbox | "Opened *Loops* in the Topic Library" | – |
| ⌨️ Keyboard Wizard | A `shortcut` from the [list](#keyboard-wizard-shortcuts), in a task or a sandbox | "Used *Ctrl+Enter*" | – |
| 🚀 Ready to Code | On a code task (any module), `first_edit.elapsedMs` ≤ `readyToCodeSeconds` × 1000 | "Started 6 s into *Task 2*" | – |
| 🧠 Problem Solver · 🧪 Experimenter · 💡 Creative Coder · 😂 Comedy Coder · 🧘 Focused Coder · 🧭 Project Explorer · 📈 Knowledge Builder · 🤝 Helpful Coder | Tutor-only | – | – |

- **Manual picker.** Every badge in this table is in the tutor's manual picker. The rules only decide
  suggestions.
- **One task can produce several suggestions.** Persistence and Code Fixer can both be suggested for
  the same task.
- **Module coverage.** Scratch has no Topic Library and no console, so Resourceful Coder and Code Fixer
  never fire there. PR2 wires Arcade's errors into `error`.
- **Ready to Code: what counts as an edit.**
  - It's measured on the student's device with `performance.now()`, from when the task first
    rendered for them or when they joined, whichever is later.
  - It counts only **real input**:
    - CodeEditor transactions marked as user input, delete or move (`onUserEdit`)
    - Blockly user events that create, delete or move a block to a new position or parent
    - an equivalent user event in the other modules' work areas
  - Loaded or carried code, a stage sprite drag, and picking a block up and dropping it back in the
    same place don't count.

### Keyboard Wizard shortcuts

These are listed in one constant (`src/badges/shortcuts.js`) so the list is easy to extend. Keys are
detected on the lesson work area (editor, Blockly or Desktop surface), not the whole window.

| Shortcut | Keys |
|---|---|
| Run | Ctrl/Cmd+Enter |
| Undo / redo | Ctrl/Cmd+Z, Ctrl/Cmd+Y, Ctrl/Cmd+Shift+Z |
| Toggle comment | Ctrl/Cmd+/ |
| Indent / outdent | Tab, Shift+Tab (in the editor) |
| Delete | the Delete key (forward delete, or deleting a selected block) |
| Find | Ctrl/Cmd+F |
| Save | Ctrl/Cmd+S |
| Desktop apps | shortcuts done by keyboard rather than menu (from the Desktop input recorder) |

Copy, cut, paste and select-all aren't on the list. AltGr combinations (which report as Ctrl+Alt) and
keys pressed inside iframes (the HTML preview, Arcade) are ignored. The iframe gap is a known v1 limit.

## Data model

Everything here was signed off on 2026-09-30 (`sessionArchive` was approved after the review). Each change updates `database.rules.json` plus the rules
tests (`npm run test:rules`), `docs/agents/runtime-model.md`, and the `createSession` / `endSession`
resets.

- **`sessions/{lessonId}/badges/{anonymousId}/{badgeId}`**
  - **Holds:** `{ status: 'awarded'|'dismissed'|'revoked', source: 'rule'|'auto'|'manual', reason,
    taskId, announce, bulkId?, decidedAt }`.
  - **Teacher-write only:** it inherits the `$lessonId` teacher write, and a rules test proves students
    can't write it.
  - **Writes are write-if-absent transactions**, so two teacher tabs can't double-award, and an award
    can't race a dismissal. Revoke is an explicit status change.
  - **Lifetime:** a sibling of `students`, so `setTaskId` doesn't touch it. **`endSession` does not
    clear it**, so a student who reloads the end screen still sees their moments. `createSession` clears
    it, as it does `attemptLog`.
- **`sessions/{lessonId}/badgeSettings`:** `{ autoAward, soundsOff }`, teacher-write.
- **`sessions/{lessonId}/studentSignals/{anonymousId}`:** student-write for their own id only, in the
  same pattern as `supportRevealLog`. No code is stored here. It holds two kinds of data:
  - **First occurrence only**, a handful of writes per lesson:
    - `topics/{context}/{taskId}/{topicId}`: `{ openedAt, source }`
    - `shortcuts/{shortcutId}`: `{ firstUsedAt, context, taskId }`
    - `firstEdits/{taskId}`: `{ elapsedMs }`
    - `completeShown/{taskId}`: `{ at, via: 'show'|'preview'|'teacherReset' }`
  - **Per-run counters**, never per keystroke:
    - `sandbox/{session|personal}`: `{ timeMs, runs, errorRuns, fixes, runsLog }`, where `runsLog` is
      the last 20 `{ at, error, submissionHash }` entries, enough to order a sandbox fix.
- **`sessionArchive/{lessonId}`:** a top-level node, teacher-write and teacher-read, that no client
  subscribes to live (the same idea as `sharedWorkspacePayloads`). It holds one entry per teacher
  sandbox visit: `{ enteredAt, exitedAt, previousTaskId, explainer, pushes: [{ at, code | files }],
  studentSnapshots: { [anonymousId]: { code | files, at } } }`.
  - **Pushes** are appended by `enterSandbox`, `pushSandboxExplainer` and the push-code/files actions.
    "After Task N" uses `previousTaskId`, not the `setTaskId` that `handleGoLiveSandbox` may call on
    composed lessons.
  - **Student snapshots** are copied on the teacher side from each student's existing `currentCode` /
    `currentFiles` whenever a sandbox run updates it. That needs no new student write and no timer.
  - **Missing exit time:** when the session ends from the sandbox, `exitedAt` defaults to `endedAt`.
  - **Keys:** file keys use `encodeFileKey`.
  - **Size caps:** 20 KB per snapshot or push, truncated with a marker.
- **`attemptLog` entries:** gain an optional `error: true` when the run produced a real console error.
  It's added at all seven `logAttempt` call sites, including HTML runtime errors and Arcade.
- **`students/{id}/pasteLog/{taskId}`:** gains `firstAt`, the first large paste on that task.
- **Firestore `badgeCatalogue/{id}`:** admin write, teacher and admin read.
- **Session report** (existing `sessionReports` doc). `buildSessionReport` reads all of the above
  before `endSession` runs, and the teacher-sandbox code is copied from `sessionArchive` into the
  report.
  - **Per student:**
    - `badges: [{ badgeId, emoji, title, source, reason, taskId, awardedAt }]`
    - `topicsOpened`
    - `shortcutsUsed`
    - personal-sandbox `{ timeMs, runs, errorRuns, fixes }`
  - **Per student, per task:** `timeToFirstEditMs`, `errorAttempts`, `uniqueFailedAttempts`,
    `firstPassInClass`.
  - **Per task:** the median and range of time to first edit, students who hit a console error, Topic
    Library opens (student vs tutor-sent), and the first real pass (who, and how long after the task
    opened).
  - **Per quiz group:** each student's first-try %, and the class median.
  - **Teacher sandbox:** each visit from `sessionArchive`, flagged as a *possible lesson gap*.
  - **Top level:**
    - `badgeSummary: { [badgeId]: { suggested, awarded, autoAwarded, manual, dismissed, revoked } }`,
      where `suggested` = rule-sourced decisions + suggestions still pending at session end
    - `shortcutSummary: { [shortcutId]: studentCount }`
  - **Size:** the report is checked against Firestore's 1 MiB limit. If it's over, student snapshots
    are dropped first and a note is added.
  - **Report modal:** a **Coding moments** section (grouped by badge), new columns in the task and
    student views, and a sandbox callout. All of it is in the YAML export and follows the existing
    anonymised display.

## Tutor experience

- **Grid header:** a **🏅 Suggestions (n)** item in the header's ⋯ menu, next to Nudge Away (PR 8: a dot on ⋯ shows while one is pending).
- **Suggestions panel:** a collapsible panel in the centre column (`TaskRatingPanel` pattern).
  - Suggestions are grouped by student. Each shows its emoji, title and reason, **[Award]
    [Dismiss]**, and "announce to class" (default on).
  - **Award all** for a badge suggested to several students sends one merged announcement.
  - The **Auto-award high-confidence** toggle sits at the top.
- **Student card:** a 🏅 dot while a suggestion is pending, plus a teacher-only **badge count**
  ("🏅 2"). The count is also shown in the student modal header. It never appears on student screens
  or the presentation window.
- **Student modal:** More → **🏅 Award badge** opens a picker with every badge (rule-backed,
  tutor-only and Admin-catalogue), grouped in those three sections. PR 8: selecting a badge shows
  its rule, and an explicit **Award** button confirms it.
  - Already-held badges are greyed out.
  - Hovering a badge shows its exact rule.
  - The student's awarded list has **Revoke**, which is silent to the student.
- **Multi-award:** select several cards, then Award badge. It sends one merged announcement.
- **Sounds off:** a session control that silences the chime for the whole class.
- **Timing:** awarding takes one click and is never modal.

## Student experience

- **Recipient celebration:**
  - A small card drops down top-centre, just under the top bar, and flips in (3D `rotateY`) with
    one shine sweep, showing the emoji, title and blurb (PR 8; it was centred and larger).
  - After about 2.5 s it docks into a compact, icon-only **🎖️** button in the top bar (no count),
    whose popover lists their own badges.
  - A subtle, low-gain two-note chime plays, reusing the nudge audio engine.
  - It never steals editor focus.
  - `aria-live="polite"` announces it.
  - `prefers-reduced-motion` gets a plain fade.
  - It isn't replayed on reload (load-baseline, as `useNudgeAlert` does). Awards made while offline
    still appear in the pill.
- **Class toast (every classmate's screen):**
  - A silent pill in the bottom-left corner that slides in with a soft glow, "🎖️ Alex earned a
    badge: 🐛 Bug Hunter" (PR 8: about 1.5× the original size).
  - It shows for about 4 s, and the blurb appears on hover.
  - A bulk award shows **one** toast: "🎖️ 12 students earned a badge: ⌨️ Keyboard Wizard".
  - Toasts are queued one at a time and dropped if the queue backs up.
  - The recipient doesn't see the toast; they get the celebration instead.
- **Presentation window:** the same toast, scaled up for the board, for about 4.5 s.
- **Mute:** a speaker toggle in the 🎖️ popover silences the chime on that device for the session. It's kept
  in memory only, with no new localStorage key.
- **Session-end screen:** shows the student's own moments as a sticker sheet, read from the `badges`
  node that `endSession` now keeps.
- **Nowhere** are totals, ranks, "top student" or comparisons shown to students.

## Badge Summary task

- **Task:** `taskType: information` with a new `informationType: badges` ("Today's Coding Moments").
  It follows the `introduction` pattern in `InformationTask.jsx`. The explainer is optional, and the
  task is usually placed last.
- **Student:** their own badges as a sticker sheet flipping in one by one, then the class wall grouped
  by badge. A student with no badges gets a warm class celebration, with no empty-state shaming.
- **Teacher:** a projector-friendly class wall grouped by badge.
- **Copy class summary:** on the teacher's Badge Summary and in the report. It copies the moments as
  plain text grouped by badge. In the report it uses real names only when the tutor reveals them.
- **Solo (v1):** the task is skipped, as if it were `taskMode: live`.

## Sandboxes

- **Badges:**
  - These can come from sandbox work: ⌨️ Keyboard Wizard, 📚 Resourceful Coder, and the sandbox
    version of 🔧 Code Fixer.
  - These can't, because they need a task with a check: the pass-based badges and Ready to Code.
  - 🧭 Project Explorer stays tutor-only.
- **Teacher sandbox in the report, in full**, as a *possible lesson gap*. The report shows:
  - when the class went in and for how long
  - which task it followed
  - everything the tutor added (the explainer and each push)
  - each student's last sandbox code, with their runs, errors and fixes

  It's shown as a callout, for example "The class spent 14 min in the teacher sandbox after Task 7".
  `classroom-behaviours.md` is updated, because teacher-sandbox content is no longer discarded.
- **Personal sandbox in the report:** activity only (time, runs, error runs, fixes). No code is stored.

## Adding a new badge

1. **Rule-backed:** `npm run new:badge -- <id>` scaffolds a definition with a rule stub and two
   examples, and registers it. The generic test runs its examples. The `new-badge` skill covers the
   rest.
2. **Manual, no deploy:** Admin Portal → Badges → Add.
3. **A new signal:** add an event type to the timeline builder. A new logged field needs its own
   data-model sign-off, and `docs/authoring/badges.md` lists signals.

## PR sequence

Each PR has tests green, `npm run docs:check` and doc updates, plus a CHANGELOG entry (with the
`Affects · Existing lessons · Resolves` line) wherever authoring changes.

1. **Foundations:**
   - `taskActivity.js` plus the validator warning
   - the coverage audit script and its results
   - the badge registry, rule helpers, all definitions and the generic examples test
   - `badgeOptions` / `badgeHints` validation, YAML round-trip and `lessons capabilities`
   - `docs/authoring/badges.md`, schema docs and CHANGELOG

   No UI.
2. **Live data:**
   - the `badges`, `badgeSettings`, `studentSignals` and `sessionArchive` nodes, `attemptLog.error`
     at all seven call sites, and `pasteLog.firstAt`
   - rules and rules tests
   - topic-open, shortcut, first-edit (`onUserEdit` on the shared `CodeEditor` plus Blockly user
     events) and complete-shown reporting, all gated off for the presentation window and preview
   - sandbox counters and teacher-side sandbox archiving
   - `runtime-model.md`, `classroom-behaviours.md` and `feature-impact-map.md`
3. **Engine:**
   - timeline builders and guards
   - the first-in-class computation
   - `evaluateBadgeRules`
   - characterisation tests from real session snapshots
4. **Tutor UI:**
   - suggestions panel, grid button, card dot and badge count
   - picker with hover definitions, and multi-award with a merged announcement
   - write-if-absent decisions, auto-award toggle, sounds off, revoke
5. **Celebration:**
   - recipient card, chime and mute, pill
   - compact and merged class toasts
   - presentation window, reduced motion
   - session-end screen moments
6. **Summary and report:**
   - `informationType: badges` (skipped in solo), Copy class summary
   - every report metric, the teacher-sandbox callout and personal-sandbox activity
   - the size cap, and the report modal and YAML
7. **Admin and scaffold:**
   - `badgeCatalogue` and its rules, the Admin Badges tab
   - `npm run new:badge`, the `new-badge` skill
   - an ADR for the badge registry

### Tests that must exist

- **First in class:**
  - It's deterministic after an award, a dismissal and a teacher reload.
  - A dismissal uses up the task.
  - Removed students are excluded.
- **Persistence:** A→B→A counts as 2 unique fails. A reload re-run of the same code doesn't add one.
- **Ready to Code:** loaded, carried or pushed code doesn't count, and clock skew between teacher and
  student has no effect.
- **Keyboard Wizard:** AltGr characters don't count, and listed shortcuts do.
- **Ending from the sandbox:** the archive and report are complete, and `exitedAt` = `endedAt`.
- **Concurrency:** two teacher tabs auto-awarding produce one decision.
- **Edit Lesson:** removing a task keeps its stored reason.
- **Rules tests:** students can't write `badges` or `sessionArchive`, or another student's
  `studentSignals`.
- **Report:** it stays under the size cap with 30 students and a long sandbox visit.

### Real-browser checks (jsdom can't catch these)

- **Every module, with a teacher tab and student tabs:** a suggestion, then Award, then the card flip,
  chime, pill and classmates' toast.
- **Reloads:** reload the teacher (dismissals kept) and the student (no replay).
- **Presentation window:** it shows the toast and never produces a suggestion.
- **Toasts:** a bulk award gives one toast, and the badge count never shows to students.
- **Keyboard Wizard:** Ctrl+Enter, Tab and Delete count, and clicking Run doesn't. Mac `Cmd` works.
- **Ready to Code:** typing and Scratch block drags count. Mouse moves, clicks and loaded code don't.
- **Sandbox:** a shortcut, a topic open and an error→fix suggest the right badges. The report shows
  the teacher sandbox and personal-sandbox activity.
- **Session end:** the end screen shows the student's moments, and still shows them after a reload.
- **Solo:** a run-through skips the Badge Summary task cleanly.
- **Focus:** typing is uninterrupted during the celebration.
- **Tablet:** everything works on a tablet.

## Not in v1

- Solo badges (see [Later](#later))
- Lesson-specific badges (a separate system)
- Points, totals shown to students, leaderboards, streaks, cross-lesson history, a per-device sticker book
- AI interpretation of behaviour
- Automatic Knowledge Builder or Project Explorer
- Keyboard Wizard inside iframes
- Any animation library

## Considered, not in v1

Raised on 2026-09-30 and not picked:
- a badges on/off switch per session, and an Admin per-rule kill switch
- a roughly 5 s undo window before an award reaches the student
- an optional personal note on manual awards
- the Builder and CLI showing which badges a task or lesson can suggest

## Later

- **Solo badges:**
  - Add a `buildSoloTimeline` feeding the same rules.
  - `soloAuto` badges award directly.
  - Persist to the already-approved localStorage key `headstart_{lessonId}_badges_{anonymousId}`.
  - Show the student's moments on the solo lesson-complete screen, and stop skipping the Badge Summary
    task.
- **▶ Celebrate** on the teacher's Badge Summary: steps every screen through the class wall.
- **Download my coding moments:** a canvas-rendered PNG card.
- **Rule tuning from reports:** an Admin view of `badgeSummary` dismissal rates across sessions.
