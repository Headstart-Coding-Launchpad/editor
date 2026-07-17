# Headstart Coding Classroom REPL Platform

Browser-based classroom coding platform for live sessions and solo study. The app is a single React/Vite frontend deployed to GitHub Pages, with Firebase providing auth, durable lesson/admin data, live classroom state, storage, and account-management functions.

## Routes

- `/lesson/:lessonId` - student classroom, solo mode, and teacher live sessions
- `/builder` - lesson builder
- `/admin` - admin portal
- `/login` - teacher/admin login

## Common Commands

```bash
npm run dev
npm test
npm run docs:check
npm run build
```

## Documentation

Start with `docs/README.md`. For feature work, use `docs/architecture/feature-impact-map.md` before editing so related docs, tests, and runtime contracts are checked together.

Key entry points:

- `AGENTS.md` - short project rules and routing index
- `docs/CODEBASE_MAP.md` - source file inventory
- `docs/architecture/` - design intent and impact maps
- `docs/adr/` - architecture decision records
- `docs/agents/` - runtime, workflow, and platform rules
- `docs/authoring/` - lesson authoring and schema references

## Constraints

- Do not add a backend server or API.
- Do not require Firebase Auth for student operations.
- Do not duplicate shared Pyodide, iframe, CodeMirror, checks, Markdown, file-key, or task utility logic.
- Keep docs updated with significant behavior, schema, source, workflow, or dependency changes.
