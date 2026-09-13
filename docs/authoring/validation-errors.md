# Validation Errors and Warnings

What each message from `node cli/cli.mjs lessons validate`, `yaml-to-json`, `upsert` and
`publish-yaml` means, and how to fix it. The Builder shows the same messages for the rules both
share.

- **Errors** block publishing. **Warnings** don't, but usually point at something students
  will notice.
- `…` stands for the part of the message that changes: a task number, field name or value.
- **Task numbers** count every task in order, including subtasks inside groups, starting at 1.
  `Task 3.2` means the second subtask of the third item.
- On failure the CLI prints `{ "valid": false, "errors": [...], "warnings": [...] }` as JSON on
  **stdout** and exits with code 1.

`src/modules/__tests__/validationErrorsDoc.test.js` fails if a validator gains a message that
isn't listed here, so add a row whenever you add a message.

## Lesson envelope

| Message | Meaning | Fix |
|---|---|---|
| `id is required` | The lesson has no `id`. | Add `id: my-lesson-slug`. |
| `id must be a lowercase slug (letters, digits, hyphens only)` | The id has capitals, spaces or other characters. | Use lowercase letters, digits and hyphens, e.g. `python-loops-2`. |
| `type is required` | No lesson `type`. | New lessons use `type: composed`. |
| `type must be one of: …` | Unknown lesson type. | Use `composed`, or a legacy single-module type from the list. |
| `title is required` | No lesson `title`. | Add a title. |
| `description is required` | No `description` (shown on the entry screen). | Add a one-sentence description. |
| `recordingUrl must be a YouTube link (youtube.com or youtu.be)` | `recordingUrl` isn't a YouTube URL. | Use an unlisted YouTube link, or remove the field. |
| `tasks is required and must be an array` | `tasks` is missing or not a list. | Add `tasks:` with at least one task. |
| `tasks must contain at least one task or group` | `tasks` is empty. | Add a task. |
| `draft must be a boolean when provided` | `draft` is not `true` or `false`. | Use `draft: true` or remove it. |
| `version must be a non-negative integer when provided` | `version` was hand-edited. | Remove `version` from source files; LaunchPad manages it. |

## Groups

| Message | Meaning | Fix |
|---|---|---|
| `Group … is missing a title` | A `type: group` item has no title. | Add `title:` to the group. |
| `Group "…" has no subtasks` | The group's `subtasks` list is empty. | Add subtasks or remove the group. |
| `Group … subtasks must be an array` | `subtasks` isn't a list. | Write `subtasks:` as a YAML list. |

## Task shape

| Message | Meaning | Fix |
|---|---|---|
| `Task … is missing a title` / `… is missing a title` | A task has no `title`. | Add a title. |
| `… must be an object` | A task entry is not a mapping (e.g. a bare string). | Write each task as `- title: …` with fields under it. |
| `… taskType must be information or quiz when provided` | `taskType` has an unsupported value. Allowed: `information`, `quiz`, `code_arrange`; leave it out for code tasks. | Fix the value or remove `taskType`. In YAML, `type: information` / `type: quiz` also work. |
| `… has an invalid task-type value` | The YAML `type:` shorthand isn't a known task type. | Use `information`, `quiz` or `group`, or omit it for a code task. |
| `… has an invalid quiz type` | `quizType` isn't one of the five quiz types. | Use `multiple_choice`, `match`, `fill_blank`, `short_answer` or `confidence`. |
| `… intent must be a non-empty Markdown string while lesson draft is enabled` | Draft lessons need an `intent` on every real task. | Add `intent:` describing what the task is for. |
| `… intent must be a Markdown string when provided` | `intent` isn't text. | Make it a string. |
| `… taskActivity must be a string when provided` | `taskActivity` isn't text. | Make it a string. |
| `… check must be an object or an array of objects when provided` | `check` is a string or number. | Write the check as a mapping, or a list of mappings. |
| `… must be an array of objects when provided` | A list field (`options`, `pairs`, `blanks`, `lines`, `starterFiles`, `codeStages`, `tests`, `feedbackChecks`, …) holds non-objects. | Make each entry a mapping. |
| `… … must be a string when provided` | A text field holds a list or number. | Quote the value. |
| `… … must be an object when provided` | A mapping field (e.g. `starterBlocks`, `starterCircuit`) holds a string. | Provide the object, not JSON text. |
| `Task … estimated time must be a positive number of minutes` | `estimatedMinutes` is 0, negative or not a number. | Use e.g. `estimatedMinutes: 5`, or remove it. |
| `Task … priority must be one of: …` | `priority` isn't `core` or `optional`. | Fix the value or remove it (default is core). |
| `Task … allowSharing must be true or false` | `allowSharing` isn't a boolean. | Use `true` or `false`. |
| `Task … allowSharing is not supported on quiz or information tasks` | Only code tasks have a workspace to share. | Remove `allowSharing` from that task. |
| `Task … stage … role must be one of: …` | A `codeStages` entry has an unknown `role`. | Use `starter`, `support` or `complete`. |
| `Task … stage … is missing a label` | A code stage has no `label`. | Add `label:` to the stage. |

