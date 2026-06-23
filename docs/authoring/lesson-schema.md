# Lesson JSON Schema

Full JSON field reference. For YAML authoring see `docs/authoring/AUTHORING_GUIDE.md`.

**Check types:** `docs/authoring/checks.md`
**Quiz sub-types:** `docs/authoring/quiz-tasks.md`
**Scratch fields and opcodes:** `docs/authoring/scratch-reference.md`

Lessons live in the Firestore `lessons/` collection. Each document ID is the lesson `id`. Use `node cli/cli.mjs lessons upsert <file>` to save a JSON or YAML lesson, including lessons that still contain draft tasks.

---

## Lesson Envelope

| Field | Required | Type | Notes |
|---|:---:|---|---|
| `id` | Yes | string | Lowercase slug. Used in URLs and export filename. |
| `type` | Yes | string | `python`, `html`, `scratch`, or `filesystem`. |
| `title` | Yes | string | Display title. |
| `description` | Yes | string | Short entry screen summary. |
| `level` | No | number | Difficulty badge in the TopBar. |
| `stage` | No | string | Lesson lifecycle stage: `ideas`, `details`, `review`, `approved`, `published`. Defaults to `published` if absent. Controls which draft-task fields are unlocked in the builder. |
| `topicProposals` | No | proposal array | Missing Topic Library entries proposed by the lesson. Each item has `id`, `title`, `description`, and `status` (`proposed` or `deferred`). Task `topicLinks` remain the source of truth for usage. |
| `sandboxStarter` | No | string | Python/Scratch sandbox starter code or state. |
| `sandboxStarterFiles` | No | file array | HTML sandbox pre-loaded files. |
| `sandboxToolbox` | No | string | Scratch XML toolbox for sandbox mode. |
| `sandboxSprites` | No | sprite array | Scratch sandbox sprites. |
| `sandboxBackdrops` | No | backdrop array | Scratch sandbox backdrops. |
| `sandboxStarterFs` | No | path map | Filesystem sandbox initial state. |
| `assetsPath` | No | string | Base URL path for asset resolution. |
| `assets` | No | string array | Files shown in the AssetBrowser. |
| `storageAssets` | No | `{name, url, showInEditor?}[]` | Firebase Storage files for the lesson. When `showInEditor` is `true`, the asset appears in the web editor's asset panel and its filename is rewritten to the download URL on Run. |
| `tasks` | Yes | array | Ordered task list. IDs are sequential integers starting at `1`. May contain group objects. |

---

## Common Task Fields

| Field | Required | Type | Notes |
|---|:---:|---|---|
| `id` | Yes | integer | Sequential task number. |
| `title` | Yes | string | Short task title. |
| `explainer` | Yes | string | Markdown shown to students. |
| `estimatedMinutes` | No | positive integer | Approximate duration; totalled in the builder. |
| `taskMode` | No | string | `both` (default), `live`, or `solo`. |
| `taskType` | No | string | Omit for code tasks. `information`, `quiz`, or `draft` for non-code task types. |
| `check` | No | object or array | Completion check. Arrays require every check to pass. |
| `incorrectChecks` | No | object or array | Detect specific wrong patterns. Each must have a non-empty `hint`. |
| `reviewNote` | No | object | Builder review metadata: `{ decision, suggestedChange, extraNote }`. Not used by the student view. |
| `_checkTested` | No | boolean | Builder-only validation flag. |

---

## Task Format Matrix

| Lesson type | Code task | Information | Quiz | Draft |
|---|---|---|---|---|
| `python` | Python editor + output | Supported | Supported | Supported |
| `html` | Multi-file editor + iframe | Supported | Supported | Supported |
| `scratch` | Scratch blocks + stage | Supported | Supported | Supported |
| `filesystem` | Virtual file manager | Supported | Supported | Supported |

`information` and `quiz` tasks ignore code fields such as `starterCode`, `starterFiles`, `starterBlocks`, and carry-through fields.

`draft` tasks are planning placeholders — they block publishing (in the builder and via `lessons publish-yaml`) but can be saved via `lessons upsert`.

---

## Draft Task Fields

Draft tasks (`taskType: "draft"`) are two-tiered: Tier 1 fields are always required, and Tier 2 fields are unlocked when the lesson `stage` is `details` or later.

Tasks remain `taskType: "draft"` throughout Ideas, Details, and Review. Details-stage drafts are complete implementation specifications, not executable lesson tasks. Conversion to information, quiz, code, or other real task types happens only in the separate implementation handoff after the detailed draft has been reviewed and approved.

### Tier 1 — Ideas stage

| Field | Notes |
|---|---|
| `title` | Short name for the task |
| `kind` | Intended task type: `information slide`, `code task`, `quiz`, `confidence check`, `project step`, `group heading`, `recap`, or `extension` |
| `purpose` | Why this moment exists in the lesson |
| `expectedOutcome` | What the learner produces or achieves (also appears in Tier 2 with richer context) |
| `topicLinks` | Optional array of plain Topic Library IDs, e.g. `["for-loop", "range-function"]`. Available at every stage. |
| `knownPitfalls` | Optional — common mistakes or misconceptions to watch for |

