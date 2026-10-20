# Click a True or False to flip it (boolean scrub)

- **Status:** planned
- **Built:** 2026-10-20 on branch `feature/scrub-booleans`, not merged yet. Keyboard flip is Alt+Enter, as for numbers and colours: Space and Enter type in the code editor.
- **Kind:** activity mode
- **Requested by:** Lesson Gen agent, from Ryan's look at the LG-P6 pilot Python Level 1 Lesson 10, 2026-10-20 (Ryan approved, filed direct)
- **Lessons blocked:** none. It would help Python Level 1 Lesson 10 (`ufj6g0z9d3`, nested if, taught 20 Oct) and any lesson that switches a Boolean flag.

## Need

Ryan (2026-10-20): "it would be great if we could turn booleans on or off by clicking them like a scrub".

`scrub` lets students drag a number or pick a colour and watch the Stage redraw (`docs/authoring/python.md`, Live scrubbing). But it has `numbers` and `colours` only, so a `True` or `False` still has to be typed. In L1 L10's task 15 (Meaningful Change), the student types `False` over `is_tall_enough = True` to see the ride scene vanish, because the inner check is never reached. The task is about seeing the picture change, and a single click is the natural action for an on/off value.

**Closest existing capability:** `scrub` (`numbers`, `colours`) and `#@lock-values` (typing a value redraws). Today's lesson fallback is typing the word, which works but is slower, and students misspell or lowercase it (`false`, which gives a `NameError`).

## What's wanted

- On a task with `scrub` on, every `True` and `False` in code gets the same dashed "you can change this" box as a draggable number.
- One click or tap flips it (`True` ↔ `False`) and redraws the Stage or drawing, as a drag does today. `checkOnRelease` runs the checks once after the flip.
- A new `scrub.booleans` option beside `numbers` and `colours`, on by default.
- It works on `#@lock-values` lines too, so a locked flag line can still be flipped.
- Only the keywords `True` and `False` count: not words in strings, comments or names like `is_true`.
- Like scrub today, a program that calls `input()` shows "Press Run to see it" rather than a live preview.

## Example task

```yaml
- title: Too Short for the Ride
  moduleType: python
  scrub: { enabled: true }      # booleans on by default
  codeStages:
    - role: starter
      code: |
        from stage import *
        is_tall_enough = True   # click True to flip it
        has_ticket = True
        if is_tall_enough:
            background("skyblue")
            ...
```

## Checks wanted

- None new. A flip counts as an attempt with `source: scrub` and adds to `scrubs` in the session report, like a drag.

## Devices and accessibility

- All. A tap flips it on a tablet.
- Keyboard: the box is focusable, and Space or Enter flips it. A screen reader reads it as "is_tall_enough, True, button, press to change to False".
- The box shows the word, never colour alone.

## Notes

- **Natural uses:** L1 L9's flags, L1 L10's Meaningful Change (15) and Debug (24) tasks, and later `has_key` and `while` flag tasks.
- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Visual learning.md` and `LG-P6 Working rules.md` rule 8 (Scrubbing). Once it ships, Lesson Gen revises L1 L10 task 15 to say "click True" instead of "type False".
