# Runtime Flows

This page captures the design intent behind the classroom runtime. Use the deeper agent references for exact field names and security details:

- `docs/agents/runtime-model.md`
- `docs/agents/classroom-behaviours.md`
- `docs/architecture/feature-impact-map.md`

## Route Ownership

```mermaid
flowchart TD
  App["src/App.jsx"] --> Login["/login"]
  App --> Lesson["/lesson/:lessonId"]
  App --> Code["/code"]
  App --> Admin["/admin"]
  App --> Builder["/builder"]
  Lesson --> Student["StudentView"]
  Lesson --> Teacher["TeacherView when teacher query/auth allows"]
  Code --> CodeWorkspace["CodeFileWorkspace"]
  Admin --> Protected["ProtectedRoute admin"]
  Builder --> BuilderApp["Builder route"]
```

The app stays frontend-only. Firebase supplies auth, durable lesson/admin data, live session data, storage, and account-management functions.

## Student Phase State

```mermaid
stateDiagram-v2
  [*] --> loading
  loading --> waiting: live session not ready
  loading --> nameEntry: live session open
  loading --> solo: solo link or no active session
  waiting --> nameEntry: teacher starts session
  nameEntry --> lesson: student joins
  solo --> lesson: student joins live session
  lesson --> sandbox: personal sandbox opened
  sandbox --> lesson: sandbox closed
  lesson --> ended: teacher ends session
  ended --> solo: continue solo
```

`useStudentPhase.js` owns the phase and current/viewing task decisions. Student identity remains login-less and is stored in localStorage.

## Student Persistence

```mermaid
flowchart TD
  Edit["Student edits workspace"] --> Local["localStorage saved work"]
  Edit --> Active{"activeStudentView matches?"}
  Active -->|yes| RTDB["Realtime Database student snapshot"]
  Active -->|no| LocalOnly["No per-keystroke Firebase write"]
  Run["Run or Submit"] --> Results["Output/check result"]
  Results --> RTDB
  Sandbox["Personal sandbox"] --> SandboxKeys["Separate sandbox persistence keys"]
  Local --> Export["Download current or all saved Python tasks (.launchpad)"]
  Export --> Import["Landing page: Open saved code"]
  Import --> CodeWorkspace["Focused Python editor/runner"]
```

The important invariant is that normal student code is local-first. Firebase streaming is reserved for teacher live-view moments and explicit run/check events.

## Teacher Live View

```mermaid
flowchart TD
  Teacher["Teacher opens student modal"] --> ActiveView["Set activeStudentView"]
  Student["Matching student client"] --> Stream["Publish live payload"]
  Stream --> TeacherModal["Teacher sees workspace/output"]
  TeacherAction["Teacher action"] --> Session["RTDB session command/state"]
  Session --> StudentClient["Student client applies reset/stage/message/override"]
  Close["Close modal or leave"] --> Clear["Clear activeStudentView"]
```

All ways of closing the modal should clear `activeStudentView`. This prevents accidental long-running student code streaming.

## Firebase Ownership

```mermaid
flowchart LR
  Firestore["Firestore"] --> Lessons["lessons, topicLibrary, users, reports, feedback"]
  RTDB["Realtime Database"] --> Sessions["live sessions and student snapshots"]
  Storage["Storage"] --> Assets["lesson and shared assets"]
  Functions["Cloud Functions"] --> Accounts["account management"]
```

When any path, write owner, or security assumption changes, update `docs/agents/runtime-model.md`, the relevant Firebase rules, and the feature impact map.

