# Shared Workspaces — Implementation Plan

Student-initiated workspace sharing with teacher approval. Written after the requirements interview on 5 September 2026.

This document is intended to be worked through by implementation agents. It records settled decisions, the data model, affected surfaces, phase order, acceptance criteria, and test expectations. Follow `AGENTS.md` and the referenced docs in `docs/`.

---

## Feature Summary

A student on an enabled task presses **Share with class**. The teacher sees a badge on that student's card, opens the student modal, **previews the exact snapshot**, and approves or declines. Approved workspaces land in a class-wide **Shared work** gallery that persists across task changes until the teacher removes them. A classmate opens a shared workspace in a **non-destructive sandbox copy** — they can edit and run it freely without touching their own task work — and can explicitly copy it into their own editor if they want it.

The teacher can also push a student's workspace into the gallery directly from the student modal, without the student asking.

---

## Settled Product Decisions

These came out of the requirements interview and should not be re-opened during implementation unless a blocker is found.

1. **Receiver experience is a non-destructive sandbox copy.** The shared workspace opens in its own view the classmate can edit and run. Their own task state is preserved and untouched, and one action returns them to it. A separate explicit **Copy to my editor** action is the only way shared content reaches their real work.
2. **Shares are frozen snapshots.** Content is captured at the moment of sharing and never updates afterwards. The teacher approves exactly what the class gets. There is no live streaming of a sharer's ongoing edits.
3. **Delivery is a toast plus an opt-in gallery.** A dismissible notification announces a new approved share; a persistent **Shared work (n)** button opens the gallery of everything shared so far, each entry tagged with the task it came from. Nobody is forced into a shared workspace.
4. **All lesson types are in scope**, except quiz and information tasks, which have no workspace to share.
5. **Sharing is enabled per task in the Lesson Builder.** A new task field, off by default. There is no session-level teacher kill switch — if a task does not enable sharing, the button does not exist.
6. **Approved shares persist until the teacher removes them.** They survive task changes for the life of the session.
7. **The teacher previews the snapshot before approving.** A read-only render of the exact content, distinct from the live watch view.
8. **Declining is silent.** The request clears and the student's button returns to normal. No message, no reason.
9. **The teacher can share a student's workspace without the student asking**, from the student modal. No student consent prompt.
10. **Sharing is ephemeral.** Nothing about shares enters the session report or any Firestore record.

---

## Two Architectural Constraints That Shape Everything

These were found while surveying the code and are the reason the data model below is split the way it is. Do not collapse it back into one node.

### 1. A non-watched student's code is not in Firebase

`students/{id}/currentCode` and `currentFiles` are only fresh while `activeStudentView` matches that student — this is an absolute project constraint (`AGENTS.md`: *do not write student code to Firebase per keystroke unless `activeStudentView` matches*). `buildStudentLivePayload` (`src/app/teacherLivePayload.js`) reads exactly those fields, which is why **Go Live for All** works: the teacher is already watching.

Sharing has no such guarantee. A student pressing Share is almost never the watched student.

**Consequence:** the snapshot must be written by the **sharer's own client** at the moment of sharing. The teacher can never build it. This also settles the teacher-initiated case — it needs a snapshot round-trip (teacher asks, student's client answers) rather than reading stale fields. One payload path, always fresh, always student-authored.

### 2. The whole session node streams to every client

`useSession.js:65` subscribes with `onValue(ref(db, 'sessions/{lessonId}'))`. Every client — teacher and every student — receives the entire session node on every change.

**Consequence:** full workspace payloads must not live under `sessions/{lessonId}`. A class of 30 with a handful of Scratch shares would push megabytes to every student on every unrelated session write. Payloads live in a **separate top-level node fetched on demand**; only small metadata goes in the session node.

---

## Data Model

### Session node — metadata only (streams to all)

