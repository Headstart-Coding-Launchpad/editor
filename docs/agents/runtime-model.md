# Agent Reference: Runtime Model

Load this when a task touches Firebase, localStorage, routing, session state, identity, or data compatibility.

## Firebase Data Model

Do not deviate from this shape.

```json
{
  "sessions": {
    "{lessonId}": {
      "state": "waiting | active | sandbox | ended",
      "currentTaskId": 1,
      "createdAt": 1234567890,
      "startedAt": "1234567890 | null",
      "currentTaskStartedAt": "1234567890 | null",
      "endedAt": "1234567890 | null",
      "isPaused": false,
      "activeStudentView": "{anonymousId} | null",
      "sandboxExplainer": "string | null",
      "explainerShowComplete": false,
      "teacherLive": {
        "active": true,
        "source": "teacher | student",
        "sourceStudentId": "uuid | null",
        "sourceStudentName": "Jamie | null",
        "taskId": 1,
        "lessonType": "python",
        "code": "...",
        "files": { "index__dot__html": "..." },
        "output": "...",
        "runStatus": "success | error | stopped | submitted | null",
        "checkPassed": true,
        "selection": { "from": 0, "to": 5, "file": "index.html" },
        "activity": { "type": "copy | paste | click | block_drag | block_click | green_flag | stop | sprite_drag", "at": 1234567890, "file": "index.html" },
        "spriteState": "object | null (watched Scratch student's throttled sprite/clone/backdrop snapshot, ~8Hz)",
        "cursor": "object | null (watched Scratch student's throttled live pointer position, ~20Hz — see students.{id}.currentCursor shape)",
        "blockDrag": "object | null ({ spriteId, blockId, x, y, at } — watched Scratch student's in-progress block-drag position within a sprite's Blockly workspace, read live off Blockly's own drag tracking and throttled with the cursor, ~20Hz; null once the drag ends)",
        "updatedAt": 1234567890
      },
      "sandboxCode": "string | null",
      "sandboxCodePushedAt": 1234567890,
      "sandboxFiles": { "index__dot__html": "..." },
      "sandboxFilesUpdatedAt": 1234567890,
      "lessonOverrideTasks": "Task[] | null",
      "joiningStudents": {
        "{tempId}": { "joinedAt": 1234567890 }
      },
      "taskStartTimes": {
        "{taskId}": 1234567890
      },
      "attemptLog": {
        "{anonymousId}": {
          "{taskId}": {
            "{pushId}": {
              "submission": "string | object (code / files / scratch or fs state / quiz answer)",
              "passed": true,
              "suggestion": "string | null",
              "attemptNumber": 1,
              "retries": 0,
              "loggedAt": "ServerValue.TIMESTAMP",
              "passedAt": "ServerValue.TIMESTAMP | null"
            }
          }
        }
      },
      "overrideLog": {
        "{anonymousId}": {
          "{taskId}": {
            "taskId": 1,
            "overriddenAt": "ServerValue.TIMESTAMP",
            "attemptNumber": 1,
            "previousCheckState": "failed | unattempted"
          }
        }
      },
      "carryFallbackLog": {
        "{anonymousId}": {
          "{taskId}": {
            "taskId": 3,
            "field": "carryCodeFrom | carryBlocksFrom | carryFsFrom | carryCircuitFrom",
            "requestedSourceTaskId": 2,
            "resolvedSourceTaskId": 1,
            "skippedSourceTaskIds": [2],
            "fallbackAt": "ServerValue.TIMESTAMP"
          }
        }
      },
      "supportRevealLog": {
        "{anonymousId}": {
          "{taskId}": {
            "{stageIndex}": {
              "taskId": 3,
              "stageIndex": 0,
              "stageLabel": "With a variable already created",
              "source": "teacher | student",
              "attemptNumber": 2,
              "revealedAt": "ServerValue.TIMESTAMP"
            }
          }
        }
      },
      "students": {
        "{anonymousId}": {
          "displayName": "Jamie",
          "joinedAt": 1234567890,
          "online": true,
          "currentCode": "string",
          "currentArcadeDesign": "object | null (watched Arcade student's throttled sprite/map snapshot)",
          "currentSpriteState": "object | null ({ spriteStates, cloneStates, backdropName, updatedAt } — watched Scratch student's throttled runtime snapshot, ~8Hz)",
          "currentCursor": "object | null ({ target: 'stage' | 'workspace', spriteId, x, y, at } — watched Scratch student's throttled live pointer position, ~20Hz; stage coords are origin-centred same as sprite x/y, workspace coords are that sprite's Blockly workspace units)",
          "currentBlockDrag": "object | null ({ spriteId, blockId, x, y, at } — the top block of an in-progress drag, live position in that sprite's Blockly workspace units, cleared to null when the drag ends)",
          "currentCodeArrangeSlots": "object | null (watched code_arrange student's live tile placements — { slotId: fragmentId, ... }, same shape CodeArrangeTask uses locally; updated on every tile move, independent of currentCode/currentFiles which only sync once the arrangement is fully assembled)",
          "currentFiles": { "index__dot__html": "..." },
          "currentOutput": "string",
          "currentAnswer": "b",
          "currentActiveFile": "index.html",
          "currentSelection": { "from": 0, "to": 5, "file": "index.html" },
          "currentActivity": { "type": "copy | paste | click | block_drag | block_click | green_flag | stop | sprite_drag", "at": 1234567890, "file": "index.html" },
          "lastRunStatus": "success | error | null",
          "checkPassed": true,
          "lastRunAt": 1234567890,
          "remoteResetAction": "starter | complete | stage_0 | stage_1 | ...",
          "remoteResetPushedAt": 1234567890,
          "needsHelp": "true | null",
          "inPersonalSandbox": "true | null",
          "checkOverridePassed": "boolean | null",
          "checkOverrideHint": "string | null",
          "checkOverridePushedAt": "number | null",
          "currentTopicId": "topicId | null",
          "sentToTopicId": "topicId | null",
          "sentToTopicPushedAt": "number | null",
          "teacherMessage": "string | null",
          "teacherMessagePushedAt": "number | null",
          "windowFocused": "boolean | null",
          "lastActivityAt": "number | null",
          "teacherEditRequestedAt": "number | null",
          "teacherEditAcceptedAt": "number | null",
          "teacherLiveCode": "string | null",
          "teacherEditApplyCode": "string | null",
          "teacherEditAppliedAt": "number | null",
          "teacherStageRequestedAt": "number | null",
          "teacherStagePendingAction": "string | null",
          "teacherStageAcceptedAt": "number | null",
          "teacherHighlights": {
            "{highlightId}": {
              "file": "index__dot__html (encodeFileKey'd; empty string for Python)",
              "from": 12,
              "to": 34,
              "emoji": "✅ | ❌ | ❓ | 💡 | ⭐",
              "note": "string | null",
              "createdAt": 1234567890
            }
          }
        }
      }
    }
  }
}
```

