# Locked lines, hidden setup and puzzle rules in the code editor

- **Status:** planned
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, filed straight to LaunchPad Dev at Ryan's request, bypassing pipeline-ui, as with builds 1–6), 2026-10-15
- **Lessons blocked:** none yet. Wave 1b of Lesson Gen's LG-P6 Visual learning plan (v5). Used by all three pilot lessons. Build this on top of `integrate/requests-2026-10-14` (builds 1–6) rather than waiting for them to merge, and merge when ready (Ryan, 2026-10-15).

## Need

Three problems, one request (Ryan asked for them together):

1. **Time.** Lessons are planned to 40 minutes, with an 18-minute cap on the core before the Project, and classes reach the Project late. Students spend lesson time typing data (lists, pixel pictures, setup) that isn't the concept. Ryan: "I don't want them typing lists, I want them using for loops."
2. **Focus.** A task should be able to say "this line is given, don't touch it". Today a student can delete or break the line the task depends on.
3. **Puzzles.** Ryan wants Brilliant-style puzzle tasks: "only change line 3", "do it in 6 lines", a par.

**Closest existing capability:** Code Arrange's indent mode has locked lines (`docs/authoring/python.md`, Drag-and-Drop Runnable Code), and Electronics has `locked` parts. The code editor itself has nothing. `copyCode` is a separate read-only panel, not part of the program.

## Example task

```yaml
# Locked line: visible, greyed, can't be edited; students add lines around it
- id: 31
  moduleType: python
  title: Recolour the picture
  codeStages:
    - role: starter
      code: |
        from stage import *
        #@lock
        pixels = [["red", "red", "white"], ["white", "red", "red"]]
        # Change every "red" to "blue" here

        #@lock
        grid(pixels)

# Hidden setup: runs before the student's code, in the same program, never shown
- id: 32
  moduleType: python
  title: Add three songs
  setupCode: |
    playlist = ["Intro", "Theme"]
  showVariables: { mode: view }
  codeStages:
    - role: starter
      code: |
        # playlist already exists. Add three songs to it.

# Puzzle rules
- id: 33
  moduleType: turtle
  title: Draw the star in 4 lines
  puzzle:
    onlyEdit: [2]         # optional: lock every line except these (starter line numbers)
    maxLines: 4           # optional: at most this many lines of code (blank and comment lines don't count)
    par: 1                # optional: lines changed or added compared with the starter
  check:
    - type: max_lines     # new: passes when the code is within puzzle.maxLines
```

The marker names (`#@lock`, `setupCode`, `puzzle`) are suggestions. Fit them to your marker scheme (`#>` hints, `#@peek`).

## Behaviour wanted

**Locked lines**
- A locked line is shown greyed, with a 🔒 and the word "Locked". It can't be typed in, deleted, cut or pasted over.
- Students **can** add new lines before, between and after locked lines. Ryan's case: the list is made on a locked line, and students add to it below.
- Locks follow their line as students add lines, like `#>` hints and `#@peek`.
- Reset puts the starter back with its locks.
- Indentation: a student can't change a locked line's indentation. Validation warns if a locked line would need re-indenting for the solution to work.
- `codeStages` support/complete stages and the tutor's views show which lines are locked.

**Hidden setup**
- `setupCode` runs first, in the same program and namespace, every time the student runs. It's never shown in the editor.
- Its variables **show in the name-tag panel** (build 1 hides imports and functions only; setup variables are not hidden).
- Its errors are the author's fault: validation runs it once, and the student never sees a setup traceback.
- Checks see the whole program's state (setup plus student code).
- A short line above the editor says what setup made, if the author gives one: `setupNote: "playlist already exists"`.
- Should also work with `carryCodeFrom`: the carried code is the student's, the setup is not.

**Puzzle rules**
- `onlyEdit` locks every other starter line (a shortcut for many `#@lock` markers).
- `maxLines` shows a live counter ("3 / 4 lines"). The `max_lines` check fails over the limit, with a hint: "Can you do it in 4 lines? A loop might help."
- `par` is **never** pass/fail. After the task passes, show "Solved in 2 changes (par 1)", or "Solved at par ⭐" when matched. It's a nudge for students who finish early.
- Every puzzle must be solvable within its rules: validation checks that the complete code meets `maxLines` and `par`.

## Checks wanted

- **Outcome:** `max_lines` (new) passes when non-blank, non-comment lines are at most `puzzle.maxLines`. Locked lines count; setup code doesn't.
- **Method:** locks are enforced by the editor, so no check is needed for them.

## Devices

- **Tablets:** tapping a locked line shows "This line is locked" briefly. The on-screen keyboard never opens on a locked line. The line counter and par note are at least 44 px where they're tappable.
- **Laptops and Chromebooks:** the cursor skips locked lines with the arrow keys; typing on one does nothing and shows the same note.

## Notes

- **Courses:** Python and Turtle now. HTML/CSS later (not needed for the pilot).
- **Accessibility:** screen readers announce "locked" on a locked line; the counter is a live region; ⭐ always comes with words.
- **Report:** per student per task, `linesUsed` and `changesFromStarter` at the passing run, so Lesson Gen can measure puzzles.
- **Teacher:** the student card shows "Solved at par" or "Over line limit"; Go Live shows the presenter's locks.
- **Copy the Code** tasks are unchanged by this.
- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Visual learning.md`, v5 decisions: both lock kinds, chosen per task; puzzles in the same request.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
