# Live scrubbing: redraw programs that use input(), replaying the last Run's answers

- **Status:** open
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, filed straight to LaunchPad Dev at Ryan's request, as with builds 1–18), 2026-10-16
- **Lessons blocked:** none. Improves the LG-P6 pilot, Python Level 1 Lesson 8 (Draft `caakmdqj5j`, taught Tue 20 Oct), task 37 ("Make the Poster Yours"), and any Make It Your Own on an `input()` build.

## Need

Ryan's click-through (2026-10-16): "Task 37 could use number dragger thingys." Task 37 is the Make It Your Own on the student's finished Escape poster. That program asks three `input()` questions (hero, place, colour) and then draws on the Stage. Today any program that calls `input()` can't preview live: a drag shows "Press Run to see it" (`docs/authoring/python.md`, Live scrubbing). So the one task where students most want to nudge sizes and positions is the one where dragging doesn't redraw.

**Closest existing capability:** `scrub` with a normal Run (answer the questions again after every change).

## What's wanted

- For a program that calls `input()`, live previews **replay the answers the student gave on their last Run**, in order, so the preview redraws as they drag.
- If there's been no Run yet, or the preview asks more questions than were answered last time, fall back to today's "Press Run to see it" (say why: "Press Run and answer the questions first").
- Previews stay check-free, as now (see p6-20 for checks when the drag ends).
- The answers used are shown somewhere small ("Using your last answers: Ada, Mars, teal"), so a student isn't confused that no questions appeared.

## Example task

```yaml
- id: 37
  moduleType: python
  title: Make the Poster Yours
  scrub: { enabled: true }
  allowSharing: true
  codeStages:
    - role: starter
      code: |
        from stage import *

        name = input("Who is the hero? ")
        place = input("Where is it set? ")
        colour = input("Poster colour? ")

        background(colour)
        title = f"{name} Escapes from {place}"
        text(title, "white", y=160, size=26)
        tagline = f"Only {name} can save {place}!"
        text(tagline, "gold", y=230, size=18)
        stamp("🎬", y=310, size=48)
```

After one Run (Ada, Mars, teal), dragging `size=26` redraws the poster live with those answers.

## Checks wanted

- None new.

## Devices

- Tablets: as for scrubbing today.

## Notes

- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Lesson plan - Python L1 Lesson 8 poster.md`. Until this ships, the pilot's task 37 has scrub on with "drag, then press Run".
