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
| `lessonNumber must be a positive whole number (1, 2, 3 …) when provided` | `lessonNumber` is `0`, negative, a decimal, or text (for example `"9"`). | Use a whole number from `1` up, or remove the field. |
| `tasks is required and must be an array` | `tasks` is missing or not a list. | Add `tasks:` with at least one task. |
| `tasks must contain at least one task or group` | `tasks` is empty. | Add a task. |
| `… is nested … levels deep at … — Firestore rejects documents nested deeper than … levels, so the lesson can't be saved. Flatten or shorten that part of the lesson` | Firestore refuses a document whose maps and lists nest more than 20 levels below the document root (each map key and each list index is one level). The lesson is measured **as it will be stored**: Scratch block trees (`starterBlocks`, `completeBlocks`, code-stage `blocks`, `prebuiltStacks[].stack`), Arcade designs and sealed answer fields are saved as text and don't count. The message names the task (`Task 15 ("Title")`, or `The lesson` for a field outside the tasks) and the deepest path, e.g. `tasks[14].sprites[0].extra.child.child…`; a run of stacked Scratch blocks is shortened to `(.next.block ×N)`. Without this check the save fails with Firestore's `Input object is deeper than 20 levels`. | Flatten the named field: move deeply nested data into a list of shallower entries, or remove it. |
| `draft must be a boolean when provided` | `draft` is not `true` or `false`. | Use `draft: true` or remove it. |
| `Draft lessons cannot be published. Clear draft only after full validation passes.` (**CLI only**, on publish) | The lesson has `draft: true`, and the publish command wasn't told to allow drafts. | Finish every task, remove `draft: true`, validate again, then publish. |
| `version must be a non-negative integer when provided` | `version` was hand-edited. | Remove `version` from source files; LaunchPad manages it. |
| `badgeOptions must be an object when provided` | `badgeOptions` isn't a mapping. | Write it as `badgeOptions:` with option names under it ([badges.md](badges.md#badgeoptions)). |
| `badgeOptions.… is not a badge option and is ignored` (warning) | A key under `badgeOptions` isn't one of `quizMasterThreshold`, `quizMasterMinQuizzes`, `persistenceMinFails`, `readyToCodeSeconds`, `earlyBirdMinutes`, `sideQuesterMinDone` or `wordSmithMinTasks`. | Fix the spelling or remove it. |
| `badgeOptions.… must be a number from 0 to 1` | `quizMasterThreshold` is outside 0–1 (it's a share, not a percentage). | Write `0.8`, not `80`. |
| `badgeOptions.… must be a whole number of at least 1` | `quizMasterMinQuizzes`, `persistenceMinFails`, `sideQuesterMinDone` or `wordSmithMinTasks` is below 1 or not a whole number. | Use a whole number, 1 or more. |
| `badgeOptions.… must be a positive number of seconds` | `readyToCodeSeconds` is 0, negative or not a number. | Use a number of seconds above 0. |
| `badgeOptions.… must be a positive number of minutes` | `earlyBirdMinutes` is 0, negative or not a number. | Use a number of minutes above 0. |

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
| `… has an invalid task-type value` | The YAML `type:` shorthand isn't a known task type. | Use `information`, `quiz`, `code_arrange` or an activity (`binary`, `keyboard`, `mouse`), or omit it for a code task. A group is written `group:` + `tasks:`, not `type: group`. |
| `… has an invalid quiz type` | `quizType` isn't one of the six quiz types. | Use `multiple_choice`, `match`, `fill_blank`, `short_answer`, `confidence` or `poll`. |
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
| `Task … taskMode must be one of: …` | `taskMode` isn't `both`, `live` or `solo` (a typo such as `Solo` would hide the task in both modes). | Fix the value, or remove it (the default is both). |
| `Task … has the same id (…) as task … — give every task its own id, or leave out every task id so they are numbered in order` (**CLI only**) | Two tasks share an id. In YAML this usually means some tasks have an `id` and others don't: tasks without one are numbered by position, so `id: 2` clashes with the second task. | Give every task its own id, or remove all the task ids. |
| `Task … allowSharing must be true or false` | `allowSharing` isn't a boolean. | Use `true` or `false`. |
| `Task … showBlocks must be true or false` | `showBlocks` isn't a boolean. | Use `true` (the default: block brackets show) or `false` (hide them). |
| `Task … allowSharing is not supported on quiz or information tasks` | Only code tasks have a workspace to share. | Remove `allowSharing` from that task. |
| `Task … peerHints must be a list of short hint texts` | `peerHints` isn't a list, or holds an empty or non-text entry. | Write `peerHints: ["Did you use a loop?"]`. |
| `Task … peerHints can have at most 6 hints` | More than 6 `peerHints` (helpers see at most 6 hint cards). | Keep the few that matter most. |
| `Task … peerHints must each be 60 characters or fewer` | A hint is too long to read on a card. | Shorten it: a few words a 9-year-old reads at a glance. |
| `Task … peerHints is not supported on quiz or information tasks` | Peer help is for code tasks. | Remove `peerHints` from that task. |
| `Task … sideQuests must be a list` | `sideQuests` isn't a list. | Write `sideQuests:` followed by `- title: …` entries. |
| `Task … sideQuests can have at most 3 side-quests` | More than 3 side-quests. | Keep the best three. |
| `Task … side-quest … needs a title` / `must be an object with a title` | A side-quest has no `title` (or isn't an object). | Add `title:` to it. |
| `Task … side-quest … title must be 60 characters or fewer` | The title is too long for its button. | Shorten it. |
| `Task … side-quest … kind must be one of: challenge, debug, predict` | Unknown `kind`. | Use one of those three (or leave it out for `challenge`). |
| `Task … side-quest … explainer/starter must be text` | `explainer` or `starter` isn't a string. | Use a string (a YAML block scalar for code). |
| `Task … side-quest … has unknown fields (…); they are ignored` (warning) | A side-quest has keys other than `title`, `kind`, `explainer`, `starter`. | Remove them; side-quests have no checks. |
| `Task … sideQuests are not supported on … tasks yet (only python, turtle, html); they are ignored` (warning) | Side-quests only run in Python, Turtle and HTML so far (Scratch later). | Remove them, or move the task to a supported module. |
| `Task … sideQuests only work on code tasks; they are ignored here` (warning) | `sideQuests` on a quiz, information, activity or Code Arrange task. | Remove them. |
| `Task … explainer example … has no code` (warning) | A ` ```example ` fence ([markdown-renderer.md](markdown-renderer.md#worked-examples-see-an-example)) has nothing after its `---` line (or is empty). The button opens an empty dialog. | Put the example's code after the `---` line. |
| `Task … explainer example … language "…" is not one of: …` (warning) | The word after `example` isn't `python`, `html`, `css`, `js`, `scratch` or `text`. The code shows unhighlighted. | Fix the language, or leave it out for plain code. |
| `Task … explainer example … has unrecognised words after its language: …` (warning) | The fence's first line has words other than the language and `label="…"` (often a label without quotes). | Write `` ```example python label="See an example" ``. |
| `Task … explainer example … has no closing fence` (warning) | The example fence is never closed, so it runs to the end of the explainer. | Add a closing ` ``` ` line. |
| `Task … explainer has more than … examples; opens of the rest are not recorded` (warning) | Only the first 10 examples in an explainer are logged for the tutor and the report. | Use fewer examples. |
| `Task … inspector must be an object like { enabled: true, show: [box, cascade] }` | `inspector` isn't a mapping. | Write `inspector:` with `enabled: true` under it ([html.md](html.md#html-inspector)). |
| `Task … inspector.… must be true or false` | `inspector.enabled` or `inspector.open` isn't a boolean. | Use `true` or `false`. |
| `Task … inspector.focus must be a CSS selector of … characters or fewer` | `focus` is empty, not text, or over 200 characters. | Use a short selector such as `".card p"`, or remove it. |
| `Task … inspector.show must be a list of: …` | `show` isn't a list, or names an unknown section. | Use any of `box`, `cascade`, `layout`, or remove it to show all three. |
| `Task … inspector has unknown fields (…); they are ignored` (warning) | `inspector` has keys other than `enabled`, `open`, `focus`, `show`. | Remove them. |
| `Task … inspector is not enabled (enabled: true), so students won't see it` (warning) | `inspector` is set without `enabled: true`. | Add `enabled: true`, or remove `inspector`. |
| `Task … inspector needs the preview, which submit-mode tasks don't show` (warning) | The task is `interactionMode: submit`, which has no preview to inspect. | Use run mode, or remove `inspector`. |
| `Task … inspector only works on html tasks; it is ignored here` (warning) | `inspector` on a non-HTML task (or a quiz, information or activity task). | Remove it, or move it to an HTML code task. |
| `Task … slowMo must be an object, e.g. { enabled: true }` | A Scratch task's `slowMo` isn't a mapping. | Write `slowMo:` with `enabled: true` under it ([scratch.md](scratch.md#slow-mo)). |
| `Task … slowMo.enabled must be true or false` | `slowMo.enabled` isn't a boolean. | Use `true` or `false`. |
| `Task … slowMo.speed must be a number of blocks per second above 0` | `speed` is text, zero or negative. | Use a number such as `1` or `0.5`, or remove it (default 1). |
| `Task … slowMo.timeline must be a list of: …` | `timeline` isn't a list. | Use any of `costume`, `backdrop`, `x`, `y`, `variables`, or remove it to show all five. |
| `Task … slowMo.speed … is outside 0.25–4 blocks per second; it will be clamped` (warning) | The starting speed is outside the slider's range. | Use a speed from 0.25 to 4. |
| `Task … slowMo.timeline has unknown field(s) …` (warning) | `timeline` names something else. | Use only `costume`, `backdrop`, `x`, `y`, `variables`. |
| `Task … slowMo has unknown key(s) …; they are ignored` (warning) | `slowMo` has keys other than `enabled`, `speed`, `timeline`. | Remove them. |
| `Task … slowMo is set but not enabled; add enabled: true to show it` (warning) | `slowMo` has settings but no `enabled`. | Add `enabled: true`, or remove `slowMo`. |
| `Task … slowMo.speed must be a number of steps per second above 0` | A Python or Turtle `slowMo.speed` is text, zero or negative ([python.md](python.md#slow-mo-slowmo)). | Use a number such as `1` or `0.5`, or remove it (default 1). |
| `Task … slowMo.showVariables must be true or false` | Python / Turtle `showVariables` inside `slowMo` isn't a boolean. | Use `true` or `false`. |
| `Task … slowMo.question must be text` | Python / Turtle `slowMo.question` isn't a string. | Write the question as text. |
| `Task … slowMo.speed … is outside 0.25–4 steps per second; it will be clamped` (warning) | A Python / Turtle starting speed is outside the slider's range. | Use a speed from 0.25 to 4. |
| `Task … slowMo.question is over 200 characters; keep it to one short question` (warning) | The question is long for the small box it shows in. | Shorten it to one question. |
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
| `Task … … is not supported on this task; use …` | A cross-lesson carry field that belongs to another module, e.g. `carryCodeFromLesson` on a Scratch task. | Use the field the message names (`carryBlocksFromLesson` on Scratch, `carryCodeFromLesson` on Python, Turtle and HTML). |
| `Task … … is not supported on this task type` | `carryCodeFromLesson` / `carryBlocksFromLesson` on an information, quiz, activity or `code_arrange` task, or a module with no class-roster saving (Arcade, Filesystem, Desktop, Electronics). | Remove it; only Python, Turtle, HTML and Scratch code tasks can carry from an earlier lesson. |
| `Task … … must be { lesson, task }: the earlier lesson's id and one of its task ids` | The cross-lesson carry isn't a map with a non-empty `lesson` and a `task` id. | Write `carryCodeFromLesson: { lesson: python-1-11, task: 6 }` (stock lesson id). |
| `Task … … has unknown fields: …` | The cross-lesson carry map has keys other than `lesson` and `task`. | Remove the extra keys. |
| `Task … … names this lesson; use … to carry within a lesson` | The cross-lesson carry names this lesson (or the stock lesson this fork came from). | Use the in-lesson carry field the message names instead. |
| `Task … cannot use both … and …` | A task has both a cross-lesson carry and its in-lesson carry field. | Keep one: the earlier lesson's work or an earlier task's. |
| `Task … …: lesson … was not found, so every student will start from the starter` (warning, **`lessons publish` only**) | The cross-lesson carry names a lesson that isn't published. | Check the stock lesson id (not a class fork's id), or publish the earlier lesson first. |
| `Task … …: lesson … has no task …` (warning, **`lessons publish` only**) | The earlier lesson exists but has no task with that id. | Use the id of the task whose work should carry on. |
| `Task … …: task … of lesson … saves a different kind of work, so nothing will carry` (warning, **`lessons publish` only**) | The earlier task isn't a code task of a module saving the same kind of work (code, files or Scratch blocks). | Point at a task of the same kind (a Python/Turtle task for Python/Turtle, HTML for HTML, Scratch for Scratch). |

## Information and quiz tasks

| Message | Meaning | Fix |
|---|---|---|
| `Task … is an information task but has no explainer` | Information tasks are just their explainer (except `informationType: introduction` and `badges`). | Add `explainer:` Markdown. |
| `Task … is a quiz but has fewer than 2 options` | Multiple-choice needs at least two options. | Add options. |
| `Task … is a quiz but has an empty option text` | An option has no text. | Fill in or remove it. |
| `Task … is a quiz but its answer "…" is not one of the option ids — set answer to the correct option's id (e.g. a)` | The multiple-choice answer matches no option `id`, so no choice could ever be marked right. In YAML, an `answer:` that matches exactly one option's text (or an id in different capitals) is turned into that option's id for you. | Set `answer:` (or `check.value`) to the correct option's `id`, e.g. `answer: b`. |
| `Task … is a quiz but no correct answer has been selected` | No option is marked correct, or the check isn't a single `answer_equals`. | Set `answer:` to the correct option's **id** (e.g. `answer: b`), or write `check: { type: answer_equals, value: b }`. In YAML, option text is mapped to its id for you. |
| `Task … is a match quiz but has fewer than 2 pairs` | Match quizzes need two or more pairs. | Add pairs. |
| `Task … is a match quiz but has an empty prompt or answer` | A pair is half-empty. | Fill in both sides. |
| `Task … is a fill-in-the-blank quiz but has no blanks in the text` | The quiz `text` has no `___` (three underscores) markers. | Put a `___` in `text` for each entry in `blanks`. |
| `Task … is a fill-in-the-blank quiz but has no blank answers` | `blanks` is empty. | Add an answer per blank. |
| `Task … is a fill-in-the-blank quiz but has an empty answer` | A blank has no answer. | Fill it in. |
| `Task … is a short-answer quiz with a check enabled but no check value` | The short-answer check has no `value`, **or** it isn't a single `answer_*` check object (a `checks:` list or an `output`/`type` + `operator` check gives this message too). | Write one check such as `check: { type: answer_contains, value: … }`, or remove the check for an ungraded question. |
| `Task … is a poll but has fewer than 2 options` | A poll (`quizType: poll`) needs at least two options. | Add options. |
| `Task … is a poll but has more than 6 options` | Polls take 2 to 6 options. | Remove options, or split the question. |
| `Task … is a poll but has an empty option text` | A poll option has no text. | Fill in or remove it. |
| `Task … is a poll but has an option with no id` | A poll option has no `id`. | Give each option an id (`a`, `b`, …), as for multiple choice. |
| `Task … is a poll but has duplicate option ids` | Two poll options share an `id`. | Give each option its own id. |
| `Task … is a confidence check with a scale field; confidence checks always use 1 to 10, so scale is ignored` (warning) | A confidence task sets `scale`. Every confidence check is 1 to 10. | Remove `scale`. |
| `Task … is a poll but has a check (polls are never marked)` | A poll has a `check` or `answer:`. Polls have no right answer. | Remove `check` / `answer:`. Use `quizType: multiple_choice` for a marked question. |
| `Task … is a poll but showResults is not true or false` | A poll's `showResults` is set to something other than `true` or `false`. | Use `showResults: false` to keep the class split private, or remove the field (default `true`). |
| `Task … is a short-answer quiz but showResponses is not teacher_picks` | `showResponses` has a value other than `teacher_picks`. | Use `showResponses: teacher_picks`, or remove the field to keep answers teacher-only. |
| `Task … is a short-answer quiz with a check but has showResponses (only open answers with no check can be shown)` | A graded short answer (with a `check`) asks for its answers to be shown. Graded quizzes never broadcast a student's answer. | Remove `check` to make it an open discussion question, or remove `showResponses`. |
| `Task … is a short-answer quiz but anonymiseResponses is not true or false` | `anonymiseResponses` is set to something other than `true` or `false`. | Use `anonymiseResponses: false` to show names by default, or remove the field (default `true`). |

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
| `Task …: keyboard mode must be one of ….` | `mode` is missing or unknown. | Use `type_text`, `find_key`, `symbols`, `shortcuts`, `edit_text`, `type_code` or `falling_words`. |
| `Task …: keyboard layout "…" is not supported (use "uk").` | Only the UK layout exists so far. | Remove `layout` or set it to `uk`. |
| `Task …: minAccuracy must be a number above 0 and at most 1.` | `minAccuracy` is a fraction, not a percentage. | Use e.g. `0.9` for 90%. |
| `Task …: targetWpm must be a positive number.` | `targetWpm` is zero, negative or not a number. | Use a positive number, or remove it to skip the speed goal. |
| `Task …: minKept must be a number above 0 and at most 1.` | `edit_text` `minKept` is a fraction, not a percentage. | Use e.g. `0.9`, or remove it for the default. |
| `Task …: targetCpm must be a positive number.` | `type_code` `targetCpm` is zero, negative or not a number. | Use a positive number of characters a minute, or remove it to skip the speed goal. |
| `Task …: type_code language must be one of ….` | `language` is not `python` or `html`. | Use `python` (Tab = 4 spaces) or `html` (Tab = 2 spaces), or remove it for `python`. |
| `Task …: showHistory must be true or false.` / `Task … item …: showHistory must be true or false.` | `showHistory` is not a boolean. | Write `showHistory: true`, or remove it. |
| `Task …: showHistory only works on type_text, type_code and falling_words tasks, so it is ignored here.` (warning) | Only typing modes keep a speed and accuracy history. | Remove `showHistory`, or use a typing mode. |
| `Task … item …: showHistory on an item only works on type_text and type_code tasks, so it is ignored here.` (warning) | Per-item `showHistory` was set on another mode. | Remove it, or set `showHistory` on the task. |
| `Task … item …: code is required.` | A `type_code` item has no `code`, or only spaces. | Add the block to type (a YAML block scalar keeps its lines and indentation). |
| `Task … item …: code must be at most … characters.` | A `type_code` block is over 1000 characters. | Split it into several items. |
| `Task … item …: code must be at most … lines.` | A `type_code` block is over 30 lines. | Split it into several items. |
| `Task … item …: code has a Tab after the start of a line. Use spaces there; Tab only works for indentation.` | The block has a Tab character after some code on a line. In `type_code` Tab only indents. | Replace it with spaces. Tabs at the start of a line are fine (they become 4 or 2 spaces). |
| `Task … item …: code has characters that can't be typed: …` | The block has characters with no key on the layout (curly quotes, emoji), listed at the end. | Use plain keyboard characters (straight quotes `"` and `'`). |
| `Task …: durationSeconds must be a whole number from … to ….` | `falling_words` `durationSeconds` is outside 15–300 or not whole. | Use a whole number of seconds from 15 to 300, or remove it for 60. |
| `Task …: falling_words needs a words list with at least one word or token.` | `words` is missing, not a list, or empty. | Add `words: ["print(", "</p>", …]`. |
| `Task …: falling_words can have at most … words.` | `words` has more than 100 entries. | Use fewer words; they repeat during the round anyway. |
| `Task … word …: must be some text to type.` | A word is empty, blank or not text. | Remove it or fill it in (quote tokens such as `"[1, 2]"` in YAML). |
| `Task … word …: "…" starts or ends with a space, which students can't see.` | A word has a leading or trailing space. | Trim it. Spaces inside a token (`for i in`) are fine. |
| `Task … word …: must be at most … characters.` | A word is over 20 characters, too long to type while it falls. | Use a shorter token. |
| `Task … word …: has characters that can't be typed: …` | A word has a newline, tab or a character with no key on the layout. | Use plain keyboard characters on one line. |
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
| `Task … is a code-arrange task but must use the Python, Python Turtle or HTML module` | Code arrange only runs Python (Stage included), Python Turtle or HTML. | Set `moduleType: python`, `turtle` or `html`. |
| `Task … is a code-arrange task but has no lines` | `lines` is empty. | Add the program lines. |
| `Task … line … has no id` / `Task … line … has no parts` | A line is missing its `id` or `parts`. | Give every line an `id` and at least one part. |
| `Task … line … blank … has no id` / `Task … line … blank … has no correct value` | A `slot` part is incomplete. | Give each slot an `id` and the correct `code`. |
| `Task … line … part … has an invalid type` | A part's `type` isn't `text` or `slot`. | Use `text` or `slot`. |
| `Task … is a code-arrange task but has no blanks` | No line has a `slot`. | Add at least one blank. |
| `Task … is a code-arrange task but has duplicate line ids` | Two lines share an id. | Make line ids unique. |
| `Task … distractor … has no id` / `Task … distractor … has no code` | A distractor tile is incomplete. | Give it an `id` and `code`. |
| `Task … is a code-arrange task but has duplicate blank/distractor ids` | Slot and distractor ids clash. | Make every tile id unique. |
| `Task … is a code-arrange task but has no completion check` | There's nothing to decide when the arrangement is right. | Add a `check`, usually on output. |
| `Task … entryFile "…" is not one of its starter files` | An HTML arrange task assembles its tiles into `entryFile`, but `starterFiles` has no file with that name, so the preview would be blank. | Add a starter file named after `entryFile` (an empty `content` is fine), or set `entryFile` to the starter file the tiles belong in. |
| `Task … solution arrangement does not pass its own code check` (warning) | With every blank holding its own correct tile, the assembled program fails one of the task's `code` checks (`code` / `code_contains` / `code_matches_regex` …). Only code checks are tried here; `output` and element checks need a real run, so test those with the Builder's **Show solution** and Run. | Fix the check's value, or the blanks' `code`, so the intended program passes. |
| `Task … distractor … hint must be text` | Tile feedback: a distractor's `hint` isn't a string. | Write the hint as text, or remove it. |
| `… wrongTiles must be a list of { tileId, hint }` | Tile feedback: a blank's `wrongTiles` isn't a list. `…` is `Task … line … blank …`. | Write `wrongTiles: [{ tileId: s3, hint: "…" }]`. |
| `… wrongTiles entry … has no tileId` | A `wrongTiles` entry is missing `tileId`. | Add the id of the tile (another blank's id or a distractor id). |
| `… wrongTiles entry … hint must be text` | A `wrongTiles` hint isn't a string. | Write the hint as text, or remove it (a default is shown). |
| `… wrongTiles lists "…", which is not a blank or distractor id in this task` (warning) | The id matches no tile, so the entry never fires. | Use a blank id or a distractor id from this task. |
| `… wrongTiles lists its own tile (it is never flagged)` (warning) | A blank's own tile is never flagged as wrong. | Remove the entry. |
| `… alsoAccepts must be a list of tile ids` | `alsoAccepts` isn't a list. | Write `alsoAccepts: [s5]`. |
| `… alsoAccepts entry … is not a tile id` | An `alsoAccepts` entry is empty or not a string. | Use a blank or distractor id. |
| `… alsoAccepts lists "…", which is not a blank or distractor id in this task` (warning) | The id matches no tile. | Use a blank id or a distractor id from this task. |
| `… lists "…" in both wrongTiles and alsoAccepts (alsoAccepts wins, so it is never flagged)` (warning) | The same tile is both wrong and fine in one blank. | Keep it in one list. |
| `Task … arrangeMode must be slots or indent` | `arrangeMode` has another value. | Use `indent`, or leave it out for tiles into blanks. |
| `Task … is an indent arrange task but must use the Python or Python Turtle module` | Indent mode is for Python code only. | Set `moduleType: python` or `turtle`. |
| `Task … line … has no code` | Indent mode: a line has no `code`. | Give every line its code. |
| `Task … line … code starts with spaces (set its depth instead)` | Indent mode: the indent comes from `depth`, not spaces in `code`. | Remove the leading spaces and set `depth`. |
| `Task … line … depth must be a whole number from 0 to …` (… is 4) | Indent mode: `depth` is missing, not a whole number, or out of range. | Set `depth: 0` to `4`. |
| `Task … line … start must be a whole number from 0 to …` (… is 4) | Indent mode: `start` is not a whole number from 0 to 4. | Fix it, or leave it out to start at 0. |
| `Task … line … locked must be true or false` | Indent mode: `locked` isn't a boolean. | Use `true`, or leave it out. |
| `Task … line … has parts (indent arrange lines use code and depth)` | Indent mode: a line was written in the tiles format. | Replace `parts` with `code` and `depth`. |
| `Task … is an indent arrange task but every line is locked` | Nothing for the student to move. | Unlock at least one line. |
| `Task … is an indent arrange task but has distractors (not used in this mode)` | Indent mode has no tiles. | Remove `distractors`. |
| `Task … is an indent arrange task but every movable line already starts at its correct depth` (warning) | Every unlocked line's start (default 0) is already its `depth`, so the task starts solved. | Change a `start`, or check the `depth`s. |
| `Task … line … is indented deeper than the line before it allows` (warning) | Indent mode: in the answer, this line is deeper than the line above (or more than one step deeper than a line ending in `:`), so Python would stop with an `IndentationError`. | Fix the line's `depth`. |
| `Task … line … follows a line ending in ":" but is not indented` (warning) | Python only: in the authored solution, this line comes after a block opener (`for …:`, `if …:`, `def …:`) but is not indented further, so the program would fail with an `IndentationError`. | Indent the line's blank `code` (or its fixed text), e.g. `"    print(i)"`. |

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
| `Task … uses submit mode but has a … that requires running the code` | `interactionMode: submit` tasks never run, so output/variable/element/`run_attempted` checks can't pass. | Use code checks, or remove submit mode. |
| `Task … has an element … but no CSS selector` | An HTML element check has no `selector`. | Add `selector:`. |
| `Task … has an element attribute … but no attribute name` | `html_element_attribute` has no `attribute`. | Add `attribute:`. |
| `Task … has an element style … but no CSS property` | `html_element_style_property` has no `property`. | Add `property:`. |
| `Task … has a variable … but no variable name` | A Python variable check has no `name`. | Add `name:`. |
| `Task … has a dictionary key-value … but no key` | `variable_dict_key_value` has no `key`. | Add `key:`. |
| `Task … has an array N-th item … but no valid index` | `variable_array_nth_item` has no (or a negative) `index`. | Add a 0-based `index`. |
| `Task … has a … of type … with no operator (choose contains, equals, ...)` | A text-comparing check (`output`, `code`, `answer`, element value, file content, …) has a `value` but no `operator`. Lessons published before this rule compare with `contains`, and the Builder's check editor writes `operator: contains` in when the task is opened. | Add `operator:` (`contains`, `equals`, `not_contains`, …), or use an alias that names one, such as `output_contains`. |
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
| `Task … has a Scratch … of unknown type … — use one of …` | A Scratch check's `type` isn't a Scratch check type (often a misspelling), so it could never pass. `lessons capabilities` lists the Scratch check types. | Fix the spelling, or use one of the types the message lists. |
| `Task … has a Scratch … of type … with evaluation after_block_placed — only block_used, blocks_in_order and block_count can use it, so use after_run` | Only the block checks can be judged while blocks are placed; any other type would stay pending for ever. | Remove `evaluation` (it then means `after_run`) or set `evaluation: after_run`. |
| `Task … has a Scratch variable-compare … with name instead of variableName — rename name to variableName` | `variable_compare` reads `variableName` only, so with `name` it always fails. (`variable_equals` accepts either.) | Rename `name:` to `variableName:`. |
| `Task … has invalid toolbox XML` (**Builder only**) | A Scratch task's `toolbox` isn't well-formed XML. | Fix the XML (see `scratch-toolbox-xml.md`). |
| `Task … … must be true or false` | `showCostumesTab`, `showSoundsTab`, `allowAddCostume` or `allowAddSound` isn't a boolean. | Use `true` or `false` ([scratch.md](scratch.md#costumes-and-sounds-tabs)). |
| `Task … allowAddCostume has no effect without showCostumesTab` (warning) | Students can't add a costume when the Costumes tab is hidden. | Add `showCostumesTab: true`, or remove `allowAddCostume`. |
| `Task … allowAddSound has no effect without showSoundsTab` (warning) | Students can't add a sound when the Sounds tab is hidden. | Add `showSoundsTab: true`, or remove `allowAddSound`. |
| `… sounds must be a list` (`…` is `Task N sprite "Name"`, as in the rows below) | A sprite's `sounds` isn't a list. | Write `sounds:` as a list of `{ name, synth }` or `{ name, audio }`. |
| `… has a sound with no name` | A sound entry has no `name`. | Give every sound a name. |
| `… has two sounds named "…"` | Two sounds on one sprite share a name, so a `start sound` block can't tell them apart. | Rename one. |
| `… sound "…" needs exactly one of synth or audio` | A sound has both `synth` and `audio`, or neither. | Keep one. |
| `… sound "…" uses unknown synth "…" (known: …)` | `synth` isn't one of the built-in tones listed. | Use a listed synth id, or an `audio` file. |
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
| `Task … has an ArcadeKit check that is not a code check — only code checks are evaluated when the game runs` (warning) | An Arcade task has an output, variable or other non-code check. Arcade games run in their own frame with no captured output, so only `code` checks (and `run_attempted`) are evaluated (each time the student presses **Run game**). | Replace it with a `code` check, or remove it. |
| `Task … has a code … but no check value` | A generic `code` check on a Turtle or Electronics task has no `value`. | Add the text (or regex) the student's code should match. |
| `Task … has a turtle … with unknown type "…"` | Not one of the Turtle check types, a generic `code` check or `run_attempted`. | See `turtle.md`. |
| `Task … has a run_attempted check, but … tasks have no Run button — run_attempted needs a module with a Run button (Python, Turtle, Arcade, Electronics, HTML or Scratch)` | `run_attempted` passes when the student presses Run; Filesystem and Desktop tasks have nothing to run. | Use the module's own checks (e.g. `fs_*`, `window_state`), or move the demo to a module with Run. |
| `Task … has a run_attempted feedback check — run_attempted can only be a completion check` | A feedback check matching "the student ran it" would fire on every run. | Move it to the completion `check`. |
| `Task … has a run_attempted check whose requireSuccess is not true or false` | `requireSuccess` is a string or number. | Write `requireSuccess: true`, or remove it (any run counts). |
| `Task … has a run_attempted check with requireSuccess, but … runs never report an error — requireSuccess is ignored there` (warning) | Arcade, HTML and Scratch runs have no error status, so any run passes. | Remove `requireSuccess`. |
| `Task … has interactionMode …, but Arcade tasks always run — it is ignored` (warning) | Arcade has no Submit button, so `interactionMode: submit` does nothing. | Remove `interactionMode`. |
| `Task … has a run_attempted check with evaluation after_block_placed — it is judged when the green flag runs, so remove its evaluation` | A Scratch `run_attempted` was marked to be judged while editing blocks, where no run has happened. | Remove `evaluation` (or use `after_run`). |
| `Task … has a run_attempted check and tests — a task with tests is completed by its tests, so the run_attempted check is never used` (warning) | Python `tests` replace the completion check. | Remove the `tests` for a demo task, or remove `run_attempted`. |
| `Task … has a run_attempted check but no Micro Controller — an Electronics task only has a Run button when its board has one` (warning) | Electronics' Run lives in the Code tab, which needs a Micro Controller on the board (or `microcontroller.enabled: true`). | Add a Micro Controller to the starter board, or use circuit checks. |
| `Task … has a turtle position … but no x/y target` | `turtle_position` needs `x` and `y`. | Add both. |
| `Task … has a turtle … but no check value` | A heading/count/length check has no `value`. | Add `value:`. |
| `Task … has a turtle command … with no valid command (one of: …)` | `turtle_command_used` names an unknown command. | Use one of the listed names, e.g. `forward`, `turn`, `circle`. |
| `Task … has a turtle colour … but no colour` | `turtle_color_used` has no `color`. | Add the colour exactly as students will write it. |
| `Task … has a course_… check but no course: add a course (a map to drive round)` | A `course_goal_reached`, `course_no_crash`, `course_pickups` or `course_max_moves` check is on a Turtle task with no `course`. | Add a `course` ([turtle.md](turtle.md#course-mode-course)), or use the ordinary Turtle checks. |
| `Task … has a course_… check, but course checks only work in Turtle tasks` | A course check is on another module's task. | Move it to a Turtle task with a `course`. |
| `Task … has a course_max_moves … with no max (a whole number of moves)` | `course_max_moves` needs `max`. | Add `max: 8` (every forward, backward, goto, turn and circle is one move). |
| `Task … has a course_pickups … whose min isn't a whole number` | `course_pickups`'s `min` is text, negative or a fraction. | Use 0, 1, 2, …, or remove `min` (all pickups). |
| `Task … course must be an object with type and map (or maps)` | `course` is text or a list. | Write `course: { type: grid, map: … }` ([turtle.md](turtle.md#course-mode-course)). |
| `Task … course.type must be grid or track` | `type` is missing or another word. | Use `grid` (a text map) or `track` (free movement). |
| `Task … course.vehicle must be one of: turtle, car, rover, boat, drone` | An unknown vehicle. | Pick one of the five, or remove it (the turtle). |
| `Task … course.studentMap must be true or false` | `studentMap` is text or a number. | Write `studentMap: true` (or remove it). |
| `Task … course.studentMap only works on grid courses: students can't make their own track yet` | `studentMap: true` on a `type: track` course. | Use a grid course, or remove `studentMap` ([turtle.md](turtle.md#students-make-their-own-map-studentmap)). |
| `Task … course has both map and maps; use one` | Both are set. | Keep `map` for one map, `maps` for several. |
| `Task … course.maps must be a list of maps` / `… course.maps has N maps; the most is 6` | `maps` is empty, not a list, or too long. | List 1 to 6 maps. |
| `Task … course has no map: …` / `Task … course has no track: …` | No `map` or `maps` (and, for a track, no `start`/`goal`/`walls` on `course`). | Add the map. |
| `Task … course map[ N]: the grid map …` | A grid map is empty, larger than 30 × 30, uses a character outside the legend, has no start or more than one, or no goal. The message names the problem. | Use `#` `.` `G` `*` and one of `>` `<` `^` `v`; add a `G`. |
| `Task … course map[ N]: the track has no goal …` / `goal …` / `start …` / `wall N …` / `pickup N …` | A track field is missing or the wrong shape: `goal` needs `x`, `y` (and `r` above 0) or `rect: [x1, y1, x2, y2]`; walls are `[x1, y1, x2, y2]` or `{ rect: [x1, y1, x2, y2] }`; pickups `[x, y]`; `start` inside -200 to 200. | Fix the field the message names. |
| `Task … course map[ N]: trackCode line N: …` | `trackCode` uses something it can't read (a variable, `print`, an `if`, a command outside the list). | Use plain numbers and the commands listed in [turtle.md](turtle.md#tracks-type-track). |
| `Task … course map[ N]: the start is touching a wall, so the vehicle may crash as soon as it moves` (warning) | A track start is closer than 10 units to a wall or the picture's edge. | Move the start into the open. |
| `Task … course map[ N]: the vehicle starts in the goal` (warning) | A track start is inside the goal zone. | Move the start or the goal. |
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

## Name-tag panel (`showVariables`)

Python and Turtle tasks; see [python.md](python.md#name-tag-panel-showvariables).

| Message | Meaning | Fix |
|---|---|---|
| `Task … has showVariables, but the name-tag panel only works in Python and Turtle tasks — it is ignored` (warning) | `showVariables` is on another module's task. | Remove it, or move the task to Python or Turtle. |
| `Task … has a showVariables that is not an object — use { mode, at, … }` | `showVariables` is a string, list or `true`. | Write it as a map, e.g. `showVariables: { mode: view }`. |
| `Task … has showVariables mode "…" — use one of: …` | Unknown `mode`. | Use `view`, `predict` or `target`. |
| `Task … has showVariables at "…" — use one of: …` | Unknown `at`. | Use `end` or `marker`. |
| `Task … has showVariables visuals that is not true or false` | `visuals` is text or a number. | Use `visuals: false` to turn the list and dict visuals off, or leave it out (on). |
| `Task … has showVariables link that is not true or false` | `link` must be a boolean. | Use `true` (the default) or `false` to stop linking tags to the code. |
| `Task … has showVariables lockRun that is not true or false` | `lockRun` must be a boolean. | Use `true` (the default in predict mode) or `false`. |
| `Task … has showVariables lockRun but its mode is not predict — only predict mode locks Run, so it is ignored` (warning) | `lockRun` on a view or target task. | Remove it, or set `mode: predict`. |
| `Task … has showVariables stageLists "…" — use one of: …` | Unknown `stageLists`. | Use `picture`, `tiles` or `size`. |
| `Task … has showVariables stageLists but visuals is false — every tag is plain, so it is ignored` (warning) | With `visuals: false` every tag is plain text, including lists drawn with `grid()`. | Remove `stageLists`, or turn `visuals` back on. |
| `Task … has showVariables … that is not a list of variable names` | `hide` or `predict` isn't a list. | Write `[score, lives]`. |
| `Task … has showVariables … with names that are not Python variable names: …` | A `hide` or `predict` entry isn't a Python name (spaces, a leading digit, quotes). | Use the variable names exactly as the code writes them. |
| `Task … has showVariables mode: predict but no predict list of variable names` | Predict mode needs the tags students fill in. | Add `predict: [score, lives]`. |
| `Task … has showVariables mode: target but no target values (target: { name: value })` | Target mode needs at least one target. | Add `target: { score: 10 }`. |
| `Task … has showVariables target names that are not Python variable names: …` | A `target` key isn't a Python name. | Use the variable names as the code writes them. |
| `Task … has showVariables predict but mode is not predict — it is ignored` / `Task … has showVariables target but mode is not target — it is ignored` (warnings) | The list belongs to the other mode. | Set the matching `mode`, or remove the list. |
| `Task … has showVariables at: marker but no … line in its code — the panel shows the end of the run` (warning) | `at: marker` stops at a `#@peek` line, and the code has none. | Add a `#@peek` line above the line to stop at, or use `at: end`. |
| `Task … has a variables_predicted check but no showVariables with mode: predict` / `Task … has a variables_predicted check but showVariables mode is not predict` | The check reads the panel's predictions, which only predict mode collects. | Add `showVariables: { mode: predict, predict: [...] }`, or remove the check. |
| `Task … has a variables_predicted check naming …, which showVariables predict does not list` | The check's `names` include a variable students are never asked to predict, so it can never pass. | Add the name to `predict`, or remove it from `names` (or drop `names` to mean every prediction). |
| `Task … has a variables_predicted …, but it only works in Python and Turtle tasks` | The check is on another module's task. | Move it to a Python or Turtle task. |
| `Task … has a variables_predicted … whose names is not a list of variable names` / `Task … has a variables_predicted … with names that are not Python variable names` | `names` is empty, not a list, or holds something that isn't a Python name. | Write `names: [score, lives]`, or remove `names`. |

## Live scrubbing (`scrub`)

Python, Turtle and HTML tasks; see [python.md](python.md#live-scrubbing-scrub).

| Message | Meaning | Fix |
|---|---|---|
| `Task … has scrub, but scrubbing only works in Python, Turtle and HTML tasks — it is ignored` (warning) | `scrub` is on another module's task (Arcade, Scratch, …). | Remove it, or move the task to Python, Turtle or HTML. |
| `Task … has a scrub that is not an object — write it as scrub: { enabled: true }` | `scrub` is a string, number or list. | Write `scrub: { enabled: true }` (or `scrub: true`). |
| `Task … has scrub … that is not true or false` | `enabled`, `numbers`, `colours`, `checkOnRelease` or `colourNames` is text or a number. | Use `true` or `false`. |
| `Task … has scrub with numbers and colours both off — nothing can be scrubbed` (warning) | Both kinds are turned off. | Turn one on, or remove `scrub`. |
| `Task … has scrub fields it does not use (…) — they are ignored` (warning) | `scrub` has keys other than `enabled`, `numbers`, `colours`, `ranges` and `checkOnRelease`. | Remove them (check the spelling of `colours`). |
| `Task … has scrub ranges that is not a list — write ranges: [{ line, min, max }]` | `ranges` is a map or a string. | Write a list of `{ line, min, max }`. |
| `Task … has a scrub range without a line number of 1 or more` | A range has no `line`, or it isn't a whole number from 1. | Give the line the student sees, e.g. `line: 3`. |
| `Task … has a scrub range on line … whose min or max is not a number` | `min` / `max` is missing or text. | Write numbers, e.g. `min: 10, max: 200`. |
| `Task … has a scrub range on line … whose min is not less than its max` | The range is empty or backwards. | Swap them, or fix one. |
| `Task … has two scrub ranges for line … — only the first is used` (warning) | Two ranges name the same line. | Keep one. |
| `Task … has a scrub range on line …, but the starter code has only … lines` (warning) | The line is past the end of the starter code (Python, Turtle). | Fix the line number. |
| `Task … has runOnOpen that is not true or false` | `runOnOpen` is text or a number. | Use `true` or `false`. |
| `Task … has runOnOpen but its starter code calls input() — it can't run on open, so runOnOpen is ignored` (warning) | The opening run would stop to ask a question. | Remove `runOnOpen`, or take `input()` out of the starter. |

## Python Stage (`stageTarget` and `stage_*` checks)

Python tasks; see [python.md](python.md#stage-drawing-beside-the-console).

| Message | Meaning | Fix |
|---|---|---|
| `Task … has stageTarget, but the Stage only works in Python tasks — it is ignored` (warning) | `stageTarget` is on another module's task. | Remove it, or move the task to Python. |
| `Task … has a stageTarget that is not an object — write the target's Python under code` | `stageTarget` is a string or list. | Write it as a map: `stageTarget: { code: … }`. |
| `Task … has a stageTarget with no code — add the Python that draws the target` | `code` is missing or empty. | Add the Python that draws the target picture. |
| `Task … has stageTarget code that never imports stage — it will draw nothing (start it with from stage import *)` (warning) | The target code never mentions `stage`, so it draws nothing. | Start it with `from stage import *`. |
| `Task … has a stageTarget ghost that is not true or false` | `ghost` is text or a number. | Use `ghost: true` or `ghost: false`. |
| `Task … has stageTarget fields it does not use (…) — they are ignored` (warning) | `stageTarget` has keys other than `code` and `ghost`. | Remove them. |
| `Task … has a … …, but stage checks only work in Python tasks` | A `stage_*` check is on another module's task. | Move it to a Python task. |
| `Task … has a stage_matches_target … but no stageTarget code to compare with` | The check compares with the target, and there is none. | Add `stageTarget: { code: … }`, or use another stage check. |
| `Task … has a stage_matches_target … with tolerance "…" — use a fraction from 0 to 1, e.g. 0.02` | `tolerance` isn't a number from 0 to 1 (it is a fraction, not a percentage). | Write e.g. `tolerance: 0.02` for 2%. |
| `Task … has a stage_shape_count … with kind "…" — use one of: any, …` | Unknown `kind`. | Use `any`, `rect`, `square`, `circle`, `polygon`, `line`, `text`, `stamp` or `grid`. |
| `Task … has a stage_shape_count … whose sides is not a whole number from 3 to 100` | `sides` is below 3, above 100, a fraction or text. | Use a whole number, like `sides: 6` for hexagons. |
| `Task … has a stage_shape_count … with sides but its kind is not polygon — add kind: polygon` | `sides` only filters polygons. | Add `kind: polygon`, or remove `sides`. |
| `Task … has a stage_shape_count … whose min or max is not a whole number of 0 or more` | `min` / `max` is negative, a fraction or text. | Use whole numbers like `min: 1`. |
| `Task … has a stage_shape_count … whose min is more than its max` | The range is empty, so the check can never pass. | Swap them, or fix one. |
| `Task … has a … … with colour "…" — use a CSS colour name, a PICO-8 name or a hex code like #ff0000` | `stage_colour_used` / `stage_pixel` has no colour, or one the Stage doesn't know. | Use a name like `red` or `dark_blue`, or a hex code like `"#ff0000"` (quoted in YAML). |
| `Task … has a stage_pixel … that needs one of: x and y, row and col, or index` | No point or grid cell, or more than one way of picking it. | Give just one: `x` and `y` (a stage point), `row` and `col` (a cell of the last grid), or `index` (a cell by its place in the last grid's flat list). |
| `Task … has a stage_pixel … whose x and y are not both numbers from 0 to 399` | The point is off the stage. | Use stage coordinates: top-left is `0, 0`, bottom-right `399, 399`. |
| `Task … has a stage_pixel … whose row and col are not both whole numbers of 0 or more` | `row` / `col` is negative, a fraction or text. | Count rows and columns from 0. |
| `Task … has a stage_pixel … whose index is not a whole number of 0 or more` | `index` is negative, a fraction or text. | Count from 0: `index: 0` is the first value of the list `grid()` drew. |
| `Task … has a stage_text_shown … but no text` | The check has nothing to look for. | Add `text: …`. |
| `Task … has a stage_text_shown … with operator "…" — use one of: …` | Unknown `operator`. | Use `contains` (the default), `equals` or `matches_regex`. |

## Hidden setup, locked lines and puzzles

Python and Turtle tasks; see [python.md](python.md#locked-lines-hidden-setup-and-puzzles). Validation can't run Python, so `setupCode` gets a quick check only (brackets, quotes, an indented first line); a real error in it shows students "This task's setup has a problem — tell your tutor." and the full error in the browser console, so preview the task once.

| Message | Meaning | Fix |
|---|---|---|
| `Task … has …, but it only works in Python and Turtle tasks — it is ignored` (warning) | `setupCode`, `setupNote` or `puzzle` is on another module's task. | Remove it, or move the task to Python or Turtle. |
| `Task … setupCode must be Python code (text)` | `setupCode` is a number, list or map. | Write it as a block of text (`setupCode: \|`). |
| `Task … setupCode is empty; it is ignored` (warning) | `setupCode` has no code. | Add the code, or remove the field. |
| `Task … setupCode has a syntax problem: …` | A bracket or string in the setup is never closed, a closing bracket has no opener, or the first line is indented. | Fix the setup code, then preview the task. |
| `Task … setupCode calls input(), which would ask the student a question before their code runs` (warning) | The setup asks for input. | Give the value directly instead. |
| `Task … setupCode never runs: the task is submitted, not run` (warning) | `interactionMode: submit` tasks are never run. | Remove `setupCode`, or make the task a run task. |
| `Task … setupNote must be text` | `setupNote` isn't a string. | Write one short line of text. |
| `Task … setupNote is over … characters; keep it to one short line` (warning) | The note is long for the line above the editor. | Shorten it, e.g. "playlist already exists". |
| `Task … has a setupNote but no setupCode` (warning) | The note describes setup that isn't there. | Add `setupCode`, or remove the note. |
| `Task … puzzle must be an object, e.g. { maxLines: 4 }` | `puzzle` is a number, text or list. | Write it as a map with `onlyEdit`, `maxLines` and/or `par`. |
| `Task … puzzle has unknown key(s) …; they are ignored` (warning) | `puzzle` has keys other than `onlyEdit`, `maxLines`, `par`. | Remove them (check the spelling). |
| `Task … puzzle.maxLines must be a whole number of lines, 1 or more` | `maxLines` is text, 0, negative or a fraction. | Use a whole number such as `4`. |
| `Task … puzzle.par must be a whole number of changes, 0 or more` | `par` is text, negative or a fraction. | Use a whole number such as `1`. |
| `Task … puzzle.onlyEdit must be a list of starter line numbers, e.g. [2, 3]` | `onlyEdit` isn't a list of whole numbers from 1. | List the lines students may change, e.g. `onlyEdit: [2]`. |
| `Task … puzzle.onlyEdit line … is past the end of the starter code (… lines, not counting marker lines)` | A line number is bigger than the starter. Marker lines (`#>`, `#@lock`, `#@peek`) don't count. | Count lines in the starter as the student sees it. |
| `Task … puzzle.onlyEdit is empty, so every starter line is locked` (warning) | `onlyEdit: []` leaves nothing editable (students can still add lines). | List the lines students may change, or remove `onlyEdit`. |
| `Task … has a max_lines … but no limit: set puzzle.maxLines or the check's value` | A `max_lines` check has nothing to compare with. | Add `puzzle: { maxLines: N }` (or `value: N` on the check). |
| `Task … has a max_lines … whose value is not a whole number of lines` | The check's `value` isn't a whole number from 1. | Use a whole number, or remove `value` to use `puzzle.maxLines`. |
| `Task … puzzle.maxLines shows a line counter, but no max_lines check enforces it — add { type: max_lines } to the check` (warning) | Students see the counter, but going over the limit still passes. | Add `- type: max_lines` to `check`, unless the limit is only a nudge. |
| `Task … has puzzle rules but no complete code, so they can't be checked as solvable` (warning) | There's no complete stage to prove the puzzle can be solved within its rules. | Add a `complete` code stage. |
| `Task … complete code has … lines of code, over puzzle.maxLines …` | The solution breaks its own line limit, so the puzzle can't be solved. | Shorten the solution, or raise `maxLines`. |
| `Task … complete code takes … changes from the starter, more than puzzle.par …` (warning) | The solution takes more changes than par. | Find a shorter solution, or raise `par`. |
| `Task … has a #@lock marker with no line after it; it locks nothing` (warning) | A `#@lock` is the last line (or only blank lines follow). | Put it on the line above the line to lock. |
| `Task … has a #@lock-values marker with no line after it; it locks nothing` (warning) | A `#@lock-values` is the last line (or only blank lines follow). | Put it on the line above the line to lock. |
| `Task … has a #@lock-values line … with no string or number to change — it is fully locked` (warning) | The marked line has no plain string or number (f-strings and names don't count). | Use `#@lock`, or mark a line with a value. |
| `Task … locked line … ("…") is not in the complete code — students can't change or remove a locked line` (warning) | The solution changes or removes a line students can't touch. | Unlock the line, or keep it in the complete code. |
| `Task … locked line … ("…") is indented differently in the complete code — students can't re-indent a locked line` (warning) | The solution needs the locked line at another indentation. | Lock it at the indentation the solution needs, or unlock it. |

## Screen layout (`layout`)

Python and Turtle tasks; see [python.md](python.md#screen-layout-layout).

| Message | Meaning | Fix |
|---|---|---|
| `Task … has layout, but it only works in Python and Turtle tasks — it is ignored` (warning) | A code task of another module has `layout`. (An activity's own `layout`, like the keyboard's, is unaffected.) | Remove it, or move the task to Python or Turtle. |
| `Task … layout must be an object like layout: { firstPane: picture }` | `layout` is text, a number or a list. | Write it as a map: `layout: { firstPane: console }`. |
| `Task … layout has unknown fields (…); they are ignored` (warning) | `layout` has keys other than `firstPane`. | Remove them (check the spelling). |
| `Task … layout.firstPane must be one of: picture, tags, console` | An unknown tab name, e.g. `stage`. | Use `picture` (the Stage or turtle drawing), `tags` or `console`. |
| `Task … layout.firstPane is tags, but the task has no showVariables name-tag panel; it is ignored` (warning) | There's no Tags tab without `showVariables`. | Add `showVariables`, or pick another pane. |

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
| `Task … complete solution fails a block check — review the complete blocks` | Scratch: the task's `completeBlocks` (or a Complete-role code stage) fails one of its block checks (`block_used`, `blocks_in_order`, `block_count`). Run-time checks aren't tested. | Run `lessons test-checks lesson.yaml` (no `--cases`) to see which check fails, on which sprite, and the blocks it found. Fix the blocks or the check. |
| `Task … starter already passes every completion check — students can finish without changing anything` | Scratch: every completion check is a block check and the starter blocks already satisfy all of them. | Tighten the check or change the starter. |
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

## Publishing

| Message | Meaning | Fix |
|---|---|---|
| `Draft lessons cannot be published. Clear draft only after full validation passes.` | `lessons publish-yaml` (and `lessons fork`) only publish finished lessons, and this one has `draft: true`. (`lessons upsert` still saves drafts.) | Finish every task, remove `draft: true` (or set it to `false`), and validate again. |

## Topic Library

| Message | Meaning | Fix |
|---|---|---|
| `Cannot save a lesson while Topic Library entries are missing: …` | The lesson links `[[topic-id]]`s that don't exist. | Create the topics first (`topics upsert`), or add them to `topicProposals` while drafting. |
| `Missing Topic Library entries: …` (warning) | Always shown alongside the error above, naming the same topics. (On `lessons publish`, a draft lesson skips the topic check, so neither appears.) | Create the topics (`topics upsert`) before publishing a non-draft lesson. |
| `Unused topic proposals: …` | `topicProposals` lists topics the lesson never links. | Link them or remove the proposals. |
| `… is missing an id` / `… id must be a topic slug` / `… duplicates id "…"` | A topic proposal's id is missing, malformed or repeated. | Use unique lowercase slugs. |
| `… is missing a description` | A topic proposal has no description. | Add one. |
| `… status must be proposed or deferred` | Invalid proposal `status`. | Use `proposed` or `deferred`. |
