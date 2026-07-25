# Lesson YAML Schema

Basic reference for the shape of a lesson YAML file: the lesson envelope, fields common to every task, and the non-code task types (information and group). For the underlying JSON shape every YAML file converts to, see `docs/authoring/lesson-schema.md`.

This file does not cover code task fields or quiz task fields:

- **Quiz fields:** `docs/authoring/quiz-tasks.md`
- **Python code task fields:** `docs/authoring/python-tasks.md`
- **Arcade Kit code task fields and API:** `docs/authoring/arcade.md`
- **HTML code task fields:** `docs/authoring/html-tasks.md`
- **Filesystem code task fields:** `docs/authoring/filesystem-tasks.md`
- **Electronics code task fields:** `docs/authoring/electronics.md`
- **Scratch code task fields:** `docs/authoring/scratch-reference.md`
- **Check types:** use the lesson-type docs above (`python.md`, `html.md`, `scratch.md`, `filesystem.md`, `electronics.md`, or `quiz-tasks.md`).
- **Full authoring walkthrough and CLI workflow:** `docs/authoring/AUTHORING_GUIDE.md`

Lessons live in the Firestore `lessons/` collection. Use `node cli/cli.mjs lessons publish-yaml <file>` to validate and publish a YAML lesson, or `node cli/cli.mjs lessons upsert <file>` to save one.

---

## Lesson Envelope

```yaml
id: python-for-loops         # required — lowercase slug, used in URLs
type: python                 # required — python | html | scratch | filesystem | electronics
title: Python For Loops      # required
description: Practise loops. # required — shown on the entry screen
level: Level 1               # optional legacy display fallback; prefer levelId/levelRef
levelId: python-level-1      # optional reusable level id from lessonLevels/
levelRef:                    # optional reusable level reference
  id: python-level-1
  scopeType: type            # type | module | course | collection
  scopeId: python
assetsPath: scratch-assets    # optional — base URL path for asset resolution
assets:                       # optional — files shown in the AssetBrowser
  - sprites/rocket.png
storageAssets:                 # optional — metadata for Firebase Storage files
  - name: logo.png
    url: https://firebasestorage.googleapis.com/...
    showInEditor: true        # optional — show in web editor asset panel

tasks: []                     # required — ordered task list (see below)
```

| Field | Required | Type | Notes |
|---|:---:|---|---|
| `id` | Yes | string | Lowercase slug. Used in URLs and export filename. |
| `type` | Yes | string | `python`, `arcade`, `html`, `scratch`, `filesystem`, or `electronics`. |
| `title` | Yes | string | Display title. |
| `description` | Yes | string | Short entry screen summary. |
| `level` | No | string/number | Legacy display fallback for the difficulty badge. Publishing migrates scalar values into reusable level records when no `levelId`/`levelRef` exists. |
| `levelId` | No | string | ID of a reusable record in `lessonLevels/`. |
| `levelRef` | No | object | `{ id, scopeType, scopeId }` reference for the reusable level. |
| `topicProposals` | No | array | Missing Topic Library entries proposed by the lesson. See `docs/authoring/AUTHORING_GUIDE.md`. |
| `assetsPath` | No | string | Base URL path for asset resolution. |
| `assets` | No | string array | Files shown in the AssetBrowser. |
| `storageAssets` | No | array | Optional metadata for files stored at `lessons/{lessonId}/assets/`; the Storage folder is the asset inventory. |
| `tasks` | Yes | array | Ordered task list. May contain group objects. |

Sandbox-mode envelope fields (`sandboxStarter`, `sandboxStarterFiles`, `sandboxToolbox`, `sandboxSprites`, `sandboxBackdrops`, `sandboxStarterFs`, `sandboxStarterCircuit`) are type-specific — see `docs/authoring/AUTHORING_GUIDE.md`.

---

## Common Task Fields

Every task, regardless of type, supports these fields:

```yaml
tasks:
  - id: 1                    # optional — auto-assigned sequential integer if omitted
    title: Task title         # required
    explainer: |               # required — Markdown shown to students
      Instructions here.
    estimatedMinutes: 5        # optional — approximate duration, totalled in the builder
    priority: core              # optional — core (default) | optional; teacher-facing only
    taskMode: both              # optional — both (default) | live | solo
    # taskType is not set directly in YAML — use `type: information` or `type: quiz`;
    # omit it entirely for a code task.
    check: {}                   # optional — completion check, see the lesson-type docs
    feedbackChecks: []          # optional — nudges or blocking wrong-pattern checks
```

| Field | Required | Type | Notes |
|---|:---:|---|---|
| `id` | No | integer | Auto-assigned sequential integer if omitted. |
| `title` | Yes | string | Short task title. |
| `explainer` | Yes | string | Markdown shown to students. |
| `estimatedMinutes` | No | positive integer | Approximate duration; totalled in the builder. |
| `priority` | No | string | `core` (default) or `optional`. Teacher-facing only; students do not see task priority. |
| `taskMode` | No | string | `both` (default), `live`, or `solo`. |
| `check` | No | object or array | Completion check. Arrays require every check to pass. |
| `feedbackChecks` | No | object or array | Supported by Python, HTML, Filesystem, Electronics, and Scratch. Requires a completion `check`. `mode: blocking` fails when matched; `mode: nudge` guides without blocking. `show: after_attempt` is the default; `show: on_idle` runs after the learner pauses editing (HTML idle feedback is code-check only). |
| `incorrectChecks` | No | object or array | Legacy alias for blocking `feedbackChecks`. |

---

## Task Types

A task is a code task by default. Set `type:` on the task to switch to a different task type:

| YAML `type:` on a task | Resulting task | Field reference |
|---|---|---|
| _(omitted)_ | Code task — Python, HTML, Scratch, or Filesystem depending on the lesson `type` | See the per-type files linked above |
| `information` | Explainer-only slide | See below |
| `quiz` | Knowledge check | `docs/authoring/quiz-tasks.md` |
| _(n/a — use `group:` instead)_ | Task group | See below |

---

## Information Task Fields

```yaml
  - type: information         # required — sets taskType: "information" in JSON
    informationType: standard  # optional — standard (default) | recap | introduction
    title: How loops work
    explainer: A `for` loop repeats code a fixed number of times.
    # leftContent is used only with informationType: recap (left pane content)
```

| Field | Required | Notes |
|---|:---:|---|
| `type` | Yes | Must be `information`. |
| `informationType` | No | `standard` (default), `recap`, or `introduction`. |
| `title` | Yes | Shown in progress UI. |
| `explainer` | Yes* | Markdown content. Required for `standard` and `recap`. Optional for `introduction` (renders lesson metadata). |
| `leftContent` | No | Left-pane Markdown for `recap` only. |

---

## Task Groups

```yaml
tasks:
  - group: Loop Basics         # required — generates a group object in JSON
    tasks:                      # required — ordered task objects, same format as top-level tasks
      - title: Counted loops
        explainer: Use `range()` to repeat exactly N times.
        check:
          type: output_line_count
          operator: equals
          value: 5
```

Groups cannot be nested. Group IDs are auto-generated (e.g. `g-1234567890`). `carryCodeFrom` / `carryBlocksFrom` references from within a subtask use the subtask's own integer `id`.

---

## Validation Rules

Two separate validators exist and they do not enforce the same rules. `cli lessons validate|upsert|publish-yaml` runs `cli/validate.mjs`; the Lesson Builder runs a stricter, browser-only validator. A lesson can pass CLI validation and still trip builder-only rules — publish through the builder at least once, or check by hand, if you need those covered.

See `docs/authoring/lesson-schema.md` (**Validation Rules**) for the full list of rules enforced by each validator.

---

## Minimal Examples

A minimal full-lesson YAML example for each lesson type lives alongside its field reference:

- **Python:** `docs/authoring/python-tasks.md`
- **HTML:** `docs/authoring/html-tasks.md`
- **Scratch:** `docs/authoring/scratch-reference.md`
- **Filesystem:** `docs/authoring/filesystem-tasks.md`
- **Electronics:** `docs/authoring/electronics.md`

For a complete lesson mixing information, quiz, code, and group tasks, see the **Full YAML Example** in `docs/authoring/AUTHORING_GUIDE.md`.
