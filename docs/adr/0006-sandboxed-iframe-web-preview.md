# ADR 0006: Sandboxed iframe web preview

## Status

Accepted.

## Context

HTML lessons need to preview multi-file student work in the browser while keeping student code isolated from the app shell.

## Decision

Build iframe previews from Blob URLs and inject a restrictive CSP plus console forwarding. Use shared iframe helpers rather than per-surface preview implementations.

## Consequences

- Do not duplicate iframe construction in builder, student, or teacher views.
- Preview changes can affect asset paths, console capture, CSP, and live-view rendering.
- Update `docs/agents/classroom-behaviours.md`, HTML authoring docs, and iframe tests when behavior changes.

