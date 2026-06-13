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
      "joiningStudents": {
        "{tempId}": { "joinedAt": 1234567890 }
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
          "sentToTopicPushedAt": "number | null"
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
- any student's `displayName`
- student node removal

Teacher per-student actions:

- Remote reset writes `remoteResetAction` and `remoteResetPushedAt`.
- Check override writes `checkOverridePassed`, `checkOverrideHint`, and `checkOverridePushedAt`; cleared by `setTaskId`.
- Send to topic writes `sentToTopicId` and `sentToTopicPushedAt`; cleared by `setTaskId`.

Student writes:

- On run: own `currentCode` / `currentFiles`, `currentOutput`, `lastRunStatus`, `checkPassed`, `lastRunAt`.
- When watched, Python: `currentCode` per keystroke, `currentOutput` line by line during run, `currentSelection`, `currentActivity`.
- When watched, HTML: `currentFiles` per active-tab keystroke, `currentActiveFile`, `currentSelection`, `currentActivity`.
- Quiz: `currentAnswer` on submit; also written incrementally for match and fill-blank as tiles are placed.
- Personal sandbox: own `inPersonalSandbox` set to `true` on entry and `null` on exit.
- Topic library: own `currentTopicId` when a topic opens; cleared when dialog closes and by `setTaskId`.
- Name entry: own `joiningStudents/{tempId}` during name-entry phase; removed on joining or leaving.

Firebase Realtime Database security rules live in `database.rules.json`. Sessions are public-read. Authenticated teachers/admins (`auth.token.role == 'teacher' | 'admin'`) can write anything in a session. Unauthenticated clients (students) can write only to `students/$anonymousId` and `joiningStudents/$tempId` sub-paths — they cannot touch session-control fields. Because students have no Firebase Auth identity, we cannot verify that an unauthenticated caller owns a specific `anonymousId`; the rules restrict *what* paths students can write, not *which* student writes them.

## onDisconnect Rules

- `activeStudentView` is cleared when the teacher disconnects.
- `teacherLive` is set to null when the teacher disconnects.
- Student `online` key is removed on disconnect, not set to false.
- Session node is deleted when the teacher calls `endSession()` and disconnects.
- `joiningStudents/{tempId}` key is removed on disconnect with `onDisconnect().remove()`.

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
