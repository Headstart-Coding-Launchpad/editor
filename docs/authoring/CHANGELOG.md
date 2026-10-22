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

## 2026-10-22

- **Read session reports from the CLI.** `lessons reports list <lessonId> [--since <ISO date>]`
  lists a lesson's session reports, newest first (startedAt, endedAt, studentCount, sessionId), and
  `lessons reports get <lessonId> <startedAt> --yaml` prints one report as the same anonymised YAML
  End Session exports. Read-only. See [session-reports.md](session-reports.md).
- Affects: cli, session reports · Existing lessons: no changes needed ·
  Resolves: authoring-requests/2026-10-21-cli-list-and-download-a-lesson-s-session-reports.md
- **New activity: Real or AI** (`type: real_or_ai`). Each item is a pair, two pictures or two
  texts side by side (stacked on phones and narrow tablets). The student picks the AI one, picks
  the clue ("tell") from the task's `tells` list, and presses Reveal; the reveal says whether
  the pick was right, whether the clue matches `tell`, whether that clue is `reliable`, and shows
  `reveal`. A running score stays on screen; the task finishes itself on the last Reveal.
  Task fields: `tells`, `items[]` with `id`, `kind` (`image` | `text`), `a`, `b`, `altA`, `altB`,
  `answer` (`a` | `b`), `tell`, `reliable`, `reveal`. Picture paths work like Scratch costumes
  (full URL, `/` path or relative to `assetsPath`). The tutor sees each pick and clue live,
  before Reveal. `itemProgress` is pairs picked right; the task summary adds `itemResults[]`. See
  [real_or_ai.md](activities/real_or_ai.md).
- Affects: real_or_ai · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-21-real-or-ai-activity-ai-level-1.md

## 2026-10-21

