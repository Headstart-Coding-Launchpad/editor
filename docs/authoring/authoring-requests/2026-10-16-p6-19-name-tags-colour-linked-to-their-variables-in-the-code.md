# Name-tag panel: each tag and its variable in the code share a colour

- **Status:** shipped
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, filed straight to LaunchPad Dev at Ryan's request, as with builds 1–18), 2026-10-16
- **Lessons blocked:** none. Improves the LG-P6 pilot, Python Level 1 Lesson 8 (Draft `caakmdqj5j`, taught Tue 20 Oct), and every later predict task.

## Need

Ryan's click-through of the pilot lesson (2026-10-16): "Might be handy if we can link predictions to the variables by colouring both the same somehow?" In a predict task the student reads a line of code, then types into a tag in a separate pane. Nothing on screen ties the `small` tag to the `small` on line 3, so the student has to match names by eye. Students at Level 1 are 9–16, and some are slow readers.

**Closest existing capability:** `showVariables` (`docs/authoring/python.md`, Name-Tag Panel). Tags show the name in text only; the editor doesn't mark the variables the panel shows.

## What's wanted

- When the panel is showing (any mode), each tag gets a colour, and **the same variable's name in the editor is marked with that colour**: for example a coloured underline or a soft background on every occurrence of that name.
- **Predict mode first:** the tags in `predict` must be linked. Linking every shown tag in view and target modes is welcome if it's cheap.
- **Never colour alone:** the link must also work without colour, e.g. the same small marker or number on the tag and on the variable in the code, so it holds for colour-blind students and on a projector (LG-P6's accessibility rule).
- Hovering or focusing a tag (or tapping it on a tablet) highlights that variable in the code more strongly, and the reverse.
- Up to 3 predicted tags is the authoring norm, so a palette of 3–6 clearly different colours is enough.

## Example task

```yaml
- id: 7
  moduleType: python
  title: Did LEEDS Change?
  showVariables: { mode: predict, predict: [small] }
  codeStages:
    - role: starter
      code: |
        city = "LEEDS"
        city.lower()
        small = city.lower()
```

The `small` tag and the word `small` on line 3 carry the same colour and marker.

## Checks wanted

- None new.

## Devices

- Tablets: tap a tag to highlight its variable (no hover). The markings must not shift the code's line layout or hide the text cursor.

## Notes

- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Lesson plan - Python L1 Lesson 8 poster.md`; `LG-P6 Visual learning.md`.
- An optional per-task off switch (e.g. `showVariables.link: false`) would be useful, defaulting to on.

## Resolution

Shipped 2026-10-16 on `feature/p6-19-21-name-tag-links-scrub` (not yet on `main`). New field `showVariables.link` (default true): `getVariableLinks` in `src/shared/variablesPanel/links.js` gives each linked tag one of six colours and a number 1–6; `src/shared/variableLinksEditor.js` marks every real use of the variable in the editor (syntax-tree `VariableName` only: strings, comments, attributes and keyword names are skipped) with a coloured underline, soft background and the number drawn above the name, without moving the layout. Hover / focus / tap on a tag strengthens the code marks and the reverse (`useVariableLinks`). Predict, view and target modes; Python and Turtle workspaces, slow-mo tags and the tutor's StudentModal code view. Validation and the Builder field know `link`. Docs: [python.md](../python.md#name-tag-panel-showvariables), turtle.md, lesson-schema.md, validation-errors.md, FEATURES, CHANGELOG.
