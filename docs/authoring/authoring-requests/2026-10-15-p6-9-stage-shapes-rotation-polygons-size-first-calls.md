# Stage shapes: rotation, polygons, see-through colours, outlines, hue(), and size-first calls

- **Status:** planned
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, filed straight to LaunchPad Dev at Ryan's request, bypassing pipeline-ui, as with builds 1–6), 2026-10-15
- **Lessons blocked:** none yet. Wave 1b of Lesson Gen's LG-P6 Visual learning plan (v5). Used by pilot lesson A (a `for` loop lesson). Build this on top of `integrate/requests-2026-10-14` (builds 1–6) rather than waiting for them to merge, and merge when ready (Ryan, 2026-10-15): this changes the Stage (`2026-10-14-p6-2-…`).

## Need

Ryan: "code that draws shapes with size, colour and rotation (great for looping!). Stage is nearly there for that." The aim is three lines that make something amazing, where the loop is visible in the picture:

```python
from stage import *
for i in range(40):
    square(i * 8, angle=i * 9, colour=hue(i * 9))
```

That should draw a spinning rainbow tunnel. Drag `9` with scrubbing and the whole picture changes.

The shipped Stage has `rect`, `circle`, `line`, `text`, `stamp` and `grid`. It has no rotation, polygons, see-through colours, outlines or easy colour cycling. And every call starts with a position (`rect(x, y, w, h, colour)`), so a beginner can't just write `circle(50)`.

**Closest existing capability:** the Stage in `docs/authoring/python.md` (Stage, Stage checks, Target picture).

## What's wanted

**1. Size first, everything else optional.** The simplest call is just the size; colour, position and the rest are added as students grow.

```python
circle(50)                         # a circle of radius 50 in the middle
circle(50, "red")
square(80, angle=45)               # a diamond in the middle
rect(120, 60, "gold")
polygon(6, 60, colour="teal")      # a hexagon, 60 from centre to corner
circle(50, "red", x=100, y=80)
```

| Call | Draws |
|---|---|
| `circle(r, colour, x, y, …)` | a circle of radius `r` |
| `square(size, colour, x, y, …)` | a square |
| `rect(w, h, colour, x, y, …)` | a rectangle |
| `polygon(sides, size, colour, x, y, …)` | a regular polygon, `size` from centre to corner, one corner pointing up at `angle=0` |
| `line(x1, y1, x2, y2, colour, width=2)` | unchanged |
| `text(words, colour, x, y, size=16, …)` | text, centred on `x, y` |
| `stamp(emoji, x, y, size=32, …)` | unchanged order; `angle` added |
| `grid(rows, palette, cell, x, y)` | unchanged, but `x, y` become the centre (default: the middle) |

- **Centre anchors everywhere (Ryan's decision).** `x` and `y` are always the shape's centre and default to the middle of the Stage (200, 200). `(0, 0)` stays top-left and y still goes down. This differs from Arcade Kit, where a rectangle is placed by its top-left corner; Lesson Gen's guides will say so.
- **This replaces the shipped position-first order.** Builds 1–6 aren't on `main` yet and no lesson uses the Stage, so please change it outright rather than keeping both. Do update `stageTarget` examples and docs.
- **A default colour** for when none is given, documented, and visible on white.
- **Plain-English errors for the old order.** For example, `circle(200, 200, 50)` would make `200` the colour, so explain it: "circle(): the second value is the colour, like 'red'. To place it, write x=200, y=200."

**2. Keywords on every shape:**

| Keyword | Meaning |
|---|---|
| `angle=` | rotation in degrees, clockwise (screen convention, y down), around the shape's centre |
| `opacity=` | 0 (invisible) to 1 (solid, default); see-through shapes blend with what's under them |
| `outline=` | outline colour |
| `width=` | outline width (default 2 when `outline` is given) |
| `colour=None` | no fill, so an outline-only shape |

Turtle turns anticlockwise with `left()`; the Stage's clockwise `angle` follows the screen and CSS instead. Please note this in the docs; Lesson Gen will note it in the guides.

**3. `hue(n)` returns a colour** round the colour wheel: `hue(0)` red, `hue(120)` green, `hue(240)` blue, wrapping every 360. Optional `light=` (0–100) for paler or darker shades. It returns a hex string, so `print(hue(30))` makes sense and `stage_colour_used` can check it.

## Checks wanted

- `stage_shape_count`'s `kind` gains `square` and `polygon` (and `sides` as an optional filter).
- `stage_matches_target` compares rotated and see-through shapes as drawn.
- **Method:** `code` checks are enough (e.g. `angle=` used).

## Devices

- Same as the Stage today.
- Scrubbing works on `angle`, `opacity` and the numbers inside `hue()`; colour scrubbing works on `outline=`.

## Notes

- **Slow-mo** draws them step by step, as now.
- **Accessibility:** the Stage's text description includes angle, opacity and outline ("a red square, size 80, turned 45°, in the middle").
- **Performance:** a 40-shape tunnel with opacity must redraw fast enough for scrubbing's 200 ms preview.
- **Not wanted:** animation or a game loop. Ryan: that would be "basically just replacing Arcade".
- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Visual learning.md`, v5 decisions.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
