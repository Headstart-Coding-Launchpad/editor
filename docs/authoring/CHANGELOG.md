# Lesson Authoring Changelog

Author-facing changes that affect how lessons, tasks, topics, checks, assets, or lesson Markdown should be written.

Use this changelog when a platform or documentation change alters the lesson authoring contract. Keep entries newest first and link to the deeper reference doc when the change needs examples or field-level detail.

## What belongs here

- New, renamed, deprecated, or removed lesson YAML/JSON fields.
- New or changed task types, module types, quiz types, checks, feedback checks, or Markdown syntax.
- CLI validation, conversion, publishing, topic, or asset workflow changes that affect authors.
- Builder behavior changes that alter what lesson authors can save, validate, publish, or migrate.
- Compatibility notes for older lessons when authors need to update source files.

## What does not belong here

- Internal refactors with no author-facing lesson behavior change.
- UI polish that does not affect saved lesson fields or authoring workflow.
- Test-only, tooling-only, or deployment-only changes that authors do not need to know about.

## Entry format

Every new entry ends with one tag line, so lesson agents can tell at a glance what an entry
touches without reading all of it:

```markdown
- Affects: <modules / activities / areas> · Existing lessons: <no changes needed | what to change> ·
  Resolves: authoring-requests/<yyyy-mm-dd>-<slug>.md
```

- **Affects:** module types (`python`, `scratch`, `desktop`, …), activity ids (`keyboard`,
  `quiz_match`, …), or an area (`cli`, `markdown`, `topics`, `all`), comma-separated.
