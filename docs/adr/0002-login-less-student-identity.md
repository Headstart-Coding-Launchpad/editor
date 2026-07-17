# ADR 0002: Login-less student identity

## Status

Accepted.

## Context

Students need a low-friction classroom join flow. Teachers and admins need authenticated access, but requiring student accounts would slow lessons down and create avoidable account-management work.

## Decision

Students remain login-less. The app stores anonymous student identity and display name state in localStorage and uses session-scoped Realtime Database paths for live classroom participation.

## Consequences

- Do not require Firebase Auth email/password for student operations.
- Do not move anonymous ID storage to sessionStorage.
- Teacher rename changes display name only; it must not change identity keys or localStorage keys.
- Persistence docs and tests must change with identity changes.

