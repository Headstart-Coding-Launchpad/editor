# Live Student Badges Plan

Status: **Agreed, not started** (interviewed 2026-09-30, revised the same day, branch `feature/live-badges`).
Delivered as seven focused PRs (see [PR sequence](#pr-sequence)). Source brief: "Live Student Badges"
(recognise good learning behaviour as it happens; tutor stays in control; no points, totals, rankings or
leaderboard).

> **Core principle:** make good learning behaviours visible, rewarding and socially engaging without
> turning coding into a competition.

## Decisions

These answers from the interview and the same-day revision are fixed for this plan.

| Topic | Decision |
|---|---|
| Modes | **Live only for v1.** Rules *suggest* and the tutor decides. Solo badges are deferred (see [Later](#later)); the engine is built so solo can be added without rework. |
| Manual awards | **Every badge can be awarded manually by the tutor**, rule-backed ones included. Rules only add automatic *suggestions* on top; a manual award of a rule-backed badge is recorded with `source: 'manual'` and stops further suggestions of it for that student. |
| Live auto-award | Suggest by default. A tutor session toggle, **Auto-award high-confidence badges**, lets badges marked `autoAwardable` skip the click. Any award can be revoked. |
| Task kind | **Parse the existing `taskActivity` string** into the Glossary pattern it names. No lesson re-tagging. A per-task `badgeHints` override covers edge cases. |
| Brief items that don't fit the platform | **Tutor-only.** This covers Knowledge Builder and Project Explorer (quizzes are single pass/fail questions, and students can't move ahead in live mode). |
| "First in class" badges | Bug Hunter (Debug Code Task), Code Builder (Copy the Code) and Code Detective (error quizzes, correct on the first try) go to the **first student in the class** to do it, per task. Chosen deliberately, although it rewards being quick. |
| Code Fixer | Only after a **real console error** (syntax or runtime), then edited code, then a pass. |
| Persistence | **Rule-backed, suggest only.** At least **2** failed attempts with *different* code on one task, then a real pass. Quizzes are excluded (retrying multiple choice is guessing). |
| Resourceful Coder | **Rule-backed, suggest only.** The student opened the Topic Library themselves. |
| Keyboard Wizard | **Rule-backed, suggest only.** The student used **any** keyboard shortcut, copy and paste included. |
| Ready to Code | **Rule-backed, suggest only.** The first edit on a code task landed within **10 s** of the task opening, or of the student joining if they arrived later. Scratch block drags count as edits. |
| v1 additions (2026-09-30) | A teacher-only **badge count** on each student card · the student's moments on the **session-end screen** · **sound controls** · **Copy class summary** · every new badge metric in the **session report** · **sandbox work** in badges and the report (see [Sandboxes](#sandboxes)). |
| Quiz Master | At least 80% right on the first try across a quiz group of 3+ graded questions. |
| Lesson-specific badges | **Not part of this system.** Per-lesson badges (the brief's §6, and the content workspace's concept, capstone and Level badges) stay separate. |
| History | **Session only.** Named badges in the session report plus the end-of-lesson summary. No cross-lesson sticker book. |
| Adding badges | **Both:** a code registry (with rules, scaffold, skill) for built-in badges, plus an Admin-editable catalogue of manual-only badges that needs no deploy. |
| Class wall | **Grouped by badge** ("🐛 Bug Hunter: Alex, Sam"), never by student, so nobody can count. |
| Animation | CSS badge flip plus shine, and a **subtle** two-note chime. No new dependencies. The rest of the app stays calm. |
| Data model | Approved: RTDB `badges` and `studentSignals` nodes, and Firestore `badgeCatalogue` (details [below](#data-model)). `studentSignals` merges the earlier `topicLog` / `shortcutLog` ideas, first edits and sandbox activity. A teacher-written `sandboxLog` records the teacher sandbox. A solo localStorage key was approved but is deferred along with solo. |

## What the codebase already gives us (and what it doesn't)

- **No event stream.** The teacher's client already subscribes to the whole `sessions/{lessonId}` node,
  so a teacher-side engine can derive nearly everything from the snapshot. The sources are:
  - `attemptLog`: fail→pass history for checked tasks
  - `supportRevealLog`
  - `overrideLog`
  - `pasteLog`
  - `teacherAssisted`
- **`taskActivity` is free text** (`src/shared/taskFields.js:39`, validated only as a string in
  `src/shared/draftLesson.js:30`). Its vocabulary lives in the content workspace (`guides/Task Intent
  Format.md` and `Lesson Format Glossary.md`). This plan brings the vocabulary into the platform.
- **Quizzes** are one graded question per task with free retries, so "first try" means the first
  `attemptLog` entry for that task passed.
- **`attemptLog` de-duplicates:** re-running the same code bumps `retries` rather than adding an entry.
  So distinct failed entries mean distinct code, which is what Persistence needs.
- **The Topic Library** only syncs the topic open *right now* (`students/{id}/currentTopicId`), and the
  library button, related-topic pills and `InlineMarkdown` cards report nothing. This needs a small log.
- **Runtime errors** are visible only as the latest `lastRunStatus`, which is overwritten. Code Fixer
  needs an `error` flag on the attempt entry.
- **Shortcuts:**
  - `Mod-Enter` runs through the same handler as the Run button, so today the two can't be told apart.
  - Copy and paste are reported.
  - The Desktop input recorder already counts keyboard vs menu shortcuts.

  Keyboard Wizard needs the student side to report that a shortcut fired.
- **Typing:** `students/{id}/lastActivityAt` is a throttled heartbeat that also fires on mouse moves,
  so it can't tell typing from moving the mouse. Ready to Code needs a first-edit timestamp per task.
- **"First in class":** every passing `attemptLog` entry carries a server `passedAt`, so the first
  real pass per task is exact and survives a teacher reload.
- **Solo syncs nothing** and keeps pass/fail in memory only (one reason solo is deferred).
- **Session reports** are built in `src/shared/lessonReport.js` and saved before `endSession` wipes the
  logs. They display anonymised ("Student N").
- **No animation library.** There are CSS keyframes in `src/index.css`, and the nudge chime
  (Web Audio) is in `src/app/nudgeAlert.js`.

## Architecture

```
  teacher client:  session snapshot ──► buildLiveTimeline() ──► evaluateBadgeRules
                                                          (pure, deterministic, per student)
                                                                        │
                                   suggestions[] { badgeId, studentId, taskId, reason }
                                                                        │
                         minus decided keys → Suggestions panel → Award / Dismiss (or auto-award)
                                                                        │
                                          badges log → student celebration + class toast
```

- **Rules read a timeline, not Firebase.** A *timeline* is a normalised, ordered event list per
  student:
  - `attempt { taskId, passed, firstTry, error, assisted, submissionHash, at }`
  - `topic_open { topicId, taskId, source: student|teacher, at }`
  - `reveal { taskId, stage, complete }`
  - `paste { taskId }`
  - `override { taskId }`
  - `show_complete { taskId }`
  - `shortcut { shortcutId, at }`
  - `first_edit { taskId, at, taskOpenedAt }`

  Rules also receive the whole class's timelines, so "first in class" rules can compare students.

  Rules never touch Firebase or React, so a later solo timeline builder can reuse them unchanged.
- **Suggestions are not stored.** They are recomputed from the snapshot, so they survive a teacher
  reload for free. Only *decisions* (awarded, dismissed, revoked) are written.
- **Where the engine runs:** in `TeacherView` via `useBadgeSuggestions(session, lesson)`, memoised
  per student.
- **Composed lessons.** Rules resolve each task through the per-task effective lesson, never
  `lesson.type`.

### Central anti-gaming guards

A pass is **not real** when any of these hold. The guards are applied once, in the timeline builder,
so every rule inherits them:
- teacher-assisted
- teacher override or move-on
- "Show complete code"
- the complete stage was revealed before the pass
- a large paste on that task before the pass

The presentation window never enters a timeline. Sandbox work does, but only for the badges listed
under [Sandboxes](#sandboxes); the pass-based rules need a task and a check, which sandboxes don't have.

Every badge is suggested **at most once per student per lesson**. Nothing rewards run counts, code
volume or time on platform.

Some rules do reward being quick: the three "first in class" badges and Ready to Code. This was a
deliberate choice on 2026-09-30. A "first in class" badge goes to the earliest real pass by a student
who doesn't already hold that badge, so one fast student can't take every task's suggestion.

Persistence is the one rule that looks at attempts, so it has extra limits:
- it counts only *distinct* failed submissions
- it skips quizzes
- it is never auto-awarded, so the tutor judges whether it was real persistence

## Task kind: `taskActivity` parser

- **New `src/shared/taskActivity.js`.** It is the platform copy of the Glossary vocabulary:
  - `TASK_ACTIVITY_FORMATS`: Information, Quiz, Code Task, Arrange Task, Activity
  - `TASK_ACTIVITY_PATTERNS`: Complete Example, Meaningful Change, Copy the Code, Debug Code Task,
    Challenge (Open-Ended), Take It Further, Make It Your Own, the `Quiz:` patterns, etc.
  - `parseTaskActivity(str)` returns `{ format, pattern, known }`. It is tolerant of case,
    whitespace, and `,` vs `:` separators.
- **Validator:** a **warning** (not an error) for a `taskActivity` whose pattern isn't recognised,
  listed in `validation-errors.md`.
- **`lessons capabilities`** lists the patterns.
- **Content workspace follow-up (outside this repo):** `guides/Task Intent Format.md` points at this
  file as the source of truth, so the two lists can't drift.

## Badge catalogue

### Registry (code)

- **Definition files:** `src/badges/definitions/<id>.js` export `defineBadge({...})`:
  ```js
  export default defineBadge({
    id: 'bug_hunter',
    emoji: '🐛',
    title: 'Bug Hunter',
    blurb: 'Found and fixed a bug.',          // shown to the student and in the class toast
    rule: realPassOnPattern('debug_code_task'),
    reasonText: ({ task }) => `Fixed the bug in “${task.title}”`,
    autoAwardable: true,                      // eligible for the tutor's auto-award toggle
    examples: [                               // run by one generic test for every badge
      { name: 'passes debug task', timeline: [...], expect: ['t3'] },
      { name: 'assisted pass ignored', timeline: [...], expect: [] },
    ],
  })
  ```
  Tutor-only badges omit `rule`.
- **Registry files:** `src/badges/registry.pure.js` (Node-safe, for the CLI and tests) and
  `src/badges/registry.js`. These mirror the activities registry.
- **Rule helpers** in `src/badges/rules.js`:
  - `firstInClassOnPattern` (with a `firstTryOnly` option for Code Detective)
  - `realPassOnPattern`
  - `errorThenPass`
  - `distinctFailsThenPass`
  - `anySignal` (topic opened, shortcut used)
  - `firstEditWithin`
  - `quizGroupFirstTry`

### Admin catalogue (Firestore, manual-only)

- **Storage:** `badgeCatalogue/{id}` holds `{ emoji, title, blurb, archived, updatedAt, updatedBy }`.
- **Access:** admin write, teacher read.
- **Admin Portal:** a new **Badges** tab lists registry badges (read-only) and lets admins add,
  edit or archive manual badges.
- **Ids:** must not collide with registry ids (enforced on save).
- **Archiving:** archived badges vanish from the picker but still render in old reports.

### Lesson authoring

This feature adds no badge definitions to lessons. Lessons can only tune the built-in rules.

```yaml
badgeOptions:                     # optional, lesson envelope
  quizMasterThreshold: 0.8        # default 0.8
  quizMasterMinQuizzes: 3         # default 3
  persistenceMinFails: 2          # default 2 distinct failed submissions
  readyToCodeSeconds: 10          # default 10
```

A per-task override for edge cases:

```yaml
badgeHints:
  suggest: [bug_hunter]       # treat a real pass here as that badge's trigger
  suppress: [code_fixer]      # never suggest this badge from this task
```

- **Validation errors:**
  - unknown badge ids in `badgeHints`
  - `badgeOptions` values out of range (threshold outside 0–1, counts below 1)
- **Docs:** `lesson-schema.md`, `lesson-schema-yaml.md`, a new `docs/authoring/badges.md` (which
  task activities trigger which badges), and a CHANGELOG entry.
- **Builder:** a "Badge hints" field on the task editor. `badgeOptions` is YAML-only in v1.

## The v1 badge set

A **real pass** is a passing `attemptLog` entry with none of the [guards](#central-anti-gaming-guards).
A **task's pattern** comes from parsing its `taskActivity`, and `badgeHints` can add or suppress a
badge per task. Each badge is suggested at most once per student per lesson.

| Badge | Suggested when (exactly) | Suggestion reason shown to the tutor | Auto-awardable |
|---|---|---|---|
| 🐛 Bug Hunter | A task's pattern is `Debug Code Task`, and this student made the **earliest real pass** on it (by `passedAt`) among students who don't already hold Bug Hunter. At most one suggestion per Debug task | "First to fix the bug in *Task title*" | ✅ |
| 📋 Code Builder | The same "first in class" rule on a `Copy the Code` task. Complete Example is excluded (nothing to type) | "First to build *Task title* from the example" | ✅ |
| 🔍 Code Detective | A quiz task's pattern is `Quiz: What Is the Error?` or `Quiz: Fix a Common Bug`. This student's **first** attempt was correct, and it was the **earliest** such first-try-correct answer in the class among students who don't already hold Code Detective | "First to spot the error in *Task title*, first try" | ✅ |
| 🔓 Challenge Solver | A real pass on a `Challenge (Open-Ended)` task, with no support stage revealed on that task before the pass | "Solved *Task title* without references" | ✅ |
| 🎯 Quiz Master | A task group has 3+ graded quiz tasks (confidence checks excluded; usually the End Quiz). The student has attempted every one, and at least `quizMasterThreshold` (default 80%) were correct on the first attempt. Evaluated when their last quiz in that group is answered | "End Quiz: 4 of 5 right first time" | ✅ |
| 🔧 Code Fixer | On a code task that isn't a Debug task: an attempt with `error: true` (a real console error), then a later real pass whose submission differs from the errored one | "Fixed a *NameError* in *Task title*" | – |
| 🔨 Persistence | On a code or Code Arrange task (no quizzes): at least `persistenceMinFails` (default **2**) failed attempts with *different* code (re-running the same code only bumps `retries`), then a real pass | "3 different tries, then passed *Task title*" | – |
| 📚 Resourceful Coder | The student opened the Topic Library themselves: the library button, a topic link, or a topic card. Topics the tutor sent don't count | "Opened the Topic Library (*Loops*) on *Task title*" | – |
| ⌨️ Keyboard Wizard | The student used **any** Ctrl/Cmd/Alt keyboard shortcut in the lesson workspace, copy and paste included | "Used *Ctrl+Enter*" | – |
| 🚀 Ready to Code | On a code task (any module): the student's first change to their work landed within `readyToCodeSeconds` (default **10 s**) of the task opening for them. That is the later of the teacher's advance (`taskStartTimes`) and their own join (confirmed). Cursor moves and clicks don't count; a Scratch block drag or drop does (confirmed) | "Started typing 6 s into *Task title*" | – |
| 🧠 Problem Solver · 🧪 Experimenter · 💡 Creative Coder · 😂 Comedy Coder · 🎯 Focused Coder · 🚀 Project Explorer · 📈 Knowledge Builder · 🤝 Helpful Coder | Tutor-only | – | – |

- **Every badge in this table is also in the tutor's manual picker.** The rules only decide when a
  badge is *suggested*; the tutor can award any of them at any time. The rule-backed badges'
  "first in class" limits apply to suggestions only.
- **Several badges can come from one task.** Persistence and Code Fixer can both be suggested; they
  recognise different things, and the tutor picks.
- **Module coverage.** Scratch has no Topic Library and no console, so Resourceful Coder and
  Code Fixer never fire there. Arcade's errors currently go only to its own console, so PR2
  wires them into the `error` flag. `docs/authoring/badges.md` carries a badge × module table.
- **Browser shortcuts.** Keyboard Wizard ignores combos the browser reserves (reload, close tab,
  new tab), since those take the student out of the lesson.
- **Expect volume.** Keyboard Wizard and Ready to Code will be suggested for most of the class early
  in a lesson. The panel's **Award all** handles that in one click. If they prove too noisy, the
  report's dismissal counts will show it.

## Data model

Every change here was signed off on 2026-09-30. Each one updates `database.rules.json` (plus the rules
tests), `docs/agents/runtime-model.md`, and the `createSession` / `endSession` resets.

- **`sessions/{lessonId}/badges/{anonymousId}/{badgeId}`:**
  - Holds `{ status: 'awarded'|'dismissed'|'revoked', source: 'rule'|'auto'|'manual', reason, taskId,
    announce, decidedAt }`.
  - **Teacher-write only** (inherits the `$lessonId` teacher write), so students can't award
    themselves.
  - The key is the badge id. This enforces "once per lesson" and makes auto-award idempotent across
    teacher tabs.
  - It is a sibling log, so `setTaskId` never wipes it. `endSession` clears it after the report saves.
- **`sessions/{lessonId}/badgeSettings`:** `{ autoAward: boolean, soundsOff: boolean }`,
  teacher-write.
- **`sessions/{lessonId}/studentSignals/{anonymousId}`:** one student-written node for the small
  signals the rules need.
  - Student-write for their own id, the same pattern as `supportRevealLog`.
  - **First occurrence only**, so it's a handful of writes per student per lesson.
  - It holds:
    - `topics/{taskId}/{topicId}`: `{ openedAt, source: 'student'|'teacher' }`
    - `shortcuts/{shortcutId}`: `{ firstUsedAt, taskId }`, where `shortcutId` is a normalised combo
      such as `mod+enter`
    - `firstEdits/{taskId}`: `{ at, taskOpenedAt }`
    - `sandbox/{session|personal}`: `{ timeMs, runs, errorRuns, fixes }`
      - These are counters updated per run, never per keystroke.
      - `session` also holds `lastCode` / `lastFiles` and `lastCodeAt`: a snapshot of the student's
        teacher-sandbox work, written at most every 30 s while they're in it and once on exit.
  - Where the signals come from:
    - shortcuts: a single window-level `keydown` listener for any Ctrl/Cmd/Alt combo
    - first edits: the first content change reported by each module's work area
    - topic opens: the library button, topic links and `InlineMarkdown` topic cards
- **`sessions/{lessonId}/sandboxLog/{entryId}`:** teacher-write.
  - Holds one entry per time the class entered the teacher sandbox: `{ enteredAt, exitedAt,
    afterTaskId, explainer, pushes: [{ at, code | files }] }`.
  - `enterSandbox`, `pushSandboxExplainer` and the push-code/files actions append to it.
  - Today those values are overwritten on each push and cleared at session end, so nothing
    survives into the report.
- **`attemptLog` entries:** gain an optional `error: true` when the run produced a console error
  (Python/Turtle/Electronics runtime, HTML `handleHtmlRuntimeError`).
- **Firestore `badgeCatalogue/{id}`:** admin write, teacher and admin read.
- **Session report** (Firestore `sessionReports`, existing doc). `buildSessionReport` gains every
  metric the badge signals make available. `studentSignals` and `badges` are read before `endSession`
  wipes them, as the other logs are today.
  - **Per student:**
    - `badges: [{ badgeId, emoji, title, source, reason, taskId, awardedAt }]`
    - `topicsOpened: [{ taskId, topicId, source, openedAt }]`
    - `shortcutsUsed: [{ shortcutId, taskId, firstUsedAt }]`
  - **Per student, per task** (alongside the existing attempts, reveals and pastes):
    - `timeToFirstEditMs`
    - `errorAttempts`: attempts with a real console error
    - `distinctFailedAttempts`
    - `firstPassInClass: true` when they were the class's first real pass
  - **Per task (`taskSummary`):**
    - median and range of time to first edit
    - students with a console error
    - Topic Library opens (student vs tutor-sent)
    - first real pass: who, and how long after the task opened
  - **Per quiz group:** each student's first-try %, and the class median.
  - **Sandboxes:** see [Sandboxes](#sandboxes).
  - **Top level:** `badgeSummary: { [badgeId]: { suggested, awarded, autoAwarded, manual, dismissed,
    revoked } }`, plus `shortcutSummary: { [shortcutId]: studentCount }`.

  Dismissal rates show which rules are noisy, which is the tuning signal for v2.

  The report modal gets a **Coding moments** section (grouped by badge) and adds the new columns to
  the per-task and per-student views. Everything is in the YAML export and follows the existing
  anonymised display.

## Tutor experience

- **Student grid header:** a **🏅 Suggestions (n)** button, next to Nudge Away.
- **Badge suggestions panel:** a collapsible panel in the centre column (`TaskRatingPanel` pattern).
  - Suggestions are grouped by student. Each shows its emoji, title, one-line reason, **[Award]
    [Dismiss]**, and an "announce to class" checkbox (default on).
  - An **Award all** button covers several students suggested the same badge.
  - The **Auto-award high-confidence** toggle sits at the top.
- **Student card:** a small 🏅 dot when that student has a pending suggestion. No counts on cards.
- **Student modal:** More → **🏅 Award badge** opens a picker with **every** badge: rule-backed,
  tutor-only and Admin-catalogue (already-awarded ones greyed out). The student's awarded list has **Revoke**, which is silent
  to the student.
- **Multi-award:** select several cards, then Award badge (for example 🤝 Helpful Coder to a pair).
- **Badge count (teacher-only):** each student card and the student modal header show a small
  "🏅 2". The tutor can see at a glance who hasn't been recognised yet. It never appears on
  student screens or the presentation window, so students still see no totals.
- **Badge definitions on hover:** hovering a badge in the picker or panel shows its exact
  "suggested when" rule.
- **Sounds off:** a session control that silences the award chime for the whole class.
- **Timing:** awarding takes one click and is never modal.

## Student experience

- **Recipient celebration:**
  - A centred card flips in (3D `rotateY`) with a single shine sweep, showing the emoji, the title
    and "*blurb*".
  - After about 2.5 s it shrinks into a **🎖️ Coding moments** pill in the top bar, which opens their
    own list.
  - A subtle, low-gain two-note chime plays, reusing the nudge audio engine.
  - It never steals editor focus.
  - `aria-live="polite"` announces it.
  - `prefers-reduced-motion` gets a plain fade.
  - It is not replayed on reload (load-baseline, as `useNudgeAlert` does). Awards made while offline
    still appear in the pill.
- **Class toast (every classmate's screen):**
  - A compact, silent pill in the bottom corner: "🎖️ Alex · Bug Hunter".
  - It shows for about 3 s and slides out. The badge's blurb appears on hover only.
  - One at a time, queued, dropped if the queue backs up.
  - Never shown to the recipient, who gets the full celebration instead.
  - Never shows totals.
- **Presentation window:** the same announcement, slightly larger (still a corner toast, about 4 s),
  so the projector celebrates it too.
- **Mute:** a speaker toggle in the Coding moments pill silences the chime on that student's device
  for the rest of the session. It's kept in memory only, so no new localStorage key is needed.
- **Session-end screen:** when the tutor ends the session, the student's end screen shows their own
  moments as a sticker sheet, even if the lesson has no Badge Summary task. The student's client
  keeps its own awards in memory as they arrive, so the `endSession` wipe doesn't lose them.
- **Nowhere** are counts, ranks, "top student" or comparisons shown.

## Badge Summary task

- **Task:** `taskType: information` with a new `informationType: badges` ("Today's Coding Moments").
  - This is the cheapest route, following `introduction`, which already renders lesson-level data
    in `src/app/components/InformationTask.jsx`.
  - Explainer optional. Usually placed last.
- **Student:** their own badges as a sticker sheet that flips in one badge at a time, then the class
  wall grouped by badge.
  - If they earned none, the screen is still warm ("Every coder's moments look different: here's
    what the class celebrated today"), with no empty-state shaming.
- **Teacher:** a projector-friendly class wall grouped by badge.
- **Copy class summary:** a button on the teacher's Badge Summary and in the session report.
  It copies "Today's coding moments" as plain text grouped by badge ("🐛 Bug Hunter: Alex,
  Sam"), ready for a newsletter or class chat. It has no counts, and in the report it uses real
  names only when the tutor chooses to reveal them.
- **Solo (v1):** the task is skipped, as if it were `taskMode: live`, because solo has no badges yet.

## Sandboxes

Decided 2026-09-30.

**Badges.** Sandbox work (the teacher sandbox and personal sandboxes) can suggest the signal badges:
- ⌨️ Keyboard Wizard (a shortcut used in a sandbox)
- 📚 Resourceful Coder (the Topic Library opened in a sandbox)
- 🔧 Code Fixer, sandbox version: a sandbox run with a real console error, then a later run of changed
  code without one. The reason reads "Fixed an error in the sandbox".

The pass-based badges (Bug Hunter, Code Builder, Code Detective, Challenge Solver, Quiz Master,
Persistence) and Ready to Code need a task, so they don't apply. Project Explorer stays tutor-only.

**Report: teacher sandbox, in full.** Using the teacher sandbox usually means the lesson fell short and
the tutor had to improvise, so the report records it as a **possible lesson gap**:
- when the class entered and left, how long, and which task it followed
- everything the teacher added: the explainer and every code or files push (from `sandboxLog`)
- each student's last sandbox code snapshot, plus time, runs, error runs and fixes

The report modal shows it as a callout, for example "The class spent 14 min in the teacher sandbox
after Task 7", with the teacher's code and explainer, and each student's code viewable on expand. It
is included in the YAML export.

**Report: personal sandbox, activity only.** Per student: time spent, runs, runs with an error, and
errors fixed. No code is stored.

## Adding a new badge

1. **Rule-backed or built-in:** run `npm run new:badge -- <id>`. This scaffolds
   `src/badges/definitions/<id>.js` with a rule stub and two examples, and registers it. The generic
   test runs its examples. The `new-badge` skill walks through the rest.
2. **Manual, no deploy:** Admin Portal → Badges → Add.
3. **A new signal** (something no timeline event covers): add an event type to the timeline builder.
   A new logged field needs its own data-model sign-off, and `docs/authoring/badges.md` gets a
   "Signals" table.

## PR sequence

Each PR has tests green, `npm run docs:check`, and doc updates. A CHANGELOG entry (with the
`Affects · Existing lessons · Resolves` line) is added wherever authoring changes.

1. **Foundations:**
   - `src/shared/taskActivity.js` plus the validator warning
   - the badge registry, `defineBadge`, rule helpers, all universal definitions and the generic
     examples test
   - `badgeOptions` and task `badgeHints` validation, YAML round-trip and `lessons capabilities`
   - `docs/authoring/badges.md`, schema docs and CHANGELOG

   No UI.
2. **Live data:**
   - `badges`, `badgeSettings`, `studentSignals` and `sandboxLog` nodes, `attemptLog.error`
   - rules and rules tests
   - topic-open reporting from the library button, topic links and `InlineMarkdown`
   - shortcut reporting (window `keydown`) and first-edit reporting (each module's work area)
   - sandbox counters and snapshots (student) and the teacher `sandboxLog` appends
   - `useSession` writers and resets, `runtime-model.md`, `feature-impact-map.md`
3. **Engine:** `buildLiveTimeline`, the guards, `evaluateBadgeRules`, and characterisation tests from
   real session snapshots.
4. **Tutor UI:** suggestions panel, grid button, card dot, modal award and revoke, picker with
   hover definitions, multi-award, auto-award toggle, teacher-only badge count, sounds off.
5. **Celebration:** recipient card, chime and mute, pill, class toast, presentation window,
   reduced motion, session-end screen moments.
6. **Summary and report:** `informationType: badges` (skipped in solo), Copy class summary,
   every new metric in `buildSessionReport` (see [Data model](#data-model)), the teacher-sandbox
   "possible lesson gap" callout and personal-sandbox activity,
   the report modal "Coding moments" section and YAML export.
7. **Admin and scaffold:** Firestore `badgeCatalogue` plus rules, the Admin Badges tab,
   `npm run new:badge`, the `new-badge` skill, and an ADR for the badge registry.

### Real-browser checks (jsdom can't catch these)

- Teacher and student tabs on each module: a suggestion appears, then Award, then the card flips,
  the chime plays, the pill updates and classmates see the toast.
- Reload the teacher (dismissals kept) and the student (no replay).
- The presentation window toast.
- Reduced motion.
- Keyboard Wizard: a shortcut counts but clicking Run doesn't, and Mac `Cmd` works.
- Sandbox: a shortcut, a topic open and an error→fix in a sandbox suggest the right badges. The
  report shows the teacher sandbox's pushes and each student's snapshot, and personal-sandbox time.
- The presentation window never produces a suggestion.
- The class toast shows for about 3 s on classmates' screens, and the badge count never shows to
  students.
- The session-end screen shows the student's moments after `endSession`.
- Ready to Code: typing counts, and moving the mouse or clicking into the editor doesn't. Scratch
  block drags count.
- "First in class": two students passing seconds apart gives the suggestion to the earlier one, and
  it's still correct after a teacher reload.
- A solo run-through skips the Badge Summary task cleanly.
- Typing is uninterrupted during the celebration.
- A tablet.

## Not in v1

- Solo badges (see [Later](#later))
- Lesson-specific badges (a separate system)
- Points, totals, leaderboards, streaks, cross-lesson history, a per-device sticker book
- AI interpretation of behaviour
- Automatic Knowledge Builder or Project Explorer
- Any animation library

## Considered, not in v1

Raised on 2026-09-30 and not picked for v1:
- a badges on/off switch per session, and an Admin per-rule kill switch
- a roughly 5 s undo window before an award reaches the student
- an optional personal note on manual awards
- the Builder and CLI showing which badges a task or lesson can suggest

## Later

- **Solo badges:**
  - Add a `buildSoloTimeline` from local events, feeding the same rules.
  - Badges marked `soloAuto` award directly. There is no tutor, so tutor-only badges never appear.
  - Persist to the already-approved localStorage key `headstart_{lessonId}_badges_{anonymousId}`.
  - Show the student's moments on the solo lesson-complete screen, and stop skipping the Badge
    Summary task.
- **▶ Celebrate** on the teacher's Badge Summary: steps every screen through the class wall one
  badge at a time (a `badgeCelebration` session field).
- **Download my coding moments:** a canvas-rendered PNG card the student can keep.
- **Rule tuning from reports:** an Admin view of `badgeSummary` dismissal rates across sessions.
