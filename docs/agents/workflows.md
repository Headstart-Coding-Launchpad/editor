# Agent Reference: Workflows

Load this when a task touches branches, commits, PRs, reviews, tests, docs, or release hygiene.

## Git Workflow

Create a branch before writing code:

```bash
git checkout -b feature/<short-kebab-case-description>
```

Use focused branch prefixes:

- `feature/` for new functionality.
- `fix/` for bug fixes.
- `refactor/` for behaviour-preserving restructuring.

Do not commit directly to `main`. Preserve unrelated user changes already present in the worktree.

When complete:

```bash
git push -u origin feature/<branch-name>
gh pr create --title "<Feature title>" --body "<summary, decisions, verification>"
```

Do not merge the PR.

## PR Review Comments

When asked to address a PR comment, reply directly to that thread before starting work. After committing, post a follow-up on the same thread with the commit SHA and what changed.

```bash
gh api repos/{owner}/{repo}/pulls/comments/{comment_id}/replies \
  --method POST --field body="Addressed in <commit-sha>: <brief explanation>"
```

For top-level reviews, use:

```bash
gh pr comment <pr-number> --body "Addressed in <commit-sha>: <brief explanation>"
```

## Code Review

When reviewing a PR by number or URL, post findings as a PR comment when complete:

```bash
gh pr comment <pr-number> --repo Headstart-Coding-Launchpad/editor --body "<findings>"
```

Use a Markdown list of findings. For each bug include severity, file and approximate line, summary, concrete failure scenario, and suggested fix. End with:

```text
*Review performed by AI agent*
```

If reviewing a local branch diff instead of a PR, skip the comment step.

## Worktrees

All worktrees share the same `.env` automatically because it lives one level above the repo root and Vite uses `envDir: '../'`.

Do not create, copy, or write `.env` inside a worktree or the main repo directory.

After creating a PR from a temporary worktree, remove that worktree when the PR is open and the user no longer needs local changes there.

## Testing

Read `docs/TESTING.md` before writing or modifying tests.

Commands:

- `npm test` for Vitest unit/component tests.
- `npm run test:e2e` for Playwright E2E tests.
- Never run tests through raw `node` or `vite` commands.

Test placement:

- Unit/component tests live in `src/**/__tests__/*.test.{js,jsx}`.
- E2E tests live in `e2e/*.spec.js`.
- Do not place tests next to source files.

Mock rules:

- Firebase: mock module boundaries with `vi.mock('firebase/database', ...)`; never hit real database.
- localStorage: use jsdom built-in and clear in `beforeEach`.
- `window.matchMedia`, `URL.createObjectURL`, `URL.revokeObjectURL`, and `crypto.randomUUID` are already mocked in `src/test/setup.js`.
- Pyodide/Web Worker: mock the `pyodide.js` manager interface; never import the worker directly.
- `react-router-dom`: mock `useNavigate`, `useParams`, and `useSearchParams` as needed.

Layer choice:

- Pure functions: unit tests.
- React components/hooks: component tests.
- Critical journeys that do not require Firebase: E2E tests.
- Firebase-dependent live flows remain out of scope until emulator infrastructure exists.

Do not test:

- Firebase `onDisconnect` behaviour.
- Pyodide WASM execution.
- Scratch VM rendering.
- CodeMirror `EditorView` internals.

Do not lower thresholds to make builds pass.

## Doc Hygiene

After significant changes, update relevant docs:

- `docs/CODEBASE_MAP.md` when files are added, moved, or removed.
- `docs/authoring/lesson-schema.md`, `docs/authoring/lesson-schema-yaml.md`, `docs/authoring/quiz-tasks.md`, or the relevant per-type doc (`docs/authoring/{python,html,scratch,filesystem}.md`) when lesson JSON fields or check types change.
- `docs/authoring/AUTHORING_GUIDE.md` when YAML conversion rules or shorthands change.
- `docs/authoring/TOPIC_LIBRARY_SCHEMA.md` when topic structure changes.
- `docs/FEATURES.md` when user-facing features change.
- `docs/TESTING.md` when test strategy or coverage thresholds change.
- `docs/agents/project-rules.md` when CLI commands or auth setup changes.
- `docs/authoring/skills/*.md` when authoring or editing workflows change.
- `AGENTS.md` and `docs/agents/*.md` when agent-facing rules, Firebase model, localStorage keys, URLs, session states, or key behaviours change.

**All project docs live under `docs/`.** `AGENTS.md` and `CLAUDE.md` are the only doc files at the repo root.

A significant change includes a new component, hook, or module; Firebase field change; URL parameter change; or change to a documented key behaviour.

When a library or CDN module is added, removed, or upgraded to a new major version, update `docs/LICENSES.md` with package name, version, and license. Check for copyleft licenses before adding anything.
