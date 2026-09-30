# Live Student Badges Plan

Status: **Agreed, not started** (interviewed 2026-09-30, branch `feature/live-badges`). Delivered as seven
focused PRs (see [PR sequence](#pr-sequence)). Source brief: "Live Student Badges" (recognise good
learning behaviour as it happens; tutor stays in control; no points, totals, rankings or leaderboard).

> **Core principle:** make good learning behaviours visible, rewarding and socially engaging without
> turning coding into a competition.

## Decisions

These answers from the interview are fixed for this plan.

| Topic | Decision |
|---|---|
| Modes | **Live and solo.** Live: rules *suggest* and the tutor decides. Solo: there is no tutor, so the rule-backed badges award directly. |
| Live auto-award | Suggest by default. A tutor session toggle, **Auto-award high-confidence badges**, lets the badges marked `autoAwardable` skip the click. Any award can be revoked. |
| Task kind | **Parse the existing `taskActivity` string** into the Glossary pattern it names. No lesson re-tagging. A per-task `badgeHints` override covers edge cases. |
| Brief items that don't fit the platform | **Tutor-only.** This covers Knowledge Builder, Project Explorer and Keyboard Wizard (students can't move ahead in live mode, and quizzes are single pass/fail questions). |
| Automatic mappings | Bug Hunter ← Debug Code Task · Code Builder ← Copy the Code · Challenge Solver ← Challenge (Open-Ended) · Code Detective ← Quiz: What Is the Error? / Quiz: Fix a Common Bug (first try) |
| Code Fixer | Only after a **real console error** (syntax or runtime), then edited code, then a pass. |
| Quiz Master | First-try correct % over a group of graded quizzes. |
| History | **Session only.** Named badges in the session report plus the end-of-lesson summary. No cross-lesson sticker book. |
| Adding badges | **Both:** a code registry (with rules, scaffold, skill) for built-in badges, plus an Admin-editable catalogue of manual-only badges that needs no deploy. |
| Lesson badges | **Separate live badges**, 1–2 per lesson in a new envelope field. The content workspace's concept, capstone and Level badges (Badge Writing Guide) are untouched and stay off-platform. |
| Lesson badge discovery | *Default, not confirmed:* a "❓ Today's lesson badge" teaser that reveals the name and emoji the first time anyone in the class earns it. Easy to switch to "shown upfront". |
| Class wall | **Grouped by badge** ("🐛 Bug Hunter: Alex, Sam"), never by student, so nobody can count. |
| Animation | CSS badge flip plus shine, and a **subtle** two-note chime. No new dependencies. The rest of the app stays calm. |
| Data model | Approved: RTDB `badges` node, RTDB `topicLog` node, Firestore `badgeCatalogue`, and a solo localStorage key (details [below](#data-model)). |

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
- **The Topic Library** only syncs the topic open *right now* (`students/{id}/currentTopicId`), and the
  library button, related-topic pills and `InlineMarkdown` cards report nothing. This needs a small log.
- **Runtime errors** are visible only as the latest `lastRunStatus`, which is overwritten. Code Fixer
  needs an `error` flag on the attempt entry.
- **Solo syncs nothing** and keeps pass/fail in memory only.
- **Session reports** are built in `src/shared/lessonReport.js` and saved before `endSession` wipes the
  logs. They display anonymised ("Student N").
- **No animation library.** There are CSS keyframes in `src/index.css`, and the nudge chime
  (Web Audio) is in `src/app/nudgeAlert.js`.

## Architecture

```
            live: teacher client                        solo: student client
  session snapshot ──► buildLiveTimeline()     local events ──► buildSoloTimeline()
                              │                                         │
                              └──────────► evaluateBadgeRules ◄─────────┘
                                   (pure, deterministic, per student)
                                              │
                        suggestions[] { badgeId, studentId, taskId, reason }
                                              │
                 live: minus decided keys → Suggestions panel → Award / Dismiss
                 solo: soloAuto badges → awarded locally → celebration
```

- **One rules engine, two timeline sources.** A *timeline* is a normalised, ordered event list per
  student:
  - `attempt { taskId, passed, firstTry, error, assisted, submissionHash, at }`
  - `topic_open { topicId, taskId, source: student|teacher, at }`
  - `reveal { taskId, stage, complete }`
  - `paste { taskId }`
  - `override { taskId }`
  - `show_complete { taskId }`

  Rules never touch Firebase or React.
- **Suggestions are not stored.** They are recomputed from the snapshot, so they survive a teacher
  reload for free. Only *decisions* (awarded, dismissed, revoked) are written.
- **Where the engine runs.** Live: the engine runs in `TeacherView` via `useBadgeSuggestions(session,
  lesson)`, memoised per student. Solo: it runs in `StudentView` via `useSoloBadges`.
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

Every badge is suggested **at most once per student per lesson**, and nothing rewards speed, run
counts, attempt counts, code volume or time on platform.

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
    tier: 'universal',                        // 'universal' | 'lesson' (lesson = gold treatment)
    rule: realPassOnPattern('debug_code_task'),
    reasonText: ({ task }) => `Fixed the bug in “${task.title}”`,
    autoAwardable: true,                      // eligible for the tutor's auto-award toggle
    soloAuto: true,                           // awarded directly in solo
    examples: [                               // run by one generic test for every badge
      { name: 'passes debug task', timeline: [...], expect: ['t3'] },
      { name: 'assisted pass ignored', timeline: [...], expect: [] },
    ],
  })
  ```
- **Registry files:** `src/badges/registry.pure.js` (Node-safe, for the CLI and tests) and
  `src/badges/registry.js`. These mirror the activities registry.
- **Rule helpers** in `src/badges/rules.js`: `realPassOnPattern`, `firstTryOnPatterns`,
  `errorThenPass`, `topicThenPass`, `quizGroupFirstTry`, `passTasks`.

### Admin catalogue (Firestore, manual-only)

- **Storage:** `badgeCatalogue/{id}` holds `{ emoji, title, blurb, archived, updatedAt, updatedBy }`.
- **Access:** admin write, teacher read.
- **Admin Portal:** a new **Badges** tab lists registry badges (read-only) and lets admins add,
  edit or archive manual badges.
- **Ids:** must not collide with registry ids (enforced on save).
- **Archiving:** archived badges vanish from the picker but still render in old reports.

### Lesson badges (lesson envelope)

```yaml
badges:                       # optional, max 2
  - id: loop_master
    emoji: "🔄"
    title: Loop Master
    blurb: Used loops to solve the challenge.
    suggestWhen:              # optional; omit → tutor-only
      passTasks: [loop-challenge]
