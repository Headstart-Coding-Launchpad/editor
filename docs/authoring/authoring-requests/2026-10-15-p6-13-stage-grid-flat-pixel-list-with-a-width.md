# Stage: grid() draws a flat pixel list wrapped at a width

- **Status:** open
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, filed straight to LaunchPad Dev at Ryan's request, bypassing pipeline-ui, as with builds 1–12), 2026-10-15
- **Lessons blocked:** none yet. Wave 1c of Lesson Gen's LG-P6 Visual learning plan, from Ryan's click-through of the sandbox (`ocgq3appv6`). Build on top of `integrate/requests-2026-10-14`, as with wave 1b.

## Need

In the sandbox, Ryan liked recolouring a pixel picture (task 8) but wants it with a **one-dimensional list**: "easier to explain and play with". His idea: the pixels are a flat list, and a width says where each row wraps, so a 1D list still shows a 2D image. This is also how real images are stored, and it lets students loop over a picture with one plain `for` loop before they meet lists of lists.

**Closest existing capability:** the Stage's `grid(rows, palette, cell, x, y)` (`docs/authoring/python.md`, Stage → Grids). It needs a list of rows. A flat list today has to be wrapped as `grid([pixels])`, which draws one long strip.

## Example task

```yaml
- id: 70
  moduleType: python
  title: Recolour the flag
  showVariables: { mode: view }
  setupCode: |
    pixels = ["red"] * 8 + ["white"] * 8 + ["red"] * 8
  setupNote: "pixels already exists: 24 colours, 8 to a row"
  codeStages:
    - role: starter
      code: |
        from stage import *
        #> Change every "red" in pixels to "blue"

        #@lock
        grid(pixels, width=8)
    - role: complete
      code: |
        from stage import *
        for i in range(len(pixels)):
            if pixels[i] == "red":
                pixels[i] = "blue"
        grid(pixels, width=8)
  check:
    - type: stage_pixel
      index: 0
      colour: blue
      hint: Check every item in pixels, from index 0 to the end.
```

## Behaviour wanted

- **`grid(values, width=8)`:** when `values` is a flat list (no item is a list) and `width` is given, draw it as rows of `width` cells, left to right, top to bottom. The last row may be short.
  - Values follow `grid()`'s existing rules: colour names, hex, `None`/`"none"`, or palette numbers with `palette=`.
  - `cell`, `x`, `y` and the 100 × 100 limit work as now.
- **Plain-English errors:**
  - a flat list with no `width`: "grid(): pixels is one long list. Say how many squares fit in a row, like grid(pixels, width=8)";
  - a `width` that isn't a whole number of 1 or more;
  - `width` given with a list of rows.
- **Name-tag panel:**
  - Shows the flat list as it does today: swatches for colour names, with index numbers, numbers for palette numbers (see `2026-10-15-p6-14-…`).
  - When that list was drawn with `grid(…, width=…)` this run, wrap the panel's tiles at the same width, with the indexes running on (0–7, 8–15, …). Students can then see that index = row × width + column.
- **`stage_pixel`:** add `index` (0 or more) as a third way to pick a cell: the cell at that position in the flat list of the last grid. Count from 0, and say so in the docs table (findings row 11 asked for that on `row`/`col` too).
- **Slow-mo** draws it step by step as now.

## Checks wanted

- **Outcome:** `stage_pixel` with `index`.
- **Method:** `code` checks are enough (e.g. `width=`).

## Devices

- As the Stage today. The wrapped panel tiles stay readable at tablet width, with long lists scrolling inside the tag.

## Notes

- **Ages:** 11–16. A flat list wrapped at a width is how images really work, and gives a good "how does a computer store a picture?" moment.
- **Accessibility:** the Stage description says "a grid of 24 squares, 8 to a row, …"; the panel reads "pixels, item 9 (row 2, column 2): white".
- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Visual learning.md`, wave 1c; findings in `Plans/LG-P6 Sandbox findings.md`.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
