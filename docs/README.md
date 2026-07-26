# docs/ — Documentation Index

What every file in this directory covers and when to reach for it. Use this to find the right doc for a task rather than guessing or reading files speculatively.

**Update rule:** When a doc file is added, removed, renamed, or substantially changes scope, update this index in the same PR.

## Root docs (`docs/`)

### [CODEBASE_MAP.md](CODEBASE_MAP.md)
One-line role for every source file in the repo — entry points, all React components, hooks, shared modules, Cloud Functions, scripts, CLI, and config files. Use this as a navigation index: search for a heading or file name to find what you need without loading the whole map.

**Load when:** you need to locate a file, understand what a file does, or check what exists before creating something new.

### [FEATURES.md](FEATURES.md)
Feature reference for the whole platform — lesson types, task types, quiz variants, completion checks, session features, teacher tools, student UI, lesson builder, admin portal, feedback, and CLI. Describes *what* the product does, not *how* it's implemented.

**Load when:** you need to understand product capabilities before making a change, or when checking whether a feature already exists.

### [MODULE_FEATURE_MATRIX.md](MODULE_FEATURE_MATRIX.md)
At-a-glance capability matrix for every lesson module, including landing-page playgrounds, lesson sandboxes, teacher/student collaboration, code stages, checks, and carry-through.

**Load when:** you need to compare module capabilities or check whether a classroom feature is available for a particular lesson type.

### [ARCADE_KIT_STATUS.md](ARCADE_KIT_STATUS.md)
Current implementation record for the experimental Arcade Kit lesson type: supported API, asset model, integration details, test status, known limitations, and the recommended next milestones.

**Load when:** evaluating Arcade Kit for a lesson, implementing Arcade Kit behavior, or deciding what needs to be completed before production use.

### [UI_STYLE_GUIDE.md](UI_STYLE_GUIDE.md)
Style guide for app UI elements: theme tokens, typography, buttons, forms, tabs, panels, modals, status feedback, accessibility, reusable primitives, and recommendations for keeping classroom, builder, and admin UI consistent.

**Load when:** adding or changing UI elements, creating a reusable component, or reviewing whether a new interface follows existing app patterns.

### [TESTING.md](TESTING.md)
Testing strategy, tool choices, test file conventions, and what to test when behaviour changes. Read this before writing or significantly modifying tests.

**Load when:** writing tests, deciding what to test, or understanding why the test suite is structured the way it is.

### [LICENSES.md](LICENSES.md)
All third-party open-source libraries used in the project, their versions, and their licenses. Must be updated whenever a library is added, removed, or upgraded to a new major version.

**Load when:** adding or removing a dependency, or auditing third-party license compliance.

---

## Architecture docs (`docs/architecture/`)

These docs explain design intent and cross-system coupling. Use them before changing behavior that may affect more than one surface.

### [architecture/feature-impact-map.md](architecture/feature-impact-map.md)
Change-type map for finding adjacent code, docs, and tests that usually move together. This is the primary guardrail for keeping feature work from leaving related docs or behavior stale.

**Load when:** starting feature work, changing runtime contracts, adding source files, or deciding which docs/tests a change should update.

### [architecture/lesson-type-modules.md](architecture/lesson-type-modules.md)
Design intent and contract for `src/modules/<type>/` lesson modules, including student, builder, teacher-live, persistence, check editor, runtime, sandbox, and carry-through responsibilities.

**Load when:** adding or changing a lesson type, changing the module interface, or touching registry-driven classroom/builder behavior.

### [architecture/composed-lessons-spec.md](architecture/composed-lessons-spec.md)
Proposed technical specification for backward-compatible multi-workspace composed lessons, lesson-module-scoped carry-through and sandboxes, plus local-only Python, Arcade Kit, and Electronics playgrounds.

**Load when:** implementing or reviewing composed lessons, module-aware task routing, scoped sandbox persistence, or the first standalone playgrounds.

### [architecture/runtime-flows.md](architecture/runtime-flows.md)
High-level route, student phase, persistence, teacher-live, and Firebase ownership diagrams.

