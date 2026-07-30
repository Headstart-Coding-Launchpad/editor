# AGENTS.md - Headstart Coding Classroom REPL Platform

Shared quick-start instructions for AI coding agents. Keep this file short and tool-neutral; load the referenced docs only when the task needs them.

## Session Start Checklist

Before writing code:

- Check open PRs with `gh pr list`.
- Confirm the current branch with `git branch --show-current` or `git branch`.
- Run `npm test`; the suite must pass before changes.
- Use `docs/CODEBASE_MAP.md` as an index. Search or open only the relevant sections instead of reading the whole map by default.

## Request Clarification

- Before acting on any user request, think through the goal, likely affected areas, and assumptions. Quiz the user with concise clarifying questions when missing details could change the implementation, scope, or success criteria; wait for answers before making changes unless the user explicitly asks the agent to use best judgment.

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

**Not sure which doc to open?** See `docs/README.md` — it lists every file in `docs/` with a description and when to use it.

| Task area | Read this first |
|---|---|
| Index of all docs | `docs/README.md` |
| File ownership or locating code | `docs/CODEBASE_MAP.md` relevant section |
| Feature impact analysis / change coupling | `docs/architecture/feature-impact-map.md` |
| Design intent and architecture decisions | `docs/architecture/` and `docs/adr/` |
| Product capabilities | `docs/FEATURES.md` |
| Project rules, stack, shared modules, CLI tool, admin | `docs/agents/project-rules.md` |
| Firebase, localStorage, URLs, session states, identity | `docs/agents/runtime-model.md` |
| Classroom live-view, sandbox, Pyodide, carry-through behaviours | `docs/agents/classroom-behaviours.md` |
| Git, PRs, review comments, testing, doc hygiene | `docs/agents/workflows.md` |
| Writing or editing a lesson (envelope, common fields, quiz, groups) | `docs/authoring/AUTHORING_GUIDE.md` |
| Recent lesson-authoring contract changes | `docs/authoring/CHANGELOG.md` |
| Authoring a Python lesson (task fields, checks, tests, examples) | `docs/authoring/python.md` |
| Authoring an HTML lesson (task fields, element checks, examples) | `docs/authoring/html.md` |
| Authoring a Scratch lesson (sprites, opcodes, checks, examples) | `docs/authoring/scratch.md` |
| Authoring a Filesystem lesson (task fields, fs checks, examples) | `docs/authoring/filesystem.md` |
| Authoring an Electronics lesson (breadboard fields, circuit checks, examples) | `docs/authoring/electronics.md` |
| Quiz sub-types and quiz check types in detail | `docs/authoring/quiz-tasks.md` |
| Lesson JSON field reference (cross-cutting schema) | `docs/authoring/lesson-schema.md` |
| Lesson YAML basics (envelope, common fields, info/group/draft tasks) | `docs/authoring/lesson-schema-yaml.md` |
| Topic library schema and YAML authoring | `docs/authoring/TOPIC_LIBRARY_SCHEMA.md` |
| Markdown renderer (explainers, topic cards) | `docs/authoring/markdown-renderer.md` |
| Agent playbooks (author, edit, review, topics, assets, feedback) | `docs/authoring/skills/` |
| Reading, creating, or clearing feedback via CLI | `docs/authoring/skills/hsc-feedback.md` |
| Reviewing a lesson draft against authoring guidelines | `docs/authoring/skills/hsc-review.md` |
| Authoring guidelines and lesson draft pipeline | `docs/authoring/skills/hsc-authoring.md` |
| Test strategy | `docs/TESTING.md` |
| Licenses | `docs/LICENSES.md` |

## Default Workflow

- Make feature work on a focused branch (`feature/`, `fix/`, or `refactor/`) - Create this branch before making changes. 
- Keep changes scoped to the request and existing architecture.
- Preserve unrelated user changes in the worktree.
- Add or update tests when behaviour changes.
- Update relevant docs after significant changes.
- Update `docs/authoring/CHANGELOG.md` when a change affects how lessons, tasks, topics, checks, assets, or lesson Markdown should be written.
- Run `npm run docs:check` when docs, source files, or documented behaviours change.
- Run `npm test` before handing work back.

*Last updated: July 2026*