Firebase keys cannot contain dots. Store `index.html` as `index__dot__html`. Always use `encodeFileKey` and `decodeFileKey` when reading or writing Firebase file maps. App state and localStorage use real filenames.

## Write Rules

Teacher writes:

- `state`, `currentTaskId`, `startedAt`, `currentTaskStartedAt`, `endedAt`, `isPaused`
- `taskStartTimes/{taskId}` — stamped by `startSession` (for the initial task) and `setTaskId` (for the newly-entered task); overwritten if the teacher revisits a task. Used by `buildSessionReport` to compute time-on-task.
- `activeStudentView`, `teacherLive`
- `sandboxCode`, `sandboxCodePushedAt`, `sandboxFiles`, `sandboxFilesUpdatedAt`
- `sandboxExplainer` (pushed via `pushSandboxExplainer`, cleared on `createSession`/`endSession`/entering sandbox) and `explainerShowComplete` (toggled via `setExplainerShowComplete`; reset to `false` on `setTaskId`, `createSession`, `endSession` — see `docs/agents/classroom-behaviours.md` for the student-facing "Complete Code" reveal this gates)
- `lessonOverrideTasks` (session-only task edits from `EditLessonModal`; `pushLessonOverride`/`clearLessonOverride`) — reset to `null` on `createSession`/`endSession`. Task IDs inside it are never renumbered, so they stay valid against `currentTaskId`, carry-through references, and student per-task localStorage keys
- any student's `displayName`
- student node removal

