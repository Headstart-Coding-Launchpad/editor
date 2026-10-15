# HSC Audit scripts

Tools for the termly HSC Audit (`HSC Hub\Plans\HSC Audit Plan.md`). Outputs go in `HSC Hub\Research\HSC Audit\`.

| Script | What it does | Writes to Firebase? |
|---|---|---|
| `build-lesson.mjs` | Builds the draft test lesson `hsc-audit-visual-review`: one real example of each task kind, copied from published lessons, plus small hand-written tasks for modules no lesson uses yet. `--upsert` validates and publishes it | Yes, with `--upsert`: one draft lesson with no level |
| `run-visual-review.mjs` | Signs in as the test tutor, runs a throwaway live session on the test lesson with two made-up students ("Test Ava", "Test Ben"), and screenshots every feature group in the student and tutor views at desktop (1440×900) and tablet (1024×768, touch) widths, on the live site | A live session for the test lesson only |
| `cleanup.mjs` | Removes the test lesson's live-session nodes, its Firestore document and every subcollection (session reports, feedback). Dry run unless `--apply` | Yes, with `--apply`: only the test lesson's data |
| `usage-counts.mjs` | Read-only aggregate counts from session reports and other collections for the in-scope courses. Counts only, never names or IDs | No |

## Before you start

- **Test tutor:** `audit-tutor@headstartcoding.test`, a teacher-role account kept for these runs (it isn't a real tutor). Its login is `AUDIT_TUTOR_EMAIL` / `AUDIT_TUTOR_PASSWORD` in the gitignored repo-root `.env`.
- **CLI credentials:** `cli/.env` (`GOOGLE_APPLICATION_CREDENTIALS`), as for the CLI.
- **From a worktree:** there's no `.env` or `cli/node_modules`, so point at a checkout that has them:
  - `HSC_CLI=<checkout>/cli/cli.mjs` (packages and CLI credentials)
  - `HSC_ENV=<checkout>/.env` (test tutor login, database URL)
  - `HSC_REPO=<checkout>` (for `usage-counts.mjs`)
- **Courses:** update `COURSE_BY_LEVEL` in `usage-counts.mjs` when the courses Ryan teaches change.

## Each term

```
node scripts/hsc-audit/build-lesson.mjs --upsert
node scripts/hsc-audit/run-visual-review.mjs --out "C:\Users\rflem\Documents\HSC Hub\Research\HSC Audit\Visual Review"
node scripts/hsc-audit/cleanup.mjs --apply
node scripts/hsc-audit/usage-counts.mjs --since YYYY-MM-DD --json usage.json
```

- **The screenshot run** takes about 15 minutes. It writes `screens\` and `manifest.json` (each screenshot, plus any step that couldn't find its button and the buttons it could see).
- **When the app changes,** a step may stop finding a button. The run carries on, and the step shows in `manifest.json` under `problems`: fix its selector in `run-visual-review.mjs`.
- **Then** write `Visual Review.md` (the critique) from the new screenshots.
