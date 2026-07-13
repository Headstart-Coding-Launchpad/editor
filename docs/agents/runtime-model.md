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
        "activity": { "type": "copy | paste | click", "at": 1234567890, "file": "index.html" },
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
      "attemptLog": {
        "{anonymousId}": {
          "{taskId}": {
            "{pushId}": {
              "submission": "string | object (code / files / scratch or fs state / quiz answer)",
              "passed": true,
              "suggestion": "string | null",
              "attemptNumber": 1,
              "retries": 0,
              "loggedAt": "ServerValue.TIMESTAMP"
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
          "currentFiles": { "index__dot__html": "..." },
          "currentOutput": "string",
          "currentAnswer": "b",
          "currentActiveFile": "index.html",
          "currentSelection": { "from": 0, "to": 5, "file": "index.html" },
          "currentActivity": { "type": "copy | paste | click", "at": 1234567890, "file": "index.html" },
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
- `activeStudentView`, `teacherLive`
- `sandboxCode`, `sandboxCodePushedAt`, `sandboxFiles`, `sandboxFilesUpdatedAt`
- `lessonOverrideTasks` (session-only task edits from `EditLessonModal`; `pushLessonOverride`/`clearLessonOverride`) — reset to `null` on `createSession`/`endSession`. Task IDs inside it are never renumbered, so they stay valid against `currentTaskId`, carry-through references, and student per-task localStorage keys
- any student's `displayName`
- student node removal

Teacher per-student actions:

- Remote reset writes `remoteResetAction` and `remoteResetPushedAt`.
- Check override writes `checkOverridePassed`, `checkOverrideHint`, and `checkOverridePushedAt`; cleared by `setTaskId`.
- Send to topic writes `sentToTopicId` and `sentToTopicPushedAt`; cleared by `setTaskId`.
- Highlight code (`pushTeacherHighlight`) adds an entry under `teacherHighlights/{highlightId}`; the teacher (or the student — see below) can remove any entry (`removeTeacherHighlight`). All entries cleared by `setTaskId`.

Student writes:

- On run: own `currentCode` / `currentFiles`, `currentOutput`, `lastRunStatus`, `checkPassed`, `lastRunAt`.
- On a graded check result (lesson phase only, not sandbox): own `attemptLog/{taskId}/{pushId}` via `logAttempt` — deduplicated client-side, so an unchanged resubmission only bumps `retries` on the existing entry rather than pushing a new one, and no further entries are written once a task has passed. `attemptLog` is a sibling of `students`, not nested inside it, so it is untouched by `setTaskId`'s per-task field wipe and is still present in the teacher's in-memory `session` snapshot at the moment `endSession()` runs — that snapshot is what `buildSessionReport` (`src/shared/lessonReport.js`) reads to build the Firestore report described under "Session Reports" below.
- When watched, Python: `currentCode` per keystroke, `currentOutput` line by line during run, `currentSelection`, `currentActivity`.
- When watched, HTML: `currentFiles` per active-tab keystroke, `currentActiveFile`, `currentSelection`, `currentActivity`.
- Quiz: `currentAnswer` on submit; also written incrementally for match and fill-blank as tiles are placed.
- Personal sandbox: own `inPersonalSandbox` set to `true` on entry and `null` on exit.
- Topic library: own `currentTopicId` when a topic opens; cleared when dialog closes and by `setTaskId`.
- Name entry: own `joiningStudents/{tempId}` during name-entry phase; removed on joining or leaving.
- Dismiss a teacher highlight: removes one `teacherHighlights/{highlightId}` entry on their own node (same `removeTeacherHighlight` call the teacher uses to retract one).

Firebase Realtime Database security rules are in `database.rules.json`. Sessions are publicly readable. Teachers/admins (email auth with `role` custom claim) can write session-level fields. Students (anonymous auth) can write only to their own `students/{anonymousId}` node and their own `attemptLog/{anonymousId}` node, where `$anonymousId` must equal `auth.uid`. Any authenticated user can write to `joiningStudents/{tempId}` (name-entry presence markers).

## onDisconnect Rules

- `activeStudentView` is cleared when the teacher disconnects.
- `teacherLive` is set to null when the teacher disconnects.
- Student `online` key is removed on disconnect, not set to false.
- Session node is deleted when the teacher calls `endSession()` and disconnects.
- `joiningStudents/{tempId}` key is removed on disconnect with `onDisconnect().remove()`.

## Session Reports (`lessons/{lessonId}/sessionReports` subcollection)

Written once per session run, when the teacher ends (or restarts, since restart is only reachable after `endSession()`) a session. `TeacherView.handleEndSession` builds the report client-side via `buildSessionReport({ session, lesson })` (`src/shared/lessonReport.js`) from the in-memory `session` snapshot — combining `session.students` (roster), `session.attemptLog` (full per-task attempt history), and the lesson's task list — then writes it with `saveSessionReport` (`src/shared/lessonService.js`) before the RTDB `endSession()` update wipes the live session's `students`/`attemptLog` data. Doc ID is the report's `sessionId` (`String(session.startedAt)`), so each distinct run of a lesson gets its own report doc. Information tasks (no `check`) are excluded — there is nothing to grade.

Read/write access mirrors the `feedback` subcollection: teacher or admin only (see `firestore.rules`). Teachers view reports via `TeacherReportModal` (shown right after ending a session) and `TeacherReportsPanel` (a persistent list reachable any time from the lesson's Reports button, querying the subcollection ordered by `startedAt` desc). Export to YAML uses `reportToYamlText` with the same `js-yaml` options as `cli/yaml-converter.mjs`.

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
          "completed": true,
          "attempts": 3,
          "finalResult": "passed | failed | not attempted",
          "distinctAttempts": [
            { "attemptNumber": 1, "passed": false, "retries": 1, "suggestion": "string | null", "submission": "string | object | null" }
          ]
        }
      ]
    }
  ],
  "taskSummary": [
    {
      "taskId": 1,
      "title": "Task One",
      "totalStudents": 12,
      "completedCount": 9,
      "completionRate": 0.75,
      "avgAttempts": 2.3,
      "commonFailures": [{ "suggestion": "string", "count": 4 }]
    }
  ]
}
```

## Lesson Drafts (`lessonDrafts` collection)

Admin-only Firestore collection for the lesson authoring workflow (Ideas → Details → Review → Publish). Draft content is Markdown prose, not lesson JSON. Drafts never appear in the classroom.

```json
{
  "id": "python-l3-09",
  "stage": "ideas | details | review | approved | published",
  "title": "Dictionaries",
  "type": "python",
  "level": 3,
  "content": "# Markdown lesson plan content (the Ideas or Details document)",
  "context": "AI working notes: prerequisites, open decisions, author reasoning",
  "reviewNotes": [
    {
      "sectionId": "4-runnable-reminder-rps-snippet",
      "sectionTitle": "4. Runnable Reminder — RPS Snippet",
      "decision": "pending | accepted | rejected",
      "suggestedChange": "The recap code is too complex…",
      "extraNote": "",
      "createdAt": 1234567890
    }
  ],
  "_meta": {
    "authorEmail": "ai@headstart",
    "createdAt": "Timestamp",
    "updatedAt": "Timestamp",
    "reviewedBy": "ryan@flemtech.co.uk",
    "reviewedAt": "Timestamp | null"
  }
}
```

Section IDs are slugified H3 headings from the Markdown stored in `content`. The CLI reads a YAML file on `lessons draft upsert`; fields: `title`, `type`, `level`, `stage`, `content` (Markdown body), `context`, `author`. Stage flow: `ideas → details → review → approved → published`.

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

## URL Structure

| URL | Behaviour |
|---|---|
| `/` | Landing page; student enters lesson ID |
| `/login` | Email/password sign-in for teachers/admins; reads `?redirect` |
| `/admin` | Admin portal; admin role required |
| `/lesson/:lessonId` | Solo student mode |
| `/lesson/:lessonId?live=true` | Live student mode |
| `/lesson/:lessonId?teacher=true` | Teacher view; redirects unauthenticated users to login |
| `/lesson/:lessonId?teacher=true&present=true` | Teacher presentation view; auth required |
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

- Anonymous ID is a random UUID generated on first visit and stored in `localStorage`.
- Display name is separate; teacher rename must not affect keys or localStorage.
- Compare local `lastSessionTimestamp` with Firebase `createdAt`.
- Matching timestamp means same session: skip name entry and restore work.
- Different timestamp means new session: fresh name entry and new anonymous ID.
- Duplicate names receive numeric suffixes: `Jamie`, `Jamie-2`, `Jamie-3`.