- **Share links for every student at End Session.** Ending a live session now makes one
  name-hidden, read-only link per student with code work, for their last task with work (the
  Export work share: 30 days, revocable). The report lists them under "Share links for parents"
  (Copy, Copy all, Revoke). New report fields: `students[].studentKey` (stable anonymous key) and
  `shareLinks[]`. New CLI: `sessions share-links [lessonId] [--session <id>] [--since <date>]`.
  See [session-reports.md](session-reports.md#share-links). Nothing is sent anywhere.
- Affects: cli, session reports, all code modules · Existing lessons: no changes needed ·
  Resolves: authoring-requests/2026-10-18-share-links-built-for-every-student-at-the-end-of-each-sessi.md

## 2026-10-20

- **Predict tags above the code** (`showVariables.placement: above`, off by default). On a
  Python predict task, the empty tags sit above the editor until the student's first Run, then
  go back to their usual place with the ticks and crosses. On a tablet or small screen there's no
  Tags tab until then, so the tags stay in view. On every predict task (Python and Turtle), each
  empty tag the student can still fill now has a purple border and a slow glow (a still ring
  with reduced motion). The words "Fill in your predictions first" beside a locked Run are now a
  button that puts the cursor in the first empty tag, switching to the Tags tab if needed.
  Builder: "Show the predictions above the code until the first Run". See
  [python.md](python.md#name-tag-panel-showvariables).
- Affects: python (placement), python + turtle (glow, lock button) · Existing lessons: no
  changes needed; add `placement: above` to the first predict tasks of a lesson · Resolves:
  authoring-requests/2026-10-20-predict-mode-show-the-predict-tags-above-the-code-until-pred.md

- **Scrub and `#@lock-values` open only after the pass** (`scrub.afterPass: true`, off by
  default). Until the task's first pass, there are no scrub boxes or True / False flips, and a
  `#@lock-values` line is fully locked, so students do the step instead of scrubbing and no
  `source: scrub` attempts happen first. On the first pass (checks or the tutor's pass) the
  boxes and editable values appear with "✨ Now make it yours: change the values in the dashed
  boxes." above the editor, and stay open on that device after a reload or Reset Code. A task
  with `#@lock-values` and no `scrub` uses `scrub: { afterPass: true }` (which also turns
  scrubbing on). See [python.md](python.md#live-scrubbing-scrub).
- Affects: python, turtle, html · Existing lessons: no changes needed; add `afterPass: true` to
  `scrub` on a Project's build steps · Resolves:
  authoring-requests/2026-10-20-scrub-and-editable-locked-values-open-only-after-the-task-is.md

- **Click a True or False to flip it** (`scrub.booleans`, on by default; P6-31). On a task with
  `scrub`, every `True` and `False` in code gets the dashed "you can change this" box; one click
  or tap (or Alt+Enter) flips it and redraws the Stage like a drag, and `checkOnRelease` runs
  the checks once. It works on `#@lock-values` lines. Strings, comments and names like `is_true`
  are left alone. A flip counts as an attempt with `source: scrub` and adds to `scrubs` (and the
  new `scrubBooleans`) in the session report. `booleans: false` turns it off. Every existing
  `scrub` task now boxes its `True` / `False` too. See
  [python.md](python.md#live-scrubbing-scrub).
- Affects: python, turtle · Existing lessons: no changes needed (L1 L10 task 15 can now say
  "click True") · Resolves: authoring-requests/2026-10-20-p6-31-click-a-true-or-false-to-flip-it-boolean-scrub.md

- **The Stage shows the drawing while `input()` waits** (P6-32). When a Stage program stops to
  ask a question, the Stage (and the tutor's view) shows everything drawn so far, at every
  `input()` in the run; the finished run's picture replaces it, and checks read the final
  picture as before. Two-question stories (draw a scene, then ask the next question) now show
  each scene in turn. Not in Slow-mo (it replays), and not the Turtle drawing. See
  [python.md](python.md#stage-drawing-beside-the-console).
- Affects: python · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-20-p6-32-stage-shows-drawing-while-input-waits.md

## 2026-10-17

### Lesson screenshots by CLI (`lessons screenshot`)

- **New command:** `node cli/cli.mjs lessons screenshot <lessonId> --task <id>` saves a PNG of a
  task as a student sees it, for lesson images: optional code (`--code`, `--code-stage complete`),
  Run with `input()` answers, a crop (`workspace`, `instructions`, `editor`, `output`,
  `console`, `stage`) and desktop or tablet size. Student views need no session and work on
  Drafts; nothing is written to Firebase.
- **Session views** (`tutor`, `tutor-grid`, `student-modal`, `shared-work`, `student-live`) run on
  a throwaway Draft copy with the test tutor and made-up `Test …` students, deleted afterwards.
- `--spec shots.json` takes many shots in one run (what Attach assets calls). A shot that can't
  find its panel fails with the task named and writes no file. See
  [lesson-screenshot-cli.md](lesson-screenshot-cli.md).
- **Fixed (request #76):** the Shared work gallery and its toast showed blank sharer names and
  title, and **Open** showed the task's starter instead of the classmate's work. The shared-work
  viewer no longer shows the "Live + Solo" preview banner.
- Affects: cli, python, turtle, html, scratch · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-17-lesson-screenshot-command-cli-png-of-a-task-s-editor-output-.md,
  authoring-requests/2026-10-17-shared-work-list-shows-blank-names-and-opens-the-starter-code.md

### One after-class feedback step (session report feedback and lesson feedback merged)

- The tutor reaches **one feedback step after every way of ending a session**: rating 1-5,
  "What worked well", "What didn't work", and optional per-task notes. **End & Go to Home** now
  shows the step (with Skip) too, and past reports gain **Add feedback / Edit feedback**, so
  `teacherFeedback` can be added after the fact.
- `teacherFeedback` is unchanged: `{ rating, whatWorkedWell, whatDidntWork, submittedAt }` on
  that run's report. `taskSummary[].teacherRating` and the during-lesson task rating panel are
  unchanged.
- Per-task notes go to `lessons/{lessonId}/feedback` (the feedback CLI store) with a new
  `reportId` field linking to the run's report. `feedback lesson` / `feedback all` now print
  `reportId` (null for older items). The in-lesson Feedback button was removed from the live
  tutor header. See [session-reports.md](session-reports.md#teacher-feedback) and
  [feedback-cli.md](feedback-cli.md).
- Affects: all · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-17-merge-the-session-report-feedback-and-lesson-feedback-into-o-2.md

### Solo study log: who did a Solo Challenge, and the side-quests per session

Tutors can now see who did a Solo Challenge (or any lesson opened solo) and who opened
side-quests, per lesson. No lesson fields change.

- **Admin ▸ Solo & side-quests** lists, per class and lesson, each solo student's started /
  finished times, tasks passed and first-attempt passes, and each side-quest opened in an ended
  session (when, runs, ✓ self-reported). **Download (no names)** gives the anonymised JSON.
- **CLI:** `lessons solo-log <lessonId>` prints the lesson's solo log anonymised ("Student N", no
  names or ids): `{ lessonId, lessonTitle, students: [{ studentLabel, startedAt, lastAt,
  finishedAt, taskCount, tasksPassed, firstAttemptPasses, tasks[] }] }`. Fields are in
  [session-reports.md](session-reports.md#solo-study-log). Side-quests per session are already in
  each session report's `sideQuests[]`.
- The live "on side-quest" line on the student card is now written before the live-work mirror and
  ranks above topic / sandbox lines, so it leads the card's "Now:" line.
- Affects: cli, python, turtle, html · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-17-tutor-view-of-solo-challenge-and-side-quest-completion-who-d.md

## 2026-10-16

### Edit zones: one-line slots, and lines that stay first or last (P6-30)

- **`#@lock-last`** / **`#@lock-first`** lock the next line like `#@lock`, and nothing can be added
  after / before it: typing or a paste on that side goes to the other side of the line instead,
  with "This line stays last. Add your code above it." Use `#@lock-last` on the line that uses the
  student's work (`draw(robot)`, `grid(pixels)`). One of each per task.
- **`#@slot`** marks the next line (blank lines too) as a place the student types exactly one
  line: dashed outline, "Write one line here" tag; Enter and multi-line pastes don't add lines.
  `#@slot 2` (up to 5) allows a small block.
- **`puzzle.noNewLines: true`**: students can't add a line anywhere; they edit the editable lines
  and fill the slots. `puzzle: { onlyEdit: [4], noNewLines: true }` is "change one line, add
  nothing".
- Python and Turtle tasks, side-quest starters included. See
  [python.md](python.md#edit-zones-one-line-slots-and-lines-that-stay-first-or-last-slot-lock-first-lock-last-puzzlenonewlines).
- Affects: python, turtle · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-16-p6-30-edit-zones-one-line-slots-and-fenced-locks.md

### Run counts: predict how many times a line runs (p6-26)

New task field `runCounts` (Python and Turtle; not under `showVariables`, works with or without
the name-tag panel) and a new marker, `#@count`, on the line above the line to count (up to 3 a
task; stripped like `#@peek`, and it follows its line when code moves):

```yaml
runCounts: predict              # predict | show
codeStages:
  - role: starter
    code: |
      for i in range(3):
          #@count
          print("Hip")
      #@count
      print("Hooray")
check:
  - type: runs_predicted        # new: every marked line's prediction was right (lines optional)
  - type: line_run_count        # new: line (default: the #@count line), operator, value
    operator: equals            # equals | min | max
    value: 3
```

- `predict`: a "How many times will this run?" number box at the end of each marked line; Run waits
  until every box is filled (predict mode's lock and words; `showVariables.lockRun: false` turns it
  off). After Run: "ran 3 times ✓" / "ran 1 time ✗ · you said 3" / "ran 0 times". `show`: "ran 3
  times" after each Run.
- A Turtle `stamp()` or drawing line counts its runs. Mark the line inside a loop, not the `for`
  line (that counts every check of the loop).
- `line` / `lines` in the checks are starter line numbers as the student sees them (marker lines
  removed). `line_run_count` counts its line even without `runCounts`.
- Tutor chip, StudentModal and Go Live show the boxes and counts; the session report adds
  `runCountPredictions` per student and `runCountFirstByLine` (with `offByOne`) per task.
- New validation messages: [validation-errors.md](validation-errors.md#run-counts-runcounts-count).
- See [python.md](python.md#run-counts-runcounts-count) and [turtle.md](turtle.md#run-counts-runcounts-count).

- Affects: python, turtle · Existing lessons: no changes needed (the multiple-choice "how many
  times?" questions can become `#@count` lines with `runCounts: predict`) ·
  Resolves: authoring-requests/2026-10-16-p6-26-predict-how-many-times-a-line-runs.md

### Predict mode: answer boxes that fit the value, and predicting the type (p6-27)

A `showVariables.predict` entry can now say what answer its tag takes, and a new `predictType`
list asks for the **type** of a value instead of the value:

```yaml
showVariables:
  mode: predict
  predict:
    - name: door_open
      answer: boolean          # True / False buttons
    - name: coins
      answer: number           # number field, numeric keypad on tablets
    - name: greeting
      answer: text             # text box between quote marks
    - name: colour
      choices: [red, blue]     # one button per choice
    - lives                    # a plain name: today's free text box, unchanged
  predictType: [typed, age]    # pick text / number / true/false / list
check:
  - type: variables_predicted
  - type: types_predicted      # new: every predictType was right (names optional)
```

- `variables_predicted` judges typed and picked answers by the same forgiving rules as before.
- `predictType` entries may be `{ name, choices: [text, number] }` to limit the type labels.
- Run's lock (`lockRun`) waits for type picks too. The tutor's 🏷️ chip counts them; the session
  report's `predictions` lists them after the values, marked `kind: 'type'`.
- New validation messages: [validation-errors.md](validation-errors.md#name-tag-panel-showvariables).
  The "no predict list" error now reads "no predict or predictType list".
- The Builder's "Students predict" box keeps an entry's `answer` / `choices` when you edit the
  names, and has a "Students predict the type of" box; answer kinds are YAML-only for now.
- See [python.md](python.md#name-tag-panel-showvariables) (Answer boxes, `types_predicted`).

- Affects: python, turtle · Existing lessons: no changes needed (plain names work as before; give
  true/false and number tags an `answer` for better boxes) ·
  Resolves: authoring-requests/2026-10-16-p6-27-predict-mode-typed-answers-and-predicting-the-type.md

### Slow-mo plays through the Run button (`slowMo.separateButton`)

On a Python or Turtle task with `slowMo.enabled`, **Run now plays the program in slow-mo**. The
button reads **▶ Run (slow-mo)**, and there is no separate 🐢 Slow-mo button. Once a run is
playing or paused, Pause (Play while paused), Step, Step back and Restart show above the code, with
a new **⏭ Finish** that jumps to the end of the run. The output and check result are as for a
normal Run, and checks still run once. The speed slider stays and starts at `slowMo.speed`. The run
shortcut, a Code Arrange board's Run and the tutor's remote Run do the same. The predict-mode Run
lock still applies, and in Go Live the presenter's Run plays slow-mo on every screen.

`slowMo.separateButton: true` keeps the old layout: Run runs normally beside a 🐢 Slow-mo button
(say for a Solo Challenge that wants plain runs plus optional slow-mo). It is validated as true or
false, and the Builder's Slow-mo field has a "Keep a separate 🐢 Slow-mo button" box. See
[python.md](python.md#slow-mo-slowmo).

- Affects: python, turtle, code_arrange · Existing lessons: no changes needed (slow-mo tasks now
  play through Run; add `separateButton: true` to keep a plain Run) · Resolves:
  authoring-requests/2026-10-16-p6-28-slow-mo-through-the-run-button.md

### Typing a value redraws; two result panes stay side by side longer; Emoji Artist counts new emoji only

- **Typing redraws like scrubbing.** On a Python or Turtle task with `scrub`, `runOnOpen` or a
  `#@lock-values` line, the Stage or drawing re-runs as a preview half a second after the student
  stops typing, as a scrub does: no attempt, no checks, nothing saved beyond the edit. Half-typed
  code that errors leaves the last picture in place. See
  [python.md](python.md#live-scrubbing-scrub).
- **Picture + Console never turn into tabs** in landscape: without name tags, the Picture sits
  above the Console and shrinks to fit, on Chromebooks and tablets alike. Three panes (with Tags)
  tab as before, and portrait screens and phones still put the editor above the result. See [python.md](python.md#screen-layout-layout).
- **🤩 Emoji Artist** only counts emoji the student added. Emoji already in the task's code
  stages, `copyCode` or the tutor's sandbox code don't count, so a starter with emoji no longer
  awards it on the first Run. See [badges.md](badges.md).
- Affects: python, turtle, html, badges · Existing lessons: no changes needed · Resolves: none

### Line hints and locks work in side-quest starters (P6-29)

- A side-quest's `starter` now handles `#>` line hints (HTML `<!--> … -->`), `#@lock`,
  `#@lock-values` and `#@peek` exactly as a task's starter does. Before, the marker lines showed
  as plain comments. See [AUTHORING_GUIDE.md](AUTHORING_GUIDE.md#side-quests).
- Affects: python, turtle, html · Existing lessons: no changes needed (markers already written
  in side-quest starters now work) · Resolves:
  authoring-requests/2026-10-16-p6-29-line-hints-in-side-quest-starters.md

### Authoring docs corrected to match the app (HSC Audit)

The HSC Audit checked every claim in these docs against the app. Some docs told authors to write
things that never work. Check existing lessons for these first:

- **Code regexes never see spaces.** `code` checks remove every space, tab and newline outside
  strings before comparing, and regex checks run on that squashed text. So `\s`, `\s+`, `\n`,
  literal spaces, `^`/`$` and the `m` flag never match in a `code` regex: the old Turtle example
  `for\s+\w+\s+in\s+range\(` never passed. Write `for\w+inrange\(`, or use `contains`
  `"for * in range("`. Non-regex code checks also ignore case, so `code not_contains "Print"`
  rejects `print` too. See [python.md](python.md#output-and-code-checks-shared-with-html).
- **HTML style checks read computed values.** `html_element_style_property` compares the
  browser's computed style, so colours are `rgb(255, 0, 0)` and sizes are in `px`: `value: red`
  never passes. See [html.md](html.md#html-element-checks-run-mode-only).
- **Multiple-choice `answer:` is the option's id** (`answer: b`), not its text. The converter now
  maps option text to its id, and a value matching no option fails validation. Options are never
  shuffled, so vary where the right answer sits.
- **Fill-in-the-blank uses `___`** (three underscores), not `{{blank}}`.
- **Arcade:** `game.clear`, `game.rect` and `game.text` take `colour=` (as documented) and `color=`;
  before this fix `colour=` crashed with a TypeError.
- **The asset CLI is `node cli/cli.mjs assets …`** (`assets upload-sound`, `set-default-sounds`,
  `list-type`), not `lessons assets …`. There is no `lessons export` either: use
  `lessons get <id> --format yaml` or `lessons json-to-yaml`.
- **Scratch checks:** leaving out `evaluation` means `after_run`; only `block_used`,
  `blocks_in_order` and `block_count` may use `after_block_placed` (others now fail validation); a
  run judges every check in a mixed list, block checks included, so `run_attempted` with block
  checks needs the blocks too; `block_count` supports all six comparison operators live;
  `sprite_property_delta` works on `x`, `y`, `size` and `direction` only; `variable_compare` needs
  `variableName` (`name:` fails validation); a `CLONE_OPTION` takes `_myself_` or a sprite id, not
  `_mouse_`. The task `toolbox` doesn't apply to Stage code, and toolbox categories keep their
  written order.
- **Envelope and fields:** use `levelId`, not a plain `level` (publishing turns it into a new
  level record), and don't set `version`. HTML `starterFiles` is required, not legacy. `taskMode`
  other than `both`, `live` or `solo` fails validation. Short-answer quizzes take one `answer_*`
  check object; multiple choice exactly one `answer_equals`. `"a","b"` option lists work with
  `contains` / `not_contains` only. Desktop tasks with Browser downloads must list `/Downloads/`
  in an authored `fs`. Authored Electronics wires without `color` draw red. `fs_opened` needs
  `itemType`. Mixing explicit and omitted task ids can clash.
- **Also documented:** Turtle commands that don't work yet (`Turtle()`, `shape`, `tracer`,
  `towards`, module-level `exitonclick`), stage "offer" behaviour in Turtle and Filesystem,
  feedback checks in all eight modules, `answer_not_equals` / `answer_not_matches_regex` and
  `flags`, `*` in answers, Markdown limits (merged callouts, table cells, same-tab links,
  `---` headings, no strikethrough), the servo control, `sandboxStarterDesktop`, Scratch sound and
  tab validation messages, feedback deletion with its lesson, and numeric CLI `--task-id`.
  Examples now use `codeStages` and the canonical check form.
- Affects: all (python, turtle, html, scratch, arcade, desktop, filesystem, electronics, quiz, cli,
  markdown) · Existing lessons: fix `code` regexes that use `\s`, `\n`, `^`/`$` or the `m` flag;
  change HTML style-check values to computed `rgb(…)` / `px`; check multiple-choice `answer:` is
  an option id (text is now mapped, unmatched text fails validation); replace `{{blank}}` with
  `___`; `"a","b"` lists only under `contains` / `not_contains`; Scratch `after_block_placed` on a
  run-time check type, `variable_compare` with `name:`, or a bad `taskMode` now fail validation ·
  Resolves: none

### HSC Audit app fixes: Scratch checks, quiz answers, new validation rules

- **Scratch: a Run judges every check.** In a list mixing `after_block_placed` and `after_run`
  checks, the block checks are judged against the current blocks when the run is judged, so a
  missing block can no longer pass. `run_attempted` with block checks needs the blocks as well as
  the green flag (judged the moment the flag is pressed).
- **Scratch: a missing `evaluation` means `after_run`** (the Builder now shows that).
  `after_block_placed` works only on `block_used`, `blocks_in_order` and `block_count`;
  validation errors on any other type.
- **Scratch `block_count`** while blocks are placed now supports every operator a run does
  (`not_equals`, `greater_than_or_equal`, `less_than_or_equal` too), so it agrees with
  `lessons test-checks`.
- **Scratch check types are listed and checked.** `lessons capabilities` lists the 11 Scratch
  check types on the Scratch module (owner `module:scratch`), and a misspelt Scratch check type is
  a validation error. `variable_compare` written with `name` (it reads `variableName`) is an error.
- **Scratch sandbox:** `sandboxStarter` may be the state object or a JSON string, and the
  student's personal sandbox now uses `sandboxSprites`, `sandboxToolbox` and `sandboxBackdrops`.
- **Quizzes:** a YAML `answer:` written as an option's text (or an id in other capitals) becomes
  that option's id; a multiple-choice answer that is no option id is an error. `answer_not_equals`
  now works (it always failed before).
- **Arcade:** `game.clear`, `game.rect` and `game.text` take `colour=` as well as `color=`.
  `interactionMode` is not an Arcade field (there is no Submit button); setting it warns.
- **New rules:** `taskMode` must be `both`, `live` or `solo`; the CLI rejects two tasks with the
  same id (YAML mixing explicit and omitted ids); an unquoted number `key` on
  `variable_dict_key_value` is accepted. `lessons capabilities` now says
  `requireShiftForCapitals` is off when left out.
- **Feedback CLI:** `--task-id 4` is stored as the number 4, so it shows in the Builder.
- **Topic links:** `types: [python]` topics now resolve on a composed lesson's information and
  quiz slides. See [validation-errors.md](validation-errors.md) for every new message.
- Affects: scratch, arcade, quiz_multiple_choice, quiz_short_answer, keyboard, cli, topics, all
  (taskMode, task ids) · Existing lessons: fix any new validation error (misspelt Scratch check
  types, `after_block_placed` on a run-time Scratch check, `variable_compare` with `name`, a quiz
  answer that is not an option id, a `taskMode` typo, clashing task ids); Scratch tasks that mixed
  check timings may now need the blocks to be present on Run · Resolves: none

### Scrub follow-ups from the pilot click-through: colour names only, colour boxes, run on open

- **The colour picker writes colour names only** (`scrub.colourNames`, on by default; Ryan,
  2026-10-16). The colour-blind-safe colours are offered under their nearest CSS names
  (`black`, `orange`, `cornflowerblue`, `teal`, `gold`, `steelblue`, `orangered`,
  `palevioletred`), then the other common names; there's no hex box, and each choice is labelled
  with the word it writes. `colourNames: false` brings back the hex colours and the hex box.
- **Pickable colours get the dashed "you can change this" box** that numbers and
  `#@lock-values` values have, with the swatch beside it.
- **`runOnOpen` tasks open with the output side showing**, so the opening preview is in view (it
  was drawn into a folded panel, so it looked as if nothing ran).
- Affects: python, turtle · Existing lessons: none need changes; explainers can say "pick a colour"
  without warning about hex · Resolves: none (follow-ups to p6-23 and p6-24, logged in
  `HSC Hub\Handoffs.md` on 2026-10-16)

### Linked name tags, checks when a drag ends, live redraw with `input()` and on open, `#@lock-values`

- **Name tags link to their variables** (`showVariables.link`, on by default). Each tag and every
  real use of that variable in the code share one of six colours and a small number (never colour
  alone). Strings, comments, attributes (`city.lower`) and keyword names (`size=26`) are not
  marked. Hovering, focusing or tapping a tag strengthens its marks in the code, and the reverse.
  Predict tags are linked from the start. `link: false` turns it off (Builder: "Link each tag to
  its variable in the code"). See [python.md](python.md#name-tag-panel-showvariables).
- **A drag runs the checks when it ends** (`scrub.checkOnRelease`, on by default). When a drag, a
  slider step or a colour pick ends, the task's checks run once exactly as a Run: attempt logged,
  result shown, tutor card updated. The attempt is marked `source: 'scrub'` in the session report
  (`distinctAttempts[].source`). Previews during the drag stay check-free. Programs that don't
  preview live, and predict tasks still waiting for predictions, wait for the next Run.
- **Programs with `input()` redraw live** by replaying the answers from the student's last Run,
  with "Using your last answers: Ada, Mars, teal" near the result. Before a Run the student sees
  "Press Run and answer the questions first".
- **Live redraw keeps up with the drag.** Previews used to wait for the drag to pause; they now
  run about every 200 ms while the value keeps moving.
- **Draggable numbers are marked** with an always-visible dashed box, with no hover or tap needed.
- **`runOnOpen`** (Python, Turtle; default on when `scrub` is on): the task's code runs once as a
  preview when it opens, so the picture shows straight away. No checks, no attempt, not a Run.
  Ignored, with a warning, when the starter calls `input()`.
- **`#@lock-values`** locks the next line except its values (plain string contents, empty strings
  too, and numbers), shown in the same dashed "you can change this" box as draggable numbers.
  Validation warns when the line has nothing to change. See
  [python.md](python.md#locked-lines-with-editable-values-lock-values).
- Affects: python, turtle (new fields `showVariables.link`, `scrub.checkOnRelease`, `runOnOpen`;
  new marker `#@lock-values`), html (`scrub.checkOnRelease`, live redraw), session reports
  (`distinctAttempts[].source`) · Existing lessons: no changes needed (scrub tasks now check on
  release and run on open; add `checkOnRelease: false` or `runOnOpen: false` to keep the old
  behaviour; explainers that say "press Run after dragging" can drop it) · Resolves:
  authoring-requests/2026-10-16-p6-19-name-tags-colour-linked-to-their-variables-in-the-code.md,
  authoring-requests/2026-10-16-p6-20-scrub-runs-the-checks-when-a-drag-ends.md,
  authoring-requests/2026-10-16-p6-21-scrub-live-redraw-for-programs-with-input.md,
  authoring-requests/2026-10-16-p6-22-locked-lines-with-editable-values.md,
  authoring-requests/2026-10-16-p6-23-run-the-starter-when-the-task-opens.md,
  authoring-requests/2026-10-16-p6-24-scrub-visible-marker-on-draggable-values.md,
  authoring-requests/2026-10-16-p6-25-scrub-live-redraw-lags-during-a-drag.md

### Student screens from the HSC Audit: what lesson text can rely on

- **The `copyCode` panel is titled "⌨️ Type this out".** Lesson text should name it ("type out
  the code in the *Type this out* box") rather than say where it is: "the panel above" read
  wrongly, because the panel sits above the editor, beside the instructions.
- **The Topic Library button opens on the task's topic.** It picks the first `[[topic]]` link in
  the explainer, else the first inline code span named exactly like a topic (`` `print()` ``),
  else the first topic named in the text. Add a `[[topic]]` link to choose it yourself.
- **Line hints go once the check passes**, so they never linger as ghost text after the
  finished code.
- **Recap `leftContent` is shown larger in a narrower panel.** Keep it to one short line
  ("Today you learned"), with no stray punctuation.
- **The fail pop-up names the help button "✋ Help"**, and its stage offer reads "Want a hint?
  Show me a hint" (or "Show hint: <stage label>"). Hints that mention help should call it the
  Help button.
- Affects: python, turtle, arcade, html (copyCode, line hints, check feedback), information
  (recap), markdown (topic library) · Existing lessons: change "the panel above" to the
  *Type this out* box where a lesson points at `copyCode` · Resolves: none

### HSC Audit visual fixes: wording and pictures authors refer to

- **Binary's button is now "Check my work"**, like Keyboard and Mouse (it said "Check answers").
  Lesson text that tells students to press "Check answers" should say "Check my work".
- **Scratch block pictures:** the text inputs of `say`, `think` and `ask … and wait` (for
  example `say [Hello!] for (2) seconds`) draw as white typed-text ovals with no dropdown arrow,
  as in Scratch. Every other `[…]` stays a dropdown, and `[… v]` (scratchblocks syntax) always
  draws a dropdown, without the ` v`. Scratch pictures in a quiz question are drawn bigger. See
  [markdown-renderer.md](markdown-renderer.md).
- **Activities show a purple title bar and a Topic library chip** over their instructions, like
  other tasks.
- **Electronics:** the tutor's Starter board now shows the starter stage's board when
  `starterCircuit` is missing or empty, matching what students load. Still write
  `starterCircuit` (see [electronics.md](electronics.md)).
- Affects: binary, scratch, markdown, activities, electronics · Existing lessons: change "Check
  answers" to "Check my work" in Binary task text; otherwise no changes needed · Resolves: none

## 2026-10-15

### Name-tag panel: predict mode locks Run until every prediction is in (`showVariables.lockRun`)

- **Predict tasks now enforce predicting first.** With `showVariables.mode: predict`, Run, Slow-mo
  and Step stay disabled until every `predict` tag has an answer (anything non-blank). "Fill in
  your predictions first" shows beside Run in words, as a tooltip, and as the button's accessible
  description.
- **After the first Run the lock is gone** for the rest of the task, so students can change the
  code and run again. The presenter (Go Live, the presentation window) is never locked, a tutor's
  remote Run still runs, and the personal sandbox isn't locked.
- **Off switch:** `showVariables.lockRun: false` (Builder: "Students fill in every prediction
  before their first Run"). Validation errors on a non-boolean and warns when it's set outside
  predict mode. See [python.md](python.md#name-tag-panel-showvariables).
- Affects: python, turtle (name-tag panel predict mode; new field `showVariables.lockRun`) ·
  Existing lessons: predict tasks now lock Run until the predictions are in; add
  `lockRun: false` to keep the old behaviour · Resolves:
  authoring-requests/2026-10-15-p6-18-predict-mode-locks-run-until-every-prediction-is-in.md

### Name-tag panel: `#@peek` now shows where the program stopped

- **A "stopped here" band in the editor.** With `showVariables.at: marker`, a dashed purple ⏸ band
  sits in the gap above the line the `#@peek` marker stops at, reading "The tags show the values
  here". It shows from when the task opens (before any run), so predict-mode students know where
  to predict, and follows the line as the student edits. It is unlike slow-mo's amber band.
- **A panel header, "Values just before line N"**, with the line number as the student sees it,
  in every mode (empty predict tags included).
- **When the marked line never ran**, the panel keeps its note, the band reads "The program never
  reached this line" and the header "Line N never ran".
- StudentModal and Go Live show the band and the header too. Screen readers hear "Values shown
  just before line N". Nothing new to author. See
  [python.md](python.md#name-tag-panel-showvariables) ("The `#@peek` marker").
- Affects: python, turtle (name-tag panel `at: marker`) · Existing lessons: no changes needed ·
  Resolves: authoring-requests/2026-10-15-p6-17-peek-marker-show-where-the-program-stopped.md

### Stage: flat pixel lists with `grid(values, width=n)`; palette numbers show as numbers in the panel

- **`grid(pixels, width=8)`** draws a flat list (no item is a list) as rows of 8 squares, left to
  right, top to bottom; the last row may be short. Values, `palette`, `cell`, `x`, `y` and the
  100 × 100 limit work as for a list of rows, and slow-mo draws it step by step as before.
  Plain-English errors: a flat list with no `width` ("grid(): pixels is one long list. Say how
  many squares fit in a row, like grid(pixels, width=8)", naming the student's variable), a
  `width` that isn't a whole number of 1 or more, and `width` given with a list of rows. A bad
  value is named by its place: `pixels[9]`. The Stage description says "a pixel grid of 24
  squares, 8 to a row, in red and white".
- **`stage_pixel` gains `index`** (0 or more): the cell at that place in the last grid's flat
  list, row by row, so `index: 9` after `grid(pixels, width=8)` reads `pixels[9]`. Give exactly
  one of `x`/`y`, `row`/`col` or `index`; the docs now say all three count from 0. Validation's
  message changed to "needs one of: x and y, row and col, or index", with a new one for a bad
  `index`.
- **Name-tag panel: wrapped lists.** A flat list drawn with `grid(…, width=…)` this run shows its
  tiles wrapped at the same width, indexes running on (0–7, 8–15 …), whatever `stageLists` says:
  swatches for colours, plain numbers for palette numbers (never bars), tiles otherwise. Screen
  readers hear "pixels, item 9 (row 2, column 2): white"; the tutor card shows a wrapped colour
  list as a small picture.
- **Palette numbers always show as numbers.** A 2D list holding palette numbers is a plain table
  with row and column indexes (read by row: "pixels, row 1: 0, 1, 1, 0"), even with
  `stageLists: picture`; it is never tinted or drawn as the picture. Colour names and hex codes
  are unchanged: swatches, and a small picture for a 2D list (with `stageLists: picture` for a
  drawn one). See [python.md](python.md#stage-drawing-beside-the-console) (Grids, Stage checks)
  and [List and dict visuals](python.md#name-tag-panel-showvariables).
- Affects: python (Stage `grid()`, `stage_pixel`, name-tag panel) · Existing lessons: no changes
  needed; a task relying on `stageLists: picture` to show palette numbers as a picture now shows
  a number table instead · Resolves:
  authoring-requests/2026-10-15-p6-13-stage-grid-flat-pixel-list-with-a-width.md,
  authoring-requests/2026-10-15-p6-14-name-tag-panel-palette-numbers-as-a-number-table.md

### Turtle course mode: students make their own maze (`course.studentMap`, `turtle.course_map`)

- **New optional field `course.studentMap: true`** (grid courses only) lets the student's code
  set its own map with **`turtle.course_map("""…""")`**, before the vehicle's first move. Same
  legend and limits as an authored grid map (one start, at least one goal, at most 30 × 30);
  blank lines at the ends and shared indentation are fine. The authored `map` is still required:
  it shows until the student sets one.
- Mistakes stop the run with plain messages ("Your map needs a G for the goal.", "Your map has
  two starts (>): keep just one.", "Call course_map() before the rover moves: …"). On a task
  without `studentMap`, `course_map()` says the map is set for you.
- The student's map shows as soon as it's in the code (before a Run and in slow-mo), and after a
  Run the picture, the course checks (`course_goal_reached`, `course_no_crash`,
  `course_pickups`, `course_max_moves`), the tutor views, Go Live and screen-reader words all use
  the map the run drove. With `maps`, code that sets its own map runs once, on that map.
- **Map editor:** a 🧱 **Map editor** button beside Run on `studentMap` tasks opens a
  tap-to-paint grid (Wall, Road, Goal, Star, Start; 44 px squares; 3 to 30 rows and columns)
  that writes the `turtle.course_map("""…""")` call into the student's code.
- Validation: `studentMap` must be `true` or `false` and errors on a track. Add a `code` check
  for `course_map(` if students must make their own.
- **Line hints are no longer read inside Python triple-quoted strings** (Python and Turtle), so a
  starter maze row such as `#>....G#` stays in the code instead of being taken out as a `#>`
  hint. The same goes for `#@peek` and `#@lock` lines inside a `"""…"""` string. See [turtle.md](turtle.md#students-make-their-own-map-studentmap) and
  [validation-errors.md](validation-errors.md).
- Affects: turtle (course mode; new field `course.studentMap`, new `turtle.course_map()`) ·
  Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-15-p6-16-turtle-course-student-made-maps.md

### Code Arrange runs on Turtle (course mode too) and on the Python Stage

- **`type: code_arrange` with `moduleType: turtle`** is new. The tile board sits where the editor
  would, in the Turtle workspace, so Run plays the program exactly as on a code task: the canvas,
  animation and Skip, slow-mo if the task turns it on, the name-tag panel and course mode (maps,
  sensors, crashes, map tabs). `turtle_*` and `course_*` checks work as on a code task, and so do
  `course`, `slowMo`, `showVariables`, `layout` and `setupCode`.
- **A Python arrangement whose code imports `stage`** (`from stage import *` on a fixed line or in
  a blank), or that has a `stageTarget`, gets the Stage pane from the start, the `stageTarget`
  ghost and Differences, and the `stage_*` checks, as a code task does.
- On smaller screens both use the Picture · Tags · Console tabs. Tiles, distractors, tile
  feedback, the tutor's board (now with the student's last picture or Stage under it), Edit
  answers, tile highlights and the report's attempts are unchanged. A plain Python or HTML
  arrangement looks as before.
- **Indent mode** (`arrangeMode: indent`) works for both too: `moduleType: turtle` is now allowed
  there.
- Validation: the module message is now "must use the Python, Python Turtle or HTML module" (and
  "the Python or Python Turtle module" for indent mode); the Turtle module's own rules (course
  map, Turtle checks) run on a Turtle arrangement. The Builder's Arrange form offers **Python
  Turtle** under Language and its preview draws the run; it doesn't edit `course`, `slowMo` or
  `showVariables` yet, so author those in YAML. See [turtle.md](turtle.md#code-arrange-code_arrange),
  [python.md](python.md#drag-and-drop-runnable-code-code_arrange) and
  [lesson-schema.md](lesson-schema.md#code-arrange-task-fields).
- Affects: code_arrange, turtle, python (Stage) · Existing lessons: no changes needed (Turtle
  `fill_blank` stand-ins can become runnable arrangements) · Resolves:
  authoring-requests/2026-10-15-p6-15-code-arrange-on-turtle-course-and-stage-tasks.md

### Python and Turtle screen space: one tabbed result pane on smaller screens (`layout.firstPane`)

- **Tablets, 1366 × 768 Chromebooks and small laptops** now show the editor on the left and one
  result pane on the right with tabs **Picture · Tags · Console**. Portrait screens and phones put
  the editor above the tabs. Wide desktops keep everything side by side, as before. Only the tabs
  a task has appear: Picture once the code imports `stage` (or has a `stageTarget`; always on
  Turtle), Tags with `showVariables`. A Python task with just a console has no tabs.
- **What the task is about is in view.** Predict and target tasks open on Tags, so the code and
  the empty tags show together while the student types, and the workspace shrinks above a
  tablet's on-screen keyboard. A `stageTarget` task opens on the Picture with its ghost. After
  Run the pane switches to the Picture if the program drew (or there is a target or course), to
  Tags in predict / target mode, otherwise to the Console. A run that fails before drawing shows
  the Console.
- **Slow-mo** (and predict / target mode once there is a picture) shows the Picture and Tags
  together in one tab, one above the other.
- **The Console is always one tap away:** while hidden, its tab counts the new lines or shows
  **!** for an error. Switching tabs never loses a drawing, a playing turtle or the output.
- Accessibility: the tabs are a proper tab list (arrow keys, Home, End), each pane is a labelled
  region, tabs are 44 px tall, and a screen reader hears what changed after Run. Go Live and
  screen share follow the same rules, with tabs large enough for a projector.
- **New optional field `layout: { firstPane: picture | tags | console }`** on Python and Turtle
  tasks picks the tab selected when the task opens (and opens a Python task's result side from
  the start). Most tasks don't need it. Validation rejects an unknown pane, warns about unknown
  keys or `tags` without `showVariables`, and warns when another module's task has `layout`.
  See [python.md](python.md#screen-layout-layout), [turtle.md](turtle.md#screen-layout) and the
  new rows in [validation-errors.md](validation-errors.md#screen-layout-layout).
- Affects: python, turtle (workspace layout; new task field `layout`) · Existing lessons: no change
  needed · Resolves:
  authoring-requests/2026-10-15-p6-12-python-screen-space-console-stage-and-panel.md

### Turtle course mode: drive a vehicle round a maze or track (`course`)

- **New Turtle task field `course`.** The turtle becomes a vehicle the student drives round a map
  with ordinary Turtle Python: `{ type: grid | track, vehicle, map | maps }`. It is a mode of the
  `turtle` module, not a game: Run plays the moves; there are no keys or game loop.
- **Grid** (`type: grid`): a text map, `#` wall, `.` road, `G` goal, `*` pickup, `>` `<` `^` `v`
  start and heading (space: off the map; at most 30 × 30). `forward()` with no number moves one
  square and `forward(3)` three; `left()` / `right()` turn 90°; part squares, other angles and
  `goto` / `home` / `reset` / `circle` stop with a plain message.
- **Track** (`type: track`): turtle coordinates, `start: { x, y, heading }`, `goal: { x, y, r }`
  or `{ rect: [x1, y1, x2, y2] }`, `walls` (lines `[x1, y1, x2, y2]` and boxes `{ rect }`),
  `pickups: [[x, y]]` and an optional `trackCode` snippet whose drawn lines are walls (read, not
  run: a fixed Turtle subset with `for … in range()` loops). The vehicle is a circle 10 units
  across from centre to edge; the picture's edge is a wall.
- **Sensors** on `turtle`: `wall_ahead()`, `wall_left()`, `wall_right()` (the next square; 30
  units on a track), `at_goal()`, `on_pickup()`, `collected()`. Pickups are collected by driving
  over them. Driving into a wall bumps, marks the crash and ends the program with a plain message
  ("The rover hit a wall at row 2, column 5."), counted as a finished run, not an error. A run
  stops after 1,000 moves or 20,000 sensor checks on a map. The pen is down by default (a faint
  trail).
- **Vehicles:** `turtle` (default), `car`, `rover`, `boat`, `drone`, drawn top-down.
- **`maps`** (up to 6): the code runs once per map; Run plays them in turn with a tick or cross
  per map. A real Python error on one map leaves the later ones not run.
- **New checks** (every map): `course_goal_reached`, `course_no_crash`, `course_pickups` (`min`,
  default all) and `course_max_moves` (`max`; every forward, backward, goto, turn and circle is
  one move). They need a run (`lessons test-checks` reports them as needing one). The Builder
  offers them on a course task with a kid-friendly hint. Mix with `code` / `turtle_command_used`
  checks for the method.
- Validation covers the course shape (one start, at least one goal, legend, track fields,
  `trackCode`, course checks only on a course task); it can't run code, so check a solution in
  the Builder preview, which runs every map. New rows in
  [validation-errors.md](validation-errors.md). The tutor card shows "Reached goal", "Crashed" or
  "2/3 maps"; the session report adds per-task `course: { runs, goalReached, goalRuns, crashes,
  pickups, lastGoalReached }`. See [turtle.md](turtle.md#course-mode-course).
- Affects: turtle (`course`, course checks, sensors, session report) · Existing lessons: none (a
  new optional field; `forward()` and `left()` without a number still need one outside course
  mode) · Resolves: authoring-requests/2026-10-15-p6-11-turtle-course-mode-drive-a-vehicle-round-a-maze.md

### Stage shapes: size-first calls, centre anchors, rotation, polygons, see-through, outlines, `hue()`

- **The Stage's call order changed (breaking).** Calls are now size first, with everything else
  optional: `circle(r, colour, x, y)`, `square(size, colour, x, y)` (new), `rect(w, h, colour, x,
  y)`, `polygon(sides, size, colour, x, y)` (new; `size` is centre to corner, one corner up),
  `text(words, colour, x, y, size=16)`. `line(x1, y1, x2, y2, colour, width=2)` and `stamp(emoji,
  x, y, size=32)` keep their order; `grid(rows, palette, cell, x, y)` keeps its order but `x, y`
  are now its centre. The old position-first order is replaced outright (no lesson used it): a
  call like `circle(200, 200, 50)` stops with "circle(): the second value is the colour, like
  'red'. To place it, write x=200, y=200, like circle(50, x=200, y=200)".
- **Centre anchors everywhere.** `x` and `y` are always the middle of the shape, text, emoji or
  grid, and default to the middle of the stage (200, 200). `(0, 0)` is still top-left and `y`
  still goes down. Unlike Arcade Kit, where a rectangle is placed by its top-left corner.
- **Default colours:** royal blue (`#4169e1`) for shapes, black for text and lines.
- **New keywords** on `circle`, `square`, `rect` and `polygon`: `angle=` (degrees **clockwise**
  around the centre: the opposite way to Turtle's `left()`), `opacity=` (0–1; see-through shapes
  blend), `outline=` (colour), `width=` (outline width, default 2), and `colour=None` for an
  outline only. `text` and `stamp` take `angle=` and `opacity=`; `line` takes `opacity=`.
  `color=` works as well as `colour=`.
- **New `hue(n, light=50)`** returns a hex colour round the colour wheel (`hue(0)` red,
  `hue(120)` green, `hue(240)` blue, wrapping every 360); `light` 0–100 makes it darker or paler.
  `stage_colour_used` can check it by its hex code.
- **Checks:** `stage_shape_count`'s `kind` adds `square` and `polygon`, and a new `sides` field
  (with `kind: polygon`) counts only the polygons with that many sides. `stage_matches_target`,
  `stage_pixel` and the Differences view compare turned, see-through and outlined shapes as drawn.
  `stage_colour_used` also finds outline colours.
- The Stage's screen-reader description says how shapes are turned, faded and outlined ("a red
  square, size 80, turned 45°, in the middle"). Scrubbing gives `angle=` 0–360, `opacity=` 0–1,
  `light=` 0–100 and numbers inside `hue()` 0–360; `outline=` colours get the colour picker.
  See [python.md](python.md#stage-drawing-beside-the-console) and the new rows in
  [validation-errors.md](validation-errors.md).
- Affects: python (Stage, stageTarget, stage checks, scrub) · Existing lessons: rewrite any Stage
  code (starter, complete, `stageTarget`) in the size-first, centred order · Resolves:
  authoring-requests/2026-10-15-p6-9-stage-shapes-rotation-polygons-size-first-calls.md

### Name-tag panel: lists and dicts you can see (`showVariables.visuals`, `stageLists`)

- The name-tag panel now draws lists and dicts as what they hold, chosen automatically: a list of
  colours as swatches (index and text on each), a list of numbers as labelled bars, a 2D list of
  colours as a small picture with a row/column ruler, other 2D lists as a table, a dict as cards
  (with a swatch for colour values) and a dict of numbers as labelled bars. Anything mixed or
  ambiguous stays as today's tiles. The exact Python value is one tap away (**Show value**).
- New optional `showVariables` fields: `visuals` (default `true`; `false` keeps plain tags for the
  whole task) and `stageLists: picture | tiles | size` (default `size`), how a list passed to the
  Stage's `grid()` in this run shows — just its size, a picture as well, or rows of tiles. Palette
  numbers draw as a picture only in a drawn list with `stageLists: picture`.
- Target mode draws list and dict targets with the same visuals; predict mode shows the real
  value's visual next to the ✓ / ✗. After a re-run (and in slow-mo) the item that changed is
  marked, not only the tag. The tutor's card shows small thumbnails; StudentModal and Go Live show
  the visuals. The panel now reads about 1,000 values per variable (a 32 × 32 picture).
- Validation checks both fields ([validation-errors.md](validation-errors.md#name-tag-panel-showvariables)).
  See [python.md](python.md#name-tag-panel-showvariables).
- Affects: python, turtle · Existing lessons: no changes needed (add `visuals: false` where a
  list of words could be mistaken for colours) · Resolves:
  authoring-requests/2026-10-15-p6-7-name-tag-panel-lists-and-dicts-you-can-see.md

### Turtle: animated drawing, real drawing order, `pensize()` and `dot()`

- **Run now plays the drawing**: the 🐢 moves, turns and draws at the `speed()` in the code. With
  no `speed()` call it plays at speed 10 pace, squeezed to finish within about 4 seconds;
  `speed(1–10)` (or `"slowest"`, `"slow"`, `"normal"`, `"fast"`) plays at real turtle pace;
  `speed(0)` / `"fastest"` is instant. A **Skip** button jumps to the end, and the check result
  shows once the drawing finishes or is skipped. Under reduced motion the drawing appears at once
  with a **Play** button. Slow-mo still takes over when it's on, scrubbing still redraws
  instantly, and Go Live plays the presenter's drawing on every screen. See
  [turtle.md](turtle.md#speed-and-animation).
- **Drawing order is now the order the code ran** (was fixed layers: fills, lines, stamps, text),
  so later shapes cover earlier ones. A filled shape's own outline stays on top of its own fill.
  See [turtle.md](turtle.md#drawing-order). No live lesson used Turtle (checked 2026-10-15).
- New commands: `pensize(width)` / `width(width)` (no argument reads it back) and
  `dot(size=None, colour=None)`, as in real turtle.
- `turtle_command_used` accepts `command: pensize` (`width()` records as `pensize`) and
  `command: dot`. No other new checks.
- The picture has a screen-reader description of the drawing.
- Affects: turtle · Existing lessons: no changes needed (drawings that relied on fills sitting
  under later lines may now look different; add `turtle.speed(0)` to keep a drawing instant) ·
  Resolves: authoring-requests/2026-10-15-p6-10-turtle-animated-drawing-drawing-order-pensize-dot.md

### Locked lines, hidden setup and puzzle rules (`#@lock`, `setupCode`, `puzzle`, `max_lines`)

- **Locked lines:** a `#@lock` marker line locks the next non-blank line of Python or Turtle code.
  Students see it greyed with a 🔒 Locked tag and can't type in it, delete it, cut, paste over or
  re-indent it, but can add lines before, between and after locked lines. Locks follow their line
  through saving, support stages and Reset, and show in the tutor's views and Go Live.
- **Hidden setup:** `setupCode` runs first on every Run, in the same program, and is never shown;
  its variables show in the name-tag panel and the checks see them. `setupNote` is one short line
  above the editor. Students never see a setup traceback ("This task's setup has a problem — tell
  your tutor."), and their line numbers are unchanged.
- **Puzzle rules:** `puzzle: { onlyEdit: [lineNums], maxLines, par }`. `onlyEdit` locks every
  other non-blank starter line; `maxLines` shows a live "3 / 4 lines" counter; `par` is shown
  after a pass ("Solved at par ⭐") and never decides it. The new `max_lines` check (Python,
  Turtle; no run needed) passes at or under `puzzle.maxLines` lines of code (non-blank,
  non-comment; locked lines count, setup doesn't), with the default hint "Can you do it in 4
  lines? A loop might help."
- Validation: `setupCode`'s brackets, quotes and indentation (it can't run Python, so preview
  the task once), the complete code meets `maxLines` (error) and `par` (warning), `onlyEdit` lines
  are in the starter, and a warning when the complete code drops a locked line or re-indents it
  ([validation-errors.md](validation-errors.md#hidden-setup-locked-lines-and-puzzles)). The session
  report adds `linesUsed` and `changesFromStarter` per student on puzzle tasks; the tutor's card
  shows "Solved at par" or "Over line limit". See
  [python.md](python.md#locked-lines-hidden-setup-and-puzzles) and
  [turtle.md](turtle.md#locked-lines-hidden-setup-and-puzzles).
- Affects: python, turtle, cli (validate, test-checks, capabilities) · Existing lessons: no
  changes needed · Resolves:
  authoring-requests/2026-10-15-p6-8-locked-lines-hidden-setup-and-puzzle-rules.md

## 2026-10-14

### Live number and colour scrubbing in the code editor (`scrub`)

- New optional task field `scrub: { enabled, numbers, colours, ranges: [{ line, min, max }] }` on
  Python, Turtle and HTML tasks (`scrub: true` is short for `{ enabled: true }`). Students drag a
  number (or tap it for a slider; Alt+Enter from the keyboard) and click a colour for a picker
  (colour-blind-safe colours first, then names, then hex). Whole numbers stay whole, decimals step
  by their last place, CSS units are kept, and a colour is written back as a name or hex to match.
- While a value moves, Turtle, Python programs that draw on the Stage, and HTML/CSS re-run live as
  a preview (no attempt, checks, save or tutor update). Programs that call `input()`, and Python
  without the Stage, show "Press Run to see it". When the drag ends the value is one normal edit.
  Arcade has no scrubbing. See [python.md](python.md#live-scrubbing-scrub),
  [turtle.md](turtle.md#live-scrubbing-scrub) and [html.md](html.md#live-scrubbing-scrub).
- The session report adds `scrubs`, `scrubNumbers` and `scrubColours` per student task, and
  `scrubUsedCount` per task ([session-reports.md](session-reports.md)). Validation checks the
  field's shape and ranges ([validation-errors.md](validation-errors.md#live-scrubbing-scrub)).
- Affects: python, turtle, html, cli (capabilities, validate) · Existing lessons: no changes needed
  (add `scrub: { enabled: true }` to Modify tasks) · Resolves:
  authoring-requests/2026-10-14-p6-4-live-number-and-colour-scrubbing-in-the-editor.md

### Python and Turtle slow-mo: step through a run line by line

- New optional Python and Turtle task field `slowMo: { enabled: true, speed?, showVariables?,
  question? }` adds **Slow-mo**, **Pause**, **Step**, **Step back** and **Restart** above the
  code, plus a speed slider. It is off unless `enabled: true`. `speed` is the starting lines a
  second (default 1; the slider goes 0.25–4), `showVariables: true` shows name tags step by step,
  and `question` shows while paused. See [python.md](python.md#slow-mo-slowmo) and
  [turtle.md](turtle.md#slow-mo).
- The run is recorded first, then played back: the line that just ran is highlighted, each loop
  header shows "pass 3 of 4" (when the code writes the count) or "pass 3", changed name tags
  pulse once with earlier values struck through, output grows line by line, and the Stage and
  Turtle drawing build up step by step. `input()` is asked while recording; the answers appear at
  the right step. Recordings stop at 2,000 steps ("Slow-mo stops after 2,000 steps. Is there a
  loop that never ends?"), and that run counts as stopped.
- No new checks. The recorded run is the run, so checks and the attempt log behave exactly as for
  Run (the result shows when playback reaches the last line). Editing the code ends slow-mo.
- Go Live: the presenter's recording and step go to every screen. The session report's
  `slowMoUsed`, `slowMoRuns`, `slowMoSteps` and `slowMoUsedCount` now cover Python and Turtle too
  ([session-reports.md](session-reports.md)).
- Validation: errors for a malformed `slowMo` or wrong-typed keys; warnings for an out-of-range
  speed, a question over 200 characters, unknown keys and a missing `enabled`. Pair slow-mo with a
  prediction or a single question: step-through alone doesn't teach.
- Also: Python Export work now saves the Stage drawing as a PNG, and a share link shows it.
- Affects: python, turtle, cli (capabilities) · Existing lessons: no changes needed (add `slowMo`
  where students should trace a loop or a reassignment) · Resolves:
  authoring-requests/2026-10-14-p6-3-python-slow-mo-step-through-runs.md

### Keyboard typing history across lessons (`showHistory`)

- Every finished Keyboard `type_text`, `type_code` and `falling_words` result is now kept across
  lessons for students the tutor has matched to the class list (no lesson field needed): date,
  lesson, mode, characters and words a minute, accuracy, corrections, time (and the falling-words
  score). Unmatched students, and sessions with no class, keep nothing.
- New optional Keyboard field `showHistory: true` (task-level on the three typing modes; per item
  on `type_text` / `type_code`) shows the student "Last time: 62 cpm, 91% · Best: 75 cpm" beside
  each item and, when they finish faster than their first lesson, "You went from 40 to 75
  characters a minute." Hidden until the student has an earlier score. See
  [keyboard.md](activities/keyboard.md#typing-history-showhistory).
- Tutors see last / best on the student card and a Typing history list in the StudentModal; the
  session report adds `tasks[].typingHistory` (`{ mode, cpm, accuracy, previousCpm,
  previousAccuracy, bestCpm, firstCpm }`, anonymised;
  [session-reports.md](session-reports.md#typing-history)).
- Validation: an error for a non-boolean `showHistory`, a warning when it is set on a mode that
  keeps no history ([validation-errors.md](validation-errors.md)).
- Affects: keyboard activity, cli (capabilities) · Existing lessons: no changes needed (add
  `showHistory: true` to timed challenges) · Resolves:
  authoring-requests/2026-10-14-typing-history-speed-and-accuracy-across-lessons-on-the-stud.md

### Carry a student's own work from an earlier lesson (two-lesson projects)

- New optional task fields `carryCodeFromLesson` (Python, Turtle, HTML) and
  `carryBlocksFromLesson` (Scratch), each `{ lesson, task }`: the **stock** lesson id (never a
  class fork's) and that lesson's task id. The task starts from each student's own saved work
  on that task (HTML: each `starterFiles` file by name). See
  [Two-lesson projects](AUTHORING_GUIDE.md#two-lesson-projects-carry-from-an-earlier-lesson).
- The work comes from the class roster, through the tutor's screen. A student the tutor hasn't
  matched yet waits ("Waiting for your tutor to find your Lesson 11 work…") until they are
  matched or the tutor chooses **Use the starter**. Nothing saved, "No class", solo study, the
  presentation window and the Builder preview use the task's starter, so keep a sensible
  `starterCode` / `starterFiles` / `starterBlocks`. A student with their own saved work for the
  task keeps it.
- Validation errors: the wrong module's field, a field on a non-code task, anything but
  `{ lesson, task }`, naming the same lesson, or combining it with `carryCodeFrom` /
  `carryBlocksFrom` on the same task. `lessons publish` warns (doesn't fail) when the named
  lesson or task isn't found or saves a different kind of work
  ([validation-errors.md](validation-errors.md)). Builder: Task options → **Carry from an
  earlier lesson**. `lessons capabilities` lists each module's `crossLessonCarryField`.
- Session reports add a per-student `crossLessonCarry` (`found` / `none` / `starter` /
  `no_class`) and the task's `crossLessonCarryCounts`
  ([session-reports.md](session-reports.md)).
- Affects: python, turtle, html, scratch, cli · Existing lessons: no changes needed (Lesson 12's
  Build Reference starter workaround can move to `carryCodeFromLesson`, keeping the starter as
  the fallback) · Resolves:
  authoring-requests/2026-10-14-carry-a-student-s-own-code-from-one-lesson-into-the-next-two.md

### Scratch test-checks: student-variation cases and Support stages

- `lessons test-checks --cases` now takes Scratch cases: whole `blocks`, or a `stage` (a stage id
  or a role) plus `edits` (`appendBlock`, `replaceOpcode`, `setField`, `removeBlock`), with
  `expect: { completion, blocking?, feedback? }`. Each completion and feedback check is reported
  as pass / fail / skipped (needs a run) against the expectation, mismatches are listed, and
  `stillBuilding` says whether the variant counts as still building in class (its
  `after_block_placed` fails held back). A cases file may also be a flat `cases:` list whose
  entries name their `task`. See
  [scratch.md](scratch.md#testing-student-variations).
- Without `--cases`, Support-role code stages with `blocks` are now checked too
  (`support:<label>`), and a Support stage that passes completion is a warning (exit status 1).
- Affects: scratch, cli · Existing lessons: no changes needed (a Support stage that passes
  completion now warns in `test-checks`) · Resolves:
  authoring-requests/2026-10-14-scratch-test-checks-student-variation-cases-and-support-stag.md

### Scratch slow-mo: block glow, Step and a state timeline

- New optional Scratch task field `slowMo: { enabled: true, speed?, timeline? }` adds four big
  buttons under the stage: **Slow-mo**, **Pause**, **Step** (one block) and **Restart**, plus a
  speed slider. It is off unless `enabled: true`. `speed` is the starting blocks per second
  (default 1; the slider goes 0.25–4). `timeline` lists what each timeline card shows, any of
  `costume`, `backdrop`, `x`, `y`, `variables` (default: all five; `[]` hides the strip). See
  [scratch.md](scratch.md#slow-mo).
- The running block glows in each running script, and the stage redraws after every block, so
  "two quick switches" visibly shows both costumes. With several scripts, Step lets one block
  through at a time, the scripts taking turns (round-robin). Under reduced motion the glow is a
  still outline.
- The timeline records one labelled card per step. Students swipe through it and tap a card to
  see the stage at that moment.
- No new checks. A slow-mo run is a green-flag run, so existing checks (`run_attempted`,
  after-run checks at the end of the run) and the "still building" rule work as before. You no
  longer need wait blocks just to show each state.
- In Go Live, the tutor's controls drive the glow, stage and step the class sees. The session
  report adds `slowMoUsed`, `slowMoRuns` and `slowMoSteps` per student and `slowMoUsedCount` per
  task ([session-reports.md](session-reports.md)).
- Validation: errors for a malformed `slowMo`; warnings for an out-of-range speed, unknown
  timeline fields or keys, and a missing `enabled` ([validation-errors.md](validation-errors.md)).
- Affects: scratch, cli · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-14-p6-6-scratch-slow-mo-block-glow-step-and-state-timeline.md

### Python Stage: a drawing pane beside the console (prototype)

- Python tasks can draw: `from stage import *` gives `background`, `rect`, `circle`, `line`,
  `text`, `stamp`, `grid` (a 2D list as a pixel grid, values indexing `palette` or being colours)
  and `clear`. A fixed 400 × 400 stage, **top-left origin, y down**. Colours are CSS names, hex
  codes or the PICO-8 names Arcade Kit uses (CSS wins where a name is both). The pane appears
  once the code draws, beside the console (above it on narrow screens); `print()` is unchanged.
  Bad arguments stop the run with a plain-English error on the student's line naming the
  argument. See [python.md](python.md#stage-drawing-beside-the-console).
- New optional Python task field `stageTarget: { code, ghost? }`: Python that draws the target
  picture. Students get a faint ghost to draw over (Target toggle) and, after Run, a Differences
  toggle that highlights where their drawing differs and says it in words.
- New checks (Python, need a run, so `lessons test-checks` reports them as needing one):
  `stage_matches_target` (`tolerance`, needs `stageTarget`), `stage_shape_count` (`kind`, `min`,
  `max`), `stage_colour_used` (`colour`), `stage_pixel` (`x`/`y` or `row`/`col`, `colour`) and
  `stage_text_shown` (`text`, `operator`). Write their hints with colours in words.
- `from module import *` at the top level of a Python task now works (it used to be a
  SyntaxError, because the program runs inside a function). Turtle tasks are unchanged.
- The tutor sees each Run's drawing on the student card and in StudentModal, and Go Live
  broadcasts it. Validation covers `stageTarget` and every stage check field
  ([validation-errors.md](validation-errors.md)).
- Affects: python, cli · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-14-p6-2-python-stage-drawing-pane-beside-the-console.md

### HTML Inspector: box model, "Why this …?" and flex/grid overlays

- New optional HTML task field `inspector: { enabled: true, open?, focus?, show? }` adds an
  **Inspect** button to the preview. Off unless `enabled: true`. `open: true` starts in inspect
  mode; `focus` (a CSS selector) pre-selects an element; `show` picks the panel sections, any of
  `box`, `cascade`, `layout` (default: all three). See [html.md](html.md#html-inspector).
- Students point at (or tap) part of the page to see labelled margin, border, padding and content
  bands with px sizes. The panel explains the cascade in plain words (less specific, earlier in
  the file, overridden by !important, inherited from …), and draws flex axes, gaps and grid
  lines. No new checks: the Inspector never changes the page, so `html_*` checks are unchanged.
- The tutor's inspect state syncs in Go Live, and the session report adds a per-student
  `inspector` (`{ used, opens, selects }`) and the summary's `inspectorUsedCount`
  ([session-reports.md](session-reports.md)).
- Validation: errors for a malformed `inspector`, warnings for unknown keys, a missing
  `enabled: true`, a submit-mode task, or `inspector` on a non-HTML task
  ([validation-errors.md](validation-errors.md)).
- Affects: html, cli · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-14-p6-5-html-inspector-box-model-cascade-and-layout-overlays.md

### Feedback checks match when their check passes (docs fix)

- **Docs fix, no behaviour change.** A `feedbackChecks` entry matches when its check **passes**,
  so it must describe the mistake. The python.md Code Structure example used `not_nested_in` for
  "Move `print(total)` out of the loop", which fired on correct code; it now uses `nested_in`.
  The lesson-schema.md Indent mode example used `directly_nested_in` for a "line it up" hint (now
  `not_nested_in`) and wrapped the entry in `check: {...}`, a shape that is silently dropped; it
  is now a plain check with `hint` alongside. python.md Feedback Checks states the rule.
- **Check your lessons:** a `code_structure` feedback check copied from the old examples fires
  the wrong way round. Invert its operator, and unwrap any `- check: {...}` feedback entry. Confirm
  with `test-checks` (`matchedFeedback`).
- Affects: python, code_arrange · Existing lessons: invert `code_structure` feedback checks copied
  from the old examples; unwrap `- check:` feedback entries · Resolves:
  authoring-requests/2026-10-14-python-md-not-nested-in-feedbackchecks-example-has-its-hint-.md

### `taskActivity` patterns: Which Construct Fits? and Poll

- `Quiz: Which Construct Fits?` (`quiz_which_construct_fits`) and `Quiz, Poll` (`quiz_poll`) are
  now recognised patterns, so they no longer warn "not a recognised pattern". See the table in
  [badges.md](badges.md).
- Affects: all · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-14-taskactivity-patterns-which-construct-fits-and-quiz-poll.md

### Scratch: no fail while still building; starting backdrop; sprite library fits the screen

- **Still building.** A failing `after_block_placed` check no longer shows a fail or hint, or logs
  an attempt, while the blocks are unchanged since the task opened (starter or carried blocks,
  ignoring block ids and positions) or while a non-hat block sits loose on the canvas. `on_idle`
  feedback is held back the same way. Passes are never held back. Run and Check are unchanged. See
  [scratch.md](scratch.md#scratch-check-types) ("Still building").
- **`backdrops[].current: true`** sets the backdrop the Stage starts on (and returns to on Reset
  Stage). Without it the first backdrop is used, as before. Validation warns when more than one
  backdrop is `current` and errors when it isn't a boolean. The Builder's backdrop list has a
  **Start** choice. See [scratch.md](scratch.md#backdrop-object).
- **Sprite and backdrop library pickers** now open over the page, sized to the screen, so every
  item can be reached on small laptops, tablets and zoomed browsers. Nothing to author.
- Affects: scratch · Existing lessons: no changes needed; a lesson that reordered `backdrops` to
  get the right starting scene can restore its order and mark the scene `current: true` ·
  Resolves: authoring-requests/2026-10-14-scratch-don-t-mark-work-wrong-while-the-workspace-is-unchang.md,
  authoring-requests/2026-10-14-scratch-sprite-library-student-can-t-scroll-to-the-bottom-in.md,
  authoring-requests/2026-10-14-scratch-task-choose-which-backdrop-the-stage-starts-on.md

### Tutors can see side-quests and the students on them

- A **🗺️ Side-quests** panel under the task in the teacher's view lists the current task's
  side-quests (title, kind, explainer, starter code), each with **On it now**, **Done** and
  **Probably stuck** counts. Probably stuck: on it, and the last 2 Runs in a row hit an error,
  or no Run for 5 minutes. Clicking a count lists those students. Clicking a student, or the
  🗺️ chip on their card, opens their StudentModal on a read-only **Side-quest** view (status,
  code, output, drawing or preview), with a Main task / Side-quest switch.
- Side-quest code now reaches the tutor: on every Run, and live while the tutor has that
  student open. This reverses the 2026-10-09 "status only" note. It is still never saved as the
  task's work and never feeds `carryCodeFrom`. No new lesson fields and no report changes.
- Authoring tip: the tutor reads each side-quest's `explainer` in the panel to help, so keep it
  clear about what "done" looks like. See [AUTHORING_GUIDE.md](AUTHORING_GUIDE.md#side-quests).
- Affects: python, turtle, html (sideQuests) · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-14-tutor-view-of-side-quests-what-each-task-offers-and-how-each.md

### "See an example" button for worked examples in explainers

- **New Markdown fence, ` ```example `.** It renders a button in the explainer; the button
  opens the example in a wide pop-up (a full-width sheet on phones), so the code no longer wraps
  in the narrow panel. First line: `example`, an optional language (`python`, `html`, `css`,
  `js`, `scratch`, `text`) and an optional `label="…"` (the button text, default "See an
  example"). Lines before a `---` line are the intro (Markdown); the rest is the code:

  ````
  ```example python label="See an example"
  Here's the same Check → Do → Otherwise shape with different weather.
  ---
  weather = "sunny"
  if weather == "rainy":
      print("Grab your wellies!")
  else:
      print("Sunglasses on!")
  ```
  ````

  It works in any Markdown field (top-level only, not in a list or blockquote), including the
  Builder preview and topic cards. There is **no `example` task field**: the request suggested
  one, but a fence keeps it where it's read, can sit anywhere in the explainer and allows more
  than one. The guides v35 workaround (leaving the worked example out) can now be undone.
- **Tutor and report.** When a student opens one in a task's explainer in a live lesson, the
  tutor's card shows 🔍 and the student modal "🔍 Opened example". The session report adds
  `exampleOpens` per student task (first open, time after the task started, number of opens) and
  `exampleOpenStudentCount` per task. See
  [markdown-renderer.md](markdown-renderer.md#worked-examples-see-an-example) and
  [session-reports.md](session-reports.md).
- **Validation warnings** for an example with no code, an unknown language, stray words on the
  first line (often an unquoted label), no closing fence, or more than 10 in one explainer. See
  [validation-errors.md](validation-errors.md).
- Affects: markdown, all · Existing lessons: no changes needed (optionally put worked examples
  back into Challenge explainers as ` ```example ` fences) · Resolves:
  authoring-requests/2026-10-14-see-example-button-in-explainers-that-opens-a-worked-example.md

### Keyboard: `type_code` and `falling_words` modes

- **`mode: type_code`** types whole blocks of real code. Each item has a multi-line `code`
  (≤ 1000 characters, ≤ 30 lines, a YAML `|` block is easiest). Task fields: `language`
  (`python`, the default, or `html`: syntax colouring and the Tab width), `minAccuracy` (default
  `0.9` here) and an optional `targetCpm` (characters a minute; speed is always shown, checked only
  when set). Every typed character is marked right or wrong, newlines and indentation included.
  Enter types a newline with no auto-indent; at the start of a line Tab counts as 4 spaces
  (Python) or 2 (HTML), so Tab and spaces are both right. Needs a real keyboard (no on-screen
  keyboard). See [activities/keyboard.md](activities/keyboard.md#typing-code-type_code).
- **`mode: falling_words`** is a timed warm-up: `words` (code tokens with symbols and spaces are
  fine, ≤ 20 characters each, ≤ 100 words) fall and typing one exactly clears it. Points only, no
  lives; the round always runs for `durationSeconds` (15–300, default 60) and then completes.
  The task has **no `items`**. Respects reduced motion and pauses when the tab is hidden. Needs a
  real keyboard. See [activities/keyboard.md](activities/keyboard.md#falling-words-falling_words).
- **Results for typing history.** `type_text`, `type_code` and `falling_words` results all record
  `mode`, `accuracy`, `cpm`, `wpm`, `corrections`, `timeMs` and `done` (falling words adds
  `cleared`, `missed`, `score`); `type_text` gains `mode`, `cpm`, `corrections` and `timeMs`
  alongside its existing fields. Tutor cards read `2/3 done · 94% · 71 cpm` and `falling: 23
  cleared · 4 missed · 250 pts`. New validation messages are in
  [validation-errors.md](validation-errors.md) (Keyboard).
- Affects: keyboard · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-14-keyboard-type-code-mode-type-a-multi-line-block-of-real-code.md,
  authoring-requests/2026-10-14-keyboard-falling-words-mode-with-code-tokens.md

### Highlight a control: task `highlight` and the tutor's live Highlight menu

- **New optional task field `highlight`** (code tasks): pulses a ring around one control on each
  student's screen when the task opens, once per task, until they use it or for 20 seconds (a
  still outline with reduced motion). Write `highlight: green_flag` or
  `highlight: { target: green_flag }`. Targets: `run` and `stop` on Python, Turtle, Arcade and
  Electronics (one shared Run/Stop button), `run` on HTML, and on Scratch `green_flag` (or
  `run`), `stop`, `costumes_tab`, `sounds_tab` and `category:<name>` (`Motion`, `Looks`, `Sound`,
  `Events`, `Control`, `Sensing`, `Operators`, `Variables`, `My Blocks`; the palette scrolls to
  it). A control on a hidden tab pulses that tab instead.
- **Validation:** an unknown target for the task's own module (a composed lesson's `moduleType`)
  is an error, as is `highlight` on a quiz, information or activity task or on Filesystem or
  Desktop. `costumes_tab` / `sounds_tab` warn without `showCostumesTab` / `showSoundsTab`. The
  Builder sets it under Task options → "Highlight a control"; `lessons capabilities` lists each
  module's `highlightTargets`.
- **Live:** tutors can pulse the same controls for the whole class ("Highlight Class" in the top
  bar) or one student (More → Highlight in the student modal). Nothing to author.
- See [scratch.md](scratch.md#highlighting-a-control) and [lesson-schema.md](lesson-schema.md).
- Affects: python, turtle, html, arcade, electronics, scratch · Existing lessons: no changes
  needed · Resolves:
  authoring-requests/2026-10-14-highlight-a-scratch-ui-control-green-flag-stop-tabs-for-the-.md

### Name-tag panel: show what is in the variables (`showVariables`, `#@peek`, `variables_predicted`)

- **New task field `showVariables`** on Python and Turtle tasks, off unless set:
  `{ mode: view | predict | target, at: end | marker, hide: [names], predict: [names], target: { name: value } }`.
  The panel draws one name tag per variable (name, type label `text` / `number` / `true/false` /
  `list` / `dict` / `None`, value; text keeps its quotes; list tiles with indexes; dict rows;
  **Show all** for long values; "changed" marks on a second Run). Modules, functions, classes,
  dunder names, names imported from `turtle` and `hide` names are never shown.
  - `view`: the values after Run. `predict`: students type what each `predict` variable will
    hold **before** running; Run marks each ✓ / ✗. `target`: target tags turn green with ✓ when
    the variable matches (display only — keep the `variable_*` checks for completion); a name not
    made yet reads "not made yet".
  - `at: marker` stops at a **`#@peek`** marker line: put `#@peek` on its own line just above the
    line to stop at. It is stripped like a `#>` line hint and follows its line through student
    edits; the panel shows the variables the first time the program is about to run that line,
    or the end of the run (with a note) when the line never runs.
- **New check `variables_predicted`** (`names` optional; default every `predict` name): passes
  when every prediction matches the value shown after Run, compared forgivingly by the value's
  type — text with or without quotes (capitals count), `5` = `5.0` but `"5"` ≠ `5`,
  `true`/`True`, lists and dicts written as Python. Predict mode only; validation rejects it
  elsewhere. `lessons test-checks` reports it as needing a run.
- **Variables after an error.** Python variables are now read at the end of a run even when it
  stops with an error (they were empty before). Completion still fails on an error; only feedback
  checks can notice.
- **Tutor and reports.** The tutor card shows a 🏷️ chip (predictions typed / right, targets
  hit) and StudentModal shows the student's panel, predictions included as they type; Go Live
  shows the presenter's panel. Session reports add `predictions` per student task (first and
  latest revealed predictions, each right or not) and `predictionStudentCount`,
  `predictionFirstAllCorrectCount`, `predictionFirstByName` per task. The Builder has a
  **Name-tag panel** section. See [python.md](python.md#name-tag-panel-showvariables),
  [turtle.md](turtle.md#name-tag-panel-showvariables) and
  [session-reports.md](session-reports.md).
- Affects: python, turtle · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-14-p6-1-name-tag-panel-show-what-is-in-the-variables.md

## 2026-10-09

### Confidence checks are 1–10; tutors see unsubmitted short answers

- **Confidence 1–10 everywhere.** Every `quizType: confidence` task now shows ten buttons, red (1,
  👎) to green (10, 👍); one tap still submits. This includes lessons already published: there is
  nothing to change and no opt-in. There is **no `scale` field**: writing one gives the
  validation warning "… confidence checks always use 1 to 10, so scale is ignored". The tutor's
  card reads "N/10" and a **Class confidence** strip above the student grid counts how many
  chose each number. Session reports add `ratingScale: 10` (task summary and student task) and
  `ratingDistribution` has keys 1–10; a report without `ratingScale` is from before this change
  and was rated 1–5. See [quiz-tasks.md](quiz-tasks.md#confidence).
- **Live answer drafts.** In a live lesson the tutor sees what a student is typing into a short
  answer (open or checked) or the gaps of a typed fill-in-the-gaps before they submit: "✏️
  Typing, not submitted" on the card and in full in StudentModal. See-only. Drafts are never
  attempts, checks, `showResponses` entries or badge signals. The session report adds `lastDraft`
  for a student who never submitted. Nothing to author. See
  [quiz-tasks.md](quiz-tasks.md#live-drafts-what-the-tutor-sees-before-submit).
- Affects: quiz_confidence, quiz_short_answer, quiz_fill_blank · Existing lessons: no changes
  needed · Resolves: authoring-requests/2026-10-09-confidence-check-1-to-10-scale.md,
  authoring-requests/2026-10-09-tutor-sees-short-answer-text-as-the-student-types.md

### Session reports: tutor tile highlights (`tutorTileHighlights`)

- A tutor can now tap a tile (or an empty blank) on a student's Code Arrange, Match or Fill in the
  Gaps (drag mode) board in the student modal to outline it as "look again" on the student's
  screen, with an optional note. No new lesson fields; nothing to author.
- Session reports add `tutorTileHighlights[]` per student task: `{ targetId, tileId, note?, at }`
  (the blank or Match prompt, the tile in it, the tutor's note). Not attempts; completion is
  unchanged. Read many on one task as a sign the tiles or distractors confused students. See
  [session-reports.md](session-reports.md).
- Affects: code_arrange, quiz_match, quiz_fill_blank · Existing lessons: no changes needed ·
  Resolves: authoring-requests/2026-10-09-tutor-highlights-a-wrong-tile-in-arrange-and-drag-and-drop.md

### New live badges 📖 Word Smith and 🤩 Emoji Artist; suggestions name their task

- 📖 Word Smith (`word_smith`) is suggested when a student is right **first time** on every vocab
  task they have tried, and on at least `wordSmithMinTasks` (new `badgeOptions` key, default 2) of
  them. A vocab task is any **graded** quiz tagged `taskActivity: Quiz: Vocabulary Check` or
  `Quiz: Vocabulary Match`, whatever its `quizType`; one vocab task wrong first time rules the
  student out for the session. Tag vocab quizzes with one of those patterns for them to count.
- 🤩 Emoji Artist (`emoji_artist`) is suggested the first time a student runs Python (or Turtle,
  Electronics) code with an emoji inside a string, or HTML with an emoji in its text or an
  attribute. Comments never count. No lesson fields; it works in tasks and sandboxes.
- Every badge suggestion in the tutor's panel now names its task (the title, "Sandbox" or
  "No task"), so a badge's reason no longer needs to quote the task title for the tutor to see it.
  See [badges.md](badges.md).
- Affects: badges, quiz_match, quiz_multiple_choice, quiz_fill_blank, quiz_short_answer, python,
  turtle, electronics, html · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-09-badge-suggestions-always-show-the-task.md,
  authoring-requests/2026-10-09-vocab-and-emoji-live-badges.md

### Side-quests for students who finish while the class waits (`sideQuests`)

- New optional field `sideQuests` on Python, Turtle and HTML code tasks: up to 3 side-quests, each
  `{ title, kind, explainer, starter }`. `title` (≤ 60 characters) is required; `kind` is
  `challenge` (default), `debug` or `predict` and only picks the label and icon; `explainer` is
  Markdown; `starter` is the side-quest's own starting code (HTML: its `index.html`).
- Unchecked: no checks run, and the student marks each one done themselves. They unlock once the
  task's own check passes (so the task needs a `check`): live only while the class is still on
  that task, solo after a pass. Each runs in its own scratch editor and never changes the task's
  code or what `carryCodeFrom` copies into the next task. When the teacher moves on, the
  side-quest closes.
- Use them on tasks the class waits on (always Copy the Code; later tasks once the concept is
  taught). Practise the task's concept or an earlier skill, never the next task's content.
- The teacher sees "🗺️ on side-quest n/m" on the card; the session report adds `sideQuests[]` per
  student task and `sideQuestStudentCount` / `sideQuestDoneCount` per task. New suggested badge
  🗺️ Side Quester (`side_quester`) after `sideQuesterMinDone` (new `badgeOptions` key, default 2)
  side-quests marked done. On Scratch (and other modules) `sideQuests` is a validation warning and
  ignored. Builder: Task options → **Side-quests**. See
  [AUTHORING_GUIDE.md](AUTHORING_GUIDE.md#side-quests).
- Affects: python, turtle, html, badges · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-09-side-quests-for-students-who-finish-a-code-task-while-the-cl.md

### Session reports: class task timeline, typing measures and time-on-task spread

- New top-level `taskTimeline: [{ taskId, startedAt }]`: every time the teacher moved the class
  onto a task, oldest first, **information tasks included** (consecutive repeats collapsed, a
  return to an earlier task adds an entry). Section times, skipped tasks (a jump) and the task the
  class was on at any minute can now be read from the report. Teacher-sandbox time sits inside
  the task the class left (see `teacherSandbox.visits`).
- New per-student `typing` on Python, Turtle and HTML code tasks (keyboard devices only):
  `{ charsTyped, activeTypingMs, charsPerMin, corrections, longestPauseMs, autocompleteAccepts,
  copyDistance? }`. Pastes and autocomplete never count as typed; a gap over 5 s ends a typing
  burst; `charsPerMin` is null under 5 s of typing; `copyDistance` (copyCode tasks only) is the
  edit distance from the copyCode at the student's first Run, ignoring trailing whitespace.
- Task summary adds `typingSummary` (`charsPerMin { medianPerMin, minPerMin, maxPerMin,
  studentCount }`, `correctionsMedian`) and, on graded tasks, `timeOnTaskSpread` (`medianMs`,
  `p90Ms`, `maxMs`, `studentCount`). Report only: nothing new on the teacher's live card.
- Reports from before 2026-10-09 lack all of these; each is omitted when empty. Field reference:
  [session-reports.md](session-reports.md) "taskTimeline" and "Typing".
- Affects: all (session reports), python, turtle, html · Existing lessons: no changes needed ·
  Resolves:
  authoring-requests/2026-10-09-session-report-timeline-of-the-class-s-current-task-includin.md,
  authoring-requests/2026-10-09-session-report-per-student-typing-rate-corrections-and-copy-.md

### Code Arrange tile feedback (`distractors[].hint`, `wrongTiles`, `alsoAccepts`)

- New optional fields flag a tile the moment it is dropped into a blank where it is known to be
  wrong: the blank turns red and the hint shows under the line (no hover; works on touch). A
  distractor in any blank shows its `hint` (default "This piece doesn't belong in this
  program."); a tile in a blank's `wrongTiles: [{tileId, hint}]` shows that hint;
  `alsoAccepts: [tileId]` is never flagged in that blank. A `tileId` is a blank's id (its own
  tile) or a distractor's id. Nothing is ever marked right, and anything not listed is left to the
  run, so other valid arrangements still pass.
- Opt-in per task: a task with none of the three fields flags nothing. Completion is unchanged
  (Run against `check`; Run stays available whatever is flagged).
- Session reports: each flagged drop is a `tileMisses[]` entry per student task (not an attempt),
  summarised per task; every Code Arrange attempt now records its `placements` (blank id -> tile
  id) beside the submission. The new fields and `distractors` are sealed with `lines`.
- Validation warns when a `wrongTiles`/`alsoAccepts` id isn't in the task's pool, or a tile is in
  both lists for one blank. The Builder has a hint box per distractor and a **Tile feedback** list
  per blank. See [lesson-schema.md](lesson-schema.md) "Tile feedback" and
  [session-reports.md](session-reports.md).
- Affects: code_arrange, python, html · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-09-tile-level-feedback-for-code-arrange-flag-known-wrong-tile-p.md

### Text checks need an `operator`

- A text-comparing check (`output`, `code`, `answer`, element value, file content, …) written
  with a `value` but no `operator` used to fail every time, even on matching output, while
  `lessons validate` and the Builder accepted it. Validation now rejects it (`Task … has a check of type
  output with no operator …`), and publishing is blocked until it has one.
- Already published lessons with such a check now compare with `contains` instead of always
  failing. The Builder's check editor shows `contains` for them and writes `operator: contains`
  into the task when it's opened, so the stored check matches what the author sees.
- Affects: python, html, turtle, arcade, electronics, filesystem, desktop, code_arrange, quiz ·
  Existing lessons: no changes needed (a sweep of all 79 published lessons on 2026-10-09 found no
  check without an operator; re-validate local YAML sources to catch any) · Resolves:
  authoring-requests/2026-10-09-output-check-with-no-operator-never-passes-and-validation-does.md,
  authoring-requests/2026-10-09-builder-check-editor-shows-contains-when-the-check-has-no-op.md

### Code Arrange indent mode (`arrangeMode: indent`)

- New Python mode for `code_arrange`: the lines are fixed in order and the student only sets how
  far each one is indented (drag it sideways, its ← → buttons, or ← → on the keyboard). Run
  assembles the program at the chosen depths (4 spaces per step) and runs it through the normal
  pipeline, so `check`, `feedbackChecks` and `code_structure` work as for any arrange task.
- Lines are `{ id, code, depth, start?, locked? }`: `code` has no leading spaces, `depth` (0–4) is
  always the correct depth, `start` is where a line begins (default 0) for "fix the indent" tasks,
  and `locked: true` fixes a line at its depth. No `parts`, `distractors` or HTML in this mode.
- Coloured block brackets as in the Python editor (`showBlocks: false` hides them). The teacher's
  card shows "2/5 lines moved". The Builder's Arrange composer has an **Arrange mode** choice;
  switching keeps the program. See [lesson-schema.md](lesson-schema.md) "Indent mode".
- Affects: code_arrange, python · Existing lessons: no changes needed · Resolves:
  authoring-requests/2026-10-08-indent-mode-for-code-arrange-lines-fixed-in-order-student-se.md

## 2026-10-08

### Block brackets in the Python editor (`showBlocks`)

- The Python editor (also in Turtle, Arcade Kit and Electronics MicroPython tasks) now draws a
  coloured bracket beside the lines each `:` line controls, and colours that colon to match. The
  colour follows the header's depth, so `elif`/`else` share their `if`'s colour, and the bracket
  sits at the indent itself, so depth doesn't rely on colour alone. A header whose body isn't
  indented gets no bracket.
- On by default. Students and tutors can hide them with the editor's **Blocks** button
  (remembered on that device). New optional task field `showBlocks: false` hides the brackets and
  the button for that task; the Builder's **Block brackets** checkbox sets it. Non-boolean
  values fail validation. See [python.md](python.md).
- Affects: python, turtle, arcade, electronics · Existing lessons: no changes needed (brackets
  appear automatically; add `showBlocks: false` only where a task should go without them) ·
  Resolves: authoring-requests/2026-10-08-show-indentation-depth-in-the-python-editor-indent-guides-or.md

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
  `node cli/cli.mjs assets upload-sound scratch <file>` and `node cli/cli.mjs assets set-default-sounds scratch
  [file]` (`assets` is a top-level command; corrected 2026-10-16). `node cli/cli.mjs assets list-type scratch` now returns `defaultSounds` alongside `defaultSprites` / `defaultBackdrops` (`[]` when none), so check it before asking for a new sound file.
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
  still works; `lessons get <id> --format yaml` and `lessons json-to-yaml` now write the shorthand (there is no `lessons export`; corrected 2026-10-16). An `activityType` this version doesn't
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
