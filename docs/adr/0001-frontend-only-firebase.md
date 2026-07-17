# ADR 0001: Frontend-only Firebase architecture

## Status

Accepted.

## Context

The platform serves classroom, builder, admin, and login routes from one React/Vite app. It needs durable lesson content, live classroom state, account management, and asset storage without operating a custom backend.

## Decision

Do not add a backend server or API. Use Firebase Auth, Firestore, Realtime Database, Storage, and Cloud Functions where the repo already establishes them.

## Consequences

- Feature work must fit the existing Firebase data model and security rules.
- Account management belongs in Cloud Functions, not browser-only admin writes.
- Any backend-like workflow should first be considered as client code, CLI code using Firebase Admin SDK, or an existing Cloud Function.
- Docs that usually change: `docs/agents/project-rules.md`, `docs/agents/runtime-model.md`, Firebase rules, and `docs/architecture/feature-impact-map.md`.

