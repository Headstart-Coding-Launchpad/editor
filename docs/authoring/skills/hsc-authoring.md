# HSC: Authoring Guidelines and Lesson Drafts

Use when managing authoring guidelines or working with the lesson draft pipeline (Ideas → Details → Review → Approved → Published).

There are two separate concepts here:

- **Authoring guidelines** — standalone admin guidance documents stored in `authoringGuidelines/`. Visible in the Admin Portal to help lesson authors follow style and quality rules.
- **Lesson drafts** — work-in-progress lesson plans stored in `lessonDrafts/`. They move through a review pipeline before being converted to a published lesson in Firestore.

---

## Authoring Guidelines

### List guidelines

```bash
node cli/cli.mjs authoring guidelines list
node cli/cli.mjs authoring guidelines list --applies-to python
```

`--applies-to` accepts `python`, `html`, `scratch`, or `all`.

Returns an array of `{ id, title, appliesTo, body, updatedAt }`.

### Get a guideline

```bash
node cli/cli.mjs authoring guidelines get <id>
```

### Create or update a guideline

Input is a YAML file (or stdin) with these fields:

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Display name shown in the Admin Portal |
| `appliesTo` | yes | `python` \| `html` \| `scratch` \| `all` |
| `body` | yes | Markdown content of the guideline |

```bash
node cli/cli.mjs authoring guidelines upsert <id> guideline.yaml
cat guideline.yaml | node cli/cli.mjs authoring guidelines upsert <id>
```

Example `guideline.yaml`:

```yaml
title: Python Task Explainer Style
appliesTo: python
body: |
  ## Explainer guidelines

  Keep explainers under 200 words. Use `code` formatting for all keywords.
  Always include a worked example before the task prompt.
```

Returns `{ success, id }`.

### Delete a guideline

```bash
node cli/cli.mjs authoring guidelines delete <id>
```

Throws if the guideline does not exist. Returns `{ success, id }`.

---

## Lesson Drafts

The draft pipeline has five stages:

```
ideas → details → review → approved → published
```

| Stage | Meaning |
|---|---|
| `ideas` | Initial concept — title, type, level, rough content |
| `details` | Author is fleshing out the plan with entries |
| `review` | Submitted for reviewer sign-off |
| `approved` | Reviewer approved; ready to be built into a full YAML lesson |
| `published` | Lesson has been published to Firestore |

### List all drafts

```bash
node cli/cli.mjs lessons draft list
node cli/cli.mjs lessons draft list --format yaml
```

Returns an array of `{ id, title, type, level, stage, updatedAt }`, newest first.

### Get a draft

```bash
node cli/cli.mjs lessons draft get <id>
```

Returns the full draft document including `entries`, `reviewNotes`, and `_meta`.

### Create or update a draft

Input is a YAML file with these fields:

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Working title for the lesson |
| `type` | yes | `python` \| `html` \| `scratch` \| `filesystem` |
| `level` | no | Numeric difficulty level |
| `stage` | no | Defaults to `ideas` on create |
| `content` | no | Free-text outline or rough notes |
| `context` | no | AI working-notes field (see below) |
| `author` | no | Author email address |
| `module` | no | Module name (e.g., "Python Level 3") |
| `lessonNumber` | no | Position within the module |
| `description` | no | Shown on the lesson entry screen |
| `targetAudience` | no | e.g., "Groups of up to 8 children, ages 9–11" |
| `duration` | no | e.g., "45 minutes" |

```bash
node cli/cli.mjs lessons draft upsert <id> draft.yaml
cat draft.yaml | node cli/cli.mjs lessons draft upsert <id>
```

Example `draft.yaml`:

```yaml
title: Python Dictionaries
type: python
module: Python Level 2
lessonNumber: 5
description: Students learn to create and use dictionaries.
targetAudience: Groups of up to 8 children, ages 9–11
duration: 45 minutes
level: 2
stage: ideas
content: |
  Cover creating dicts, reading values, and iterating.
  Aim for 6 tasks with a quiz at the end.
author: teacher@school.com
```