Teacher per-student actions:

- Remote reset writes `remoteResetAction` and `remoteResetPushedAt`. For Arcade tasks, the student resets both code and the matching Starter/Stage/Complete visual design.
- Check override writes `checkOverridePassed`, `checkOverrideHint`, and `checkOverridePushedAt`; a manual pass also writes `overrideLog/{anonymousId}/{taskId}` when the student has no real passing attempt. The per-student visible override fields are cleared by `setTaskId`; `overrideLog` is not, so the end-of-session report can read it.
- Whole-class task advance writes `overrideLog/{anonymousId}/{taskId}` for each student who has not passed, unless the task is information, confidence, or an unchecked open short-answer response task. Override records store the task id, server timestamp, total attempt count at the moment of override, and `previousCheckState` (`failed` or `unattempted`). Teacher identity is not stored.
- Send to topic writes `sentToTopicId` and `sentToTopicPushedAt`; cleared by `setTaskId`.
- Highlight code (`pushTeacherHighlight`) adds an entry under `teacherHighlights/{highlightId}`; the teacher (or the student — see below) can remove any entry (`removeTeacherHighlight`). All entries cleared by `setTaskId`.
- Remote edit (Python/Scratch only): `requestTeacherEdit` sets `teacherEditRequestedAt` and clears `teacherEditAcceptedAt`/`teacherLiveCode`/`teacherEditApplyCode`/`teacherEditAppliedAt`, prompting the student for consent. Once accepted, `pushTeacherLiveCode` streams `teacherLiveCode` as the teacher types; `commitTeacherEdit` writes the final code to `teacherEditApplyCode` + `teacherEditAppliedAt` and directly to the student's `currentCode`; `cancelTeacherEdit` clears the request without committing. All eight `teacherEdit*`/`teacherLiveCode` fields are cleared by `setTaskId`.
- Remote stage push: `requestTeacherStage` sets `teacherStageRequestedAt` and `teacherStagePendingAction` (a reset-action string, same shape as `remoteResetAction`) and clears `teacherStageAcceptedAt`, prompting the student for consent before the stage change is applied; `clearTeacherStage` clears all three fields. Cleared by `setTaskId`.
- Stage reference reveal: `recordSupportStageReveal` writes `supportRevealLog/{anonymousId}/{taskId}/{stageIndex}` with `source: "teacher"`, stage label, attempt count, and server timestamp. This reveals a read-only Python/HTML stage reference to that one student and does not write to their editor.

Student writes:

- On run: own `currentCode` / `currentFiles`, `currentOutput`, `lastRunStatus`, `checkPassed`, `lastRunAt`.
- On a graded check result (lesson phase only, not sandbox): own `attemptLog/{taskId}/{pushId}` via `logAttempt` — deduplicated client-side, so an unchanged resubmission only bumps `retries` on the existing entry rather than pushing a new one, and no further entries are written once a task has passed. The moment an attempt (new or retried-in-place) first becomes `passed`, `passedAt` is stamped alongside it — this is the timestamp `buildSessionReport` uses (together with `taskStartTimes`) to compute time-on-task. `attemptLog` is a sibling of `students`, not nested inside it, so it is untouched by `setTaskId`'s per-task field wipe and is still present in the teacher's in-memory `session` snapshot at the moment `endSession()` runs — that snapshot is what `buildSessionReport` (`src/shared/lessonReport.js`) reads to build the Firestore report described under "Session Reports" below.
- When watched, Python: `currentCode` per keystroke, `currentOutput` line by line during run, `currentSelection`, `currentActivity`.
- When watched, Arcade design changes are saved locally immediately and publish a throttled `currentArcadeDesign` snapshot. Pixel/map edits never stream unless that student is `activeStudentView`.
- When watched, HTML: `currentFiles` per active-tab keystroke, `currentActiveFile`, `currentSelection`, `currentActivity`.
- When watched, `code_arrange` tasks (Python or HTML module): `currentCodeArrangeSlots` on every tile placement/move, independent of the Python/HTML rules above — `currentCode`/`currentFiles` for the task only update once the arrangement is fully assembled (see `CodeArrangeTaskContainer.jsx`).
- When watched, Scratch: `currentCode` (settled block state) on change, `currentActivity` for block drags/clicks/green-flag/stop/sprite-drag notices, a throttled (~120ms) `currentSpriteState` snapshot of sprite/clone/backdrop runtime state so the mirror renders live stage motion instead of authored starting positions, and a throttled (~50ms) `currentCursor` live pointer position covering both the stage and each sprite's block workspace. While a block is actively being dragged, its live in-progress position (not just the settled `currentCode` state on drop) also streams as `currentBlockDrag`, read directly off Blockly's own drag-tracked coordinates — the mirror repositions that block (if it already has it from the last settled sync) via Blockly's `moveTo`, without treating it as a real drag. The broadcast direction (`teacherLive`) mirrors the same fields (`code`, `activity`, `spriteState`, `cursor`, `blockDrag`); the mirror's visible sprite tab follows the source's tab automatically whenever a workspace-target cursor is live, and a cursor with no update for 2s fades out rather than freezing in place.
- Quiz: `currentAnswer` on submit; also written incrementally for match and fill-blank as tiles are placed.
- Quiz attempts are reportable even when the task has no explicit `check`. The attempt log stores structured submissions for fill-blank and match, numeric ratings for confidence, and text for open short-answer. Confidence and open short-answer use the internal passed flag only as a UI completion signal; reports translate them to `finalResult: not_applicable` and `passed: null`.
- Carry-through walk-back: when a live lesson task carries from a skipped source and resolves to an earlier saved source in the authored carry chain, the student writes own `carryFallbackLog/{taskId}` with the carry field, requested source, resolved source, skipped source ids, and server timestamp. Empty saved state is not skipped.
- Personal sandbox: own `inPersonalSandbox` set to `true` on entry and `null` on exit.
- Topic library: own `currentTopicId` when a topic opens; cleared when dialog closes and by `setTaskId`.
- Name entry: own `joiningStudents/{tempId}` during name-entry phase; removed on joining or leaving.
- Dismiss a teacher highlight: removes one `teacherHighlights/{highlightId}` entry on their own node (same `removeTeacherHighlight` call the teacher uses to retract one).
- Presence: own `windowFocused` and `lastActivityAt` via `writeStudentPresence`, independent of the `online` onDisconnect key.
- Remote edit/stage consent: `acceptTeacherEdit`/`acceptTeacherStage` set their own `teacherEditAcceptedAt`/`teacherStageAcceptedAt`; `declineTeacherEdit`/`declineTeacherStage` clear the corresponding request fields without accepting.
- Stage reference reveal: after a failed attempt, students can reveal their own Python/HTML Support `codeStages` entries. The same `supportRevealLog` record stores `source: "student"`, stage label, attempt count, and server timestamp. Revealing does not change editor contents.