```json
"sessions": {
  "{lessonId}": {
    "sharedWorkspaces": {
      "{shareId}": {
        "sharerId": "{anonymousId}",
        "sharerName": "Jamie",
        "taskId": 3,
        "taskTitle": "Looping over a list",
        "lessonType": "python",
        "sharedBy": "student | teacher",
        "sharedAt": 1234567890
      }
    },
    "students": {
      "{anonymousId}": {
        "shareRequestedAt": "number | null",
        "shareRequestTaskId": "number | string | null",
        "shareRequestOrigin": "student | teacher | null",
        "shareSnapshotRequestedAt": "number | null"
      }
    }
  }
}
```

`sharedWorkspaces` is an index, not the content. Each entry is a few hundred bytes and is what drives the gallery list, the toast, and the teacher's manage-shares list.

The four per-student fields are the request signal. `shareRequestedAt` drives the card badge. `shareSnapshotRequestedAt` is the teacher asking the student's client for a fresh snapshot (teacher-initiated flow); the student's client answers by writing a pending payload and stamping `shareRequestedAt` with `shareRequestOrigin: 'teacher'`.

### Payload node — content, fetched on demand

```json
"sharedWorkspacePayloads": {
  "{lessonId}": {
    "pending": {
      "{anonymousId}": { /* snapshot, see shape below */ }
    },
    "approved": {
      "{shareId}": { /* snapshot, see shape below */ }
    }
  }
}
```

A top-level sibling of `sessions`. Nobody subscribes to it. The teacher `get()`s `pending/{anonymousId}` when opening a request for preview; a student `get()`s `approved/{shareId}` when opening a gallery entry, and caches it client-side for the session.

### Snapshot shape

Deliberately the same field vocabulary as `buildStudentLivePayload`, so the existing display path can render it with minimal adaptation:

```json
{
  "code": "string",
  "files": { "index__dot__html": "..." },
  "activeFile": "index.html",
  "arcadeDesign": "object | null",
  "output": "string",
  "runStatus": "success | error | null",
  "lessonType": "python",
  "taskId": 3,
  "capturedAt": 1234567890
}
```

File keys use `encodeFileKey`. Live-only fields (`cursor`, `blockDrag`, `spriteState`, `selection`, `activity`, `codeArrangeSlots`) are **not** captured — a snapshot is frozen, so transient interaction state is meaningless and would only bloat the payload.

Modules whose state is neither `code` nor `files` (Scratch, filesystem, electronics) serialize into `code` via the registry's `serializeState`, and are restored with `deserializeState`. Note `src/modules/html/index.js:139` has `serializeState: null` — HTML is a `files` module and uses that branch instead. Arcade carries `arcadeDesign` alongside its code. This is why the snapshot carries both `code` and `files` rather than one opaque blob.

### Lifecycle

| Event | Effect |
|---|---|
| `setTaskId` | Clears the four per-student share request fields, and deletes `pending/{anonymousId}` payloads. Pending requests are per-task and must not survive a task change. **Does not touch** `sharedWorkspaces` or `approved` payloads — that is decision 6. |
| Teacher removes a share | Deletes `sharedWorkspaces/{shareId}` and `approved/{shareId}`. |
| `createSession` / `restartSession` / `endSession` | Sets `sharedWorkspaces` to null and removes the whole `sharedWorkspacePayloads/{lessonId}` subtree. |
| Teacher disconnect | `onDisconnect().remove()` registered on `sharedWorkspacePayloads/{lessonId}`, alongside the existing session-node `onDisconnect` at `useSession.js:143`. Without this, payloads orphan outside the session node that normally self-deletes. |

### RTDB rules (`database.rules.json`)

- `sessions/{lessonId}/sharedWorkspaces` — public read; teacher/admin write only. Students never write the index.
- `sessions/{lessonId}/students/{anonymousId}` — existing rule already covers the four new request fields for the student's own node and for teachers.
- `sharedWorkspacePayloads/{lessonId}/pending/{anonymousId}` — write where `auth.uid === $anonymousId`, or teacher/admin (so the teacher can clear it on approve/decline). Read: teacher/admin only. A pending snapshot has not been approved and must not be readable by classmates.
- `sharedWorkspacePayloads/{lessonId}/approved/{shareId}` — public read; teacher/admin write only.