Returns `{ success, id, stage }`.

### Get or set the context field

The `context` field is a freeform AI working-notes string — use it to store background info, constraints, or in-progress notes.

```bash
# Print the current context
node cli/cli.mjs lessons draft context <id>

# Set from inline text
node cli/cli.mjs lessons draft context <id> "Focus on real-world examples for KS3"

# Set from a file
node cli/cli.mjs lessons draft context <id> --file notes.txt

# Set from stdin
cat notes.txt | node cli/cli.mjs lessons draft context <id>
```

### Advance the stage

```bash
node cli/cli.mjs lessons draft submit <id>
```

Moves the draft one step forward: `ideas → details`, then `details → review`. Throws if already at `review` or later.

Returns `{ success, id, previousStage, stage }`.

### Request changes (reviewer)

```bash
node cli/cli.mjs lessons draft request-changes <id>
```

Retreats the draft to `details` regardless of its current stage. Use this when a reviewer needs revisions.

### Approve a draft (reviewer)

```bash
node cli/cli.mjs lessons draft approve <id>
node cli/cli.mjs lessons draft approve <id> --reviewer reviewer@school.com
```

Sets `stage` to `approved` and stamps `_meta.reviewedBy` and `_meta.reviewedAt`. `--reviewer` is optional.

### Mark as published

```bash
node cli/cli.mjs lessons draft publish <id>
```

Sets `stage` to `published` on the draft document. This does **not** push the lesson to Firestore — run `lessons publish-yaml` separately to go live.

---

## Draft Entries

Entries are the structured plan items on a draft. Each entry represents one proposed lesson task and has its own ID and `order` field. They are stored as an array on the draft document.

Entry fields:

| Field | Notes |
|---|---|
| `id` | Auto-generated (base36 timestamp + random suffix) |
| `order` | 1-based position; re-set automatically on delete |
| `title` | Display name for this entry |
| `entryType` | `information` \| `code` \| `quiz` |
| `purpose` | What this entry achieves |
| `body` | Main Markdown content |
| `expectedOutcome` | What students should be able to do after this |
| `pitfalls` | Known issues or common mistakes |

### List entries

```bash
node cli/cli.mjs lessons draft entry list <draftId>
```

Returns entries sorted by `order`.

### Get a single entry

```bash
node cli/cli.mjs lessons draft entry get <draftId> <entryId>
```

### Add an entry

```bash
node cli/cli.mjs lessons draft entry add <draftId> \
  --title "Create a dictionary" \
  --type code \
  --purpose "Students learn the dict literal syntax" \
  --body "Use `{}` to create a dictionary..." \
  --outcome "Student can create a dict with at least two keys" \
  --pitfalls "Common mistake: using = instead of : for key-value pairs"
```

All flags except `--title` are optional. `--type` defaults to `code`.

Returns `{ success, entry }` with the full new entry object including its generated `id`.

### Update an entry

Pass only the flags you want to change:

```bash
node cli/cli.mjs lessons draft entry update <draftId> <entryId> \
  --title "Create and read a dictionary" \
  --outcome "Student can create a dict and read a value by key"
```

Entry review decisions can also be set via this command using `--decision` and `--change`:

```bash
node cli/cli.mjs lessons draft entry update <draftId> <entryId> \
  --decision accepted

node cli/cli.mjs lessons draft entry update <draftId> <entryId> \
  --decision rejected \
  --change "Move the worked example before the theory paragraph"
```

`--decision` accepts `pending` | `accepted` | `rejected`. `--change` stores the reviewer's suggested change note on the entry (`suggestedChange` field).

Returns `{ success, draftId, entryId }`.

### Delete an entry

```bash
node cli/cli.mjs lessons draft entry delete <draftId> <entryId>
```

Removes the entry and renumbers the remaining entries. Returns `{ success, draftId, entryId, remaining }`.

---

## Draft Review Notes

