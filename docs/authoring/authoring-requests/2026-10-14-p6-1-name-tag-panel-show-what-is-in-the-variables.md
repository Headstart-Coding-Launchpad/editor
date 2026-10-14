# Name-tag panel: show what is in the variables (Python and Turtle)

- **Status:** shipped
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, sent straight to LaunchPad Dev at Ryan's request, bypassing pipeline-ui), 2026-10-14
- **Lessons blocked:** none yet. This is build 1 of 6 in Lesson Gen's P6 Visual learning plan. Ryan wants these capabilities built before any lessons are rewritten.

## Need

Students can see what a program prints, but not what it is holding. Several recorded misconceptions in Lesson Gen's `Known Misconceptions - Python.md` are about state the student can't see:

- reporting the whole printed line as a variable's value
- `.lower()` or `int()` results that were never stored back
- reading the loop variable as the item's position
- a variable created inside a branch that didn't run

We teach a variable as a **name tag stuck on a value**, so the panel should draw exactly that.

**Closest existing capability:** the `python` module (`docs/authoring/python.md`). Its `variable_exists`, `variable_equals`, `variable_array_equals`, `variable_dict_equals` and related checks already read the student's variables after a run. They never *show* them to the student. Nothing in `lessons capabilities` displays program state.

**Research constraint:** a state display only teaches when the student commits to a prediction or aims at a target first. Live value display alone gave no learning gain (Huang, Lerner et al., SIGCSE 2022). So the panel has three modes, `view`, `predict` and `target`, and is off unless a task turns it on.

**Kind:** this is a feature of the existing `python` workspace (and `turtle`), not a new workspace. Apply your module-vs-activity test. Re-label as `check type` / `activity mode` if that fits better.

## Example task

```yaml
# View: show the variables after Run (or at a marked line)
- id: 12
  moduleType: python
  title: What did input() store?
  showVariables:
    mode: view
    at: end            # or: marker  (stop at the line marked `#@peek`)
    hide: [answer2]    # optional: names not to show
  codeStages:
    - role: starter
      code: |
        name = input("Name? ")
        shout = name.upper()
        print("Hi " + shout)

# Predict: student fills empty name tags BEFORE running; Run reveals tick/cross per tag
- id: 13
  moduleType: python
  title: What's in the variables?
  showVariables:
    mode: predict
    predict: [score, lives]   # tags the student must fill
    at: end
  codeStages:
    - role: starter
      code: |
        score = 5
        lives = 3
        score = score + 5
        lives = lives - 1
  check:
    - type: variables_predicted   # new: every listed prediction matched the real value
      names: [score, lives]

# Target: target tags shown; each turns green when the variable matches after Run
- id: 14
  moduleType: python
  title: Hit the target
  showVariables:
    mode: target
    target:
      score: 10
      lives: 2
      bag: ["key", "map"]
  check:
    - type: variable_equals
      name: score
      value: 10
    - type: variable_equals
      name: lives
      value: 2
    - type: variable_array_equals
      name: bag
      value: ["key", "map"]
```

Display rules:

- **One name tag per variable**, in the order the variables were created. Each tag shows the name, the value, and a small **type label**: `text`, `number`, `true/false`, `list`, `dict` or `None`. Text values show their quotes, so `"5"` and `5` look different.
- **Lists:** a row of tiles with the index under each tile. **Dicts:** key → value rows. Nested values are truncated, with an expand control. Long strings are truncated, with an expand control.
- **Hidden by default:** imported modules, functions, classes and dunder names. The author can hide more with `hide`.
- **Marker:** `#@peek`, or whatever fits your existing marker scheme (e.g. the `#>` hints). It is stripped like other markers, and the panel shows the state the first time execution reaches that line.
- **Changed since last run:** if the student runs again, briefly mark the tags whose values changed.
- **Unknown target name:** in target mode, a target name the student hasn't created yet shows as an empty tag reading "not made yet".

## Checks wanted

- **Outcome, predict mode:** a new `variables_predicted` check passes when every listed prediction equals the real value. Use the same forgiving comparison as typed quiz answers: trim, `5` vs `5.0`, and quotes optional for text, decided by type.
  - The session report should record each prediction and whether it was right. Lesson Gen will measure the pilot from this.
