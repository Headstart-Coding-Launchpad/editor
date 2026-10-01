# Validation Errors and Warnings

What each message from `node cli/cli.mjs lessons validate`, `yaml-to-json`, `upsert` and
`publish-yaml` means, and how to fix it. The Builder and the CLI run the same rules with the same
wording (`src/shared/lessonValidation.js` plus each module's `validateTask`; see
[ADR 0008](../adr/0008-split-cli-and-builder-validation.md)). A few rows are marked
**CLI only** or **Builder only**: those depend on where the lesson is being validated.

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
| `description is required` (**CLI only**) | No `description` (shown on the entry screen). | Add a one-sentence description. |
| `recordingUrl must be a YouTube link (youtube.com or youtu.be)` | `recordingUrl` isn't a YouTube URL. | Use an unlisted YouTube link, or remove the field. |
| `tasks is required and must be an array` | `tasks` is missing or not a list. | Add `tasks:` with at least one task. |
| `tasks must contain at least one task or group` | `tasks` is empty. | Add a task. |
| `draft must be a boolean when provided` | `draft` is not `true` or `false`. | Use `draft: true` or remove it. |
| `version must be a non-negative integer when provided` | `version` was hand-edited. | Remove `version` from source files; LaunchPad manages it. |
| `badgeOptions must be an object when provided` | `badgeOptions` isn't a mapping. | Write it as `badgeOptions:` with option names under it ([badges.md](badges.md#badgeoptions)). |
| `badgeOptions.… is not a badge option and is ignored` (warning) | A key under `badgeOptions` isn't one of `quizMasterThreshold`, `quizMasterMinQuizzes`, `persistenceMinFails` or `readyToCodeSeconds`. | Fix the spelling or remove it. |
| `badgeOptions.… must be a number from 0 to 1` | `quizMasterThreshold` is outside 0–1 (it's a share, not a percentage). | Write `0.8`, not `80`. |
| `badgeOptions.… must be a whole number of at least 1` | `quizMasterMinQuizzes` or `persistenceMinFails` is below 1 or not a whole number. | Use a whole number, 1 or more. |
| `badgeOptions.… must be a positive number of seconds` | `readyToCodeSeconds` is 0, negative or not a number. | Use a number of seconds above 0. |

## Groups

| Message | Meaning | Fix |
|---|---|---|
| `Group … is missing a title` | A `type: group` item has no title. | Add `title:` to the group. |
| `Group "…" has no subtasks — add at least one subtask` | The group's `subtasks` list is empty. | Add subtasks or remove the group. |
| `Group … subtasks must be an array` | `subtasks` isn't a list. | Write `subtasks:` as a YAML list. |

## Task shape

| Message | Meaning | Fix |
|---|---|---|
| `Task … is missing a title` / `… is missing a title` | A task has no `title`. | Add a title. |
| `… must be an object` | A task entry is not a mapping (e.g. a bare string). | Write each task as `- title: …` with fields under it. |
| `… taskType must be information, quiz, code_arrange or activity when provided` | `taskType` has an unsupported value. Allowed: `information`, `quiz`, `code_arrange`, `activity`; leave it out for code tasks. | Fix the value or remove `taskType`. In YAML, `type: information` / `type: quiz` also work. |
| `… has an invalid task-type value` | The YAML `type:` shorthand isn't a known task type. | Use `information`, `quiz` or `group`, or omit it for a code task. |
| `… has an invalid quiz type` | `quizType` isn't one of the five quiz types. | Use `multiple_choice`, `match`, `fill_blank`, `short_answer` or `confidence`. |
| `… intent must be a non-empty Markdown string while lesson draft is enabled` | Draft lessons need an `intent` on every real task. | Add `intent:` describing what the task is for. |
| `… intent must be a Markdown string when provided` | `intent` isn't text. | Make it a string. |
| `… taskActivity must be a string when provided` | `taskActivity` isn't text. | Make it a string. |
| `Task … taskActivity "…" is not a recognised Lesson Format Glossary pattern` (warning) | `taskActivity` doesn't name a known format and pattern (`Code Task, Debug Code Task`, `Quiz: What Is the Error?`, plain `Information` …). Pattern-based badges ([badges.md](badges.md)) won't recognise the task. | Use a pattern from `lessons capabilities` → `taskActivity.patterns`, or the plain form (`Code Task`, `Quiz, Multiple Choice`). |
| `Task … badgeHints must be an object with suggest and/or suppress lists` | `badgeHints` isn't a mapping. | Write `badgeHints:` with `suggest:` / `suppress:` lists under it ([badges.md](badges.md#badgehints)). |
| `Task … badgeHints only takes suggest and suppress (found "…")` | `badgeHints` has another key. | Use only `suggest` and `suppress`. |
| `Task … badgeHints.… must be a list of badge ids` | `suggest` or `suppress` isn't a list of strings. | Write `suggest: [bug_hunter]`. |
| `Task … badgeHints.… names an unknown badge "…"` | The id isn't a built-in badge. | Use an id from `lessons capabilities` → `badges.badges`. |
| `Task … badgeHints.suggest names "…", which a task's pattern can't trigger` | Only the pattern badges (`bug_hunter`, `code_builder`, `code_detective`, `challenge_solver`) can be added to a task; the others follow their own signals, and tutor-only badges are never suggested. | Remove the id from `suggest`. |
| `Task … badgeHints.suppress names "…", a tutor-only badge that is never suggested` (warning) | Suppressing a tutor-only badge does nothing. | Remove the id from `suppress`. |
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
| `Task ID … is used by … and … - renumber task IDs before publishing` (warning, **Builder only**) | Two tasks share an `id`. | Renumber the task ids. |

## Composed lessons and carry-through

| Message | Meaning | Fix |
|---|---|---|
| `Code task "…" must select a workspace module` | A code task in a composed lesson has no `moduleType` (or `moduleId`). | Add `moduleType: python` (or `turtle`, `html`, `scratch`, …). |
| `Code task "…" has an unknown workspace module` | `moduleType`/`moduleId` doesn't match a module. | Use a supported module type, or define the module in `modules:`. |
| `Code task "…" has a module ID and module type that do not match` | Both are set and they disagree. | Remove one, or make them agree. |
| `Task … … must reference an earlier task in the same lesson module` | A `carryCodeFrom`/`carryBlocksFrom`/`carryFsFrom`/`carryCircuitFrom`/`carryDesktopFrom` points at a later task or a task using a different module. | Carry only from an earlier task with the same `moduleType`. |
| `Task … references task … for carry-through but that task does not exist` | The task's module carry field (`carryCodeFrom`, `carryBlocksFrom`, `carryFsFrom`, `carryCircuitFrom` or `carryDesktopFrom`) names a task id that isn't in the lesson. | Use the id of an earlier task, or remove the field. |

## Information and quiz tasks

| Message | Meaning | Fix |
|---|---|---|
| `Task … is an information task but has no explainer` | Information tasks are just their explainer (except `informationType: introduction` and `badges`). | Add `explainer:` Markdown. |
| `Task … is a quiz but has fewer than 2 options` | Multiple-choice needs at least two options. | Add options. |
| `Task … is a quiz but has an empty option text` | An option has no text. | Fill in or remove it. |
| `Task … is a quiz but no correct answer has been selected` | No option is marked correct. | In YAML, set `answer:` to the correct option text; in JSON, set `check` to that option's id. |
| `Task … is a match quiz but has fewer than 2 pairs` | Match quizzes need two or more pairs. | Add pairs. |
| `Task … is a match quiz but has an empty prompt or answer` | A pair is half-empty. | Fill in both sides. |
| `Task … is a fill-in-the-blank quiz but has no blanks in the text` | The quiz text has no `{{blank}}` markers. | Add blanks to `text`. |
| `Task … is a fill-in-the-blank quiz but has no blank answers` | `blanks` is empty. | Add an answer per blank. |
| `Task … is a fill-in-the-blank quiz but has an empty answer` | A blank has no answer. | Fill it in. |
| `Task … is a short-answer quiz with a check enabled but no check value` | The short-answer check has no `value`. | Add the expected answer, or remove the check for an ungraded question. |

## Activity tasks

Tasks with `taskType: activity` are checked by their activity's own rules (messages start
`Task …:`).