Review notes attach to sections of the draft's `content` field. Each note is keyed by a `sectionId` (a slugified H3 heading from the content). Adding a note with an existing `sectionId` replaces the previous note.

Note fields:

| Field | Notes |
|---|---|
| `sectionId` | Slug identifying the section (e.g. `introduction`) |
| `sectionTitle` | Human-readable heading |
| `suggestedChange` | Reviewer's proposed edit |
| `extraNote` | Additional comment |
| `decision` | `pending` \| `accepted` \| `rejected` |

### List review notes

```bash
node cli/cli.mjs lessons draft notes list <id>
```

### Add or replace a note

```bash
node cli/cli.mjs lessons draft notes add <id> \
  --section introduction \
  --title "Introduction" \
  --change "Move the worked example before the theory paragraph" \
  --note "Students were confused in the last session" \
  --decision pending
```

`--section` is required. All other flags are optional; `--decision` defaults to `pending`.

Returns `{ success, id, sectionId }`.

### Update a note

```bash
node cli/cli.mjs lessons draft notes update <id> \
  --section introduction \
  --decision accepted
```

`--section` is required. Pass only the flags you want to change.

### Delete a note

```bash
node cli/cli.mjs lessons draft notes delete <id> --section introduction
```

---

---

## Draft tasks inside a published lesson (different concept)

The `lessonDrafts/` pipeline above is for *planning* a new lesson before it exists. There is a separate concept — `taskType: "draft"` placeholder tasks embedded directly inside a lesson in the `lessons/` collection — for in-progress authoring of a lesson that is already in the builder.

Key differences:

| | Lesson drafts (`lessonDrafts/`) | Draft tasks (`taskType: "draft"`) |
|---|---|---|
| Where stored | `lessonDrafts/` Firestore collection | `lessons/` collection, inside the task list |
| CLI namespace | `lessons draft …` | `lessons set-stage`, `lessons review` |
| Purpose | Plan a lesson before building it | Placeholder tasks during active lesson authoring |
| Blocks publish? | No | Yes — `lessons publish-yaml` rejects them |

For the YAML syntax, field reference, and CLI commands for draft tasks, see the **"Draft Tasks and Lesson Stage"** section in `docs/authoring/AUTHORING_GUIDE.md`.

### Topic planning for lesson-native drafts

Do not keep a separate "Topics to Create" list in working notes. Record likely topic IDs on each draft task using `topicLinks` during Ideas. Add lesson-level `topicProposals` only for referenced IDs that are missing from the Topic Library, then embed the links in `studentFacingContent`, `hintsAndSupport`, or final task prose during Details.

Audit the lesson against Firestore before stage changes:

```bash
node cli/cli.mjs lessons topics <lessonId>
```

Details → Review requires every missing ID to have a `proposed` or `deferred` proposal. Approved → Published requires every referenced ID to exist in the Topic Library.

---

## Typical draft workflow

```bash
# 1. Create the draft at the ideas stage
node cli/cli.mjs lessons draft upsert python-dicts-v1 draft.yaml

# 2. Add structured plan entries
node cli/cli.mjs lessons draft entry add python-dicts-v1 --title "What is a dictionary?" --type information
node cli/cli.mjs lessons draft entry add python-dicts-v1 --title "Create a dictionary" --type code

# 3. Advance to details, then submit for review
node cli/cli.mjs lessons draft submit python-dicts-v1   # ideas → details
node cli/cli.mjs lessons draft submit python-dicts-v1   # details → review

# 4. Reviewer adds notes and approves
node cli/cli.mjs lessons draft notes add python-dicts-v1 --section introduction --change "..." --decision pending
node cli/cli.mjs lessons draft approve python-dicts-v1 --reviewer reviewer@school.com

# 5. Build the lesson YAML from the approved draft, publish it
node cli/cli.mjs lessons publish-yaml python-dicts-v1.yaml

# 6. Mark the draft as published
node cli/cli.mjs lessons draft publish python-dicts-v1
```