**Load when:** changing classroom session behavior, student persistence, teacher live view, or Firebase ownership.

### [architecture/scratch-block-icons-plan.md](architecture/scratch-block-icons-plan.md)
Review draft for adding readable emoji/icon cues to Scratch blocks across Markdown, editor pickers, and Blockly labels.

**Load when:** reviewing or implementing the Scratch block icon mapping.

---

## Architecture decision records (`docs/adr/`)

Short records of durable architecture decisions. Update or supersede these when the decision changes.

### [adr/README.md](adr/README.md)
Index of architecture decision records.

**Load when:** looking for why a major architectural choice exists.

### [adr/0001-frontend-only-firebase.md](adr/0001-frontend-only-firebase.md)
Decision to keep the app frontend-only and use Firebase instead of adding a backend server or API.

### [adr/0002-login-less-student-identity.md](adr/0002-login-less-student-identity.md)
Decision to keep students login-less and persist anonymous identity in localStorage.

### [adr/0003-realtime-database-for-live-sessions.md](adr/0003-realtime-database-for-live-sessions.md)
Decision to use Realtime Database for live session state and Firestore for durable content.

### [adr/0004-lesson-type-module-registry.md](adr/0004-lesson-type-module-registry.md)
Decision to isolate code lesson behavior behind the lesson type module registry.

### [adr/0005-worker-based-python-runtime.md](adr/0005-worker-based-python-runtime.md)
Decision to run Pyodide through a Web Worker.

### [adr/0006-sandboxed-iframe-web-preview.md](adr/0006-sandboxed-iframe-web-preview.md)
Decision to render HTML previews with sandboxed Blob-backed iframes.

### [adr/0007-custom-scratch-runtime.md](adr/0007-custom-scratch-runtime.md)
Decision to use the custom Scratch runtime in `src/modules/scratch/`.

### [adr/0008-split-cli-and-builder-validation.md](adr/0008-split-cli-and-builder-validation.md)
Decision to keep CLI validation and Builder validation separate.

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
Very high-level, non-technical overview of the kinds of tasks a lesson can contain (code, information, quiz, group) — no field names or YAML.

**Load when:** you just need a plain-language explanation of what a task type is, e.g. explaining lesson structure to a non-technical author.

### [authoring/quiz-types.md](authoring/quiz-types.md)
Very high-level, non-technical overview of the quiz styles (multiple choice, match, fill in the blank, short answer, confidence) — no field names or YAML.

**Load when:** you just need a plain-language explanation of what a quiz type is, without the field-level detail in `quiz-tasks.md`.

### [authoring/lesson-schema.md](authoring/lesson-schema.md)
Complete JSON field reference for lessons — every field on the lesson object, task object, group object, and nested structures. The ground truth for field names, types, and valid values.

**Load when:** you need the exact field name or shape for a lesson JSON property, or when validating a generated lesson against the schema.

### [authoring/lesson-schema-yaml.md](authoring/lesson-schema-yaml.md)
Canonical YAML contract for the lesson envelope, Draft workflow, managed version/timestamps, common task fields, information tasks, and task groups. Points to `quiz-tasks.md` and the per-type code task files for the rest.

**Load when:** you need a quick, focused reference for the basic shape of a lesson YAML file without wading through code task or quiz task detail.

### [authoring/lesson-assets-cli.md](authoring/lesson-assets-cli.md)
Durable CLI contract for listing, uploading, and deleting lesson files in Firebase Storage, including metadata and Markdown URLs.

**Load when:** adding, replacing, listing, or removing a lesson asset.

### Per-type code task and check references
Completion and feedback checks are documented inside each lesson-type authoring doc so authors can work from one self-contained page per lesson type.

**Load when:** adding or editing checks on any task type.

### [authoring/python.md](authoring/python.md)
Python lesson authoring reference: task fields, checks, tests, examples, carry-through, and runtime behavior.

**Load when:** authoring or editing a Python lesson.