The pending/approved read split is the actual enforcement of the approval gate. Hiding the button client-side is not sufficient.

### Payload size guard

Scratch and Arcade snapshots can be large. Enforce a client-side cap (suggest 512 KB serialized) before writing a pending payload; over it, the share fails with a plain message to the student and nothing is written. Add the same guard on the teacher-initiated snapshot answer.

---

## Lesson Schema

New optional task field:

```yaml
allowSharing: true
```

- Boolean, default omitted/false. Only valid on code tasks — reject on quiz, information, and group tasks in validation.
- Applies to every lesson type (decision 4).
- For composed lessons, the flag lives on the individual task, and the effective module type comes from `getTaskModuleType` / the per-task effective type — **never** branch on `lesson.type` (see `docs/architecture/composed-lessons-spec.md`).

Surfaces to update:

- `cli/validate.mjs` — type check, task-type applicability check.
- `src/builder/components/task-editor/TaskOptionsSection.jsx` — a checkbox, "Allow students to share this workspace with the class".
- `docs/authoring/lesson-schema.md` and `lesson-schema-yaml.md` — field reference.
- `docs/authoring/AUTHORING_GUIDE.md` — a note on when to enable it.
- `docs/authoring/CHANGELOG.md` — required, this changes how lessons are written.

---

## `useSession` API Additions

Student-side:

- `requestWorkspaceShare(anonymousId, snapshot)` — writes `pending/{anonymousId}` payload, then stamps `shareRequestedAt` / `shareRequestTaskId` / `shareRequestOrigin: 'student'`. Payload first, signal second, so the teacher never sees a badge for a request whose payload has not landed.
- `answerShareSnapshotRequest(anonymousId, snapshot)` — same writes with `shareRequestOrigin: 'teacher'`, and clears `shareSnapshotRequestedAt`.
- `cancelWorkspaceShare(anonymousId)` — student withdraws their own pending request; clears the signal fields and the pending payload.

Teacher-side:

- `requestShareSnapshot(anonymousId)` — stamps `shareSnapshotRequestedAt`.
- `readPendingShare(anonymousId)` — one-shot `get()` of the pending payload for preview.
- `approveWorkspaceShare(anonymousId, meta)` — moves `pending/{anonymousId}` to `approved/{shareId}`, writes the `sharedWorkspaces/{shareId}` index entry, clears the request fields. Do the payload copy first, index entry second — a student must never see a gallery entry whose payload is missing.
- `declineWorkspaceShare(anonymousId)` — clears the request fields and the pending payload. Nothing else (decision 8).
- `removeSharedWorkspace(shareId)` — deletes index entry and approved payload.
- `readSharedWorkspace(shareId)` — one-shot `get()` of an approved payload, for students opening a gallery entry.

---

## Student-Side UI

### Share button

Next to the existing **Need help** button in `StudentView.jsx` (see `handleNeedHelp` at line 662 and the button at line 884 — the same pattern, placement, and state handling).

Visible only when all of: live session (`phase` is `lesson` or `sandbox`), the current task has `allowSharing`, the student is not currently viewing a shared workspace, and the student is not a forced live viewer.

States: **📤 Share with class** → **⏳ Waiting for teacher** (pending, with a cancel affordance) → back to normal on approve or decline. Because declining is silent, the transition out of pending is identical either way — the button simply becomes available again.

### Toast

A new approved share fires a dismissible toast, "Jamie shared their work". Follow the existing `TeacherMessageToast.jsx` / `LiveActivityToast.jsx` pattern. Suppress the toast for the sharer's own share. Dismissal is client-side only — one student dismissing must not clear it for anyone else. This is the same trap called out for `teacherClassPaneCommand` in `docs/agents/runtime-model.md`; the fix there was client-side tracking, and it applies identically here.

### Gallery