- **Existing lessons:** `no changes needed`, or the change authors must make (for example "add
  `markdown` to blocks-only Support stages").
- **Resolves:** the authoring request(s) the change ships, comma-separated; `none` when there
  isn't one.

Entries written before 2026-09-29 are not tagged.

## 2026-10-05

### 12 new tutor-only badges: confidence, sharing and code craft

- Confidence: `honest_check_in` (🌡️ Honest Check-in), `brave_coder` (🦁 Brave Coder),
  `growing_coder` (🌱 Growing Coder), `comeback_coder` (🔁 Comeback Coder).
- Sharing: `show_and_tell` (🎤 Show and Tell), `great_answer` (💬 Great Answer),
  `code_teacher` (🧑‍🏫 Code Teacher), `teacher_trap` (🕵️ Teacher Trap).
- Code craft: `tidy_coder` (🧹 Tidy Coder), `edge_explorer` (🔦 Edge Explorer),
  `finisher` (🏁 Finisher), `careful_checker` (🧷 Careful Checker).
- Tutor-only: tutors award them by hand (student modal → More → 🏅 Award badge), they are
  never suggested, and they can't be named in `badgeHints.suggest`. Honest Check-in may later gain
  a suggestion rule the tutor confirms. See [badges.md](badges.md).
- Affects: all · Existing lessons: no changes needed · Resolves: authoring-requests/2026-10-02-12-new-tutor-only-live-badges-confidence-sharing-code-craft.md

### `lessons validate` catches Firestore's 20-level nesting limit; prebuilt stacks stored as text

- A lesson nested deeper than Firestore allows used to pass validation and then fail on save with
  `Input object is deeper than 20 levels`. The shared validator (CLI and Builder) now measures the
  lesson **as it will be stored** and reports an error naming the task, its title and the deepest
  path, e.g. `Task 15 ("Title") is nested 24 levels deep at tasks[14].sprites[0]…`. See
  [validation errors](validation-errors.md#lesson-envelope).
- `prebuiltStacks[].stack` (on a task and on each code stage) is now saved as JSON text and parsed
  back on read, like `starterBlocks` / `completeBlocks`, so a long prebuilt stack no longer hits
  the limit. Authors still write the stack as an object; stacks stored as objects still load.
  [scratch.md](scratch.md#populated-block-state-json) no longer calls a stack "one shallow block".
- Affects: scratch, cli, all · Existing lessons: no changes needed (a lesson that failed to save
  because of a long prebuilt stack can now be republished as it is) · Resolves:
  authoring-requests/2026-10-04-lessons-validate-should-catch-firestore-s-20-level-depth-lim.md

### `lessons test-checks --cases` skips checks that need a run instead of failing them

- In `--cases` mode, `output`, `output_not_empty`, `output_empty`, `output_line_count`,
  `code_no_error`, `variable_*`, Turtle and HTML element checks (and checks that read
  Filesystem / Desktop / circuit / answer state) are now reported per check as `skipped` with a
  reason instead of a false `fail`. Completion is judged on the source checks alone; it reads
  `skipped` when every completion check needs a run, and a `skipped` completion is not a mismatch.
  A task with Python `tests` is skipped entirely, as at runtime. The output gains
  `actual.checks`, `skippedFeedback`, and `summary.skipped` / `summary.skippedRuntimeChecks`.
  See the [Quick Start](AUTHORING_GUIDE.md).
- Affects: cli, python, html, turtle · Existing lessons: no changes needed; drop any stripped
  "source-checks-only" lesson copies made to work around the old false failures · Resolves:
  authoring-requests/2026-10-04-lessons-test-checks-should-skip-runtime-checks-instead-of-fa.md

### Docs: which hint shows when Python code can't run

- New subsection [When the code can't run (SyntaxError)](AUTHORING_GUIDE.md#when-the-code-cant-run-syntaxerror):
  the task always fails, but `feedbackChecks` and `code` checks are still evaluated against the
  source (so a regex feedback check for a syntax slip does fire), `code_no_error` and `variable_*`
  checks fail, and output checks are compared against the error message. Order completion checks
  so the hint you want for broken code comes first. No behaviour change.
- Affects: python · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-04-document-whether-source-code-checks-evaluate-python-code-tha.md

### Docs: shared asset CLI — `showInEditor`, replace vs append, multi-costume presets

- [lesson-assets-cli.md](lesson-assets-cli.md#shared-lesson-type-assets) now says that
  `assets upload-type` stores `showInEditor: false` (Scratch never reads it, so preset costumes
  are unaffected; Arcade needs **Web editor** ticked), that `set-default-sprites` and
  `set-default-sounds` **replace the whole list** while `upload-sound` / `upload-backdrop` append,
  and to fetch the current list with `assets list-type scratch` first.
  [scratch.md](scratch.md#a-multi-costume-preset) gains a worked multi-costume `defaultSprites`
  preset using uploaded shared images (use full `https://` URLs). No behaviour change.
- Affects: scratch, arcade, cli · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-04-lesson-assets-cli-md-upload-type-showineditor-default-set-de.md

### Docs: Markdown renderer reference fences fixed

- An unbalanced code fence in [markdown-renderer.md](markdown-renderer.md) swallowed the
  "Scratch Blocks (fenced)", block colour, value pill, shape and maintenance sections into one code
  block. They now render as normal sections. No renderer change.
- Affects: markdown · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-04-markdown-renderer-md-broken-code-fence-swallows-the-scratch-.md

### Optional `lessonNumber` orders lessons within a level

- New optional lesson-envelope field `lessonNumber`: a positive whole number giving the lesson's
  position in its level. Every lesson list (Admin, the Builder's "Open from Firestore" picker
  and `lessons list`) now sorts within a level by `lessonNumber`, unnumbered lessons after
  numbered ones by title, and shows it next to the title (`9 · Boolean Flags`). The classroom
  header shows `Lesson 9` beside the level badge.
- A Solo Challenge (`companionOf`) needs no number: it sorts straight after its parent. Give a
  Solo Project the number of the lesson it follows; on a shared number the lesson without
  `soloOnly` comes first, then its companion, then the `soloOnly` lesson.
- `lessons validate` and the Builder reject `0`, negatives, decimals and strings. Like task
  `intent`, a save or upsert that leaves `lessonNumber` out keeps the stored number;
  `lessonNumber: null` clears it. Set it in the Builder's new "Lesson number" field.
- `lessons list` (JSON and YAML) now includes `lessonNumber`, `soloOnly` and `companionOf` for
  every lesson, in the new order; `lessons get` includes `lessonNumber` (`null` when unset).
  See "Lesson Numbers" in [lesson-schema.md](lesson-schema.md).
- Affects: all, cli · Existing lessons: no changes needed (add `lessonNumber` to set list
  order) · Resolves: authoring-requests/2026-10-05-lesson-number-field-lessonnumber-that-sorts-lessons-within-a.md

### New `run_attempted` check for demo tasks

- Demo tasks (Complete Example, Visual Fun Application: "press Run and watch") can now require
  that the student actually ran the code. `check: { type: run_attempted }` passes once the student
  presses **Run** (Python, Turtle, Electronics, HTML), **Run game** (Arcade Kit) or the **green
  flag** (Scratch — clicking a single script does not count). Any run counts, even one that
  errors or that the student stops; once passed the task stays complete.
- Optional `requireSuccess: true` also requires the run to finish without an error. Honoured in
  Python, Turtle and Electronics; ignored in Arcade, HTML and Scratch (a validator warning).
- Composes with other completion checks in a list (all must pass); mixed with any other check an
  erroring run fails as before. It is a completion check only: rejected as a feedback check, in
  submit mode, on Filesystem/Desktop (no Run button) and as a Scratch `after_block_placed` check.
  It never passes without a run (`lessons test-checks` reports `fail`, Scratch verification
  `skipped`, the auto-check on leave **not run**). The Builder offers it as a **Run** check.
- Example:

  ```yaml
  - title: 🎮 Watch It Move
    taskActivity: Code Task, Complete Example
    starterCode: |
      import turtle
      for side in range(4):
          turtle.forward(100)
          turtle.left(90)
    check:
      type: run_attempted
      hint: Press **Run** to see the program work.
  ```

  Reference: [python.md](python.md#run-attempted-check-run_attempted); per-module notes in
  `turtle.md`, `arcade.md`, `electronics.md` and `scratch.md`.
- Affects: python, turtle, arcade, electronics, html, scratch, cli · Existing lessons: no changes
  needed (checkless demo tasks can add `check: { type: run_attempted }`) · Resolves:
  authoring-requests/2026-10-04-run-attempted-completion-signal-for-demo-mode-tasks.md

## 2026-10-04

### Scratch `audio` sounds play from Firebase Storage and any other host

- Sprite sounds with an `audio` file were silent when the file lived in Firebase Storage (for
  example `/assets/shared/...` or an uploaded lesson asset): the bucket sent no CORS headers, so
  the browser blocked the download. The bucket now allows the app's origins, and a file on a host
  without CORS falls back to plain `<audio>` playback, so `start sound`, `play sound until done`
  and `stop all sounds` work either way. No field changes.
- Affects: scratch · Existing lessons: no changes needed · Resolves: none

## 2026-10-02

### Peer help: optional `peerHints` on code tasks

- In a live lesson a stuck student can now let a classmate who finished the task help them. The
  teacher checks the work and offers it, and a finished student marks lines 👍/👎 and sends
  preset hints (💡) on a line. Neither student sees the other's name.
- New optional task field `peerHints`: up to 6 short strings (60 characters each) that a helper
  can send on this task. Helpers see at most 6 hint cards: the lesson's first, then the
  platform's. They reach the stuck student without the teacher checking each one, and helpers
  can be 9, so write them as a few kind, general words ("Did you use a loop?"), never the
  answer. Not valid on `quiz` or `information` tasks. See [lesson-schema.md](lesson-schema.md).
- Peer help works on Python, Python Turtle, HTML and Scratch tasks (Scratch: feedback on scripts).
- Session reports gain `peerHelp[]` (see [session-reports.md](session-reports.md#peerhelp)).
- 🤝 Helpful Coder is no longer tutor-only: it is suggested (never auto-awarded) when a stuck
  classmate found a student's peer help useful. It still can't be named in `badgeHints.suggest`;
  `badgeHints.suppress: [helpful_coder]` now works on a task. See [badges.md](badges.md).
- Affects: python, turtle, html, scratch · Existing lessons: no changes needed · Resolves: none

### Open short answers: the teacher can show chosen answers on the presentation window

- New fields on an open `short_answer` quiz (no `check`): `showResponses: teacher_picks` gives
  each student card a **📺 Show** button in a live lesson, and the picked answers replace the
  answer box on the presentation window. `anonymiseResponses` (default `true`) shows them
  without names; `false` shows names by default. The teacher can turn a name on or off per
  answer either way. Students' screens don't change. See
  [quiz-tasks.md](quiz-tasks.md#showing-answers-on-the-presentation-window).
- Validation rejects `showResponses` on a short answer with a `check` (graded answers are never
  broadcast), a value other than `teacher_picks`, and a non-boolean `anonymiseResponses`.
- Session reports: the task summary gains `shownResponses[]` (`studentLabel`, `text`,
  `showName`, `shownAt`, `hiddenAt`). See
  [session-reports.md](session-reports.md#ungraded-tasks).
- Affects: quiz_short_answer · Existing lessons: no changes needed · Resolves: authoring-requests/2026-10-02-open-short-answer-teacher-shows-chosen-answers-on-the-presen.md

### New tutor-only badge: 🦸 Independent Coder

- `independent_coder` (🦸 Independent Coder): for a student who worked problems out on their own,
  trying things and using hints and the Topic Library before asking for help. Tutor-only: tutors
  award it by hand, it is never suggested, and it can't be named in `badgeHints.suggest`. A suggestion rule may come later, once a "help requested" signal exists. See
  [badges.md](badges.md).
- Affects: all · Existing lessons: no changes needed · Resolves: authoring-requests/2026-10-02-new-tutor-only-live-badge-independent-coder.md

### Scratch: per-sprite sounds, and Costumes / Sounds tabs

- Sprites take an optional `sounds: [{ name, synth } | { name, audio }]` list. `synth` is one of
  18 built-in sounds (`pop`, `meow`, `click`, `chime`, `boing`, `laser`, `coin`, `jump`,
  `power-up`, `game-over`, `beep`, `buzzer`, `bell`, `drum`, `snare`, `whoosh`, `splash`,
  `zap`); `audio` is an audio file path resolved like a costume image. The sound blocks'
  dropdown lists the sprite's own sounds. Without `sounds`, a sprite keeps the old four
  (`pop`, `meow`, `click`, `chime`). See [scratch.md](scratch.md#sounds).
- New task toggles, all off by default: `showCostumesTab`, `showSoundsTab`, `allowAddCostume`
  (emoji or admin-library costumes), `allowAddSound` (synth sounds or admin sound files).
  Students may add to any sprite; additions are saved with their work. See
  [scratch.md](scratch.md#costumes-and-sounds-tabs).
- New admin library `lessonTypeAssets/scratch.defaultSounds` (`{ id, name, audio }`), with CLI
  `lessons assets upload-sound scratch <file>` and `lessons assets set-default-sounds scratch
  [file]`. `lessons assets list-type scratch` now returns `defaultSounds` alongside `defaultSprites` / `defaultBackdrops` (`[]` when none), so check it before asking for a new sound file.
- Affects: scratch, cli · Existing lessons: no changes needed · Resolves: authoring-requests/2026-10-02-assets-list-type-scratch-include-defaultsounds.md

## 2026-10-01

### Moving the class on auto-checks unpassed tasks; it no longer counts as complete

- When the teacher moves a live class to another task, each student who hasn't passed the graded
  task being left has their current work graded **without running it** and the verdict logged for
  the session report: Correct (auto-checked) `auto_passed`, Incorrect (auto-checked)
  `auto_failed`, or Not run `auto_not_run`. New per-student `autoCheck` and summary
  `autoPassedCount` / `autoFailedCount` / `autoNotRunCount` fields. See
  [session-reports.md](session-reports.md#auto-check-on-leave).
- Only checks a run can't change are judged (`code`, `code_structure`, filesystem, desktop,
  `input_*`, electronics circuit checks, Scratch `block_used` / `blocks_in_order` /
  `block_count`). A task whose checks include `output*`, `code_no_error`, Python variable,
  Turtle, HTML element or Scratch run-time checks, or Python `tests`, is "not run" unless one of
  its static checks already fails. Authors who want move-on grading for a task should include a
  static check (for example a `code` check) alongside its output checks.
- Being moved on past a graded code task without passing it (a class-advance override) **no
  longer counts as complete** in `completed` / `completedCount` / `completionRate`; a tutor's hand
  pass still does. Overrides now carry `source: teacher | class_advance`. Check-less code tasks,
  information tasks, quizzes and activities are unchanged (moved past, they still count as
  complete).
- Affects: all · Existing lessons: no changes needed · Resolves: none
### Poll quiz (`quizType: poll`) and live class polls in the session report

- New quiz sub-type `quizType: poll`: an opinion question with 2 to 6 `options` (`id`, `text`),
  never marked. Any choice completes the task and students can change it. In a live lesson a
  student sees the class split (percentages, never who chose what) once they have chosen, and the
  presentation window shows it live; set `showResults: false` to keep it teacher-only. No
  `check`, `answer:` or option `feedback` (a `check` is a validation error).
  See [quiz-tasks.md](quiz-tasks.md#poll) and the new poll rows in
  [validation-errors.md](validation-errors.md).
- Its `taskSummary` entry reports `respondedCount` and `optionDistribution`
  (`[{ id, text, count }]`, each student's latest choice), like other ungraded tasks.
- Session reports gain a top-level `polls[]`: the teacher's ad-hoc live polls from the new
  **📊 Poll** button (question, options with counts, each student's final answer, who didn't
  answer, times). Their results are public by default (live on the presentation, and on a
  student's screen once they have voted) unless the teacher ticks "Keep results private". See [session-reports.md](session-reports.md#polls). Lessons don't author these.
- Affects: quiz_poll, all · Existing lessons: no changes needed · Resolves: none

### Seven new live badges; `earlyBirdMinutes`; Code Arranger hints

- New rule-backed badges: 🧩 **Code Arranger** (`code_arranger`, auto-awardable: first in class
  right first time on any Arrange task, whatever its `taskActivity`), ✨ **Autocomplete Ace**
  (`autocomplete_ace`: accepted a code-editor autocomplete suggestion) and 🐦 **Early Bird**
  (`early_bird`: joined at least `earlyBirdMinutes` before the tutor pressed Start).
- New tutor-only badges: 🙋 Great Question, 🏹 Sharp Shooter, ✍️ Word Wizard, 🎨 Design Master.
- New `badgeOptions.earlyBirdMinutes` (default `5`, a number of minutes above 0).
- `badgeHints.suggest` can now name `code_arranger` (to treat a non-Arrange task as its trigger),
  and `badgeHints.suppress` can name `code_arranger` or `autocomplete_ace` (Early Bird isn't tied
  to a task, so suppressing it does nothing). See [badges.md](badges.md).
- Affects: all · Existing lessons: no changes needed · Resolves: none

### Session report field reference

- New [session-reports.md](session-reports.md): every field a session report's YAML can contain
  (path, meaning, units, when it's present or omitted, date added), including activity summary
  fields (`pairFailures`, `blankFailures`, `ratingDistribution`, `avgItemProgress`).
- Explains the derivations that surprise reviewers: `attempts` and `avgAttempts` count identical
  resubmissions (`retries`); `completionRate` includes overrides; `overridden_failed` is written
  automatically for every unpassed student when the teacher moves the class on, not only by a
  tutor; a support reveal can attach to a task with no `check`; there is no `revealCount`.
- Documents lesson-level `teacherFeedback` (one per session run, on that run's report; absent
  after **End & Go to Home**) and per-task `taskSummary[].teacherRating`, and how both differ from
  the [feedback CLI](feedback-cli.md)'s lesson feedback.
- From now on, a change to the report's output updates that page and adds an entry here.
- Affects: all · Existing lessons: no changes needed ·
  Resolves: authoring-requests/2026-09-30-document-the-session-report-schema-including-teacherfeedback.md

### Multi-group Draft example; recap `leftContent` is a single heading

- [AUTHORING_GUIDE.md](AUTHORING_GUIDE.md#draft-lessons) has a second Draft example: an
  introduction, two groups, code tasks with intent, quizzes, an activity and a recap, with
  `taskActivity` across the Glossary patterns.
- Recap `leftContent` (the purple left pane) is canonically a **single `## ` heading**
  (`leftContent: "## What we covered"`), with the recap body in `explainer`. An `introduction`
  ignores both `leftContent` and `explainer`: it shows the lesson's title, level and description.
  See [lesson-schema-yaml.md](lesson-schema-yaml.md#information-task-fields).
- Affects: all · Existing lessons: recaps whose `leftContent` holds plain text or a body should
  move to a single `## ` heading, with the body in `explainer` (they still render as before) ·
  Resolves: authoring-requests/2026-09-30-authoring-guide-draft-lessons-add-a-multi-group-draft-exampl.md

### Arcade palette hex values

- [arcade.md](arcade.md#palette) lists each palette colour's hex. The palette is exactly the
  standard PICO-8 16-colour palette; `white` is the warm `#fff1e8`, not `#ffffff`, which matters
  when an image-generation prompt must match the game window.
- Affects: arcade · Existing lessons: no changes needed ·
  Resolves: authoring-requests/2026-09-30-arcade-md-palette-section-should-list-each-colour-s-hex-valu.md

### Session reports: each student's first join, task at join and rejoins

- Each `students[]` entry in a session report now carries `joinedAt` (the student's first join,
  ms, never overwritten), `joinedAfterMs` (how long after the session started, clamped to 0 for a
  waiting-room join), `joinedAtTaskId` (the class's current task at that moment) and `rejoins:
  [{ at, taskId }]` (each later name entry or page reload back into the session, oldest first; at
  most the latest 20). Untouched tasks before `joinedAtTaskId` mean "not present yet", not
  "skipped".
- Reports from sessions before 2026-10-01 lack these fields; any of them is also omitted when
  unknown (no session start, no rejoins, a student the teacher removed).
- Affects: all (session reports) · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-01-session-report-per-student-join-time-and-task-at-join.md

### `code_structure` check: Python nesting (`nested_in`, `directly_nested_in`, `not_nested_in`)

- New Python check `type: code_structure` with `operator` (`nested_in` | `directly_nested_in` |
  `not_nested_in`, required), `inner` and `outer`. It reads indentation, which `code` checks
  can't see, so a nested `if` no longer passes the same checks as two sibling `if`s or an `elif`
  lined up with the outer `if`.
- `inner` / `outer` are whole lines, matched ignoring spacing and case, with `*` wildcards. Every
  operator fails when no line matches `inner`.
- Needs no run: works in submit mode, in feedback checks (including `show: on_idle`), in
  `code_arrange` tasks with `moduleType: python`, and in `lessons test-checks`. The Builder offers
  it as Code → Structure (nesting) on Python tasks.
- See [python.md](python.md#code-structure-checks-code_structure).
- Affects: python, code_arrange · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-09-30-python-check-that-can-see-indentation-nesting-depth.md

### Scratch block checks accept one of several opcodes

- `block_used`, `block_run`, `block_count` and each `blocks_in_order` sequence item can give
  `opcode` a list, so any one of several equally-correct blocks counts. Short form:
  `opcode: [motion_turnright, motion_turnleft]`, where the check's (or item's) `fieldValues`
  apply to whichever block matched. Long form: a list of `{ opcode, fieldValues }` entries, each
  with its own values. A plain string works exactly as before.
- In `blocks_in_order`, put the list under the item's `opcode:` (`- opcode: [a, b]`). A bare
  list as the item is rejected, because lessons can't store a list inside a list.
- `block_count` adds up the blocks of every listed opcode and, as before, ignores `fieldValues`.
  `block_run` passes when any listed block ran.
- Validation rejects an empty list or a malformed entry. It warns when a shared `fieldValues`
  key isn't an input of every listed block, and when a `block_count` entry has `fieldValues`.
  The Builder shows a list as "any of: …" and leaves it alone; edit it in YAML. See
  [scratch.md](scratch.md#one-of-several-opcodes).
- Affects: scratch · Existing lessons: no changes needed ·
  Resolves: authoring-requests/2026-09-30-scratch-block-checks-that-accept-one-of-several-opcodes.md

### Scratch checks verified per check by `test-checks` and `validate`

- `lessons test-checks lesson.yaml` with **no `--cases`** now verifies every Scratch task (picked
  by each task's own module, so composed lessons work). Each completion and feedback check is
  evaluated against the task's `completeBlocks`, its starter and each Complete-role code stage,
  with a per-check `pass`/`fail` (plus `sprite`, `reason` and `actual` blocks on a fail) and
  feedback `fires`/`silent`. Run-time checks (`sprite_property*`, variables, costumes,
  `block_run`) are reported as `skipped`. It warns when a Complete stage fails a check, a
  feedback check fires on a Complete stage, the starter already passes, or a Debug Code Task's
  blocking feedback checks all stay silent on the starter. `--task <id>` limits it to one task.
  See [scratch.md](scratch.md#verifying-scratch-checks).
- `lessons validate` (and the Builder) warn `Task … complete solution fails a block check —
  review the complete blocks` and `Task … starter already passes every completion check — …`.
  See [validation-errors.md](validation-errors.md#warnings-about-the-solution).
- Affects: scratch, cli · Existing lessons: no changes needed (validate may now warn on Scratch
  lessons whose Complete stage fails a check) · Resolves:
  authoring-requests/2026-09-30-scratch-check-verification-per-check-results-from-validate-o.md

### Which hint is shown: one documented rule, Scratch now follows it

- New [Which hint is shown](AUTHORING_GUIDE.md#which-hint-is-shown) section: only one hint is
  shown per attempt. A matched blocking feedback check's hint wins; then, if the completion checks
  failed, the highest-priority matched feedback check's hint; otherwise the first **failed** entry
  in the `check` list that has a `hint`; otherwise the generic "Not quite, try again!" banner.
  Order completion checks most-specific-first (or give each a hint), and use `feedbackChecks`
  with `priority` for misconception-specific hints.
- Scratch now matches Python/HTML: it no longer falls back to the first check's hint when no
  failed check has one (that could be a check the learner had already passed), and while the
  learner is placing blocks only an `after_block_placed` check that has definitely failed can
  supply the hint. Run-time checks (`block_run`, `sprite_property`, …) only contribute hints
  after Run. See [scratch.md](scratch.md).
- Affects: all, scratch · Existing lessons: no changes needed (Scratch lessons that relied on a
  passed check's hint now show the generic banner) · Resolves:
  authoring-requests/2026-09-30-document-which-hint-shows-when-several-completion-checks-fai.md

### Scratch: typing in a text field no longer logs an attempt per keystroke

- On Scratch tasks with a text field (a Say message, for example), each character typed was
  checked and logged as a separate attempt (`h`, `ha`, `hav`, …), inflating attempt counts and
  awarding the Persistence badge too easily. Checks now run, and one attempt is logged, when the
  field edit is committed (the learner leaves the field or presses Enter), with the final text.
  Placing, moving or deleting a block still runs checks as before. See
  [scratch.md](scratch.md#scratch-check-types).
- Session reports from before this fix overcount attempts on Scratch tasks with a text field;
  discount their attempt counts and Persistence badges when judging task difficulty.
- Affects: scratch · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-09-30-scratch-text-field-typing-logs-a-new-attempt-on-every-keystr.md

### Code Arrange: HTML entry file must be a starter file; solutions are checked

- An HTML `code_arrange` task whose `entryFile` is not one of its `starterFiles` now fails
  validation (`Task … entryFile "…" is not one of its starter files`). Before, the assembled tiles
  were silently dropped and the preview stayed blank.
- Validation (CLI `lessons validate` and the Builder) now assembles the authored solution and
  warns when it fails the task's own `code` checks, or, for Python, when a line after a block
  opener (`…:`) isn't indented. `output` and element checks still need a real run and aren't tried.
- Classroom fixes with no authoring change: a tutor's **Edit answers** applies once, to the task it
  was made on; tiles a task no longer has are ignored (the board isn't "complete" with them); Run
  stays disabled with a message when Python failed to load. See
  [lesson-schema.md](lesson-schema.md#code-arrange-task-fields) and
  [validation-errors.md](validation-errors.md#code-arrange-tasks).
- Affects: code_arrange · Existing lessons: html arrange tasks whose entryFile isn't a starter
  file now fail validation; solutions failing their own code checks warn · Resolves: none

### Code Arrange attempts always record the assembled program

- A `code_arrange` Run now always runs, and logs, the program assembled from the tiles. Before,
  the code behind the board could be reset to empty while the tiles stayed placed (loading a task
  in a live session, a late reconnect, a tutor's **Start again**), so the attempt was logged with
  an empty `submission` and failed. A tutor's reset now clears the tiles too (or fills in the
  answer for **Complete**).
- [lesson-schema.md](lesson-schema.md#code-arrange-task-fields) now says what an arrange attempt
  records: the assembled program text as `submission`, identical re-runs counted as retries.
- Affects: code_arrange · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-09-30-code-arrange-attempts-recorded-with-an-empty-submission-then.md

### Badge Summary title shown exactly as written

- The Badge Summary task (`informationType: badges`) no longer adds 🎖️ in front of its `title`,
  so an emoji-first title no longer shows two emojis. The title (and the first line of **Copy
  class summary**) is shown exactly as written; with no title the default is
  "🎖️ Today's Coding Moments". See [badges.md](badges.md#badge-summary-task).
- Affects: badges · Existing lessons: Badge Summary tasks whose title has no emoji now show
  none — add one if wanted · Resolves: none

### Line hints: a trailing marker gets its own empty line

- A line-hint marker with nothing after it (`#> …` / `<!--> … -->` as the last line of the code,
  a stage or a file) now shows on a **new empty last line** instead of beside the last line of
  code, so `#> Write your code here` at the end marks where the student starts typing. No extra
  blank lines are needed (YAML `code: |` strips them anyway).
- The validator warning `Task … has a line hint with no line after it …` is removed.
- The editor's cursor now sits at the end of a hinted line (column 0 on an empty one) rather than
  floating out next to the hint text.
- Affects: python, turtle, html · Existing lessons: no changes needed · Resolves: none

## 2026-09-30

### Badge hints in the Builder; Admin catalogue badges

- The Builder task editor has a **Badge hints** field (Authoring metadata, every task except
  information tasks) that edits `badgeHints.suggest` and `badgeHints.suppress` with only the ids
  validation accepts, and notes which badges the task's `taskActivity` pattern already triggers.
  The YAML field is unchanged. See [badges.md](badges.md#badgehints).
- Admins can add manual-only badges in Admin Portal → Badges. They are awarded by tutors only;
  lessons can't name them in `badgeHints`. See [badges.md](badges.md#admin-catalogue-badges).
- Affects: all · Existing lessons: no changes needed · Resolves: none

### Badge Summary information task (`informationType: badges`)

- New information type `badges`: "Today's Coding Moments". In a live session each student sees
  their own badges as stickers, then the class wall grouped by badge (names only, no counts); the
  teacher sees a projector-friendly wall with **Copy class summary**. The `explainer` is optional
  and shows above the wall. Usually the last task.
- Solo learners skip it, exactly as if it were `taskMode: live`; no `taskMode` is needed. See
  [badges.md](badges.md#badge-summary-task).
- Affects: all · Existing lessons: no changes needed · Resolves: none

### `taskActivity` patterns are read; `badgeOptions` and `badgeHints` for live badges

- `taskActivity` stays free text, but the platform now reads the Lesson Format Glossary pattern it
  names (`src/shared/taskActivity.js`; `lessons capabilities` → `taskActivity`). An unrecognised
  pattern is a **warning**, never an error. Case, spacing and `,` vs `:` don't matter.
- The coming live badges use the pattern: a `Debug Code Task` can suggest 🐛 Bug Hunter, a
  `Copy the Code` task 📋 Code Builder, `Quiz: What Is the Error?` / `Quiz: Fix a Common Bug`
  🔍 Code Detective, and a `Challenge (Open-Ended)` 🔓 Challenge Solver. Those tasks need a `check`.
- New optional envelope field `badgeOptions` (`quizMasterThreshold`, `quizMasterMinQuizzes`,
  `persistenceMinFails`, `readyToCodeSeconds`) and per-task `badgeHints` (`suggest`, `suppress`).
  Lessons never define badges. See [badges.md](badges.md).
- Affects: all, cli · Existing lessons: no changes needed (fix any `taskActivity` the validator
  warns about) · Resolves: none

## 2026-09-29

### Mac and Chromebook keys and right-click

- Keyboard prompts, hints and the key picture name keys as the student's computer does (Mac
  **delete** for Backspace and **fn + delete** for Delete, **Cmd** for Ctrl; Chromebook
  **Alt + Backspace** for Delete, **Alt + Search** for Caps Lock). Those presses already counted,
  because the browser reports them as the Windows key; now the words match the keyboard.
- Fixes: on a Mac, turning Caps Lock *off* now counts for `find_key: CapsLock` (Macs send no
  keydown then), and `edit_text` treats Cmd + ← / → as Home / End.
- Teachers see a **Mac** or **Chromebook** badge on Keyboard and Mouse work. Mac Ctrl + click and
  Chromebook Alt + click count as right-click. Known gap: `symbols` hints use the UK Windows
  layout, which differs on a UK Mac. See
  [activities/keyboard.md](activities/keyboard.md#mac-and-chromebook-keyboards).
- Affects: keyboard, mouse, desktop · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-09-29-mac-and-chromebook-equivalents-for-taught-keys-and-right-cli.md

### Keyboard `edit_text` mode: fix a line without retyping it

- New Keyboard mode `edit_text`. Each item has `start` (the line with mistakes) and `target`
  (the fixed line); the student edits in place with the arrow keys, Home/End, Shift selection,
  Backspace and Delete. The line finishes when it matches `target` exactly.
- It passes only if it was **edited, not retyped**: at least `minKept` (default `0.9`) of the
  characters `start` and `target` share must never have been deleted and typed again. Optional
  per-item `requireKeys` (`Backspace`, `Delete`, `ArrowLeft`, `ArrowRight`, `Home`, `End`,
  `select`) must each be used. `showTarget: false` hides the fixed line.
- Needs a real keyboard: the on-screen keyboard shows a note instead. The teacher card adds
  `· n retyped`. New validation messages are in [validation-errors.md](validation-errors.md).
  See [activities/keyboard.md](activities/keyboard.md).
- Affects: keyboard · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-09-29-keyboard-edit-text-mode-fix-the-text-without-retyping-it.md

### CHANGELOG entries carry a tag line

- From today every entry ends with `Affects: … · Existing lessons: … · Resolves: …`, naming the
  modules/activities it touches, whether existing lessons need changing, and the authoring
  request it ships. Read the tag line first to decide whether an entry matters to a lesson.
  Older entries are not tagged. See [Entry format](#entry-format).
- Affects: all (changelog format) · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-09-29-tag-changelog-entries-with-affected-modules-lesson-impact-an.md

### `lessons capabilities`: activity modes and fields, content fields, open requests

- Each activity now lists `modes`, `fields` (task fields with `required`, `authored`, `values`,
  `modes` and per-item `itemFields`), `fieldsByMode`, and `authoredFields` (content paths such
  as `items[].text`). Each module lists its own task `fields` / `authoredFields`, and a new
  `taskFields` section covers the common task fields plus `information` and `group`.
- `requests` is now an array of the requests in `docs/authoring/authoring-requests/`
  (`file`, `title`, `kind`, `status`, `requestedBy`, `lessonsBlocked`); the old hint text moved
  to `requestsHowTo`. Lesson tooling can drop hand-kept field lists and read these instead.
- No lesson changes. See [AUTHORING_GUIDE.md](AUTHORING_GUIDE.md).
- Affects: all activities and modules (capabilities output only) · Existing lessons: no changes
  needed · Resolves: authoring-requests/2026-09-29-lessons-capabilities-per-activity-modes-and-fields-and-open-.md,
  authoring-requests/2026-09-29-machine-readable-content-field-map-per-task-type.md

### Desktop `window_state` `moved_to` and `resized`

- New `window_state` operators. `moved_to` passes when the window's centre is in `zone`
  (`left_half`, `right_half`, `top_half`, `bottom_half` or a quarter such as `top_right`).
  `resized` passes when the window is `size: smaller` / `larger` than it started (15% or more in
  area), meets `minWidth` / `minHeight` / `maxWidth` / `maxHeight` (fractions of the desktop), or,
  with neither, changed by 15% or more. Minimised or maximised windows never count.
- Window geometry is now judged against the student's real desktop size, recorded on each window
  interaction. `windows_arranged_side_by_side` no longer assumes a 1200px viewport, so a layout
  that fills a smaller screen now passes.
- New validator errors for a missing `appId`, unknown `zone` / `size`, and out-of-range limits.
  See [desktop.md](desktop.md#moving-and-resizing-windows) and
  [validation-errors.md](validation-errors.md).
- Affects: desktop · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-09-29-window-state-moved-to-and-resized-operators.md

### Scratch Support stages: `markdown` for students, `blocks` for replacing (docs fix)

- No platform change; the docs contradicted each other. A Scratch Support stage's `markdown` is
  the read-only reference the student sees, and the panel opens empty without it. Its optional
  `blocks` are only loaded when the stage replaces the student's work (teacher stage push,
  `stageOffer` `replace`, stage reset) and are what the teacher's stage tab shows.
- Lessons whose Scratch Support stages carry only `blocks` should add `markdown`. See
  [scratch.md](scratch.md#sprite-object).
- Affects: scratch · Existing lessons: add `markdown` to blocks-only Support stages ·
  Resolves: authoring-requests/2026-09-29-scratch-support-stage-docs-say-markdown-every-live-lesson-us.md

### Line hints in starter code (`#> …` / `<!--> … -->`)

- Python, Turtle and HTML starter code, code stages and complete code can carry **line hints**
  instead of instruction comments: a line whose trimmed text starts with `#>` (Python, Turtle)
  or is `<!--> … -->` (HTML) is removed from the student's code and shown beside the next line
  (a 💡 in the gutter plus faded text after the line). Consecutive markers stack on one line.
- Marker lines are stripped before the code is shown, saved, run, checked (including
  `code_contains` / regex checks and the validator's complete-solution check), carried or
  mirrored. Existing lessons are unaffected unless a line already starts with `#>` or is
  `<!--> … -->`.
- New validator warning: `Task … has a line hint with no line after it (…) — it shows on the
  last line`. See [python.md](python.md#line-hints), [turtle.md](turtle.md#line-hints),
  [html.md](html.md#line-hints) and
  [validation-errors.md](validation-errors.md#module-starter-state).

### Task answers are stored sealed (no authoring change)

- Nothing changes in how lessons are written: keep authoring `check`, `completeCode`,
  `codeStages`, `tests`, quiz answers and the rest as plain fields in YAML/JSON.
- The **stored** format changed: on save (Builder, `lessons upsert` / `publish-yaml`, task
  upsert/append, admin import and fork) each task's answer fields are moved into an obfuscated
  `_sealed` string on the public lesson document, and restored on every read (`lessons get`,
  Builder load, the classroom). It hides answers from casual snooping; it is not security.
- Existing lessons keep working unchanged and are sealed on their next save, even an unchanged
  republish. Do not hand-write `_sealed`. See [lesson-schema.md](lesson-schema.md).

### Keyboard shortcuts, binary answers and validation messages

- Keyboard `shortcuts` items can now use Shift with a non-typing key (`Shift+Tab`,
  `Shift+ArrowLeft`); students can complete them. `Shift+<character>` (e.g. `Shift+A`) is now a
  validation error because it just types a capital. See
  [activities/keyboard.md](activities/keyboard.md).
- Binary `to_decimal` answers are compared as numbers, so `05` is accepted for `5` (matching hex
  mode's decimal answers).
- The "complete desktop does not satisfy a check" warning no longer tests `browser_visited` or
  `search_query` checks, which the complete desktop can't hold.
- A missing task or group title is reported once instead of twice.
- Keyboard `shortcuts`: the item's shortcut now counts anywhere on the page (Ctrl+S no longer
  opens the browser's save dialog outside the practice box), and `Shift+Tab` items are practised
  in a row of fields. Binary `pixels` draw items now show each row's bits beside the grid.

## 2026-09-28

### Desktop input checks (`input_gesture`, `input_shortcut`, `input_modifier`)

- Desktop tasks can now check **how** the student did something: `input_gesture` (click,
  double-click, right-click, drag, scroll, hover — optionally on a `file`, `folder`, `window` or
  desktop `icon`, and for drags onto a `dropTargetKind`), `input_shortcut` (`combo: ctrl+c`,
  `via: keyboard | menu | any`) and `input_modifier` (Shift vs Caps Lock capitals). Put them in a
  `check` list next to an outcome check. Only Desktop tasks record input; the validator rejects
  them elsewhere, and rejects browser-reserved shortcuts such as `ctrl+w`. Only counts are
  recorded, in memory, for the current attempt. See
  [desktop.md](desktop.md#input-checks-how-it-was-done) and the new rows in
  [validation-errors.md](validation-errors.md#checks).

### Activities in YAML (`type: binary`) and in the Builder

- YAML shorthand: `type: binary`, `type: keyboard` or `type: mouse` on a task (any activity's
  YAML type) becomes `taskType: activity` + `activityType: <id>`. The explicit two-field form
  still works; `lessons export` now writes the shorthand. An `activityType` this version doesn't
  know is exported explicitly. Quizzes keep `type: quiz` + `quizType`. See
  [lesson-schema-yaml.md](lesson-schema-yaml.md#activity-tasks) and the pages in
  [activities/](activities/), whose examples now use the shorthand.
- Builder: the task format grid is **Code / Information / Quiz / Activity** (+ Arrange in
  composed lessons). **Activity** opens a gallery of the activities; each has its own editor
  with validation shown next to the item it is about, and a playable student preview.
  Switching format keeps the title and description (and priority, explainer, authoring
  metadata) and drops fields the new format doesn't use. Quiz editing is unchanged; the quiz
  types' labels now come from the activity registry ("Fill in the gaps", "Confidence check").
- Session reports: activity tasks now report `taskType: activity` + `activityType` (they were
  reported as `code`), with each student's `itemProgress` (`correct` / `total`) and the task's
  `avgItemProgress`. Quiz reports are unchanged.
- Print: activity tasks show the activity's name and their `description`.

### Binary activity: overflow, hex, ASCII and pixels modes

- Four new Binary `mode`s (see [activities/binary.md](activities/binary.md), which has a
  complete example lesson):
  - `overflow`: items `a`, `b` whose sum does **not** fit in `bits`; students set the bits that
    are left and answer "Did it overflow?".
  - `hex`: items `value`, `from`, `to` (`binary` / `hex` / `decimal`, different); binary is shown
    in groups of 4 bits and hex answers are marked ignoring case.
  - `ascii`: items `text` (1–16 printable ASCII characters) and `direction` (`encode` /
    `decode`); task options `codeFormat` (`binary` default, or `decimal`) and `showTable`.
  - `pixels`: task `width` / `height` (1–16), items `rows` (quoted bit strings) and
    `direction` (`draw` / `encode`).
- `requireCarries` now also applies to `overflow`.
- The `add` message for a sum that is too big now reads "a + b is too big for … bits (use mode:
  overflow for that)." New messages are listed in [validation-errors.md](validation-errors.md),
  including a size limit on a task's saved answers for the new modes.
- Existing `make_number`, `to_binary`, `to_decimal` and `add` tasks are unchanged.

### Quiz answers are kept after a reload

- Quizzes now run as activities in the classroom (one per quiz sub-type). A student's quiz
  answer is saved on their device as they answer, so it survives a page reload and is still
  there when they return to the task. Only the answer comes back — the right/wrong banner
  starts fresh and the student can answer again. See [quiz-tasks.md](quiz-tasks.md).
- Nothing changes in the lesson format: keep writing `type: quiz` (`taskType: quiz`) with
  `quizType`. Validation messages, session reports and printed quizzes are unchanged. Printed
  lessons now also include each activity's own section (e.g. a Binary task's questions and
  answers).
- When the teacher's own Presentation View broadcast is live on a quiz task, students now see
  the teacher's selected answer (read-only), like other activities.

### Binary, Keyboard and Mouse activities run in the classroom

- Tasks with `taskType: activity` and `activityType: binary`, `keyboard` or `mouse` now render
  as full-screen activities for students, anywhere in a lesson (any lesson type, including
  composed lessons). They have no Run button, personal sandbox, sharing or carry-through.
  Progress is saved on the device and shown on the teacher's student card; the teacher can
  view, edit, reset ("Start again") or complete ("Complete (show answers)") a student's
  activity from the student modal.
- New authoring pages with complete, validated example lessons:
  [activities/binary.md](activities/binary.md), [activities/keyboard.md](activities/keyboard.md),
  [activities/mouse.md](activities/mouse.md). Every Binary / Keyboard / Mouse validation message
  is now listed in [validation-errors.md](validation-errors.md). Write `taskType: activity` +
  `activityType: …` in YAML; the `type: binary` shorthand arrives with the Builder activity
  gallery.
- Go Live: on quiz and activity tasks the teacher can no longer broadcast a *student's* answers
  to the class ("Go Live for All" is hidden there). The teacher's own Presentation View
  broadcast of an activity now shows the class the teacher's activity state. Lessons need no
  changes.

### Builder and CLI validation share one rule set and one wording

- `lessons validate` (and `yaml-to-json`, `upsert`, `publish-yaml`) now runs the same rules as
  the Builder, with the same messages. Lessons that only passed the CLI before may now get:
  feedback-check errors (`… has feedback checks but no completion check`, priority and
  stage-offer rules) and the `blocking feedback check with no hint` warning; the full Scratch
  check rules; Python/HTML/Arcade check-field rules (`… but no CSS selector`,
  `… enabled but no check value`, submit mode with run-only checks, …); Python `tests` rules;
  `… references task … for carry-through but that task does not exist`; the
  `complete breadboard` warning; and the empty-editor warning for quiz and code-arrange tasks.
  The Builder now also checks `recordingUrl`, Electronics stage labels, and `browser_visited` /
  `search_query` checks against the complete Desktop state.
- Reworded messages (one wording for both): Builder full stops dropped from quiz and
  code-arrange messages (`… has an empty option text field.` → `… has an empty option text`);
  Builder envelope/fork messages now use the CLI wording (`Lesson ID is required` →
  `id is required`, `Lesson must have at least one task` → `tasks is required and must be an
  array` / `tasks must contain at least one task or group`, `Forked lesson ID must be …` →
  `forked lesson id must be '…'`, …); the Builder's `may only carry work from an earlier task`
  → `Task … carryCodeFrom must reference an earlier task in the same lesson module`; the CLI's
  Scratch and Desktop check messages now use the Builder wording (`sprite check is missing a
  property` → `has a Scratch sprite-property check with missing property, operator, or value`,
  `file-in-dir check but no parent folder` → `file-location check but no parent folder`, …);
  `Group "…" has no subtasks — add at least one subtask` in both.
- `taskType: activity` (with `activityType`) is accepted and validated by the activity's own
  rules; an unknown `activityType` is an error. Still-builder-only: invalid Scratch toolbox XML,
  duplicate task ids and the untested-check reminder. CLI-only: `description is required`.
  See [validation-errors.md](validation-errors.md).

### Explainer code-block menu offers Python for Arcade Kit, Python Turtle and Electronics

- The Builder explainer editor's code-block button now inserts a ```` ```python ```` fence
  for Arcade Kit, Python Turtle and Electronics tasks (it previously only offered an
  unlabelled generic block there). Existing Markdown is unaffected. The same change makes
  the Builder label Python Turtle lessons correctly (they were shown as "Web") and prints
  Desktop lessons as "Desktop". See [markdown-renderer.md](markdown-renderer.md).

## 2026-09-17

### Arcade Kit direction keys also respond to WASD

- `keys.left`, `keys.right`, `keys.up`, `keys.down`, `keys.horizontal`,
  `keys.vertical`, and `keys.pressed("left")` (etc.) now also respond to
  `A`/`D`/`W`/`S`. Existing lessons need no changes; single-letter checks
  such as `keys.pressed("a")` still mean only that key, so avoid giving
  W/A/S/D a separate meaning in a game that also uses the direction names.
  See [arcade.md](arcade.md).

## 2026-09-15

### `recordingUrl` no longer requires a class fork

- The Builder's **Recording** field (sets `recordingUrl`) is now shown for
  every lesson, not just class forks (`lesson.fork?.sourceLessonId`).
  `recordingUrl` was already accepted on any lesson by `lessons validate` and
  `RecordingWidget`; only the Builder UI gated it to forks. See
  [lesson-schema.md](lesson-schema.md).

## 2026-09-13

### Code checks on Turtle, Arcade Kit and Electronics

- **Python Turtle** tasks can now mix generic `code` checks (e.g. "uses a
  `for` loop") with turtle checks in `check` and `feedbackChecks`. The Builder
  has a new **Code** subject in the Turtle check editor. `lessons validate`
  accepts `code` checks on Turtle tasks and rejects any with no `value`. See
  [turtle.md](turtle.md#checks).
- **Arcade Kit** now evaluates `code` checks every time the student presses
  **Run game**, so they gate progression and show hints like other code
  tasks. Output and other non-code checks on Arcade tasks are never
  evaluated. The check editor no longer offers them, and the Builder and
  `lessons validate` warn about any already saved. See
  [arcade.md](arcade.md#runtime-notes-and-limits).
- **Electronics** `code` checks now read the Micro Controller's MicroPython
  source after **Run** as well as after **Check**, and a `code` check with no
  `value` is now a validation error.

### Turtle: 🐢 marker, hideturtle and showturtle

The Turtle canvas now draws a 🐢 at the turtle's position, facing its heading.
New commands: `hideturtle()`/`ht()`, `showturtle()`/`st()` and `isvisible()`.
`turtle_command_used` accepts `command: hideturtle` and `command: showturtle`.

### Check comparisons now behave the same in every module

Text operators (`contains`, `not_contains`, `equals`, `not_equals`, `matches_regex`,
`not_matches_regex`) now share one implementation across output, quiz answers, file content,
HTML element checks and Scratch block inputs. Existing checks can change verdict in these cases:

- **`not_contains` with an option list** (`"a","b"`) now passes only when none of the options
  appear. It used to search for the literal quoted text, so it almost always passed. This affects
  output, answer and HTML element, attribute and style checks.
- **An invalid regex** now fails `not_matches_regex` too, instead of passing for every student.
- **Filesystem `fs_file_content` `equals` / `not_equals`** now support `*` wildcards.
- **Scratch `fieldValues`** on `block_used`, `block_run` and `blocks_in_order`:
  - `equals` and `contains` ignore case and surrounding spaces.
  - `contains` supports `*` and option lists.
  - Numbers compare numerically (`10` equals `10.0`).
  - Regex honours `flags`.

Review Scratch checks that relied on case-sensitive field matching, and any `not_contains` check
written with an option list.

### Scratch graphic effects draw on the stage

`set/change [effect] effect` blocks used to update sprite state without changing how the sprite
looked. All seven effects now render. `fisheye` and `whirl` are skipped for costume images hosted
on another site. `motion_setrotationstyle` is now in the default toolbox (it was already in the
catalog and runtime). See `docs/authoring/scratch.md`.

### CLI reads and writes lessons the same way as the Builder

- `lessons get`, `lessons upsert`, `lessons publish-yaml`, `lessons fork` and the
  `tasks` commands now decode and encode
  Scratch block trees and Arcade designs at the Firestore boundary, like the
  web app. Long Scratch scripts and Arcade sprite art can now be published from
  the CLI (Firestore rejected them before), and `lessons get` returns blocks as
  objects rather than JSON strings for lessons saved in the Builder.
- Scratch `starterBlocks`, `completeBlocks` and stage `blocks` can now be written as plain
  objects in lesson files. JSON strings still work and are not encoded twice.
- `lessons delete` also removes the lesson's session reports and feedback, like
  deleting from Admin. The result includes a `cleared` count.
- The Builder now rejects an unknown lesson `type`, as the CLI already did.
- The broken `scripts/yaml-to-json.mjs` script is removed. Use
  `node cli/cli.mjs lessons yaml-to-json` instead.

### Turtle lessons now validate and publish correctly

- The CLI accepts `type: turtle` and `moduleType: turtle`; it previously
  rejected every Turtle lesson.
- The Builder no longer rejects `turtle_position`, `turtle_path_closed`,
  `turtle_command_used` or `turtle_color_used` with "no check value". Both the
  Builder and CLI now check each Turtle check's own fields (`x`/`y`, `value`,
  `command`, `color`) and reject unknown Turtle check types.
- `turtle_command_used` with `command: backward` now passes when students call
  `backward()`/`bk()`/`back()`. Before, it could never pass. A backward move
  still also counts as a `forward` call.
- Python, Arcade and Turtle tasks whose starter lives only in `codeStages` no
  longer get a false "no starter code" warning.

See `docs/authoring/turtle.md`.

## 2026-09-12

### Scratch check fixes that change existing verdicts (backfilled)

These fixes shipped earlier without a changelog entry. Lessons authored while the bugs existed may
need their checks reviewed.

- **2026-09-11: `fieldValues` now match dropdown fields.** `block_used` and `blocks_in_order`
  `fieldValues` only read number/text inputs, so a condition on a dropdown (e.g. `motion_goto`
  `TO`, `looks_switchcostumeto` `COSTUME`) could never pass. It now reads the block's own field
  first.
- **2026-09-09: `blocks_in_order` waits for the student.** Starter stacks that connect the
  surrounding blocks directly (the usual "insert a block between these two" task) were reported as
  failed before the student did anything. A gap now counts as pending until the wrong block is
  actually placed.
- **2026-09-07: `sprite_property_delta` and `sprite_property_changed` work.** The "before run"
  sprite snapshot was aliased to live state, so the delta was always 0 and "changed" was always
  false for every task using these checks. If a lesson avoided these check types because they never
  passed, they are safe to use now.


### New Turtle module task type

Added `moduleType: turtle` — a single-file Python task type for turtle
graphics, running a hand-built shim of the real `turtle` module (`import
turtle` works as written) inside the shared Pyodide worker, drawing onto a
responsive canvas with a fixed logical coordinate space matching real
turtle's centre-origin, y-up convention. Supports the core movement/pen
command set (forward/backward/left/right/penup/pendown/pencolor/goto/
setheading/home/reset), plus circle, begin_fill/end_fill/fillcolor/color,
stamp, write, bgcolor, and colormode. New check types: `turtle_position`,
`turtle_heading`, `turtle_path_closed`, `turtle_segment_count`,
`turtle_path_length`, `turtle_command_used`, `turtle_color_used` (takes an
optional `kind: "pen" | "fill"`), and `turtle_stamp_count`. The student's
drawing now also syncs live to the teacher — both when watching an
individual student and when "Go Live" broadcasts a turtle task to the whole
class — via the same channels that already sync live code. Multiple
`Turtle()` instances, per-task canvas size, and a reference-image comparison
feature are not implemented. See `docs/authoring/turtle.md`.

### New `companionOf` lesson field links a solo challenge to its parent lesson

A `soloOnly` "solo challenge" lesson can now set `companionOf: "<parent-lesson-id>"` to link it to the lesson it extends. The Admin lesson list groups a solo lesson under its linked parent (collapsible, same pattern as class forks), and students who finish the parent lesson — live or solo — are offered a "Try the Solo Challenge" button that drops them straight into the companion in solo mode. The field is set only on the solo lesson; the parent lesson document is unchanged. Set it via the Builder's new "Solo challenge companion of" text field in `LessonMetaPanel.jsx`, or the CLI. See "Solo Companion Metadata" in `docs/authoring/lesson-schema.md`.

## 2026-09-11

### New `allowRemoveSprite` / `allowRemoveStarterSprites` Scratch task fields

Scratch tasks can now opt in to letting students remove sprites from their workspace with `allowRemoveSprite: true`. By default this only allows removing sprites the student added themselves via the existing "Add sprite" picker (`studentAdded: true`) — author-placed starter sprites stay protected. Set `allowRemoveStarterSprites: true` alongside it to also allow removing author-placed sprites; a workspace can never be emptied to zero sprites, and removal asks the student to confirm first. The Scratch Playground sets both flags so every sprite there is removable. See `docs/authoring/scratch.md`.

## 2026-09-05

### New `allowSharing` task field for student workspace sharing

Tasks can now opt in to student workspace sharing with `allowSharing: true`. When set, students working on that task get a **Share with class** button; the teacher is notified, previews the exact snapshot, and approves or declines it. Approved workspaces go into a class-wide **Shared work** gallery that persists across task changes until the teacher removes them, and classmates open them as a non-destructive sandbox copy they can run and edit without touching their own work.

The field is off unless explicitly set, so existing lessons are unaffected and need no changes. It is valid on any code task in any lesson type, and rejected by CLI and Builder validation on `quiz` and `information` tasks, which have no workspace to share. Set it on tasks where seeing a classmate's approach helps — open-ended builds, creative tasks, "solve it your own way" problems — and leave it off where you want independent work. See `docs/authoring/lesson-schema.md`.

## 2026-09-04

### Topic library removed from Scratch lessons

The topic library (inline `[[wiki-links]]`, hover cards, and the browse dialog) no longer renders on Scratch lessons at all — `useTopicLibrary` now returns no topics whenever the lesson type is `scratch`, regardless of a topic's `types` field. A topic tagged `["scratch"]` (or left untagged, normally "all types") will never appear on a Scratch lesson; `[[topic-id]]` syntax in a Scratch explainer now renders as plain text instead of a link. This also removes the teacher's "📖" topic-library button from the Student Grid/Student Modal while viewing a Scratch lesson. No change for any other lesson type. Existing Scratch lessons need no changes — any `[[..]]`/`topicLinks` authored there simply stop resolving to links; authors should stop adding them for Scratch going forward. See `docs/authoring/TOPIC_LIBRARY_SCHEMA.md`.

## 2026-09-02

### New optional `recordingUrl` field for per-class recordings

Lessons can now carry an optional `recordingUrl` field: an unlisted YouTube link to that class's recorded live session. It's meant to be set per-class on a class's forked lesson (`lessons fork`), not on the shared source lesson, since each class recorded a different session. When present, solo students see a small pop-out player (bottom-right, pausable/hideable) on the lesson page; it never appears during a live session or teacher presentation. The video must be set to **Unlisted** on YouTube — students are login-less and never authenticate with Google, so a Private video would just show a "request access" screen. Only `youtube.com`/`youtu.be` links validate; Google Drive links do not, because Drive's embed has no JS control API to pause/resume the widget in place. See `docs/authoring/lesson-schema.md`.

### Electronics `locked: true` components are now interactive

A "Fixed" (`locked: true`) component previously had every one of its controls disabled for students, so a fully locked demo board was inert: the switch would not flip, the button would not press, and the potentiometer would not turn. `locked` now freezes only a part's *structure* — position, rotation, `props`, pins, and deletion — while its `controls` state stays live on the canvas and in the inspector. `push_button` (`pressed`), `slide_switch` (`closed`), `potentiometer`/`sensor` (`value`), `transistor` (`baseHigh`), and `servo_motor` (`angle`) all respond on a locked part. This makes the documented pre-wired demo board pattern work as its example already described: `controls: {}` leaves the switch open and the student flips it to light the LED. Existing lessons need no changes — a locked demo board gains its intended interactivity automatically. A read-only workspace (teacher live view, Support/Complete stage preview) remains fully inert. See `docs/authoring/electronics.md`.

### Electronics wire format corrected: `from`/`to` are `componentId.pin` strings

`docs/authoring/electronics.md` previously documented a wire as `from: { component: battery1, pin: positive }`. That shape does not work. The runtime uses `wire.from`/`wire.to` directly as graph keys in `buildGraph` and string-splits them in `pinPoint`, so it accepts only the flat form `from: battery1.positive`. An object-form wire produces no error — `lessons validate` still passes — but connects nothing in the simulation and draws nothing on the board, leaving the parts placed but entirely unwired and every check involving them permanently failing. The doc's only populated wire example carried the wrong shape, so any board authored from it was dead on arrival. Wires are strings; **Checks** endpoint selectors remain `{ type, pin }` objects, which is the likely source of the confusion. Existing lessons with object-form wires need their wires rewritten. No runtime change. See `docs/authoring/electronics.md`.

### Electronics `controls` documented

`docs/authoring/electronics.md` now documents the `controls` map, which was previously undocumented and appeared only as `controls: {}` in examples. It holds live, student-adjustable state keyed by component id, separate from the fixed `props`: `slide_switch` uses `closed`, `push_button` uses `pressed`, `transistor` uses `baseHigh`, and `potentiometer`/`sensor` use `value`. Switches and buttons default to open/at-rest, so a demo board's LED starts dark until the student toggles it. No runtime change. See `docs/authoring/electronics.md`.

### Electronics tasks should write `starterCircuit` even when a starter stage exists

The student workspace reads `codeStages[0].circuit` and falls back to `starterCircuit`, and the lesson validator follows the same fallback — but the Builder's task editor checks `starterCircuit` alone, so a draft electronics task with only a starter stage shows "This draft task has no starter breadboard yet" over an otherwise working task while `lessons validate` reports it clean. `docs/authoring/electronics.md` now says to write both, and adds a complete pre-wired demo-board example showing the whole shape. No runtime change. See `docs/authoring/electronics.md`.

### Electronics pin names documented for every component type

`docs/authoring/electronics.md` now lists the pin names for all 16 electronics component types, not just the seven newer parts. `battery`, `resistor`, `led`, `push_button`, `slide_switch`, `potentiometer`, `motor`, `buzzer`, and `terminal` previously had no documented pins, so authoring a `starterCircuit` meant guessing — and a wire naming a pin that does not exist silently never connects rather than failing validation. Buttons and switches use `a`/`b`, batteries `positive`/`negative`, LEDs `anode`/`cathode`, potentiometers `left`/`wiper`/`right`, and a junction has the single pin `pin`. No runtime change; `COMPONENT_PINS` in `src/modules/electronics/circuit.js` remains the source of truth. See `docs/authoring/electronics.md`.

## 2026-09-01

### New lesson-level `soloOnly` field

Lessons can now set `soloOnly: true` on the envelope to hard-force solo mode always — the live/wait choice screen is never offered to students, regardless of URL (`?solo=true` becomes redundant) or whether a live session exists for the lesson. Authored via the Builder's "Solo-only lesson" checkbox next to "Draft workflow". Default is `false`/absent (unchanged live/solo behaviour). See `docs/authoring/lesson-schema.md` and `docs/authoring/lesson-schema-yaml.md`.

### `code_arrange` lines no longer each require a blank

A `code_arrange` line can now have zero `slot` parts (all `type: "text"`) — useful for fixed context like a variable declaration the student doesn't need to arrange. Validation now only requires at least one blank somewhere across the whole task, not on every individual line. See `docs/authoring/lesson-schema.md`.

## 2026-08-20

### `estimatedMinutes` now accepts decimal values

`estimatedMinutes` previously had to be a positive whole number; it now accepts any positive number, e.g. `estimatedMinutes: 7.5`. The Builder's task editor input steps by 0.5 minutes. See `docs/authoring/lesson-schema.md` and `docs/authoring/lesson-schema-yaml.md`.

## 2026-08-18 (2)

### Added a Paint app to the Desktop module

New `paint` desktop app: a freehand drawing canvas (Brush/Eraser, 8-colour palette + custom
colour, three brush sizes, Undo, Clear) with the same explicit Open/Save/Save As model as Text
Editor. `availableApps` now also accepts `"paint"`. Saved drawings store their image as a
`data:image/png;...` URL directly on the file entry's `content` — Image Viewer and File Manager
now fall back to reading that when there's no authored `src`/asset, so a Paint drawing previews
like any other image with no other authoring change needed. No new check type. See
`docs/authoring/desktop.md`.

## 2026-08-18 (1)

### Added a simulated Browser + search engine to the Desktop module

New `browser` desktop app: a simulated web browser (Back/Forward/Refresh/Home, editable address
bar) over a new task field, `siteGraph` — a lesson-authored, read-only set of fake pages with
content, links, an optional `sponsored` flag, `kind: 'search'` (an inline search box), `kind:
'broken'` (unreachable pages), and `kind: 'download'` (writes into `/Downloads/` via the existing
Filesystem `fs` map). `availableApps` now also accepts `"browser"`.

New check types: `browser_visited` (`visited`/`not_visited`, field `pageId`) and `search_query`
(`contains`/`not_contains`/`equals`, field `text`), backed by two new desktop-state fields —
`browserVisited` (dedup visit log) and `lastSearchQuery` — alongside the existing `fs`/`recycleBin`/
`windows`. Downloads reuse `fs_path`/`fs_file_content`; no new check type was needed for them.

`siteGraph` has no visual Builder editor yet — author it as JSON/YAML on the task, the same gap
`sandboxStarterDesktop` has. See `docs/authoring/desktop.md`.

## 2026-08-17

### Corrected Scratch `evaluation` values and documented `sprite_property_delta`/`sprite_property_changed`

`docs/authoring/scratch.md` previously told authors to write `evaluation: continuous` for block-structure checks (`block_used`, `blocks_in_order`, `block_count`); the runtime only ever recognizes `after_block_placed`, `after_run`, and `manual` — `continuous` silently fell into the after-run bucket, so a check authored exactly as documented would only ever evaluate after Run, never continuously. Use `evaluation: after_block_placed` instead. No published lesson used `continuous`, so no content migration is needed.

Also documented two previously-unlisted check types that were already implemented and available in the Builder: `sprite_property_delta` (change in a property since before Run) and `sprite_property_changed` (property differs from before Run, any amount).

Added a warning to the `block_run` section: a block is marked "executed" the instant it runs, before its field values are inspected, and this app's click-to-run-a-single-block feature means a bare click into a block (e.g. to edit its text) already counts as a run. Omitting `fieldValues` on a `block_run` check for a block with student-editable input can pass on an unedited/default value — set `fieldValues` (e.g. `operator: not_equals, value: ""`) to require the student's own input.

See `docs/authoring/scratch.md#scratch-check-types`.

### Prebuilt Scratch stacks no longer require their blocks to be in the toolbox

A `prebuiltStacks` (or legacy `predefinedBlocks`) entry now appears in the correct toolbox flyout category even when the task's `toolbox` doesn't otherwise include that block type — the platform resolves the root block's category and creates it if missing. This lets a task restrict its toolbox to already-taught blocks while still handing out a scaffolded starter stack built from blocks ahead of the current lesson. The Builder's prebuilt-stack editor no longer restricts which block types an author can add to a stack.

This only applies to categorized toolboxes; a minimal/flat toolbox (blocks listed directly under `<xml>`) is unchanged and still requires the stack's root block type to already be present there.

See `docs/authoring/scratch.md#prebuilt-stack-object`.

## 2026-08-04

### Added the Desktop module type

New `desktop` composed-lesson module type: a windowed desktop shell (icon grid, taskbar, draggable/resizable windows) hosting a File Manager app that wraps the Filesystem module's UI plus a Recycle Bin, search, and sort. New task fields: `starterDesktop`/`completeDesktop` (`{ fs, recycleBin, windows }`, reusing the Filesystem module's flat path-map for `fs`), `carryDesktopFrom`, `availableApps` (defaults to `["fileManager"]`), and stage snapshots use a `desktop` key instead of `fs`. `startsInDir` is reused unchanged from the Filesystem module.

New check types: `fs_recycle_bin` (`is_in`/`not_in`), `window_state` (`opened`/`closed`/`minimized`/`maximized`), and `windows_arranged_side_by_side` (a tolerant two-window geometry check). All existing `fs_*` check types work unchanged against a Desktop task's `fs`.

This first release ships File Manager only — Text Editor, Image Viewer, Paint, and a simulated Browser/search engine are planned for later releases. The support-stage reveal ladder is not available for Desktop tasks yet, matching the Filesystem module. See `docs/authoring/desktop.md`.

### Added Text Editor and Image Viewer apps to the Desktop module

Two new Desktop-module apps: **Text Editor** (plain text, no rich formatting yet) and **Image Viewer** (read-only, zoom + next/prev). Opening a file in File Manager now launches the matching app as its own window instead of showing an inline preview, regardless of `availableApps` — `availableApps` (now `fileManager`/`textEditor`/`imageViewer`, with a Builder checkbox picker) only controls which app icons appear on the desktop for standalone launch.

Text Editor is the platform's first explicit-save UI — content lives in a window's local `draftContent` until Save/Save As/Ctrl+S commits it, unlike every other module type's continuous autosave. A window with unsaved changes shows a `•` in its title and asks for confirmation before closing. Window objects gained two optional fields: `filePath` and `draftContent`; several Text Editor windows can now be open at once (windows dedupe by `(appId, filePath)`, not `appId` alone).

No new check types: `window_state` already worked generically by `appId`, and `fs_opened` already worked off the same `openFile` interaction context File Manager uses — both new apps just report through it. See `docs/authoring/desktop.md`.

## 2026-08-03

### Added student-added sprites/backdrops and student-created variables (Scratch)

Five new optional Scratch task fields: `allowAddSprite`, `addSpritePresetIds`, `allowAddBackdrop`, `addBackdropPresetIds`, `allowCreateVariable`. When enabled, students get an "Add sprite"/"Add backdrop" picker (sourced from the admin-curated `lessonTypeAssets/scratch.defaultSprites`/`.defaultBackdrops` library, optionally narrowed per task by the `...PresetIds` fields) and/or a "Make a Variable" flyout button. Student-added sprites/backdrops and student-created variables are decorative only — they never satisfy `sprite_property`, `block_used`, `blocks_in_order`, `block_count`, `block_run`, `variable_equals`, or `variable_compare` checks, which continue to see only the author-authored sprite/variable set. They persist through save, carry-through, and remote reset the same as authored content.

See `docs/authoring/scratch.md#student-added-sprites-backdrops-and-variables`.

### Electronics: generic code checks and lockable wires

Electronics tasks with a `microcontroller` component can now use the shared generic check types — `code`, `code_contains`, `code_equals`, `code_matches_regex`, and their negated variants — alongside the existing `circuit_*` checks. These evaluate against the Micro Controller's MicroPython source, not the raw circuit. The Builder's electronics check editor now exposes this as a **Code** subject (with the same operators and wording as the Python/HTML code check editor), so authors can add these checks without hand-editing lesson JSON/YAML. See `docs/authoring/electronics.md` (Checks section) for an example.

Wires now support an optional `wire.locked: true` field, mirroring the existing component `locked` convention: a locked wire cannot be deleted or recolored by students (new wires can still be attached to its pins). The builder's wire inspector gained a "Fixed for students" checkbox alongside the existing color select. See `docs/authoring/electronics.md` for the field description.

No lesson migration is required — omitted `wire.locked` behaves exactly as before (unlocked).

### Arcade Kit now honours the "Web editor" asset flag

Arcade's student workspace and the Builder's author preview now filter both
per-lesson `storageAssets` and Arcade-wide shared assets by `showInEditor`,
matching the existing HTML module behaviour. Generated sprites and tilemaps
from the visual design tools are unaffected.

**Migration note:** shared Arcade assets uploaded before this change default
to `showInEditor: false` and will disappear from lessons until an admin
re-ticks **Web editor** for them in the Admin Portal's Shared Assets panel.

See `docs/authoring/arcade.md#assets` for details.

### Added `taskActivity` field; authoring intent now previewable

Tasks may now carry an optional `taskActivity` field — a plain-text, author-only note on the intended in-class activity (e.g. "Pair-share discussion"). Like `intent`, it is stored but never shown to students, and it is always optional (not required in Draft). It rides along under the existing generic `taskLastChangedAt` timestamp; it has no dedicated `taskActivityLastChangedAt`.

Authoring intent (and the new `taskActivity`) are now also visible in the Builder's inline student/quiz preview and in the teacher's full read-only lesson preview, in an "Authoring metadata" section above the student-facing content. This section is visible by default while `lesson.draft: true`, and collapsed (one click to expand) once Draft is cleared. Both fields remain strictly author-only in every case — never rendered on any student-facing render path.

See `docs/authoring/lesson-schema.md` and `docs/authoring/lesson-schema-yaml.md` for the field reference.

### Added the `code_arrange` task type

New task type for Python and HTML: `taskType: "code_arrange"`. Students assemble a program line by line and run it for real through the same Pyodide/HTML pipeline as an ordinary code task. Completion is decided by the task's normal `check`/`feedbackChecks` against the real run result, not by matching tile identity or order.

`code_arrange` is a distinct task type alongside `python`/`html` code tasks, not a `quiz` sub-type, since quiz tasks must not carry code/output check fields.

Every line in `lines` is authored the same way: as an ordered `parts` array alternating fixed text (`{type: "text", text}`) and blanks (`{type: "slot", id, code}`) — never parsed out of a `___`-marker text blob. A line that's just a single blank with no surrounding text behaves like a traditional whole draggable line; a line mixing text and blanks reads like `for i in range(___):`. There is no separate mode/schema branch for the two — it's purely how many/which parts a line has.

There is exactly one shared tile pool for the whole task: every blank's own correct code, plus the task-level `distractors` list (`{id, code}[]`). Any tile in that pool can be dropped into any blank in the task — whatever tile currently sits in a blank, correct or distractor, is exactly what gets spliced into the assembled program and run.

New fields: `lines` (`{id, parts}[]`, one program line per entry, `parts` joined together and lines joined by newlines), `distractors` (task-level `{id, code}[]`, the shared pool's wrong tiles). HTML tasks also use the ordinary `entryFile` / `starterFiles` fields; the entry file's content is replaced by the assembled lines. There is no `prefixCode`/`suffixCode` — the assembled program is just `lines` joined by newlines, nothing wrapped around them.

See `docs/authoring/lesson-schema.md` ("Code Arrange Task Fields") for the full field reference and an example combining a whole-line blank and a line with an inline blank. See `docs/authoring/python.md` / `docs/authoring/html.md` for module-specific examples. Builder support: choose **Arrange** in the task format picker (composed lessons only) — a visual, reorderable line list where every line uses the same part-by-part composer, plus one shared "Distractor tiles" list, not a raw JSON-shaped form.

## 2026-07-30

### Changed grouped subtask titles

Grouped subtasks now keep their own `title` values instead of being auto-renamed from the parent group title. Authors no longer need `_customTitle`; Builder saves and exports strip that legacy field from grouped subtasks.

See `docs/authoring/lesson-schema-yaml.md` for the updated group example.

## 2026-07-29

### Added authoring changelog maintenance rule

The authoring docs now include this changelog for future lesson-writing changes. When a change affects how lessons are authored, update this file in the same PR with:

- the author-facing impact;
- any required migration or compatibility note;
- links to the detailed reference docs that were updated.

This entry introduces the process only; it does not change the lesson schema or publishing workflow.
