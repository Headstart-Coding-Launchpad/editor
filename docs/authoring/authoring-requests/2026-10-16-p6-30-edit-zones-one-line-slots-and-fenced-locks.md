# Edit zones: one-line slots, and locks that nothing can go before or after

- **Status:** shipped
- **Kind:** module
- **Requested by:** Lesson Gen agent, from Ryan's review of the third LG-P6 pilot plan, 2026-10-16
- **Lessons blocked:** none. It would help the third LG-P6 pilot, Python Level 3B Lesson 8 ("Robot Builder", not yet built), and any task where the student should change or write one specific line.

## Need

Ryan (2026-10-16): "We want the ability to have just one line added by students. The ability to say this is locked, nothing before or nothing after. If we can factor this in we can hit a few birds with one stone."

Today `#@lock` and `#@lock-values` stop a line being edited, but students "can add new lines before, between and after locked lines" (`docs/authoring/python.md`, Locked lines). `puzzle.onlyEdit` locks every other line, but "students can still add lines". So there's no way to say any of these:
- **"Write exactly one line, here."** For example, the headline line in Python L1 L8's task 22, the one update line in a dictionary task, or the one fix in a Debug task. Students add extra lines, or type in the wrong place, and the checks have to guess.
- **"Nothing goes after this line."** In 3B L8 the student's code ends with a locked `draw(robot)`, drawn by a function in hidden `setupCode`. A part typed below it runs after the robot is drawn, so it never appears. The same goes for `grid(pixels)` at the end of a pixel task (`Plans/LG-P6 Working rules.md`, rule 5: "lock the line that uses the student's work").
- **"Nothing goes before this line."** For example, `from stage import *` or a locked data line at the top. Code typed above it breaks the program, or runs before the data exists.

**Closest existing capability:** `#@lock`, `#@lock-values`, `puzzle.onlyEdit` and `puzzle.maxLines`. Today's lesson fallback is a `#>` hint, plus a feedback check that spots a line in the wrong place.

## What's wanted

**1. Fenced locks.** Two markers that lock the next line like `#@lock` and also fence one side of it:
- `#@lock-last`: nothing can be added **after** it. Enter at its end, a paste, Undo, Reset or carried code that would put a line below it puts that line above it instead.
- `#@lock-first`: nothing can be added **before** it. New lines go below it instead.
- Trying to type on the fenced side shows a short message in words ("This line stays last. Add your code above it."), read out to screen readers.
- At most one of each per task. Validation warns if the complete code has lines on the fenced side.

**2. One-line slots.**
- `#@slot` marks the next line, usually an empty one, as a place the student types **exactly one line**.
- Enter in a slot doesn't make a new line. A multi-line paste is refused with "This space takes one line".
- A slot keeps its indentation, so a slot inside a loop body stays inside the loop.
- A slot can start empty (with a `#>` hint beside it, saying what to write) or hold a line to change.
- Several slots per task are fine. `#@slot 2` could allow a small block of up to 2 lines, if that's cheap.

**3. A task-level "no new lines" switch.**
- `puzzle.noNewLines: true` means students can't add a line anywhere. They can only edit the editable lines and slots.
- Together with slots, that gives a task where everything is fixed except the one line the student writes.
- `puzzle.onlyEdit` plus `noNewLines` gives "change one line, add nothing". That's the Debug task case.

## Example tasks

```yaml
# 3B L8: the student adds one line; the robot is drawn after it
- title: Give the Robot an Antenna
  moduleType: python
  setupCode: |
    def draw(robot):
        ...
  setupNote: draw() is ready-made. It draws whatever parts are in the robot dictionary.
  puzzle: { noNewLines: true }
  codeStages:
    - role: starter
      code: |
        #@lock-first
        from stage import *
        #@lock
        robot = {"body": "steelblue", "head": "silver"}
        #> Add the antenna here
        #@slot

        #@lock-last
        draw(robot)
```

```yaml
# A Debug task: change one line, add nothing
- title: Fix the Poster
  puzzle: { onlyEdit: [4], noNewLines: true }
```

## Checks wanted

- None new. Optionally, the session report notes how many times a student hit a fence or slot message, so a pilot can see whether the edges confuse anyone.

## Devices and accessibility

- All. On a tablet, the on-screen keyboard's Enter behaves the same way.
- Slot and fence edges have a visible marker, not colour alone (e.g. a "Write one line here" tag on a slot, and a "Nothing below" tag on a last-lock), read out to screen readers.

## Notes

- **Plan:** the 3B L8 curriculum row's Author Instructions (pipeline-ui's curriculum database), and `Lesson Gen Agent/Plans/LG-P6 Visual learning.md`.
- **The same look as the existing locks:** p6-24 and p6-22's dashed "you can change this" box would suit a slot.
- If a hidden `afterCode` (run after the student's code) is simpler than `#@lock-last`, say so. Ryan prefers the visible line, so students see what uses their work.

## Resolution

Shipped 2026-10-16 (Ryan reopened it in the LaunchPad Dev window: "Then do p6-30"). `#@lock-first` / `#@lock-last` (a lock's `fence`), `#@slot` / `#@slot n` (up to 5 lines) and `puzzle.noNewLines`, parsed in `src/shared/lineHints.js`, anchored in `src/shared/lockedLines.js` (`chooseZones`, `anchorSlots`), enforced in the editor by `src/shared/lockedLinesEditor.js` (`zoneEditFilter`): typing, Enter or a paste on a fenced side moves to the open side; a slot can't gain lines or have a line joined onto it; noNewLines refuses new lines outside slots. Notes in words, read out; slot outline + "Write one line here" tag, "Locked · nothing below / above" tags. Validation warns on two of a fence, a fence with no line, and complete code on a fenced side; `puzzle.noNewLines` must be true/false. Not done: the optional session-report count of fence/slot notes. A hidden `afterCode` wasn't needed.
