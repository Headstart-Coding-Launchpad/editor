# HSC: Author a New Lesson

> **Install as slash command:** copy to `.claude/commands/hsc-author.md` and invoke with `/hsc-author`
> **Arguments:** `$ARGUMENTS` — brief description of the lesson to create (type, topic, level, goals)

Author a complete lesson from scratch and publish it to the live app.

For brand-new lessons, keep local YAML and JSON artifacts under `New Lessons/YAML Files/<course>/` and `New Lessons/JSON Files/<course>/`. For lessons converted from old material, use `Old Lessons/YAML Files/<course>/` and `Old Lessons/JSON Files/<course>/`.

## Before you start

- Read `YAML_LESSON_FORMAT.md` for the full YAML shorthand syntax.
- Read `LESSON_SCHEMA.md` if you need detail on a specific field or check type.
- Run `node cli/cli.mjs lessons list` to check that the intended lesson ID is not already taken.

## Steps

### 1. Draft the YAML

Write the lesson in YAML following `YAML_LESSON_FORMAT.md`. Key rules:
- `id` must be a lowercase slug, e.g. `python-3-2`
- `type` is one of `python | html | scratch | filesystem`
- Each task needs a `title`; code tasks need `starterCode` / `starterFiles`
- Use `type: information` for explainer tasks, `type: quiz` for quiz tasks
- Use `checks:` (plural) or `check:` (singular) for automated checks

### 2. Convert and validate

```
node cli/cli.mjs lessons preflight 'New Lessons/YAML Files/<course>/<lesson-id>.yaml'
node cli/cli.mjs lessons yaml-to-json 'New Lessons/YAML Files/<course>/<lesson-id>.yaml'
```

Pipe or pass the YAML file. Review the returned JSON — check task IDs, check types, and any warnings. Fix errors before continuing; warnings about missing starter code are worth addressing.

### 3. Publish

```
node cli/cli.mjs lessons yaml-to-json 'New Lessons/YAML Files/<course>/<lesson-id>.yaml' --output 'New Lessons/JSON Files/<course>/<lesson-id>.json'
node cli/cli.mjs lessons upsert 'New Lessons/JSON Files/<course>/<lesson-id>.json'
```

Or pipe the JSON directly. The command validates again before writing; if it fails return to step 2.

### 4. Confirm

```
node cli/cli.mjs lessons skeleton <id>
```

Verify the task list matches what you intended. If the lesson has assets (images etc.), use `node cli/cli.mjs assets upload` to add them and note the returned URLs in the relevant task's `storageAssets`.

## One-step path (YAML → publish)

If you're confident in the YAML after reviewing the converted JSON:

```
node cli/cli.mjs lessons publish-yaml 'New Lessons/YAML Files/<course>/<lesson-id>.yaml'
```

Add `--include-lesson` to see the full converted JSON in the response, or `--write-json` to save the converted JSON artifact while publishing.