badgeOptions:                 # optional
  quizMasterThreshold: 0.8    # default 0.8
  quizMasterMinQuizzes: 3     # default 3
```

A per-task override for edge cases:

```yaml
badgeHints:
  suggest: [bug_hunter]       # treat a real pass here as that badge's trigger
  suppress: [code_fixer]      # never suggest this badge from this task
```

- **Validation (errors):**
  - unknown badge ids in `badgeHints`
  - more than 2 lesson badges
  - lesson badge ids that clash with registry ids
  - `passTasks` naming missing tasks
  - a missing emoji, title or blurb
- **Docs:** documented in `lesson-schema.md`, `lesson-schema-yaml.md` and a new
  `docs/authoring/badges.md`, with a CHANGELOG entry.
- **Builder:** gets a "Lesson badges" section in `LessonMetaPanel` and a "Badge hints" field on the
  task editor.

## The v1 badge set

| Badge | Kind | Trigger (real passes only) | Auto-awardable | Solo |
|---|---|---|---|---|
| 🐛 Bug Hunter | rule | Pass on a `Debug Code Task` | ✅ | ✅ |
| 📋 Code Builder | rule | Pass on `Copy the Code` (Complete Example excluded: nothing to type) | ✅ | ✅ |
| 🔓 Challenge Solver | rule | Pass on `Challenge (Open-Ended)` with no support stage revealed | ✅ | ✅ |
| 🔍 Code Detective | rule | First-try correct on `Quiz: What Is the Error?` or `Quiz: Fix a Common Bug` | – | ✅ |
| 🔧 Code Fixer | rule | An attempt with a **real console error**, then a pass with changed code, on a non-debug task | – | ✅ |
| 📚 Resourceful Coder | rule | The student opened a topic themselves (not teacher-sent) while the task was unsolved, then passed it. The reason says whether the topic is linked from the task | – | ✅ |
| 🎯 Quiz Master | rule | At least the threshold of first-try correct across a task group with at least the minimum number of graded quizzes (e.g. the End Quiz). Confidence checks excluded | ✅ | ✅ |
| Lesson badges | rule or tutor | `suggestWhen.passTasks` all passed | ✅ | ✅ |
| 🧠 Problem Solver · 🔨 Persistence · 🧪 Experimenter · 💡 Creative Coder · 😂 Comedy Coder · 🎯 Focused Coder · 🚀 Ready to Code · 🚀 Project Explorer · 📈 Knowledge Builder · ⌨️ Keyboard Wizard · 🤝 Helpful Coder | tutor | none | – | – |

Tutor-only badges are **not** awarded in solo, because solo has no tutor.

## Data model

Every change here was signed off in the 2026-09-30 interview. Each one updates `database.rules.json`
(plus the rules tests), `docs/agents/runtime-model.md`, and the `createSession` / `endSession` resets.

- **`sessions/{lessonId}/badges/{anonymousId}/{badgeId}`:**
  - Holds `{ status: 'awarded'|'dismissed'|'revoked', source: 'rule'|'auto'|'manual', reason, taskId,
    announce, decidedAt }`.
  - **Teacher-write only** (inherits the `$lessonId` teacher write), so students can't award
    themselves. The key is the badge id, which is what enforces "once per lesson" and makes
    auto-award idempotent across teacher tabs.
  - It is a sibling log, so `setTaskId` never wipes it. `endSession` clears it after the report saves.
- **`sessions/{lessonId}/badgeSettings`:** `{ autoAward: boolean }`, teacher-write.
- **`sessions/{lessonId}/topicLog/{anonymousId}/{taskId}/{topicId}`:** `{ openedAt, source }`.
  Student-write for their own id, the same pattern as `supportRevealLog`. The first open only (no
  per-click spam).
- **`attemptLog` entries:** gain an optional `error: true` when the run produced a console error
  (Python/Turtle/Electronics runtime, HTML `handleHtmlRuntimeError`).
- **Firestore `badgeCatalogue/{id}`:** admin write, teacher and admin read.
- **Solo localStorage `headstart_{lessonId}_badges_{anonymousId}`:**
  - Holds `{ awarded: [...], timeline: [...] }`, so a reload mid-lesson keeps badges and rule state.
  - Session-scoped: cleared when the student starts the lesson afresh.
  - Guarded with try/catch like the other keys.
- **Session report** (Firestore `sessionReports`, existing doc):
  - per student: `badges: [{ badgeId, emoji, title, source, reason, taskId, awardedAt }]`
  - top level: `badgeSummary: { [badgeId]: { suggested, awarded, autoAwarded, dismissed, revoked } }`

  Dismissal rates show which rules are noisy, which is the tuning signal for v2.

## Tutor experience

- **Student grid header:** a **🏅 Suggestions (n)** button, next to Nudge Away.
- **Badge suggestions panel:** a collapsible panel in the centre column (`TaskRatingPanel` pattern).
  - Suggestions are grouped by student. Each shows its emoji, title, one-line reason, **[Award]
    [Dismiss]**, and an "announce to class" checkbox (default on).
  - An **Award all** button covers several students suggested the same badge.
  - The **Auto-award high-confidence** toggle sits at the top.
- **Student card:** a small 🏅 dot when that student has a pending suggestion. No counts on cards.
- **Student modal:** More → **🏅 Award badge** opens a picker with universal, admin-catalogue and
  this lesson's badges (already-awarded ones greyed out). The student's awarded list has **Revoke**,
  which is silent to the student.
- **Multi-award:** select several cards, then Award badge (for example 🤝 Helpful Coder to a pair).
- **Timing:** awarding takes one click and is never modal.

## Student experience

- **Recipient celebration:**
  - A centred card flips in (3D `rotateY`) with a single shine sweep. Lesson badges get a gold
    holographic sheen.
  - It shows the emoji, the title and "*blurb*".
  - After about 2.5 s it shrinks into a **🎖️ Coding moments** pill in the top bar, which opens their
    own list.
  - A subtle, low-gain two-note chime plays, reusing the nudge audio engine.
  - It never steals editor focus.
  - `aria-live="polite"` announces it.
  - `prefers-reduced-motion` gets a plain fade.
  - It is not replayed on reload (load-baseline, as `useNudgeAlert` does). Awards made while offline
    still appear in the pill.
- **Class toast:**
  - A small, silent bottom-corner toast: "🎖️ Alex earned **Bug Hunter**, *Found and fixed a
    bug.*". The blurb models the behaviour for peers.
  - One at a time, queued, dropped if the queue backs up.
  - Never shown to the recipient.
  - Never shows totals.
  - Also shown in the presentation window.
- **Lesson badge teaser:** a "❓ Today's lesson badge" chip. It reveals its name and emoji once the
  first student earns it ("✨ Lesson badge unlocked: 🔄 Loop Master").
- **Nowhere** are counts, ranks, "top student" or comparisons shown.

## Badge Summary task

- **Task:** `taskType: information` with a new `informationType: badges` ("Today's Coding Moments").
  - This is the cheapest route, following `introduction`, which already renders lesson-level data
    in `src/app/components/InformationTask.jsx`.
  - Explainer optional. Usually placed last.
- **Student (live):** their own badges as a sticker sheet that flips in one badge at a time, then
  the class wall grouped by badge. If they earned none, the screen is still warm ("Every coder's
  moments look different: here's what the class celebrated today"), with no empty-state shaming.
- **Teacher:** a projector-friendly class wall grouped by badge.
- **Solo:** the student's own moments. The solo **lesson-complete screen** also shows them
  automatically, even when the lesson has no Badge Summary task.

## Adding a new badge

1. **Rule-backed or built-in:** run `npm run new:badge -- <id>`. This scaffolds
   `src/badges/definitions/<id>.js` with a rule stub and two examples, and registers it. The generic
   test runs its examples. The `new-badge` skill walks through the rest.
2. **Manual, no deploy:** Admin Portal → Badges → Add.
3. **Lesson-specific:** add it to the lesson's `badges:` envelope.
4. **A new signal** (something no timeline event covers): add an event type to both timeline
   builders. Live needs a new logged field with its own data-model sign-off, and `docs/authoring/badges.md`
   gets a "Signals" table.

## PR sequence

Each PR has tests green, `npm run docs:check`, and doc updates. A CHANGELOG entry (with the
`Affects · Existing lessons · Resolves` line) is added wherever authoring changes.

1. **Foundations:**
   - `src/shared/taskActivity.js` plus the validator warning
   - the badge registry, `defineBadge`, rule helpers, all universal definitions and the generic
     examples test
   - envelope `badges` / `badgeOptions` and task `badgeHints` validation, YAML round-trip and
     `lessons capabilities`
   - `docs/authoring/badges.md`, schema docs and CHANGELOG

   No UI.
2. **Live data:**
   - `badges`, `badgeSettings` and `topicLog` nodes, `attemptLog.error`
   - rules and rules tests
   - topic-open reporting from the library button, related pills and `InlineMarkdown`
   - `useSession` writers and resets, `runtime-model.md`, `feature-impact-map.md`
3. **Engine:** `buildLiveTimeline`, `buildSoloTimeline`, the guards, `evaluateBadgeRules`, and
   characterisation tests from real session snapshots.
4. **Tutor UI:** suggestions panel, grid button, card dot, modal award and revoke, picker,
   multi-award, auto-award toggle.
5. **Celebration:** recipient card, chime, pill, class toast, presentation window, lesson-badge
   teaser, reduced motion, solo auto-award and localStorage.
6. **Summary and report:** `informationType: badges`, the solo lesson-complete section,
   `buildSessionReport` fields, the report modal "Coding moments" section and YAML export.
7. **Admin and scaffold:** Firestore `badgeCatalogue` plus rules, the Admin Badges tab,
   `npm run new:badge`, the `new-badge` skill, and an ADR for the badge registry.

### Real-browser checks (jsdom can't catch these)

- Teacher and student tabs on each module: a suggestion appears, then Award, then the card flips,
  the chime plays, the pill updates and classmates see the toast.
- Reload the teacher (dismissals kept) and the student (no replay).
- The presentation window toast.
- Reduced motion.
- A solo run-through ending on the lesson-complete screen.
- Typing is uninterrupted during the celebration.
- A tablet.

## Not in v1

- Points, totals, leaderboards, streaks, cross-lesson history, a per-device sticker book
- AI interpretation of behaviour
- Automatic Knowledge Builder, Project Explorer or Keyboard Wizard
- Any animation library

## Stretch ideas (post-v1, each needs a nod)

- **▶ Celebrate** on the teacher's Badge Summary: steps every screen through the class wall one
  badge at a time (a `badgeCelebration` session field).
- **Download my coding moments:** a canvas-rendered PNG card the student can keep.
- **Rule tuning from reports:** an Admin view of `badgeSummary` dismissal rates across sessions.
- **Keyboard Wizard rule** from the Desktop input recorder's keyboard-vs-menu shortcut counts.
