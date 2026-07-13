# Lesson JSON Schema

Full JSON field reference. For YAML authoring see `docs/authoring/AUTHORING_GUIDE.md` or the basic-field reference at `docs/authoring/lesson-schema-yaml.md`.

**Check types:** `docs/authoring/checks.md`
**Quiz sub-types:** `docs/authoring/quiz-tasks.md`
**Python code task fields:** `docs/authoring/python-tasks.md`
**HTML code task fields:** `docs/authoring/html-tasks.md`
**Filesystem code task fields:** `docs/authoring/filesystem-tasks.md`
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

## Code Task Fields (by lesson type)

Type-specific code task fields, carry-through behaviour, and task tests live in their own files:

- **Python:** `docs/authoring/python-tasks.md`
- **HTML:** `docs/authoring/html-tasks.md`
- **Filesystem:** `docs/authoring/filesystem-tasks.md`
- **Scratch:** `docs/authoring/scratch-reference.md`

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

Two separate validators exist and they do not enforce the same rules. `cli lessons validate|upsert|publish-yaml` runs `cli/validate.mjs` (`validateLessonForMcp`); the Lesson Builder runs a stricter, browser-only validator in `src/builder/lessonUtils.js`. A lesson can pass CLI validation and still trip builder-only rules — publish through the builder at least once, or check by hand, if you need those covered.

**Enforced by both the CLI and the builder:**

- Lesson `id`, `title`, and at least one task are required.
- Every task needs a `title`.
- Information tasks need an `explainer` unless `informationType` is `introduction`.
- Multiple-choice quiz tasks need at least two non-empty options and an `answer_equals` check; match/fill-blank/short-answer quizzes have their own required-field rules.
- HTML code tasks should have files with unique filenames and an HTML entry file.
- Scratch `sprite_property` and `block_used` checks need their type-specific fields (`property`/`operator`/`value`, `opcode`) filled in.

**Builder-only (not checked by the CLI):**

- `carryCodeFrom` / `carryBlocksFrom` must reference an existing task ID.
- Submit mode cannot use run-required checks.
- DOM checks (`element_*`) need a CSS `selector`; `element_attribute` needs an `attribute` name; `element_style_property` needs a `property` name.
- Variable checks (`variable_*`) need a `name`; `variable_dict_key_value` needs a `key`; `variable_array_nth_item` needs a valid `index`.
- Checks requiring a value must provide one (exceptions: `code_no_error`, `output_not_empty`, `output_empty`, `element_exists`, `element_attribute`, `element_style_property`, `variable_exists`).
- Scratch toolbox XML must parse if provided.
- Scratch checks beyond `sprite_property`/`block_used` have their own required fields — see `docs/authoring/checks.md`.

---

## Minimal Examples

A minimal full-lesson JSON example for each lesson type lives alongside its field reference:

- **Python:** `docs/authoring/python-tasks.md`
- **HTML:** `docs/authoring/html-tasks.md`
- **Scratch:** `docs/authoring/scratch-reference.md`
- **Filesystem:** `docs/authoring/filesystem-tasks.md`
