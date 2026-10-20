# Scrub and editable locked values open only after the task is passed

- **Status:** planned
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-20
- **Lessons blocked:** none yet

## Need

Ryan (2026-10-20, after the Python L1 Lesson 8 pilot): changing the values of locked lines is good, but only once students have completed the task. In caakmdqj5j's first session, students scrubbed colours and sizes instead of doing the step (Student 5: 8 failed attempts on task 26, all scrubs, never added the input() line; Student 3: 5 on task 34; Student 1: 4 on task 21). Each scrub release ran the checks and logged a failed attempt, inflating attempt counts and widening the spread between students. Making it theirs after the pass keeps the engagement (6 of 8 personalised the poster) without the diversion.

Closest existing capability (from `lessons capabilities`): scrub (python.md, Live scrubbing) and #@lock-values (python.md, Locked lines with editable values): both are open from the moment the task loads; there is no option to hold them until the task passes.

Current workaround and why it falls short: Leave scrub and #@lock-values off on tasks whose step isn't a number or colour, which loses the make-it-yours moment on the Project's build steps, the part that drove engagement in the pilot.

## Example task

    - title: Ask for the Hero's Name
      moduleType: python
      scrub: { afterPass: true }      # scrub boxes and #@lock-values stay shut until the task passes
      codeStages:
        - role: starter
          code: |
            #@lock-values
            title = "My Film"
            #> Ask for the hero's name and store it
    

## Checks wanted

Outcome: before the task's first pass, a #@lock-values line is fully locked (no value box, no typing in its values) and no scrub box shows; scrub-sourced attempts can't happen. On the first pass (checks or tutor override) the dashed scrub boxes and editable values appear, with a short "Now make it yours" cue, and stay open after reload/Reset. Tutor card shows the task as passed before any scrub attempts. Method: session report records no source: scrub attempts before the first pass.


## Devices

Same on touch: the value boxes appear after the pass; no change to the touch scrub alternative.

## Notes

Also covers HTML/Turtle scrub if cheap. Suggest default off so existing lessons don't change; LG-P6 lessons would turn it on.

## Resolution

Built 2026-10-20 on `feature/scrub-after-pass` (LaunchPad Dev), not merged yet. `scrub: { afterPass: true }` (off by default) in Python, Turtle and HTML. Before the first pass (checks or the tutor's pass) there are no scrub boxes and `#@lock-values` lines are fully locked. After it, the boxes open with "✨ Now make it yours" and stay open after a reload or Reset Code (remembered per device in a `__scrub_open__` per-task file). Docs: python.md (Live scrubbing), turtle.md, html.md, CHANGELOG 2026-10-20.
