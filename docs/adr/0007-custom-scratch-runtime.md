# ADR 0007: Custom Scratch runtime

## Status

Accepted.

## Context

Scratch-style lessons need controlled block execution, check evaluation, serialization, and builder integration inside the existing app.

## Decision

Use Blockly-based workspaces with a custom Scratch runtime/interpreter in `src/modules/scratch/`.

## Consequences

- Scratch checks, persistence, and runtime behavior are type-owned.
- Serialization changes must account for Firestore depth limits via `lessonBlocksCodec`.
- Scratch changes usually affect `docs/authoring/scratch.md`, `docs/authoring/scratch-toolbox-xml.md`, module tests, and feature docs.

