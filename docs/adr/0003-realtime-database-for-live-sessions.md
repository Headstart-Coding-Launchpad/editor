# ADR 0003: Realtime Database for live sessions

## Status

Accepted.

## Context

Live classrooms need frequent state updates for session state, student presence, run/check results, teacher commands, and selected live-view snapshots.

## Decision

Use Firebase Realtime Database for live session state. Use Firestore for durable lesson/admin/report content.

## Consequences

- Session field changes require rule, hook, and runtime-model updates.
- Student code must not be written to Firebase per keystroke unless `activeStudentView` matches.
- Session lifecycle changes should update `docs/agents/runtime-model.md`, `docs/agents/classroom-behaviours.md`, and `docs/architecture/runtime-flows.md`.

