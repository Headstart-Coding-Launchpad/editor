# ADR 0004: Lesson type module registry

## Status

Accepted.

## Context

The platform supports multiple code lesson types. Without a registry, every new type would require branching through student, teacher, and builder surfaces.

## Decision

Each lesson type owns a module under `src/modules/<type>/` and registers through `src/modules/registry.js`.

## Consequences

- Core classroom and builder code should request module behavior instead of duplicating type-specific branches.
- New module properties require updates to the module contract test and `docs/architecture/lesson-type-modules.md`.
- Authoring docs, feature docs, and codebase inventory should change with new or changed lesson types.

