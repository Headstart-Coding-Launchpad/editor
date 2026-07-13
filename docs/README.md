# docs/ — Documentation Index

What every file in this directory covers and when to reach for it. Use this to find the right doc for a task rather than guessing or reading files speculatively.

**Update rule:** When a doc file is added, removed, renamed, or substantially changes scope, update this index in the same PR.

---

## Root docs (`docs/`)

### [CODEBASE_MAP.md](CODEBASE_MAP.md)
One-line role for every source file in the repo — entry points, all React components, hooks, shared modules, Cloud Functions, scripts, CLI, and config files. Use this as a navigation index: search for a heading or file name to find what you need without loading the whole map.

**Load when:** you need to locate a file, understand what a file does, or check what exists before creating something new.

### [FEATURES.md](FEATURES.md)
Feature reference for the whole platform — lesson types, task types, quiz variants, completion checks, session features, teacher tools, student UI, lesson builder, admin portal, feedback, and CLI. Describes *what* the product does, not *how* it's implemented.

**Load when:** you need to understand product capabilities before making a change, or when checking whether a feature already exists.

### [TESTING.md](TESTING.md)
Testing strategy, tool choices, test file conventions, and what to test when behaviour changes. Read this before writing or significantly modifying tests.

**Load when:** writing tests, deciding what to test, or understanding why the test suite is structured the way it is.

### [LICENSES.md](LICENSES.md)
All third-party open-source libraries used in the project, their versions, and their licenses. Must be updated whenever a library is added, removed, or upgraded to a new major version.

**Load when:** adding or removing a dependency, or auditing third-party license compliance.

---

## Agent reference docs (`docs/agents/`)

These are dense technical references for AI agents and developers. Each covers a specific domain of platform knowledge that is not easily derived from the code alone.

### [agents/project-rules.md](agents/project-rules.md)
Tech stack, architecture constraints, repository shape, shared modules that must not be duplicated, admin portal tabs, and CLI tool overview. The primary source of platform rules.

**Load when:** touching architecture, shared modules, the admin portal, the CLI, or anything where you need to understand platform-wide constraints.

### [agents/runtime-model.md](agents/runtime-model.md)
Firebase data model (Firestore collections, Realtime Database paths), localStorage key formats, URL structure, session state machine, and student identity model. Explains how data flows through the live app.

**Load when:** touching Firebase reads/writes, localStorage, routing, session lifecycle, or student identity.

### [agents/classroom-behaviours.md](agents/classroom-behaviours.md)
Live-view behaviour, teacher broadcast, sandbox mode, Pyodide execution lifecycle, code carry-through rules, and other emergent classroom behaviours that aren't obvious from the component code.

**Load when:** touching student/teacher interaction, live code sync, the sandbox, Pyodide, or carry-through between tasks.

### [agents/workflows.md](agents/workflows.md)
Git branching conventions, commit style, PR process, how to handle review comments, test expectations, worktree usage, and doc hygiene rules.

**Load when:** creating branches or PRs, working through a code review, or making changes that affect tests or documentation.

---

## Authoring guides (`docs/authoring/`)

Reference material for writing lessons and lesson content. The authoring guide is the starting point; the others are specialist references loaded on demand.

### [authoring/AUTHORING_GUIDE.md](authoring/AUTHORING_GUIDE.md)
The main YAML-first lesson authoring guide: how to structure a lesson YAML file, all task types, required and optional fields, and the CLI publishing workflow. Links to specialist references for checks, quiz types, Scratch, and the JSON schema.

**Load when:** writing a new lesson or making structural edits to an existing one.

### [authoring/task-types.md](authoring/task-types.md)
Very high-level, non-technical overview of the kinds of tasks a lesson can contain (code, information, quiz, group, draft) — no field names or YAML.

**Load when:** you just need a plain-language explanation of what a task type is, e.g. explaining lesson structure to a non-technical author.

### [authoring/quiz-types.md](authoring/quiz-types.md)
Very high-level, non-technical overview of the quiz styles (multiple choice, match, fill in the blank, short answer, confidence) — no field names or YAML.

**Load when:** you just need a plain-language explanation of what a quiz type is, without the field-level detail in `quiz-tasks.md`.

### [authoring/lesson-schema.md](authoring/lesson-schema.md)
Complete JSON field reference for lessons — every field on the lesson object, task object, group object, and nested structures. The ground truth for field names, types, and valid values.

**Load when:** you need the exact field name or shape for a lesson JSON property, or when validating a generated lesson against the schema.

