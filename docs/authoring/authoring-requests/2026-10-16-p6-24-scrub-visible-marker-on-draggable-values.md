# Live scrubbing: draggable values carry a visible marker without hovering

- **Status:** shipped
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, filed straight to LaunchPad Dev at Ryan's request, as with builds 1–21), 2026-10-16
- **Lessons blocked:** none. Improves the LG-P6 pilot, Python Level 1 Lesson 8 (Draft `caakmdqj5j`, taught Tue 20 Oct), tasks 21 and 37, and every scrub task.

## Need

Ryan (2026-10-16): "I do think the draggy things need a visual way to show they are there and different, without hovering over them." Today a number "underlines when the pointer is over it" on a computer, and on a tablet nothing shows until it's tapped (`docs/authoring/python.md`, Live scrubbing). A student who doesn't hover over the right number never finds out it can be dragged. The explainer has to say "drag the 200" to make up for it.

**Closest existing capability:** the hover underline (desktop) and tap-to-slider (tablet). Colour strings already show a small swatch at all times.

## What's wanted

- When `scrub` is on, every scrubbable number carries an **always-visible marker**, for example a dotted underline, a light pill background or a small ↔ handle. It must be visibly different from ordinary code, and shown on desktop and tablet with no hover or tap.
- The marker stays **calm**: no animation, and quiet enough not to distract while typing. It could strengthen on hover or focus as today.
- **Not colour alone:** the shape or pattern carries it, so it reads for colour-blind students and on a projector.
- It would be good to share the visual language with p6-22's editable values, so "you can change this" looks the same everywhere.
- Ranged numbers (`ranges`) could show their range on hover or focus.

## Example task

Task 21 "Slide the Sentence": the `200` and `24` in `text(sentence, "navy", y=200, size=24)` are visibly marked as draggable from the moment the task opens.

## Checks wanted

- None new.

## Devices

- Tablets: the marker is the cue to tap. It needs to be big enough to see at arm's length.

## Notes

- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Lesson plan - Python L1 Lesson 8 poster.md`.

## Resolution

Shipped 2026-10-16 on `feature/p6-19-21-name-tag-links-scrub` (not yet on `main`). Every scrubbable number now carries an always-visible marker: a light box with a dashed outline (shape, not only colour; no animation), on desktop and touch, strengthened on hover as before. It is the one shared "you can change this" style (`src/shared/editableValueStyle.js`) also used by `#@lock-values` values (P6-22), and is deliberately unlike the linked name-tag marks (P6-19: solid coloured underline and a number). Ranges on hover were not added. Docs: [python.md](../python.md#live-scrubbing-scrub), turtle.md, FEATURES, CHANGELOG.
