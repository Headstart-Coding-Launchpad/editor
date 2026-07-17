# ADR 0005: Worker-based Python runtime

## Status

Accepted.

## Context

Python tasks need browser-based execution without blocking the UI. Pyodide startup and execution are expensive enough that they should not run directly on the main thread.

## Decision

Run Pyodide through a Web Worker managed by `src/modules/python/pyodide.js` and `src/modules/python/pyodide.worker.js`.

## Consequences

- UI code should use the runtime manager rather than importing worker internals.
- Tests should mock the manager interface; they should not import or execute the worker directly.
- Python runtime behavior changes usually affect classroom behavior docs and testing guidance.