## Composed lessons and carry-through

| Message | Meaning | Fix |
|---|---|---|
| `Code task "…" must select a workspace module` | A code task in a composed lesson has no `moduleType` (or `moduleId`). | Add `moduleType: python` (or `turtle`, `html`, `scratch`, …). |
| `Code task "…" has an unknown workspace module` | `moduleType`/`moduleId` doesn't match a module. | Use a supported module type, or define the module in `modules:`. |
| `Code task "…" has a module ID and module type that do not match` | Both are set and they disagree. | Remove one, or make them agree. |
| `Task … … must reference an earlier task in the same lesson module` | A `carryCodeFrom`/`carryBlocksFrom`/`carryFsFrom`/`carryCircuitFrom` points at a later task or a task using a different module. | Carry only from an earlier task with the same `moduleType`. |

## Information and quiz tasks

| Message | Meaning | Fix |
|---|---|---|
| `Task … is an information task but has no explainer` | Information tasks are just their explainer. | Add `explainer:` Markdown. |
| `Task … is a quiz but has fewer than 2 options` | Multiple-choice needs at least two options. | Add options. |
| `Task … is a quiz but has an empty option text` | An option has no text. | Fill in or remove it. |
| `Task … is a quiz but no correct answer has been selected` | No option is marked correct. | In YAML, set `answer:` to the correct option text; in JSON, set `check` to that option's id. |
| `Task … is a match quiz but has fewer than 2 pairs` | Match quizzes need two or more pairs. | Add pairs. |
| `Task … is a match quiz but has an empty prompt or answer` | A pair is half-empty. | Fill in both sides. |
| `Task … is a fill-in-the-blank quiz but has no blanks in the text` | The quiz text has no `{{blank}}` markers. | Add blanks to `text`. |
| `Task … is a fill-in-the-blank quiz but has no blank answers` | `blanks` is empty. | Add an answer per blank. |
| `Task … is a fill-in-the-blank quiz but has an empty answer` | A blank has no answer. | Fill it in. |
| `Task … is a short-answer quiz with a check enabled but no check value` | The short-answer check has no `value`. | Add the expected answer, or remove the check for an ungraded question. |

## Code-arrange tasks

| Message | Meaning | Fix |
|---|---|---|
| `Task … is a code-arrange task but must use the Python or HTML module` | Code arrange only runs Python or HTML. | Set `moduleType: python` or `html`. |
| `Task … is a code-arrange task but has no lines` | `lines` is empty. | Add the program lines. |
| `Task … line … has no id` / `Task … line … has no parts` | A line is missing its `id` or `parts`. | Give every line an `id` and at least one part. |
| `Task … line … blank … has no id` / `Task … line … blank … has no correct value` | A `slot` part is incomplete. | Give each slot an `id` and the correct `code`. |
| `Task … line … part … has an invalid type` | A part's `type` isn't `text` or `slot`. | Use `text` or `slot`. |
| `Task … is a code-arrange task but has no blanks` | No line has a `slot`. | Add at least one blank. |
| `Task … is a code-arrange task but has duplicate line ids` | Two lines share an id. | Make line ids unique. |
| `Task … distractor … has no id` / `Task … distractor … has no code` | A distractor tile is incomplete. | Give it an `id` and `code`. |
| `Task … is a code-arrange task but has duplicate blank/distractor ids` | Slot and distractor ids clash. | Make every tile id unique. |
| `Task … is a code-arrange task but has no completion check` | There's nothing to decide when the arrangement is right. | Add a `check`, usually on output. |

## Module starter state

| Message | Meaning | Fix |
|---|---|---|
| `Task … has no files` | An HTML task has no `starterFiles` (or starter stage files). | Add at least `index.html`. |
| `Task … has duplicate filenames` | Two starter files share a name. | Rename one. |
| `Task … has no HTML file to use as entry point` | No `.html` file among the starter files. | Add an HTML file. |
| `Task … stage … has no filesystem state` | A Filesystem stage has no `fs`. | Add the stage's filesystem map. |
| `Task … stage … has no desktop state` | A Desktop stage has no `desktop` object. | Add the stage's desktop state (see `desktop.md`). |
| `Task … has no starter breadboard` | An Electronics task has no `starterCircuit` with `components`. | Add `starterCircuit: { components: [], wires: [] }` at minimum. |

## Checks