### Tier 2 — Details stage and later

| Field | Notes |
|---|---|
| `studentFacingContent` | Complete draft of explainer text, quiz question, task prompt, or slide copy (Markdown) |
| `studentAction` | What the learner does; omit for quizzes and information slides |
| `starterState` | Starter code, files, blocks, or carry-through notes |
| `expectedOutcome` | Output, correct answers, page state, or completed work |
| `checksAndSuccessSignals` | Check type and value, e.g. `output_contains: "X"` or `manual review` |
| `hintsAndSupport` | Hint text, quiz feedback, code stages, or key misconception note |
| `yamlHandoffNotes` | Task type, mode, grouping, carry-through, assets — anything the builder needs when converting to a real task |

At Details:

- Keep the Tier 1 `kind`, `purpose`, `knownPitfalls`, and `topicLinks`.
- Fill every relevant Tier 2 field with final, implementation-ready detail.
- Put exact quiz options and feedback, proposed checks and incorrect checks, code stages, and task configuration into the appropriate Tier 2 text fields.
- Record the intended executable task type in `yamlHandoffNotes`; do not change `taskType` from `"draft"`.

---

## Review Note Object

Topic references are collected from task `topicLinks` and from `[[topic-id]]`, `[[topic-id|Custom label]]`, and `#topic/topic-id` links throughout draft and final task content, including nested hints and grouped tasks.

Stage rules:

- Ideas → Details: missing Topic Library entries warn.
- Details → Review: every missing ID needs a matching `topicProposals` item with `status: proposed` or `status: deferred`.
- Review → Approved: missing entries remain visible but do not block approval.
- Approved → Published: every referenced ID must exist in Firestore; unused proposals only warn.

Any task can carry a `reviewNote` for in-builder collaboration:

```json
{
  "reviewNote": {
    "decision": "pending",
    "suggestedChange": "Split this into two tasks.",
    "extraNote": "See also task 5."
  }
}
```

`decision` values: `pending` (grey), `accepted` (green), `rejected` (red). Stored on the lesson JSON; not rendered in the student view.

---

## Python Code Task Fields

| Field | Required | Type | Notes |
|---|:---:|---|---|
| `starterCode` | No | string | Code loaded when no carry-through exists. |
| `completeCode` | No | string | Reference solution (builder preview/copy). |
| `codeStages` | No | stage array | Intermediate stages (`label`, `code`). Teacher can send any stage to students. |
| `carryCodeFrom` | No | integer or null | Task ID to carry saved code from. |
| `interactionMode` | No | string | `run` (default) or `submit`. |
| `tests` | No | test array | Automated test cases. See **Task Tests** below. |

**`interactionMode` combinations:**
- `run` or omitted: Run executes Python; checks run against output/code/status.
- `submit`: Submit checks code text only; use only submit-compatible check types (see `docs/authoring/checks.md`).
- `tests` present: **Run Tests** button appears. Only **Run Tests** sets task completion. Plain **Run** stays interactive.

---

## Task Tests (Python)

When `tests` is present, students must pass all tests to complete the task. Each test provides pre-set inputs to `input()` calls and checks the resulting output.

```json
{
  "tests": [
    {
      "id": "t1",
      "name": "Greet Alice",
      "inputs": [
        { "name": "username", "value": "Alice" }
      ],
      "check": {
        "type": "output_contains",
        "value": "Hello {username}"
      }
    }
  ]
}
```

| Field | Required | Notes |
|---|:---:|---|
| `id` | Yes | Stable string ID, e.g. `"t1"`. |
| `name` | No | Display name in builder and student results. |
| `inputs` | Yes | Ordered values provided to each `input()` call. |
| `check` | Yes | Check evaluated after the test run. Supports all non-DOM check types. |

**Input object:** `{ name?: string, value: string }`. `name` is used for `{name}` placeholder substitution in `check.value`.

**Placeholder substitution:** `{username}` in a check value is replaced with the corresponding input's `value` at run time.

Excess `input()` calls beyond the test's entries receive an empty string.

---

## HTML Code Task Fields

| Field | Required | Type | Notes |
|---|:---:|---|---|
| `starterFiles` | No | file array | Files shown as editor tabs. |
| `completeFiles` | No | file array | Reference solution files. |
| `codeStages` | No | stage array | Intermediate stages (`label`, `files`, `entryFile?`). |
| `entryFile` | No | string | HTML file rendered in the iframe. Defaults to `index.html`. |
| `completeEntryFile` | No | string | Entry file for `completeFiles`. |
| `carryCodeFrom` | No | integer or null | Task ID to carry saved files from (matched by filename). |
| `interactionMode` | No | string | `run` (default) or `submit`. |

**File object:** `{ name: string, type: "html"|"css"|"javascript", content: string }`.

