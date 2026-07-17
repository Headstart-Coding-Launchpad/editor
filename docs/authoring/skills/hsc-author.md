# HSC: Author a New Lesson

Use with a brief description of the lesson to create: type, topic, level, and goals.

Author a complete lesson YAML/JSON artifact and publish it to the live `lessons` collection. The old Firestore lesson-draft pipeline and Admin Authoring tab are currently removed, so use direct YAML/JSON publishing plus in-lesson `stage` and task `reviewNote` fields when review metadata is needed.

For brand-new lessons, keep local YAML and JSON artifacts under `New Lessons/YAML Files/<course>/` and `New Lessons/JSON Files/<course>/`. For lessons converted from old material, use `Old Lessons/YAML Files/<course>/` and `Old Lessons/JSON Files/<course>/`.

## Before You Start

- Read `docs/authoring/AUTHORING_GUIDE.md` for YAML syntax, all fields, and CLI usage.
- For per-type detail: `docs/authoring/python.md`, `docs/authoring/html.md`, `docs/authoring/scratch.md`, `docs/authoring/filesystem.md`, `docs/authoring/electronics.md`, `docs/authoring/quiz-tasks.md`.
- Run `node cli/cli.mjs lessons list` to check that the intended lesson ID is not already taken.
- If the lesson needs a reusable level, create or confirm it first with `node cli/cli.mjs levels list` / `levels upsert`, or in Admin > Lessons > Levels.

## Direct Publish Workflow

1. Draft the YAML following `docs/authoring/AUTHORING_GUIDE.md`.

Key rules:
- `id` must be a lowercase slug, e.g. `python-3-2`
- `type` is one of `python | html | scratch | filesystem | electronics`
- Prefer `levelId` and `levelRef` for reusable levels; legacy scalar `level` is still accepted and migrated on publish.
- Each task needs a `title`; code tasks need starter state for the lesson type.
- Use `type: information` for explainer tasks and `type: quiz` for quiz tasks.
- Use `checks:` or `check:` for automated checks.

2. Convert and validate.

```bash
node cli/cli.mjs lessons preflight 'New Lessons/YAML Files/<course>/<lesson-id>.yaml'
node cli/cli.mjs lessons yaml-to-json 'New Lessons/YAML Files/<course>/<lesson-id>.yaml'
```

Review the returned JSON for task IDs, check types, topic links, and warnings. Fix errors before publishing.

3. Publish.

```bash
node cli/cli.mjs lessons yaml-to-json 'New Lessons/YAML Files/<course>/<lesson-id>.yaml' --output 'New Lessons/JSON Files/<course>/<lesson-id>.json'
node cli/cli.mjs lessons upsert 'New Lessons/JSON Files/<course>/<lesson-id>.json'
```

Or publish in one step:

```bash
node cli/cli.mjs lessons publish-yaml 'New Lessons/YAML Files/<course>/<lesson-id>.yaml' --write-json
```

4. Confirm.

```bash
node cli/cli.mjs lessons skeleton <id>
```

Verify the task list matches what you intended. If the lesson has assets, use `node cli/cli.mjs assets upload` and note the returned URLs in the relevant lesson/task fields.
