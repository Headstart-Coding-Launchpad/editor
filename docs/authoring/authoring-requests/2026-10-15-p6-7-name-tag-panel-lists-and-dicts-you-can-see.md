# Name-tag panel: lists and dicts you can see

- **Status:** shipped
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, filed straight to LaunchPad Dev at Ryan's request, bypassing pipeline-ui, as with builds 1–6), 2026-10-15
- **Lessons blocked:** none yet. Wave 1b of Lesson Gen's LG-P6 Visual learning plan (v5, "small code, big picture"). Used by pilot lessons A and B. Build this on top of `integrate/requests-2026-10-14` (builds 1–6) rather than waiting for them to merge, and merge when ready (Ryan, 2026-10-15): this builds on the name-tag panel (`2026-10-14-p6-1-…`).

## Need

LG-P6 v5's theme for Python is **a few lines of simple code make something that looks amazing, and the picture explains the concept**. Lists and dicts are where students most need to see what they're holding, and today the panel shows every list the same way: a row of plain tiles with indexes underneath. A list of colours, a list of scores and a pixel picture all look alike.

Ryan wants the visuals **in the name-tag panel**, not as a new Stage call: students run their code and the list pops up looking like what it holds.

**Closest existing capability:** `showVariables` (`docs/authoring/python.md`, Name-Tag Panel). Its display rules cover type labels, tiles and key → value rows. It has no way to show what a value *looks like*.

## Example task

```yaml
- id: 21
  moduleType: python
  title: Add two colours to the palette
  showVariables:
    mode: view
    visuals: true            # new; default true. false = today's plain tags for the whole task
    stageLists: picture      # new; how to show a list the Stage is drawing with grid():
                             #   picture | tiles | size   (default: size)
  codeStages:
    - role: starter
      code: |
        palette = ["red", "orange", "gold"]
        palette.append("green")
        palette.append("blue")
```

After Run, `palette` shows as five colour swatches with their indexes and names.

## Display rules (chosen automatically from the value)

| Value | Shows as |
|---|---|
| A list where **every** item is a colour the Stage knows (CSS name, PICO-8 name or hex) | Colour swatches, each with its index and its text (`0 "red"`) |
| A list of numbers | Bars, each labelled with its index and value |
| A list of anything else (text, emoji, mixed) | Today's tiles |
| A 2D list (list of equal-length lists) of colours or palette numbers | A small picture, cells outlined, with a row/column ruler. Picture and grid sizes follow `grid()`'s rules and limits |
| A 2D list of anything else | A small table with row and column indexes |
| A dict | Labelled cards: the key as the card title, the value under it. A colour value also shows a swatch |
| A dict of numbers | Labelled bars |

- **Index numbers always show** on list visuals. Lessons about indexes depend on them.
- **The exact Python value is always one tap away.** Show all, or tap a visual, shows the value as text, so `"5"` and `5` still look different.
- **Mixed or ambiguous lists fall back to tiles.** For example, `["apple", "orange"]` isn't all colours, so it shows as tiles. A task that still gets a wrong guess (e.g. `["orange", "lime"]` as fruit) switches visuals off with `visuals: false`.
- **Lists the Stage is drawing.** When a variable is passed to `grid()` in this run, `stageLists` decides how the panel shows it, so the picture doesn't appear twice unless the lesson wants it:
  - `picture`: the same small picture as above, to teach "the list *is* the picture";
  - `tiles`: today's tiles (rows of tiles for a 2D list);
  - `size` (default): just the tag, type and size, e.g. `pixels: list, 8 × 8, drawn on the Stage`.
- **Variables made by hidden setup code** (request `2026-10-15-p6-8-…`) show like any other variable. They are the point of many tasks.
- **Changed values:** after a re-run, the swatch, bar, cell or card that changed is marked, not only the whole tag.

## Modes

- **view:** as above.
- **predict:** predictions are still typed as text (unchanged). After Run, the real value shows with its visual next to the ✓ / ✗.
- **target:** target values show with the same visuals (e.g. target swatches), so "make your palette look like this" works. The `variable_*` checks still decide completion.
- **Slow-mo:** the visuals update step by step, and a changed item pulses as tags do today.

## Checks wanted

- None new. `variable_array_equals` and `variable_dict_equals` already decide outcomes.

## Devices

- Same as the panel today: stacks on narrow screens, 44 px touch targets for Show all and tap-to-see-value.
- Pictures and bars scale to the panel's width; long lists scroll inside the tag rather than the page.

## Notes

- **Ages:** 11–16, mixed-age classes. Clean and grown-up, not cartoonish.
- **Accessibility:**
  - Colour is never the only signal: swatches always carry their colour's text, bars their number.
  - Use the Okabe-Ito palette for anything the panel itself colours (bars, change marks).
  - Screen-reader text per item: "palette, item 0: red".
  - Pictures get a text summary: "pixels: 8 by 8 picture, 5 colours: red 12, white 40, …".
- **Teacher:** visuals show on the student card and StudentModal, and in Go Live.
- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Visual learning.md`, v5 decisions: list and dict visuals live in the panel, automatic, switchable off per task; Stage-drawn lists flexible per task.

## Resolution

Shipped 2026-10-15 on branch `feature/name-tag-visuals` (4424cba), merged into `integrate/requests-2026-10-14`. It is not on `main` yet: that waits for Ryan's browser pass.

It shipped as a feature of the `python` and `turtle` name-tag panel: new `showVariables.visuals` and `showVariables.stageLists` fields. Lists and dicts show as colour swatches, number bars, 2D pictures and tables, or dict cards, chosen automatically, with tiles as the fallback. Items are marked one by one when they change, and the exact value is one tap away. Palette numbers draw as a picture only in a list drawn with `grid()` when `stageLists: picture` is set. Capture now reads about 1,000 values per variable (a 32 × 32 picture). Docs: [python.md](../python.md#name-tag-panel-showvariables).