A persistent **📤 Shared work (n)** button, shown whenever the index is non-empty, opening a modal list. Each row: sharer name, task title, relative time, and an Open action. Rows for tasks other than the current one are still listed and openable — decision 6 means shares outlive their task, and the task tag is how a student knows what they are looking at.

### Shared workspace viewer

The heart of the feature, and where most of the risk sits.

Render the module's own `StudentWorkspace` from the registry against the deserialized snapshot, using the snapshot's `lessonType` and `taskId` — **not** the student's current task. A share from a Python task must render in the Python module even if the class has since moved to a Scratch task in a composed lesson.

The viewer must be fully non-destructive:

- **No persistence.** No localStorage writes, no RTDB writes. `createStudentPersistence.js` already implements exactly this suppression for personal sandbox via `inPersonalSandboxRef` (lines 47, 58, 73, 84). Add a parallel `viewingSharedWorkspaceRef` and gate the same four write paths on it. Model the whole mode on personal sandbox — it is local-only client state and is the closest existing precedent.
- **No check submission.** Running is allowed; submitting a check against someone else's work is not. Suppress attempt logging entirely.
- **No live-view interference.** A student in the viewer must not stream their view as their own `currentCode`, even if they happen to be the watched student.
- **Back to my work** restores their own task state exactly as it was. Their state was never mutated, so this is a mode exit, not a restore.
- **Copy to my editor** is the only bridge into their real work. Confirm first, since it overwrites their current task content, and only offer it when the shared snapshot's `taskId` matches their current task — copying Python code into a Scratch task is meaningless.

---

## Teacher-Side UI

### Student card (`StudentCard.jsx`)

A **📤 Wants to share** badge in the existing `badgeRow` (line 227), rendered from `shareRequestedAt`. Follow the `needsHelp` badge at line 296 and its card accent at line 143 — this is the same shape of signal and should look like a sibling of it, not a new visual language.

### Student modal (`StudentModal.jsx`)

A **Share request** section, shown when `shareRequestedAt` is set:

- Fetches the pending payload with `readPendingShare` on open.
- Renders it read-only via the module's `TeacherLiveView`, or `StudentWorkspace` read-only where `TeacherLiveView` is null (the registry contract explicitly allows this fallback).
- This preview is deliberately distinct from the live watch view: it shows the frozen snapshot the class would receive, not what the student is doing right now. Label it as such, or a teacher will approve believing they reviewed current work.
- **Approve** and **Decline** actions.

In the existing **More** menu, add **📤 Share this with the class**: calls `requestShareSnapshot`, shows a brief waiting state while the student's client answers, then drops into the same preview and Approve flow above. The teacher still confirms what goes out — the only difference from the student-initiated path is who started it.

Place these near the existing per-student teacher actions and reuse `DropdownMenu.jsx` / the modal's existing section conventions rather than inventing new layout.

### Managing shares

A **📤 Shared work (n)** control in `TeacherSessionControls.jsx`, opening a popover listing active shares with a Remove action on each, plus a Remove all. This is the only way approved shares end before the session does (decision 6).

---

## Phase Order

Each phase is independently reviewable. Prefer separate PRs.

**Phase 1 — Schema and authoring.** The `allowSharing` task field: CLI validation, Builder checkbox, schema docs, authoring changelog. No runtime behaviour. Ships safely on its own; the flag simply does nothing yet.

**Phase 2 — Data layer.** RTDB rules, the `useSession` functions, the lifecycle wiring in `setTaskId` / `createSession` / `restartSession` / `endSession` / teacher `onDisconnect`, and the snapshot builder (a sibling of `buildStudentLivePayload` in `src/app/teacherLivePayload.js`, or a new `sharedWorkspacePayload.js` if that file gets crowded). Unit-testable with no UI.

**Phase 3 — Request and approval loop.** Student share button and pending state; card badge; modal preview with approve/decline. At the end of this phase a share can be requested and approved, but nothing renders it to the class yet. Verify the approval gate here, including that a pending payload is unreadable by a student client.