| Message | Meaning | Fix |
|---|---|---|
| `` Task …: unknown activityType "…". Run `lessons capabilities` to list activities. `` | `activityType` is missing or isn't an activity this version knows. | Fix the `activityType`. |

Rules shared by every activity with an `items` list (Binary, Keyboard, Mouse; Mouse targets too):

| Message | Meaning | Fix |
|---|---|---|
| `Task … item …: needs an id.` / `Task … target …: needs an id.` | An item (or Mouse target) has no `id`. Ids keep each student's saved progress attached to the right item. | Give every item a short unique `id` (`a`, `b`, …). |
| `Task … item …: id "…" is used more than once.` | Two items (or two targets) share an id. | Make the ids unique. |

### Binary ([activities/binary.md](activities/binary.md))

| Message | Meaning | Fix |
|---|---|---|
| `Task …: binary mode must be one of ….` | `mode` is missing or unknown. | Use `make_number`, `to_binary`, `to_decimal`, `add`, `overflow`, `hex`, `ascii` or `pixels`. |
| `Task …: binary bits must be a whole number from … to ….` | `bits` is outside 1–16. | Use a whole number from 1 to 16 (default 8). |
| `Task …: binary task needs at least one item.` | `items` is empty. | Add at least one item. |
| `Task … item …: target must be a whole number from 0 to ….` | A `make_number` / `to_binary` target doesn't fit in `bits`. | Lower the target or raise `bits` (4 bits → 0–15, 8 bits → 0–255). |
| `Task … item …: value must be … binary digits (0s and 1s).` | A `to_decimal` value (or a `hex` value with `from: binary`) isn't exactly `bits` long, or has other characters. | Pad with leading zeros to the full width, e.g. `"0101"` for 4 bits. Quote it in YAML. |
| `Task … item …: a and b must each be … binary digits (0s and 1s).` | An `add` / `overflow` item's `a` / `b` isn't exactly `bits` long. | Pad both to the full width and quote them in YAML. |
| `Task … item …: a + b is too big for … bits (use mode: overflow for that).` | An `add` sum doesn't fit in `bits`. | Pick smaller numbers, raise `bits`, or make it an `overflow` task. |
| `Task … item …: a + b fits in … bits, so it does not overflow.` | An `overflow` item's sum fits, so there is no overflow to spot. | Pick bigger numbers (the sum must be more than 2^bits − 1), or make it an `add` task. |
| `Task … item …: from and to must be two different bases: binary, hex or decimal.` | A `hex` item's `from` / `to` is missing, unknown, or the same. | Set `from` and `to` to two different values out of `binary`, `hex` and `decimal`. |
| `Task … item …: value must be a hex number (0-9, A-F) from 0 to ….` | A `hex` item with `from: hex` has other characters, or is too big for `bits` (8 bits → at most `FF`). | Use only 0-9 and A-F, quote it in YAML, and keep it within `bits`. |
| `Task … item …: value must be a whole number from 0 to ….` | A `hex` item with `from: decimal` isn't a whole number, or doesn't fit in `bits`. | Lower the value or raise `bits`. |
| `Task …: binary codeFormat must be binary or decimal.` | An `ascii` task's `codeFormat` is something else. | Use `binary` (default) or `decimal`. |
| `Task … item …: text must be 1 to … printable ASCII characters (letters, digits, spaces and symbols).` | An `ascii` item's `text` is empty, too long (over 16), or has characters outside codes 32–126 (accents, emoji, tabs, new lines). | Shorten it and use plain keyboard characters only. |
| `Task … item …: ascii direction must be encode or decode.` | An `ascii` item's `direction` is missing or unknown. | Use `encode` (type the codes) or `decode` (type the text). |
| `Task …: binary pixels width and height must be whole numbers from 1 to ….` | A `pixels` task has no `width` / `height`, or one is over 16. | Set both on the task, each from 1 to 16. |
| `Task … item …: pixels direction must be draw or encode.` | A `pixels` item's `direction` is missing or unknown. | Use `draw` (click the squares) or `encode` (type the bits). |
| `Task … item …: rows must be … rows of … binary digits (0s and 1s).` | A `pixels` item doesn't have exactly `height` rows, or a row isn't exactly `width` 0s and 1s. | Give one quoted string per row, each exactly `width` long. |
| `Task …: binary task has too much to save (… characters of answers, limit …). Use fewer or smaller items.` | An `overflow` / `hex` / `ascii` / `pixels` task's finished answers are too big to sync to the teacher (roughly more than four 16 × 16 pictures). | Split the items across two tasks, or use smaller pictures / shorter text. |

