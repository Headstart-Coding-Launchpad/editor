# HSC: Author a New Lesson

Use with a brief description of the lesson to create: type, topic, level, and goals.

Author a complete lesson from scratch and publish it to the live app.

For brand-new lessons, keep local YAML and JSON artifacts under `New Lessons/YAML Files/<course>/` and `New Lessons/JSON Files/<course>/`. For lessons converted from old material, use `Old Lessons/YAML Files/<course>/` and `Old Lessons/JSON Files/<course>/`.

## Before you start

- Read `docs/authoring/AUTHORING_GUIDE.md` for YAML syntax, all fields, and CLI usage.
- For specific detail: `docs/authoring/checks.md`, `docs/authoring/quiz-tasks.md`, `docs/authoring/scratch-reference.md`.
- Run `node cli/cli.mjs lessons list` to check that the intended lesson ID is not already taken.

---

## Standard Path: Draft → Review → Publish

This is the default path for AI-authored lessons. Drafts are stored in Firestore and reviewed by a human in the Admin Portal → Authoring tab before going live.

### 1. Write the Ideas document

Write a Markdown planning document covering the lesson's scope, rough task sequence, and open questions. Use YAML front matter to set metadata.

```markdown
---
id: python-l3-09
title: Dictionaries
type: python
level: 3
stage: ideas
---
# Python Level 3 - Lesson 9: Dictionaries [Conceptual Draft]

## Metadata
...

## Sequential Flow

### 1. Opening Recap
...
```

```
node cli/cli.mjs lessons draft upsert python-l3-09 'New Lessons/YAML Files/Python L3/python-l3-09-ideas.md'
```

### 2. Expand to the Details document

Update the same draft with the full execution-level spec (exact student-facing copy, code, checks, hints). Change `stage: ideas` to `stage: details` in the front matter, then re-upsert:

```
node cli/cli.mjs lessons draft upsert python-l3-09 'New Lessons/YAML Files/Python L3/python-l3-09-details.md'
node cli/cli.mjs lessons draft submit python-l3-09
```

`submit` advances the stage: `ideas → details → review`.

### 3. Await human review

The reviewer opens the Admin Portal → Authoring tab and reads the plan. They add per-section notes and either approves or requests changes. Read the current notes:

```
node cli/cli.mjs lessons draft notes list python-l3-09
```

If changes are requested (stage returns to `details`), update the content and re-upsert:

```
node cli/cli.mjs lessons draft upsert python-l3-09 'New Lessons/YAML Files/Python L3/python-l3-09-details.md'
node cli/cli.mjs lessons draft submit python-l3-09
```

### 4. Generate YAML and publish

Once approved (`stage: approved`), convert the Details document to YAML, validate, and publish:

```
node cli/cli.mjs lessons preflight 'New Lessons/YAML Files/Python L3/python-l3-09.yaml'
node cli/cli.mjs lessons publish-yaml 'New Lessons/YAML Files/Python L3/python-l3-09.yaml'
node cli/cli.mjs lessons skeleton python-l3-09
```

Then mark the draft as published:

```
node cli/cli.mjs lessons draft publish python-l3-09
```

---

## Fast Path: Direct Publish (trusted content only)

Skip the draft system when making small fixes or when you are confident the lesson needs no human review. This publishes directly to the live `lessons` collection.

### 1. Draft the YAML

Write the lesson in YAML following `docs/authoring/AUTHORING_GUIDE.md`. Key rules:
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