Firebase Realtime Database security rules are in `database.rules.json`. Sessions are publicly readable. Teachers/admins (email auth with `role` custom claim) can write session-level fields, `overrideLog`, and `supportRevealLog`. Students (anonymous auth) can write only to their own `students/{anonymousId}` node, their own `attemptLog/{anonymousId}` node, their own `carryFallbackLog/{anonymousId}` node, and their own `supportRevealLog/{anonymousId}` node, where `$anonymousId` must equal `auth.uid`. Any authenticated user can write to `joiningStudents/{tempId}` (name-entry presence markers).

## onDisconnect Rules

- `activeStudentView` is cleared when the teacher disconnects.
- `teacherLive` is set to null when the teacher disconnects.
- Student `online` key is removed on disconnect, not set to false.
- Session node is deleted when the teacher calls `endSession()` and disconnects.
- `joiningStudents/{tempId}` key is removed on disconnect with `onDisconnect().remove()`.

## Session Reports (`lessons/{lessonId}/sessionReports` subcollection)

Reports include all non-information tasks, including check-less quiz interactions. Each per-student task entry and each task summary has `taskType`; quiz entries also have `quizType`. Each task summary has `priority`, defaulting omitted task priority to `core`. Confidence and open short-answer summaries use `respondedCount` instead of pass/fail completion metrics. Fill-blank and match summaries add missed-blank or missed-pair breakdowns. Carry-through walk-backs add per-student `carryFallback` metadata and task-level `carryFallbackCount`/`carryFallbacks`. Support-stage reveals add per-student `supportReveals` metadata and task-level `supportRevealCount`, `supportRevealStudentCount`, and `supportRevealSources`.

Written once per session run, when the teacher ends (or restarts, since restart is only reachable after `endSession()`) a session. `TeacherView.handleEndSession` builds the report client-side via `buildSessionReport({ session, lesson })` (`src/shared/lessonReport.js`) from the in-memory `session` snapshot — combining `session.students` (roster), `session.attemptLog` (full per-task attempt history), `session.overrideLog` (teacher move-on records), `session.carryFallbackLog` (carry walk-back records), `session.supportRevealLog` (read-only stage references opened by teacher/student), `session.taskStartTimes`, and the lesson's task list — then writes it with `saveSessionReport` (`src/shared/lessonService.js`) before the RTDB `endSession()` update wipes live session data. Doc ID is the report's `sessionId` (`String(session.startedAt)`), so each distinct run of a lesson gets its own report doc. Information tasks are excluded — there is nothing to grade.

Override records make moved-on tasks complete without claiming a real pass. If a student had at least one failed attempt before the teacher moved them on, the task reports `finalResult: overridden_failed`; if they had no attempt, it reports `finalResult: overridden_unattempted`. `distinctAttempts[].passed` remains `false` unless an actual check passed.

`buildSessionReport` can also be called against a still-live session (state `active`/`sandbox`, not yet ended) to preview an in-progress session's report before it's saved — this is how the "current report" view works (see below); the result is never written to Firestore in that case.

Each task result carries `timeOnTaskMs`: the gap between `taskStartTimes[taskId]` and either the passing attempt's `passedAt` (if completed) or the latest attempt's `loggedAt` (if not) — `null` if the task never started or nothing was logged. `taskSummary` carries the class average as `avgTimeOnTaskMs` (averaged only over students with a non-null value).

Read/write access mirrors the `feedback` subcollection: teacher or admin only (see `firestore.rules`; the rule's recursive wildcard already supports admin-wide `collectionGroup()` reads). Teachers view reports via `TeacherReportModal` (shown right after ending a session) and `TeacherReportsPanel` (a persistent list reachable any time from the lesson's Reports button, querying the subcollection ordered by `startedAt` desc; while a session is running, `TeacherView` also passes it a `liveReport` built from the live session, shown as an "In progress" row above the saved reports). Admins browse saved reports from the **Lessons** tab: expand a lesson row to see report counts and a collapsible report list. Export to YAML uses `reportToYamlText` with the same `js-yaml` options as `cli/yaml-converter.mjs`.