### Keyboard ([activities/keyboard.md](activities/keyboard.md))

| Message | Meaning | Fix |
|---|---|---|
| `Task …: keyboard mode must be one of ….` | `mode` is missing or unknown. | Use `type_text`, `find_key`, `symbols`, `shortcuts` or `edit_text`. |
| `Task …: keyboard layout "…" is not supported (use "uk").` | Only the UK layout exists so far. | Remove `layout` or set it to `uk`. |
| `Task …: minAccuracy must be a number above 0 and at most 1.` | `minAccuracy` is a fraction, not a percentage. | Use e.g. `0.9` for 90%. |
| `Task …: targetWpm must be a positive number.` | `targetWpm` is zero, negative or not a number. | Use a positive number, or remove it to skip the speed goal. |
| `Task …: minKept must be a number above 0 and at most 1.` | `edit_text` `minKept` is a fraction, not a percentage. | Use e.g. `0.9`, or remove it for the default. |
| `Task …: keyboard task needs at least one item.` | `items` is empty. | Add at least one item. |
| `Task … item …: text is required.` | A `type_text` item has no `text`. | Add the line to type. |
| `Task … item …: text must be at most … characters.` | A `type_text` line is over 200 characters. | Split it into several items. |
| `Task … item …: can't be typed on a … keyboard: …` | The text has characters with no key on the layout (listed at the end), such as curly quotes or emoji. | Replace them with plain keyboard characters. |
| `Task … item …: key must be a character or one of ….` | A `find_key` `key` is neither a typeable character nor a named key. | Use one character (`a`, `7`, `?`) or a named key such as `Enter`, `Space`, `Backspace`, `Shift`. |
| `Task … item …: char must be one character that can be typed on a … keyboard.` | A `symbols` `char` is empty, longer than one character or not on the layout. | Use a single symbol such as `@`, `£` or `"`. |
| `Task … item …: combo must be a shortcut like "Ctrl+C".` | A `shortcuts` `combo` is missing or has no modifier. | Write it as `Ctrl+C`, `Ctrl+Shift+Z`, … (`Ctrl` also means Cmd on a Mac). |
| `Task … item …: "…" just types a character. Use Ctrl, Cmd or Alt, or Shift with a key like Tab or an arrow key.` | The `combo` is Shift plus a character key (`Shift+A`), which types a capital rather than doing a shortcut. | Add Ctrl/Cmd or Alt, or use a non-typing key (`Shift+Tab`, `Shift+ArrowLeft`). To practise capitals, use `type_text` or `symbols` mode. |
| `Task … item …: "…" is kept by the browser, so students can't press it here. Teach it with a quiz question instead.` | The browser handles that shortcut itself (Ctrl+W, Ctrl+T, Ctrl+N, Ctrl+Q, Ctrl+Tab, Ctrl+Shift+T/N, Alt+F4), so the page never sees it. | Use a different shortcut, or ask about it in a quiz task. |
| `Task … item …: … is required.` | An `edit_text` item has no `start` (the line with mistakes) or no `target` (the fixed line); the message names which. | Add both. |
| `Task … item …: … must be at most … characters.` | An `edit_text` `start` or `target` is over 200 characters. | Use a shorter line, or split it into items. |
| `Task … item …: … has characters that can't be typed: …` | An `edit_text` `start` or `target` has characters with no key on the layout (curly quotes, emoji). | Use plain keyboard characters: students must be able to type every fix. |
| `Task … item …: start and target are the same, so there is nothing to fix.` | The `edit_text` line has no mistakes. | Put the mistakes in `start`. |
| `Task … item …: requireKeys must be a list, such as [Delete] or [Backspace, select].` | `requireKeys` is a single value, not a list. | Write it as a YAML list: `requireKeys: [Delete]`. |
| `Task … item …: requireKeys has keys it can't check (…). Use ….` | `requireKeys` names a key other than `Backspace`, `Delete`, `ArrowLeft`, `ArrowRight`, `Home`, `End` or `select`. | Use those names (`select` means any Shift selection). |
| `Task … item …: add a prompt telling students what the shortcut does.` (warning) | A `shortcuts` item has no `prompt`; students only see the keys. | Add `prompt:` such as "Copy the selected word". |

