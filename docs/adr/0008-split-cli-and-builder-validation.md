# ADR 0008: Split CLI and Builder validation

## Status

Accepted.

## Context

The CLI validates lesson data in Node.js for authoring and publishing workflows. The Builder validates richer browser-only editing states and can use browser APIs unavailable to the CLI.

## Decision

Keep CLI validation and Builder validation separate, while documenting the difference clearly.

## Consequences

- A lesson can pass CLI validation and still trigger Builder-only validation.
- Schema and YAML docs must say which validator enforces which rule.
- Validation changes often require updates to `cli/validate.mjs`, `src/builder/lessonUtils.js`, authoring docs, and tests.