**Phase 4 — Class delivery.** Index subscription, toast, gallery button and modal, teacher manage-shares popover. Gallery entries open to a placeholder. The whole distribution path is testable before the viewer exists.

**Phase 5 — The viewer.** The non-destructive shared workspace mode, per-module rendering via the registry, Copy to my editor, Back to my work. Largest and riskiest phase; keep it last so everything it depends on is already proven.

**Phase 6 — Teacher-initiated share.** The snapshot round-trip and the More-menu entry, reusing Phase 3's preview. Deliberately last because it is a thin layer over machinery that is by then fully working.

---

## Test Expectations

Follow `docs/TESTING.md`. At minimum:

- `cli/validate.test.js` — `allowSharing` accepted on code tasks, rejected on quiz/information/group, rejected when not boolean.
- `src/app/hooks/__tests__/useSession.test.js` — approve moves payload before writing the index; decline clears request and pending payload and writes nothing else; `setTaskId` clears requests but preserves approved shares; `createSession`/`endSession` clear both nodes; remove deletes index and payload together.
- Snapshot builder tests — code modules, files modules (HTML), serialize-based modules (Scratch, filesystem, electronics), Arcade's extra design field; live-only fields excluded; size cap enforced.
- `StudentCard` — badge renders from `shareRequestedAt` and not otherwise.
- `StudentModal` — preview fetches the pending payload; approve and decline call the right functions and clear the section.
- Student view — share button visibility across the gating conditions; pending state; button returns to normal on both approve and decline.
- Gallery — lists index entries with task tags; opening fetches the approved payload once and caches it.
- **Viewer non-destructiveness is the critical test.** Assert that entering the viewer, editing, and running produces zero localStorage writes and zero RTDB writes to the viewer's own node, and that their task state is byte-identical after Back to my work. Mirror the existing personal-sandbox suppression tests.
- Composed lessons — a share from a task of one module type renders in that module while the class is on a task of another. Do not gate on `lesson.type`.

**Verify the viewer in a real browser, not just jsdom.** The gallery modal, the viewer overlay, and the toast all stack over the existing workspace UI, and jsdom does not catch pointer-events and click-stacking bugs on layered UI. This has bitten this project before.

Also run `npm run docs:check` and the full `npm test` before handing back.

---

## Risks and Open Points

- **Scratch is the highest-risk module.** It has a documented history of a shared workspace being mutated in place by broadcast rendering, fixed by remounting rather than reusing the workspace. Render the viewer's Blockly workspace as a fresh remount keyed on `shareId`, and never hand it the student's own workspace instance. Budget extra verification here.
- **Payload size for Scratch and Arcade.** The 512 KB cap is a starting figure. Measure real snapshots from existing lessons before settling it, and make the failure message specific rather than a generic error.
- **Gallery growth.** Shares persist until removed, so a long session with an enthusiastic class could accumulate dozens. Consider a soft cap (oldest auto-removed past ~20) if this shows up in practice; not needed for v1.
- **Solo mode is out of scope.** Sharing is a live-session feature. The button must not appear in solo, in builder preview, or in teacher presentation mode.
- **Decline is silent by decision**, which means a student who is declined may re-request immediately and repeatedly. If this proves disruptive in real classroom use, the smallest fix is a short client-side cooldown on the share button, not a change to the decline semantics.

---

## Docs To Update

- `docs/agents/runtime-model.md` — the new Firebase nodes, write rules, lifecycle, and `onDisconnect` behaviour.
- `docs/agents/classroom-behaviours.md` — student-side share and viewer behaviour.
- `docs/FEATURES.md` — the feature itself.
- `docs/MODULE_FEATURE_MATRIX.md` — sharing support per module.
- `docs/CODEBASE_MAP.md` — any new files.
- `docs/architecture/feature-impact-map.md` — the coupling this feature introduces.
- `docs/authoring/` — as listed under Lesson Schema above.