### Mouse ([activities/mouse.md](activities/mouse.md))

| Message | Meaning | Fix |
|---|---|---|
| `Task …: mouse task needs at least one target.` | `targets` is empty. | Add targets to the stage. |
| `Task … target …: x and y must be between 0 and 1 (fractions of the stage).` | A target position is missing or outside the stage. | Use fractions: `x: 0.5, y: 0.5` is the middle. |
| `Task … target …: size must be one of ….` | Unknown `size`. | Use `large`, `medium` or `small` (default `large`). |
| `Task …: touch must be one of ….` | Unknown `touch` policy. | Use `equivalent`, `skip` or `block`. |
| `Task …: mouse task needs at least one item.` | `items` is empty. | Add at least one item. |
| `Task … item …: action must be one of ….` | Unknown `action`. | Use `click`, `double_click`, `right_click`, `drag`, `scroll` or `hover`. |
| `Task … item …: target "…" is not on the stage.` | The item's `target` isn't the `id` of any target. | Use a target `id` from `targets`. |
| `Task … item …: a drag needs a "to" target that is on the stage.` | A `drag` item has no `to`, or `to` isn't a target id. | Add `to:` with the id of the drop target. |
| `Task … item …: touch screens can't hover, so this item is skipped on touch devices.` (warning) | Hover items are skipped for students on tablets when `touch` is `equivalent`. | Fine if other items cover the skill; set `touch: block` if hovering is essential. |

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
| `Task … stage … has no … state` | A Filesystem stage has no `fs` (`… has no filesystem state`), or a Desktop stage has no `desktop` object (`… has no desktop state`). | Add the stage's filesystem map, or its desktop state (see `desktop.md`). |
| `Task … has no starter breadboard` | An Electronics task has no `starterCircuit` with `components`. | Add `starterCircuit: { components: [], wires: [] }` at minimum. |

