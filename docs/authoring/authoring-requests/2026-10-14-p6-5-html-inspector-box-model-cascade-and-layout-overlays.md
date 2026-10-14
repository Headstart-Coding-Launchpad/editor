# HTML Inspector: box model, "why this colour?" and flex/grid overlays

- **Status:** open
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, sent straight to LaunchPad Dev at Ryan's request, bypassing pipeline-ui), 2026-10-14
- **Lessons blocked:** none yet. This is build 5 of 6 in Lesson Gen's P6 Visual learning plan.

## Need

HTML students see the finished page but never *why* it looks that way. The HTML & CSS pathway teaches:

- the box model, padding, margin and margin collapse (Level 2)
- selectors, inheritance and specificity (Level 1)
- flexbox and positioning (Level 3)
- grid (Level 4)

The pathway itself says Level 3 "leans more heavily on live preview as a debugging tool". Nothing shows the boxes, which rule won, or the flex axes.

**Closest existing capability:** the `html` module (`docs/authoring/html.md`, `html-tasks.md`) has an iframe preview. Its `html_element_style_property` check reads computed styles, so the platform can already see the cascade's result, but the student can't. There is no inspector, hover highlight or computed-style panel.

## Example task

```yaml
- id: 52
  moduleType: html
  title: Why is the card's text blue?
  inspector:
    enabled: true
    open: true                 # start with inspect mode on
    focus: ".card p"           # optional: pre-select this element
    show: [box, cascade]       # any of: box, cascade, layout
```

**Inspect mode**

- A toggle in the preview.
- Hovering an element (tapping on touch) outlines it with coloured, labelled bands, as browser DevTools do:
  - content
  - padding
  - border
  - margin
- The bands show px values.

**Side panel for the selected element**

- Its tag, id and classes.
- **"Why this colour?" (cascade):** for a chosen property (colour, font-size, margin and so on), list every rule that set it.
  - In cascade order, with the winning rule highlighted.
  - Losing rules are struck through, with the plain-words reason: "less specific", "earlier in the file" or "inherited from `.card`".
- **Layout:** for a flex or grid container, draw the main and cross axes as arrows, plus the gap and the grid lines.

## Checks wanted

- **No new completion checks.** The existing `html_element_style_property` and DOM checks stay.
- **Optional:** record in the session report whether inspect mode was used.

## Devices

- **Tablets:** tapping an element selects it, the panel slides up from the bottom, and touch targets are at least 44 px.
- **Narrow screens:** the side panel becomes a bottom sheet.

## Notes

- **Ages:** 8–16 across HTML levels. Use plain words ("less specific"), not just specificity numbers.
- **Accessibility:**
  - The box bands carry text labels as well as colour, in a colour-blind-safe palette.
  - The panel can be read by a screen reader.
- **Teacher:** the selection syncs in Go Live, so Ryan can demonstrate.
- **Order:** P6 build order is 1 name-tag panel, 2 Stage, 3 Python slow-mo, 4 scrubbing, 5 this, 6 Scratch slow-mo.

## Resolution

