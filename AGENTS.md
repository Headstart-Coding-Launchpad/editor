# AGENTS.md - Headstart Coding Classroom REPL Platform

Shared quick-start instructions for AI coding agents. Keep this file short and tool-neutral; load the referenced docs only when the task needs them.

## Session Start Checklist

Before writing code:

- Check open PRs with `gh pr list`.
- Confirm the current branch with `git branch --show-current` or `git branch`.
- Run `npm test`; the suite must pass before changes.
- Use `CODEBASE_MAP.md` as an index. Search or open only the relevant sections instead of reading the whole map by default.

## Project Summary

Headstart Coding is a browser-based classroom coding platform for live sessions and solo study. It is one React/Vite app deployed to GitHub Pages with these route-based areas:

- Classroom at `/lesson/:lessonId`
- Lesson Builder at `/builder`
- Admin Portal at `/admin`
- Login at `/login`

No backend server exists or should be added. Firebase provides auth, Firestore, Realtime Database, Storage, and Cloud Functions where already established.

## Absolute Constraints

- Do not add a backend server or API.
- Do not add dependencies without confirming with the user.
- Teachers and admins use Firebase Auth email/password; students remain login-less.
- Do not require Firebase Auth for student operations.
- Do not use `sessionStorage` for the anonymous ID; use `localStorage`.
- Do not write student code to Firebase per keystroke unless `activeStudentView` matches.
- Do not re-render the iframe per keystroke during live view; render only on Run.
- Do not hardcode student limits.
- Do not add pip install support or file I/O support.
- Do not deviate from Firebase data model, localStorage key formats, URL structure, or session-state semantics.
- Do not duplicate Pyodide, iframe, CodeMirror, checks, Markdown, file-key, or task utility logic; use shared modules.
- Do not store Firebase file keys with raw dots; use `encodeFileKey` / `decodeFileKey`.
- Do not create, copy, or write `.env` inside the repo or a worktree; env lives one level above the repo root.

## Load Only What You Need

| Task area | Read this first |
|---|---|
| File ownership or locating code | `CODEBASE_MAP.md` relevant section |
| Product capabilities | `FEATURES.md` |
| Project rules, stack, shared modules, CLI, admin | `docs/agents/project-rules.md` |
| Firebase, localStorage, URLs, session states, identity | `docs/agents/runtime-model.md` |
| Classroom live-view, sandbox, Pyodide, carry-through behaviours | `docs/agents/classroom-behaviours.md` |
| Git, PRs, review comments, testing, doc hygiene | `docs/agents/workflows.md` |
| Lesson JSON schema | `LESSON_SCHEMA.md` |
| YAML lesson authoring | `YAML_LESSON_FORMAT.md` |
| Topic library schema | `TOPIC_LIBRARY_SCHEMA.md` |
| Test strategy | `TESTING.md` |
| Licenses | `LICENSES.md` |

## Default Workflow

- Make feature work on a focused branch (`feature/`, `fix/`, or `refactor/`).
- Keep changes scoped to the request and existing architecture.
- Preserve unrelated user changes in the worktree.
- Add or update tests when behaviour changes.
- Update relevant docs after significant changes.
- Run `npm test` before handing work back.

*Last updated: June 2026*