## Checks

Check rules apply to the completion `check` and to `feedbackChecks`; for a feedback check the
message says `feedback check` where it would say `check` (that part is shown as `…`).

| Message | Meaning | Fix |
|---|---|---|
| `Task … has feedback checks but no completion check` | `feedbackChecks` are set but `check` isn't. | Add the completion `check`. |
| `Task … has a blocking feedback check with no hint` (warning) | A blocking feedback check has no `hint`, so students are stopped without being told why. | Add a `hint`, or make the check non-blocking. |
| `Task … feedback check … priority must be a positive whole number` | `priority` is 0, negative or not a whole number. | Use 1, 2, 3, … or remove it. |
| `Task … feedback check … references a code stage that does not exist` | `stageOffer.stageIndex` is outside `codeStages`. | Point it at an existing stage (0-based). |
| `Task … feedback check … stage offer action must be preview or replace` | Unknown `stageOffer.action`. | Use `preview` or `replace`. |
| `Task … feedback check … stage offer threshold must be a positive whole number` | `stageOffer.afterMatches` is 0, negative or not a whole number. | Use 1, 2, 3, … or remove it. |
| `Task … uses submit mode but has a … that requires running the code` | `interactionMode: submit` tasks never run, so output/variable/element checks can't pass. | Use code checks, or remove submit mode. |
| `Task … has an element … but no CSS selector` | An HTML element check has no `selector`. | Add `selector:`. |
| `Task … has an element attribute … but no attribute name` | `html_element_attribute` has no `attribute`. | Add `attribute:`. |
| `Task … has an element style … but no CSS property` | `html_element_style_property` has no `property`. | Add `property:`. |
| `Task … has a variable … but no variable name` | A Python variable check has no `name`. | Add `name:`. |
| `Task … has a dictionary key-value … but no key` | `variable_dict_key_value` has no `key`. | Add `key:`. |
| `Task … has an array N-th item … but no valid index` | `variable_array_nth_item` has no (or a negative) `index`. | Add a 0-based `index`. |
| `Task … has a … enabled but no check value` | A Python, HTML or Arcade check that compares against a value has no `value`. | Add `value:`. |
| `Task … has a code_structure …, but code_structure checks only work in Python tasks` | A `code_structure` check is on an HTML, Turtle, Arcade or other non-Python task (including a `code_arrange` task with `moduleType: html`). It reads Python indentation. | Use `code` checks there, or move the check to a Python task. |
| `Task … has a code_structure … with operator "…" — use one of: …` | `operator` is missing or unknown. There is no default. | Set `nested_in`, `directly_nested_in` or `not_nested_in` (see `python.md` Code Structure Checks). |
| `Task … has a code_structure … but no inner line` / `Task … has a code_structure … but no outer line` | `inner` or `outer` is missing or blank. | Add the line that should be nested (`inner`) and the line that opens its block (`outer`), e.g. `inner: "if has_water_bottle:"`, `outer: "if has_backpack:"`. |
| `Task … has a Scratch … but no block opcode` | `block_used`, `block_run` or `block_count` has no `opcode`. | Add `opcode:` (see `scratch.md` for opcodes). |
| `Task … has a Scratch block-order … but no block sequence` / `Task … has a Scratch block-order … with an empty block opcode` | `blocks_in_order` has no `sequence`, or an entry has no opcode. | List the opcodes in order. |
| `Task … has a Scratch … with an empty list of block opcodes` / `Task … has a Scratch block-order … with an empty list of block opcodes` | A block check's `opcode` (or a `blocks_in_order` item's `opcode`) is an empty list `[]`. | List at least one opcode, or use a plain opcode string. |
| `Task … has a Scratch … with an invalid block opcode — use an opcode name or a list of opcode names or { opcode, fieldValues } entries` / `Task … has a Scratch block-order … with an invalid block opcode — use an opcode name or a list of opcode names or { opcode, fieldValues } entries` | `opcode` is neither a string nor a list, or a list entry is blank, not a string, has no `opcode`, or has `fieldValues` that isn't a map. | Use `opcode: motion_turnright`, `opcode: [motion_turnright, motion_turnleft]`, or a list of `{ opcode, fieldValues }` entries (see `scratch.md` "One of several opcodes"). |
| `Task … has a Scratch block-order … with a list as a sequence item — write alternatives as opcode: [...] inside the item` | A `blocks_in_order` sequence item is a bare list, which can't be stored (a list directly inside a list). | Write the item as `- opcode: [motion_turnright, motion_turnleft]`. |
| `Task … has a Scratch … whose shared fieldValues key … is not an input of every alternative opcode — give each alternative its own fieldValues` / `Task … has a Scratch block-order … whose shared fieldValues key … is not an input of every alternative opcode — give each alternative its own fieldValues` (warning) | A check lists several opcodes and its shared `fieldValues` uses an input that only some of them have (e.g. `DEGREES` with `[motion_turnright, motion_movesteps]`), so those blocks can never match. Only number and text inputs are known; dropdown fields aren't checked. | Use the long form, giving each `{ opcode, fieldValues }` entry only its own inputs. |
| `Task … has a Scratch block-count … with fieldValues on an alternative — block_count counts by opcode only and ignores them` (warning) | A `block_count` opcode list has an entry with `fieldValues`. | Remove the `fieldValues`; use `block_used` to require specific values. |
| `Task … has a Scratch sprite-property … with missing property, operator, or value` | A `sprite_property` or `sprite_property_delta` check is incomplete. | Set `property`, `operator` and `value`. |
| `Task … has a Scratch sprite-changed … but no property` | `sprite_property_changed` has no `property`. | Add `property:`. |
| `Task … has a Scratch variable … but no variable name` / `Task … has a Scratch variable … but no expected value` / `Task … has a Scratch variable … but no operator` | A Scratch `variable_equals` / `variable_compare` check is incomplete. | Set `variableName`, `value` and (for compare) `operator`. |
| `Task … has a Scratch costume … but no costume name` | `costume_is` has no `value`. | Add the costume name. |
| `Task … has invalid toolbox XML` (**Builder only**) | A Scratch task's `toolbox` isn't well-formed XML. | Fix the XML (see `scratch-toolbox-xml.md`). |
| `Task … has a filesystem … but no path` | A Filesystem or Desktop `fs_*` check has no `path`. | Add `path:`. |
| `Task … has a window_state … but no appId` | A Desktop `window_state` check doesn't name the app. | Add `appId:` (`fileManager`, `textEditor`, `imageViewer`, `paint` or `browser`). |
| `Task … has a window_state moved_to … with zone "…" — use one of: …` | `moved_to` has no `zone`, or an unknown one. | Use `left_half`, `right_half`, `top_half`, `bottom_half`, `top_left`, `top_right`, `bottom_left` or `bottom_right` (see `desktop.md`). |
| `Task … has a window_state resized … with size "…" — use one of: smaller, larger` | `size` is not `smaller` or `larger`. | Use one of those, or remove `size` to accept any change of 15% or more. |
| `Task … has a window_state resized … whose … is not a fraction of the desktop (more than 0, up to 1)` | `minWidth`, `minHeight`, `maxWidth` or `maxHeight` is a pixel value or out of range. | Give a fraction, e.g. `maxWidth: 0.5` for half the desktop. |
| `Task … has a window_state resized … whose min… is more than its max…` | A minimum is larger than the matching maximum, so the check can never pass. | Swap or fix the limits. |
| `Task … has a file-content … but no expected value` | `fs_file_content` (or legacy `fs_content_contains`) has no `value`. | Add the text to compare. |
| `Task … has a file line-count … but no expected count` | `fs_file_line_count` has no `value`. | Add a number. |
| `Task … has a file-location … but no parent folder` | `fs_file_location` (or legacy `fs_file_in_dir`) has no `dir`. | Add `dir:`. |
| `Task … has a folder-count … but no expected count` | `fs_folder_count` has no `value`. | Add a number. |
| `Task … has a part-exists … but no part type or label` | An Electronics part check can't identify a part. | Add `component: { type: led }` or a label/id. |
| `Task … has a powered-part … but no part type or label` | Same, for powered/unpowered checks. | Identify the part. |
| `Task … has a control … but no control or controlled part` | `circuit_control_affects_power` is missing one side. | Set both `control` and `component`. |
| `Task … has a circuit connection … but no source or destination part/pin` | A path check's `from`/`to` is incomplete. | Give both a part and a `pin`. |
| `Task … has a circuit connection-includes … but no required part` | `circuit_path_includes` has no `includes`. | Add the part the path must go through. |
| `Task … has an ArcadeKit check that is not a code check — only code checks are evaluated when the game runs` (warning) | An Arcade task has an output, variable or other non-code check. Arcade games run in their own frame with no captured output, so only `code` checks are evaluated (each time the student presses **Run game**). | Replace it with a `code` check, or remove it. |
| `Task … has a code … but no check value` | A generic `code` check on a Turtle or Electronics task has no `value`. | Add the text (or regex) the student's code should match. |
| `Task … has a turtle … with unknown type "…"` | Not one of the Turtle check types or a generic `code` check. | See `turtle.md`. |
| `Task … has a turtle position … but no x/y target` | `turtle_position` needs `x` and `y`. | Add both. |
| `Task … has a turtle … but no check value` | A heading/count/length check has no `value`. | Add `value:`. |
| `Task … has a turtle command … with no valid command (one of: …)` | `turtle_command_used` names an unknown command. | Use one of the listed names, e.g. `forward`, `turn`, `circle`. |
| `Task … has a turtle colour … but no colour` | `turtle_color_used` has no `color`. | Add the colour exactly as students will write it. |
| `Task … has an … …, but … tasks don't record input — input checks work in Desktop tasks` | An `input_gesture`, `input_shortcut` or `input_modifier` check is on a task whose module doesn't record how the student works (only Desktop does). | Move the check to a Desktop task, or check the outcome instead. |
| `Task … has an … … whose min is not a positive whole number` | An input check's `min` is 0, negative or not a whole number. | Use 1, 2, 3, … or remove `min` (it defaults to 1). |
| `Task … has an input_gesture … with gesture "…" — use one of: …` | `gesture` is missing or unknown. | Use `click`, `double_click`, `right_click`, `drag`, `scroll` or `hover` (see `desktop.md`). |
| `Task … has an input_gesture … with … "…" — use one of: …` | `targetKind` or `dropTargetKind` isn't a Desktop target kind. | Use `file`, `folder`, `window` or `icon`, or remove the field to match anything. |
| `Task … has an input_gesture … with a dropTargetKind but its gesture is not drag` | Only drags have a drop target. | Set `gesture: drag`, or remove `dropTargetKind`. |
| `Task … has an input_shortcut … but no combo (e.g. ctrl+c)` | `input_shortcut` has no `combo`. | Add `combo: ctrl+c` (`ctrl` and `cmd` both mean Ctrl on Windows/ChromeOS and Cmd on a Mac). |
| `Task … has an input_shortcut … for "…", which the browser keeps for itself — students can't perform it in a lesson (teach it with a quiz instead)` | The combo is one the browser or OS never passes to a web page (e.g. `ctrl+w`, `ctrl+t`, `ctrl+n`, `alt+f4`, `alt+tab`). | Teach that shortcut with a quiz task, and check a different one here. |
| `Task … has an input_shortcut … for "…" — a shortcut needs ctrl/cmd or alt (or is F1–F12 or Delete)` | The combo is ordinary typing (e.g. `shift+a`, `enter`). | Add `ctrl`/`alt`, or use `input_modifier` for Shift capitals. |
| `Task … has an input_shortcut … with via "…" — use one of: …` | Unknown `via`. | Use `keyboard` (default), `menu` or `any`. |
| `Task … has an input_modifier … with modifier "…" — use one of: …` | `modifier` is missing or unknown. | Use `shift` or `caps_lock`. |
| `Task … has an input_modifier … that requires Caps Lock and forbids it (notCapsLock)` | `notCapsLock: true` only makes sense with `modifier: shift`. | Remove `notCapsLock`, or use `modifier: shift`. |