- **Outcome, target mode:** the existing `variable_*` checks stay the source of truth. The panel's green tags are display only.
  - Optionally, `target` could auto-generate the checks if none are authored. Your call.
- **Method:** none.

## Devices

- **Laptops and Macs:** the panel sits beside or under the output.
- **Tablets and narrow screens:** the panel stacks under the output and stays usable with the on-screen keyboard (predict inputs). Touch targets are at least 44 px, matching quiz tasks.
- **Chromebooks:** same as laptops.

## Notes

- **Ages:** 11–16 (Python), in mixed-age classes. Keep it clean and grown-up rather than cartoonish.
- **Accessibility:**
  - Colour is never the only signal: type labels on every tag, plus tick and cross symbols beside green and red.
  - Use a colour-blind-safe palette.
  - The panel has a text alternative a screen reader can read ("score: number 10").
- **Teacher:**
  - The panel state syncs to the teacher's student card.
  - It works in **Go Live**, so Ryan can show the class the panel on screen share while everyone predicts first.
- **Turtle:** please support the `turtle` module too (`showVariables` on turtle tasks).
- **Arcade:** later, not needed now.
- **What comes next:**
  - Build 3, Python slow-mo, reuses this panel: tags update step by step, a tag flashes when its value changes, and old values are shown struck through. Design the panel so that's easy.
  - Lesson Gen will also want a trace-table view later (values per loop pass).
- **Order:** P6 build order is 1 this panel, 2 Stage, 3 Python slow-mo, 4 scrubbing, 5 HTML Inspector, 6 Scratch slow-mo.

## Resolution

Shipped 2026-10-14 (branch `feature/python-variables-panel`) as a feature of the `python` and
`turtle` workspaces, as requested: a task field, a marker and a check, not a new module or
activity.

- **`showVariables`** `{ mode: view | predict | target, at: end | marker, hide, predict, target }`
  on Python and Turtle tasks, exactly as in the example tasks above. Display rules as asked: one
  tag per variable in first-use order, type labels, quoted text, list tiles with indexes, dict
  rows, **Show all** for long or nested values, hidden modules / functions / classes / dunders /
  turtle imports / `hide`, "changed" marks on the next Run, "not made yet" targets.
- **Marker:** `#@peek` on its own line above the line to stop at (it joins the `#>` line-hint
  scheme: stripped at lesson load, re-anchored through student edits). The panel shows the state
  the first time that line is about to run; if it never runs, the end of the run with a note.
- **Check:** `variables_predicted` (`names` optional), forgiving as asked (trim, `5` = `5.0`,
  quotes optional for text, decided by type). One call made: **capitals count for text** (the
  value is the text exactly — `.upper()` / `.lower()` misconceptions need it); True/False/None
  are case-free. Target mode's green tags are display only; checks are **not** auto-generated
  from `target` (authors keep the `variable_*` checks, as the request's example does).
- **Report:** each student task gets `predictions` (first and latest revealed, each right or
  not); the task summary gets `predictionStudentCount`, `predictionFirstAllCorrectCount`,
  `predictionFirstByName`. Measure the pilot from `predictions.firstAllCorrect`.
- **Tutor:** card chip (🏷️ "Predicted 2/3" → "2/3 right", "1/3 on target"), the student's panel
  with live predictions in StudentModal, and Go Live broadcasts the presenter's panel.
- **Devices / a11y:** under the output (Python) or between drawing and output (Turtle), stacks
  on narrow screens, 44 px touch targets, ✓ / ✗ with words, green / amber verdicts, a
  screen-reader text per tag ("score: number 10").
- **For build 3 (slow-mo):** the panel takes a sequence of snapshots plus an index, and the
  worker's capture helpers (`src/modules/python/variableCapture.py.js`: value encoder, frame
  snapshot, a removable `sys.settrace` line watcher on the student's file) are shared.

See [python.md](../python.md#name-tag-panel-showvariables) and the 2026-10-14 CHANGELOG entry.