| Message | Meaning | Fix |
|---|---|---|
| `Task … sprite check is missing a property` / `Task … sprite check is missing an operator` / `Task … sprite check is missing a value` | A Scratch `sprite_property` check is incomplete. | Set `property`, `operator` and `value`. |
| `Task … block-used check is missing a block opcode` | A Scratch `block_used` check has no `opcode`. | Add `opcode:` (see `scratch.md` for opcodes). |
| `Task … has a filesystem … but no path` | A Filesystem check has no `path`. | Add `path:`. |
| `Task … has a file-content … but no expected value` | `fs_file_content` has no `value`. | Add the text to compare. |
| `Task … has a file line-count … but no expected count` | `fs_file_line_count` has no `value`. | Add a number. |
| `Task … has a file-location … but no parent folder` | `fs_file_location` has no `dir`. | Add `dir:`. |
| `Task … has a folder-count … but no expected count` | `fs_folder_count` has no `value`. | Add a number. |
| `Task … has a filesystem check but no path` | A Desktop task's `fs_*` check has no `path`. | Add `path:`. |
| `Task … has a file content check but no expected value` | A Desktop `fs_content_contains` check has no `value`. | Add the text to look for. |
| `Task … has a file-in-dir check but no parent folder` | A Desktop `fs_file_in_dir` check has no `dir`. | Add `dir:`. |
| `Task … has a part-exists … but no part type or label` | An Electronics part check can't identify a part. | Add `component: { type: led }` or a label/id. |
| `Task … has a powered-part … but no part type or label` | Same, for powered/unpowered checks. | Identify the part. |
| `Task … has a control … but no control or controlled part` | `circuit_control_affects_power` is missing one side. | Set both `control` and `component`. |
| `Task … has a circuit connection … but no source or destination part/pin` | A path check's `from`/`to` is incomplete. | Give both a part and a `pin`. |
| `Task … has a circuit connection-includes … but no required part` | `circuit_path_includes` has no `includes`. | Add the part the path must go through. |
| `Task … has a turtle … with unknown type "…"` | Not one of the eight Turtle check types. | See `turtle.md`. |
| `Task … has a turtle position … but no x/y target` | `turtle_position` needs `x` and `y`. | Add both. |
| `Task … has a turtle … but no check value` | A heading/count/length check has no `value`. | Add `value:`. |
| `Task … has a turtle command … with no valid command (one of: …)` | `turtle_command_used` names an unknown command. | Use one of the listed names, e.g. `forward`, `turn`, `circle`. |
| `Task … has a turtle colour … but no colour` | `turtle_color_used` has no `color`. | Add the colour exactly as students will write it. |

Python, HTML and code checks with missing values are validated in the Builder. See the module
docs for each check's required fields.

## Warnings about the solution

| Message | Meaning | Fix |
|---|---|---|
| `Task … has no starter code — students will start with an empty editor` | No starter code, files or blocks. | Usually add a starter; ignore if an empty editor is intended. |
| `Task … complete solution fails a code check — review the complete code` | The authored complete code fails one of the task's source-code checks. | Fix the complete code or the check. `lessons test-checks` helps. |
| `Task … complete solution fails a code check — review the complete files` | Same for HTML complete files. | Fix the files or the check. |
| `Task … has output checks — open the Complete tab and run to verify the complete solution` | Output checks need a real run, which the CLI can't do. | Open the task in the Builder and run the complete solution. |
| `Task … has element/output checks — open the Complete tab and run to verify the complete solution` | Same for HTML element checks. | Run it in the Builder. |
| `Task … complete filesystem does not satisfy a check — review the complete filesystem` | The complete filesystem fails a check. | Fix the complete state or the check. |
| `Task … complete desktop does not satisfy a check — review the complete desktop` | The complete Desktop state fails a check. | Fix the complete state or the check. |

## Class forks

| Message | Meaning | Fix |
|---|---|---|
| `fork must be an object when provided` | `fork` isn't a mapping. | Use `lessons fork` rather than writing `fork` by hand. |
| `fork.sourceLessonId is required` / `fork.classId is required` | Fork metadata is incomplete. | Recreate the fork with `lessons fork <source> <class>`. |
| `forked lesson id must be '…'` | Fork ids are `{source}-{classId}`. | Use the id shown. |
| `fork.taskLinks must be an array when provided` | `taskLinks` isn't a list. | Let `lessons fork` generate it. |

## Topic Library

| Message | Meaning | Fix |
|---|---|---|
| `Cannot save a lesson while Topic Library entries are missing: …` | The lesson links `[[topic-id]]`s that don't exist. | Create the topics first (`topics upsert`), or add them to `topicProposals` while drafting. |
| `Missing Topic Library entries: …` | Warning form of the above, for draft lessons. | Create the topics before clearing `draft`. |
| `Unused topic proposals: …` | `topicProposals` lists topics the lesson never links. | Link them or remove the proposals. |
| `… is missing an id` / `… id must be a topic slug` / `… duplicates id "…"` | A topic proposal's id is missing, malformed or repeated. | Use unique lowercase slugs. |
| `… is missing a description` | A topic proposal has no description. | Add one. |
| `… status must be proposed or deferred` | Invalid proposal `status`. | Use `proposed` or `deferred`. |