See the module docs for each check's required fields.

## Python tests

| Message | Meaning | Fix |
|---|---|---|
| `Task … test … has no inputs — consider adding at least one input` (warning) | A `tests` entry has no `inputs`. | Add inputs, or drop the test. |
| `Task … test … has an input with no name — it can still run, but {placeholder} substitution won't work` (warning) | An input has no `name`. | Name it so `{name}` placeholders in the check are replaced. |
| `Task … test … has no check — add an output check for this test case` | A `tests` entry has no `check`. | Add a `check`, usually on output. |

## Warnings about the solution

| Message | Meaning | Fix |
|---|---|---|
| `Task … has no starter code — students will start with an empty editor` | No starter code, files or blocks. | Usually add a starter; ignore if an empty editor is intended. |
| `Task … complete solution fails a code check — review the complete code` | The authored complete code fails one of the task's source-code checks. | Fix the complete code or the check. `lessons test-checks` helps. |
| `Task … complete solution fails a code check — review the complete files` | Same for HTML complete files. | Fix the files or the check. |
| `Task … has output checks — open the Complete tab and run to verify the complete solution` | Output checks need a real run, which the CLI can't do. | Open the task in the Builder and run the complete solution. |
| `Task … has element/output checks — open the Complete tab and run to verify the complete solution` | Same for HTML element checks. | Run it in the Builder. |
| `Task … complete filesystem does not satisfy a check — review the complete filesystem` | The complete filesystem fails a check. | Fix the complete state or the check. |
| `Task … complete desktop does not satisfy a check — review the complete desktop` | The complete Desktop state fails a file or window check (`browser_visited`, `search_query` and `window_state` `resized` are not tested against it). | Fix the complete state or the check. |
| `Task … complete breadboard does not satisfy a check — review the complete circuit` | The complete Electronics circuit fails a circuit check. | Fix the complete circuit or the check. |
| `Task … has a completion check that hasn't been tested — run the task to verify it` (**Builder only**) | The check hasn't been run against the task since it was edited. | Run the task in the Builder. |

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