### [authoring/checks.md](authoring/checks.md)
All completion check types across all lesson types (Python, HTML, Scratch, Filesystem, Quiz), with field names, operators, and example syntax. Covers both correct-answer checks and `incorrectChecks` patterns.

**Load when:** adding or editing checks on any task type.

### [authoring/quiz-tasks.md](authoring/quiz-tasks.md)
Detailed reference for all five quiz sub-types: multiple-choice, match, fill-in-the-blank, short-answer, and confidence rating. Covers all sub-type-specific fields and YAML syntax.

**Load when:** authoring or editing a quiz task.

### [authoring/scratch-reference.md](authoring/scratch-reference.md)
Scratch-specific task fields, sprite and backdrop objects, block opcodes accepted by the interpreter, toolbox configuration, and Scratch check field names.

**Load when:** authoring or editing a Scratch lesson, or working on Scratch-related checks.

### [authoring/scratch-toolbox-xml.md](authoring/scratch-toolbox-xml.md)
How to write a Scratch toolbox XML string: XML structure, all categories with their colours, every available block opcode, and common toolbox patterns with copy-paste examples.

**Load when:** writing a Scratch task `toolbox` field by hand, or troubleshooting a missing block in the student palette.

### [authoring/markdown-renderer.md](authoring/markdown-renderer.md)
Supported Markdown features in the shared renderer: callout syntax, fenced code blocks, topic wiki-links (`[[id]]`), Scratch block pills, tables, and inline Markdown vs full Markdown contexts.

**Load when:** writing `explainer`, `description`, or `syntax` field content, or working on the Markdown renderer itself.

### [authoring/TOPIC_LIBRARY_SCHEMA.md](authoring/TOPIC_LIBRARY_SCHEMA.md)
Schema reference for the topic library: Firestore structure, all field definitions, YAML authoring format, and how topics are linked from Markdown via `[[wiki-links]]`.

**Load when:** writing or editing topics, or when working on anything that reads from `topicLibrary` in Firestore.

---

## CLI playbooks (`docs/authoring/skills/`)

Step-by-step agent playbooks for CLI-driven workflows. Each can also be installed as a Claude Code slash command (`cp docs/authoring/skills/hsc-*.md .claude/commands/`). See [authoring/skills/README.md](authoring/skills/README.md) for setup.

### [authoring/skills/hsc-list.md](authoring/skills/hsc-list.md)
Print a summary of all published lessons and topics — IDs, titles, types, and levels. A quick orientation command before authoring or editing.

### [authoring/skills/hsc-author.md](authoring/skills/hsc-author.md)
End-to-end workflow for authoring a brand-new lesson: gather requirements, write YAML, validate, publish to Firestore, and confirm.

### [authoring/skills/hsc-edit.md](authoring/skills/hsc-edit.md)
Workflow for editing an existing published lesson — either a targeted single-task edit or a full lesson rewrite. Covers fetching the current state, making changes, and re-publishing.

### [authoring/skills/hsc-topics.md](authoring/skills/hsc-topics.md)
CRUD operations on the topic library: list, fetch, create or update, and delete. Includes field rules and duplicate-checking guidance.

### [authoring/skills/hsc-assets.md](authoring/skills/hsc-assets.md)
Upload, list, and delete lesson asset files in Firebase Storage. Covers MIME type detection, storage filename overrides, and how assets are referenced in lesson content.

### [authoring/skills/hsc-feedback.md](authoring/skills/hsc-feedback.md)
Read, create, delete, and bulk-clear feedback items in both the lesson feedback subcollection and the platform feedback collection. Full field reference, filter options, and example commands.

### [authoring/skills/hsc-authoring.md](authoring/skills/hsc-authoring.md)
Authoring guidelines (`authoring guidelines`) and the lesson draft pipeline (`lessons draft`, `lessons draft entry`, `lessons draft notes`). Covers the full Ideas → Details → Review → Approved → Published workflow with all commands, flags, YAML input formats, and a typical end-to-end example.

**Load when:** managing authoring guidelines in the Admin Portal, or working with lesson drafts at any stage of the review pipeline.

### [authoring/skills/hsc-review.md](authoring/skills/hsc-review.md)
Workflow for reviewing a lesson at its current draft stage: fetching the live Authoring Guidelines, reading a lesson's tasks with review notes, and recording per-section review decisions via `lessons review`/`lessons draft notes`.

**Load when:** asked to review a lesson draft against the platform's authoring guidelines.