**Carry-through behaviour:**
- Files matching by name are carried; new `starterFiles` in the current task use their defined content.
- Files from the carried task not in current `starterFiles` are hidden.

---

## Filesystem Code Task Fields

The `filesystem` type presents a virtual Windows Explorer-style file manager. Checks evaluate automatically — there is no Run button.

**Filesystem state model:** a flat path map. Directories end with `/`; files do not. Root `/` always exists.

```json
{
  "/": { "type": "dir" },
  "/Documents/": { "type": "dir" },
  "/Documents/notes.txt": { "type": "file", "content": "Hello!" }
}
```

| Field | Required | Notes |
|---|:---:|---|
| `starterFs` | No | Initial filesystem when no carry-through exists. Defaults to `{ "/": { type: "dir" } }`. |
| `completeFs` | No | Reference solution shown in "See complete". |
| `codeStages` | No | Array of `{ label, fs }` snapshots. |
| `carryFsFrom` | No | Task ID to carry the saved filesystem from. |
| `startsInDir` | No | Directory path the explorer opens in. Defaults to `/`. Must end with `/`. |

---

## Information Task Fields

| Field | Required | Notes |
|---|:---:|---|
| `taskType` | Yes | Must be `"information"`. |
| `informationType` | No | `standard` (default), `recap`, or `introduction`. |
| `title` | Yes | Shown in progress UI. |
| `explainer` | Yes* | Markdown content. Required for `standard` and `recap`. Optional for `introduction` (renders lesson metadata). |
| `leftContent` | No | Left-pane Markdown for `recap` only. |

---

## Task Groups

```json
{
  "id": "g-1234567890",
  "type": "group",
  "title": "Loops",
  "subtasks": [...]
}
```

| Field | Required | Notes |
|---|:---:|---|
| `id` | Yes | String (e.g. `"g-1234567890"`) — not an integer. |
| `type` | Yes | Must be `"group"`. |
| `title` | Yes | Group display name. Subtask titles are derived from this. |
| `subtasks` | Yes | Ordered task objects using the same format as top-level tasks. |

Groups may not be nested. `carryCodeFrom` / `carryBlocksFrom` references from within a subtask use the subtask's integer `id`.

---

## Validation Rules

- Lesson `id`, `title`, and at least one task are required.
- Every task needs a `title`.
- Information tasks need an `explainer` unless `informationType` is `introduction`.
- Multiple-choice quiz tasks need at least two non-empty options and an `answer_equals` check.
- HTML code tasks should have files with unique filenames and an HTML entry file.
- `carryCodeFrom` / `carryBlocksFrom` must reference an existing task ID.
- Submit mode cannot use run-required checks.
- DOM checks need a CSS `selector`.
- Checks requiring a value must provide one (exceptions: `output_not_empty`, `output_empty`, `element_exists`, `variable_exists`).
- Scratch toolbox XML must parse if provided.
- Scratch checks have their own required fields — see `docs/authoring/checks.md`.

---

## Minimal Examples

### Python

```json
{
  "id": "python-minimal",
  "type": "python",
  "title": "Python Minimal",
  "description": "A short Python lesson.",
  "tasks": [
    {
      "id": 1,
      "title": "Hello",
      "explainer": "Print `Hello`.",
      "starterCode": "",
      "check": { "type": "output_contains", "value": "Hello" }
    }
  ]
}
```

### HTML

```json
{
  "id": "html-minimal",
  "type": "html",
  "title": "HTML Minimal",
  "description": "A short HTML lesson.",
  "tasks": [
    {
      "id": 1,
      "title": "Heading",
      "explainer": "Add a heading.",
      "entryFile": "index.html",
      "starterFiles": [{ "name": "index.html", "type": "html", "content": "<!DOCTYPE html><html><body></body></html>" }],
      "check": { "type": "element_exists", "selector": "h1" }
    }
  ]
}
```

### Scratch

```json
{
  "id": "scratch-minimal",
  "type": "scratch",
  "title": "Scratch Minimal",
  "description": "A short Scratch lesson.",
  "tasks": [
    {
      "id": 1,
      "title": "Move",
      "explainer": "Move the sprite to the right.",
      "sprites": [{ "id": "sprite1", "name": "Sprite 1", "type": "cat", "x": 0, "y": 0, "size": 100, "direction": 90 }],
      "check": { "type": "sprite_property", "evaluation": "after_run", "spriteName": "Sprite 1", "property": "x", "operator": "greater_than", "value": 50 }
    }
  ]
}
```

### Filesystem

```json
{
  "id": "filesystem-minimal",
  "type": "filesystem",
  "title": "Filesystem Minimal",
  "description": "Organise your files.",
  "tasks": [
    {
      "id": 1,
      "title": "Create a Documents folder",
      "explainer": "Create a folder called **Documents** in the root folder.",
      "starterFs": { "/": { "type": "dir" } },
      "check": { "type": "fs_dir_exists", "path": "/Documents/" }
    }
  ]
}
```