```json
{
  "lessonId": "python-l3-09",
  "lessonTitle": "Dictionaries",
  "sessionId": "1234567890",
  "startedAt": 1234567890,
  "endedAt": 1234567999,
  "students": [
    {
      "anonymousId": "uuid",
      "displayName": "Jamie",
      "tasks": [
        {
          "taskId": 1,
          "title": "Task One",
          "taskType": "code | quiz",
          "quizType": "multiple_choice | match | fill_blank | short_answer | confidence",
          "completed": true,
          "attempts": 3,
          "finalResult": "passed | failed | not_attempted | not_applicable | overridden_failed | overridden_unattempted",
          "timeOnTaskMs": "number | null",
          "override": {
            "taskId": 1,
            "overriddenAt": 1234567890,
            "attemptNumber": 1,
            "previousCheckState": "failed | unattempted"
          },
          "supportReveals": [
            { "taskId": 1, "stageIndex": 0, "stageLabel": "With a variable already created", "source": "teacher | student", "attemptNumber": 2, "revealedAt": 1234567890 }
          ],
          "distinctAttempts": [
            { "attemptNumber": 1, "passed": "boolean | null", "retries": 1, "suggestion": "string | null", "submission": "string | object | number | null" }
          ]
        }
      ]
    }
  ],
  "taskSummary": [
    {
      "taskId": 1,
      "title": "Task One",
      "priority": "core | optional",
      "taskType": "code | quiz",
      "quizType": "multiple_choice | match | fill_blank | short_answer | confidence",
      "totalStudents": 12,
      "completedCount": 9,
      "completionRate": 0.75,
      "overrideCount": 2,
      "overriddenFailedCount": 1,
      "overriddenUnattemptedCount": 1,
      "avgAttempts": 2.3,
      "avgTimeOnTaskMs": "number | null",
      "commonFailures": [{ "suggestion": "string", "count": 4 }],
      "supportRevealCount": 3,
      "supportRevealStudentCount": 2,
      "supportRevealSources": { "teacher": 1, "student": 2 },
      "respondedCount": "number (confidence/open short-answer summaries)",
      "ratingDistribution": { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
      "blankFailures": [{ "blankId": "string", "expected": "string", "count": 1, "values": [{ "value": "string", "count": 1 }] }],
      "pairFailures": [{ "pairId": "string", "prompt": "string", "expected": "string", "count": 1, "values": [{ "value": "string", "count": 1 }] }]
    }
  ]
}
```

## Lesson Levels (`lessonLevels` collection)

Reusable level records are stored in `lessonLevels/{levelId}` and linked from lessons. Legacy scalar `lesson.level` values are migrated automatically by the admin lesson list and by publish helpers.

```json
{
  "id": "python-level-1",
  "title": "Level 1",
  "description": "",
  "order": 1,
  "color": "#7c3aed",
  "icon": "star",
  "scopeType": "type | module | course | collection",
  "scopeId": "python"
}
```

Lessons keep a display fallback plus a reference:

```json
{
  "level": "Level 1",
  "levelId": "python-level-1",
  "levelRef": {
    "id": "python-level-1",
    "scopeType": "type",
    "scopeId": "python"
  }
}
```

The builder and admin UI link lessons to existing levels; create/manage levels from the collapsible **Levels** section in Admin > Lessons or with `node cli/cli.mjs levels`.

## Classes (`classes` collection)

Durable class records are admin-only organisational data used to create reusable lesson forks. Students never read class records directly and do not select classes in the student flow. A forked lesson is still a normal public lesson under `lessons/{sourceLessonId}-{classId}`.

```json
{
  "id": "maple",
  "name": "Maple",
  "archived": false,
  "createdAt": 1234567890,
  "updatedAt": 1234567890
}
```

Class forks keep lineage on the lesson document:

```json
{
  "id": "python-l3-09-maple",
  "title": "Dictionaries - Maple",
  "fork": {
    "sourceLessonId": "python-l3-09",
    "sourceLessonTitle": "Dictionaries",
    "classId": "maple",
    "className": "Maple",
    "taskLinks": [
      { "taskId": 1, "sourceTaskId": 1, "relation": "copied" }
    ]
  }
}
```

Creating a fork again overwrites the fork lesson document, resets the title from the source lesson and class name, rebuilds exact 1:1 task lineage, and clears the fork lesson's `sessionReports` and `feedback` subcollections. It does not copy stock lesson reports, feedback, or live session data.

## localStorage Keys

Do not deviate from these key formats.

| Key | Value |
|---|---|
| `headstart_identity` | `{ anonymousId, displayName, lastSessionTimestamp }` |
| `headstart_{lessonId}_{taskId}_{anonymousId}` | `{ code?, output?, runStatus?, state? }` for Python/Scratch |
| `headstart_{lessonId}_{taskId}_{filename}_{anonymousId}` | `{ content }` for HTML per-file |
| `headstart_{lessonId}_personalsandbox_{anonymousId}` | `{ code?, state? }` for personal sandbox Python/Scratch; `{ fs }` for Filesystem |
| `headstart_{lessonId}_personalsandbox_{filename}_{anonymousId}` | `{ content }` for personal sandbox HTML per-file |
| `headstart_builder_current` | Full lesson JSON object |

## LaunchPad Code Files

Anonymous learner backups are browser downloads, not Firebase records. Python exports use the versioned `.launchpad` JSON format with `format: "headstart-launchpad-code"`, `version: 1`, `language: "python"`, and one or more `{ id, title, code }` tasks. A one-task download and an all-saved-tasks download intentionally use the same extension and schema.

The landing page validates a selected `.launchpad` file and passes it to `/code`, which provides a focused Python editor/runner. Imports never write to Firebase and do not alter lesson-task localStorage keys. The session-end prompt is a warning about browser/device storage, not a claim that localStorage has a timed expiry.

## URL Structure

| URL | Behaviour |
|---|---|
| `/` | Landing page; student enters lesson ID |
| `/login` | Email/password sign-in for teachers/admins; reads `?redirect` |
| `/account` | Authenticated account settings; teachers/admins can change their own password |
| `/admin` | Admin portal; admin role required |
| `/lesson/:lessonId` | Solo student mode |
| `/lesson/:lessonId?live=true` | Live student mode |
| `/lesson/:lessonId?teacher=true` | Teacher view; redirects unauthenticated users to login |
| `/lesson/:lessonId?teacher=true&present=true` | Teacher presentation view; auth required |
| `/code` | Imported `.launchpad` Python code workspace |
| `/builder` | Lesson builder |

No room IDs. There is one session per lesson.

## Session States

| State | Meaning |
|---|---|
| `waiting` | Session created; students wait |
| `active` | Live lesson; teacher controls current task |
| `sandbox` | Freeform mode; no task and no checks |
| `ended` | Session finished |
| any state plus `isPaused: true` | Freeze student navigation without changing state |

## Identity Model

- Anonymous ID is the UID from a Firebase Anonymous Auth session (`signInAnonymously`, persisted via `browserLocalPersistence`), not a locally-generated UUID — this is what lets Realtime Database security rules require `$anonymousId === auth.uid`. It falls back to `crypto.randomUUID()` only if anonymous sign-in itself fails. A legacy locally-generated UUID found in `localStorage` is migrated to the current auth UID on load.
- Display name is separate; teacher rename must not affect keys or localStorage.
- Compare local `lastSessionTimestamp` with Firebase `createdAt`.
- Matching timestamp means same session: skip name entry and restore work.
- Different timestamp means new session: fresh name entry and new anonymous ID.
- Duplicate names receive numeric suffixes: `Jamie`, `Jamie-2`, `Jamie-3`.