### [authoring/arcade.md](authoring/arcade.md)
Arcade Kit authoring reference: the single-file task model, asset names, runtime behaviour, and the available `headstart_arcade` API.

**Load when:** authoring or editing an Arcade Kit lesson.

### [authoring/quiz-tasks.md](authoring/quiz-tasks.md)
Detailed reference for all five quiz sub-types: multiple-choice, match, fill-in-the-blank, short-answer, and confidence rating. Covers all sub-type-specific fields and YAML syntax.

**Load when:** authoring or editing a quiz task.

### [authoring/python-tasks.md](authoring/python-tasks.md)
Python code task field reference: `starterCode`, `completeCode`, stage roles/revealable `codeStages`, `carryCodeFrom`, `interactionMode`, and the `tests` array (automated `input()`-driven test cases). Includes a minimal full-lesson example.

**Load when:** authoring or editing a Python code task, especially one with `tests`.

### [authoring/html.md](authoring/html.md)
HTML lesson authoring reference: task fields, file model, element checks, assets, examples, and preview behavior.

**Load when:** authoring or editing an HTML lesson.

### [authoring/html-tasks.md](authoring/html-tasks.md)
HTML code task field reference: `starterFiles`, `completeFiles`, `entryFile`, stage roles/revealable `codeStages`, and carry-through-by-filename behaviour. Includes a minimal full-lesson example.

**Load when:** authoring or editing an HTML code task.

### [authoring/filesystem.md](authoring/filesystem.md)
Filesystem lesson authoring reference: task fields, flat path-map state, filesystem checks, examples, and explorer behavior.

**Load when:** authoring or editing a filesystem lesson.

### [authoring/filesystem-tasks.md](authoring/filesystem-tasks.md)
Filesystem code task field reference: the flat path-map state model, `starterFs`, `completeFs`, stage roles/revealable `codeStages`, `carryFsFrom`, and `startsInDir`. Includes a minimal full-lesson example.

**Load when:** authoring or editing a filesystem code task.

### [authoring/electronics.md](authoring/electronics.md)
Electronics code task field reference: editable breadboard circuit shape, `starterCircuit`, `completeCircuit`, stage roles/revealable `codeStages`, `carryCircuitFrom`, checks, and MicroPython code tab fields.

**Load when:** authoring or editing an electronics breadboard task.

### [authoring/scratch.md](authoring/scratch.md)
Scratch-specific task fields, sprite and backdrop objects, block opcodes accepted by the interpreter, toolbox configuration, and Scratch check field names.

**Load when:** authoring or editing a Scratch lesson, or working on Scratch-related checks.

### [authoring/scratch-toolbox-xml.md](authoring/scratch-toolbox-xml.md)
How to write a Scratch toolbox XML string: XML structure, all categories with their colours, every available block opcode, and common toolbox patterns with copy-paste examples.

**Load when:** writing a Scratch task `toolbox` field by hand, or troubleshooting a missing block in the student palette.

### [authoring/scratch-markdown-blocks.md](authoring/scratch-markdown-blocks.md)
Complete author-facing Scratch block rendering reference: every supported block, its opcode, the exact Markdown text that renders it, shapes, aliases, input notation, and C-block nesting syntax.

**Load when:** writing a Scratch block in an `explainer`, `description`, or `syntax` field, or checking how a block should render in authored Markdown.

### [authoring/markdown-renderer.md](authoring/markdown-renderer.md)
Supported Markdown features in the shared renderer: callout syntax, fenced code blocks, topic wiki-links (`[[id]]`), Scratch block pills, tables, and inline Markdown vs full Markdown contexts.

**Load when:** writing `explainer`, `description`, or `syntax` field content, or working on the Markdown renderer itself.

### [authoring/TOPIC_LIBRARY_SCHEMA.md](authoring/TOPIC_LIBRARY_SCHEMA.md)
Schema reference for the topic library: Firestore structure, all field definitions, YAML authoring format, and how topics are linked from Markdown via `[[wiki-links]]`.

**Load when:** writing or editing topics, or when working on anything that reads from `topicLibrary` in Firestore.
