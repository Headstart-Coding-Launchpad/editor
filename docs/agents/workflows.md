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

## Versioning

The Admin Portal footer shows `LaunchPad vMAJOR.MINOR.BUILD · <commit> · built <date>`.

- **BUILD** is the commit count on `main` (`git rev-list --count HEAD`), computed at build time by `scripts/build-info.mjs`. It goes up on every merge with no manual step. CI and deploy check out with `fetch-depth: 0` so the count is real; a shallow clone shows `MAJOR.MINOR` only.
- **MAJOR.MINOR** comes from `package.json` and is bumped by hand for milestones (a new module, a batch of notable features): `npm version minor --no-git-tag-version` (or `major`) on the feature branch.
- A MAJOR.MINOR bump must add a matching entry at the top of `RELEASE_NOTES` in `src/admin/releaseNotes.js`; `AppVersionFooter.test.jsx` fails otherwise. Admins read these notes from the footer's "What's new" toggle.
- Optionally tag milestone merges on `main` (`git tag v1.1`) for easy diffs between releases.

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

The app's `.env` lives in the repo root and the CLI's in `cli/.env`. Both are gitignored, so a new worktree has neither: the dev server there has no Firebase config, and the CLI has no credentials.

Do not create, copy, or write `.env` files in a worktree unless the user asks. Run the CLI and dev server from the main checkout instead.

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

Before feature work, check `docs/architecture/feature-impact-map.md` for adjacent code, tests, and docs that usually change together.

After significant changes, update relevant docs:

- `docs/architecture/feature-impact-map.md` when a change reveals a new cross-system coupling.
- `docs/architecture/*.md` or `docs/adr/*.md` when design intent or a durable architecture decision changes.
- `docs/CODEBASE_MAP.md` when files are added, moved, or removed.
- `docs/authoring/lesson-schema.md`, `docs/authoring/lesson-schema-yaml.md`, `docs/authoring/quiz-tasks.md`, or the relevant per-type doc (`docs/authoring/{python,html,scratch,filesystem}.md`) when lesson JSON fields or check types change.
- `docs/authoring/AUTHORING_GUIDE.md` when YAML conversion rules or shorthands change.
- `docs/authoring/TOPIC_LIBRARY_SCHEMA.md` when topic structure changes.
- `docs/FEATURES.md` when user-facing features change.
- `docs/TESTING.md` when test strategy or coverage thresholds change.
- `docs/agents/project-rules.md` when CLI commands or auth setup changes.
- `docs/authoring/AUTHORING_GUIDE.md`, `docs/authoring/validation-errors.md` or `docs/authoring/feedback-cli.md` when content-authoring workflows change.
- `docs/authoring/session-reports.md` **and** a `docs/authoring/CHANGELOG.md` entry whenever the session report's output changes: `src/shared/lessonReport.js`, `src/badges/reportMetrics.js`, or an activity's `report.summaryFields` / `report.typeFields`. Reports are never regenerated, so give each new field its date added.
- `AGENTS.md` and `docs/agents/*.md` when agent-facing rules, Firebase model, localStorage keys, URLs, session states, or key behaviours change.

### Authoring CHANGELOG entries

When a change affects how lessons, tasks, topics, checks, assets or lesson Markdown are written, add an entry to `docs/authoring/CHANGELOG.md` (newest first, under today's date) that ends with the tag line described in its "Entry format" section:

```markdown
- Affects: scratch · Existing lessons: no changes needed · Resolves: authoring-requests/2026-09-29-<slug>.md
```

`Resolves:` names the authoring request(s) the change ships (or `none`); set that request's **Status** and **Resolution** in the same PR.

**All project docs live under `docs/`.** `AGENTS.md` and `CLAUDE.md` are the only doc files at the repo root.

A significant change includes a new component, hook, or module; Firebase field change; URL parameter change; or change to a documented key behaviour.

When a library or CDN module is added, removed, or upgraded to a new major version, update `docs/LICENSES.md` with package name, version, and license. Check for copyleft licenses before adding anything.

Run `npm run docs:check` before handing work back. It checks local Markdown links, verifies every docs Markdown file is indexed by `docs/README.md`, and checks that source files are represented in `docs/CODEBASE_MAP.md`.
