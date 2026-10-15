# Name-tag panel: palette numbers show as numbers, never as the picture

- **Status:** open
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, filed straight to LaunchPad Dev at Ryan's request, bypassing pipeline-ui, as with builds 1–12), 2026-10-15
- **Lessons blocked:** none yet. Wave 1c of Lesson Gen's LG-P6 Visual learning plan, from Ryan's click-through of the sandbox (`ocgq3appv6`, task 9). Changes p6-7 (`2026-10-15-p6-7-name-tag-panel-lists-and-dicts-you-can-see.md`). Build on top of `integrate/requests-2026-10-14`.

## Need

Sandbox task 9 drew an 8 × 8 picture stored as palette numbers (`0`, `1`, `2` with `palette=["white", "black", "gold"]`), with `stageLists: picture`. The panel showed `pixels` as the same coloured picture as the Stage.

Ryan asked why the value view uses the Stage's colours, and chose: **the panel always shows the numbers; the Stage is the only picture.** The panel is where students see the *data*; the Stage is where they see what the data *draws*. Showing the picture in both places hides the point that the list is just numbers.

**Closest existing capability:** p6-7's list and dict visuals (`docs/authoring/python.md`, Name-Tag Panel → List and dict visuals). Today, palette numbers draw as a picture in a list drawn by `grid()` with `stageLists: picture`.

## What's wanted

- **Palette numbers always show as numbers** in the panel, whether or not `grid()` drew them and whatever `stageLists` says:
  - a 2D list of whole numbers is a **table** with row and column indexes;
  - a flat list of whole numbers drawn with `grid(…, width=…)` (`2026-10-15-p6-13-…`) is a row of number tiles wrapped at that width, indexes running on.
- **No tint, no picture** for palette numbers. A plain, readable number table.
- **Colour names and hex are unchanged.** A list of colour names still shows as swatches, and a 2D list of colour names as a small picture (p6-7). `stageLists: picture` keeps working for those.
- **Bars:** a flat list of numbers that `grid()` drew this run shows as tiles, not bars. Bars are for numbers that are amounts.
- **Docs:** update the List and dict visuals table, and the `stageLists` row, to say palette numbers always show as numbers.

## Example task

```yaml
- id: 71
  moduleType: python
  title: The picture is just numbers
  setupCode: |
    pixels = [[0, 1, 1, 0], [1, 2, 2, 1], [0, 1, 1, 0]]
  showVariables: { mode: view, stageLists: picture }
  codeStages:
    - role: starter
      code: |
        from stage import *
        grid(pixels, palette=["white", "black", "gold"])
```

Panel: `pixels` as a 3 × 4 table of `0`, `1`, `2`. Stage: the picture.

## Checks wanted

- None.

## Devices

- As the panel today. The table scrolls inside the tag on narrow screens.

## Notes

- **Accessibility:** screen readers hear the table by row ("pixels, row 1: 0, 1, 1, 0").
- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Visual learning.md`, wave 1c; findings in `Plans/LG-P6 Sandbox findings.md`.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
