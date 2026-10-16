# Locked lines: lock the name and quote marks but let the value change

- **Status:** open
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, filed straight to LaunchPad Dev at Ryan's request, as with builds 1–21), 2026-10-16
- **Lessons blocked:** none. Would improve the LG-P6 pilot, Python Level 1 Lesson 8 (Draft `caakmdqj5j`, taught Tue 20 Oct), and any task where students personalise given data.

## Need

Ryan's second click-through of the pilot (2026-10-16): "Shame that for locked lines we can't change the values. That might be handy: can't change the " or the name but can change what is in there?" Today `#@lock` and `puzzle.onlyEdit` lock or free **whole lines** (`docs/authoring/python.md`, Locked lines, hidden setup and puzzles). A line like `hero = "Zara"` is either fully editable, where a Level 1 student can break the quote marks or the name, or fully locked, so they can't make it theirs. Level 1 students regularly mangle quote marks and names (Known Misconceptions: unquoted values, quoted names).

**Closest existing capability:** `#@lock` (whole line) and `puzzle.onlyEdit` (whole lines).

## What's wanted

- A way to lock a line **except its values**:
  - the text between a string literal's quote marks
  - number literals
  - optionally, colour strings, which already get scrub swatches.
- The name, `=`, quote marks, brackets and the rest of the line stay read-only.
- Marked per line, e.g. a `#@lock-values` marker above the line, or `puzzle.editValues: [lines]`. Dev's choice.
- **Editing:** clicking in a value edits only inside it, and typing can't move the caret out of it. The editable part looks different, e.g. a light box around the value (see p6-24 for a shared visual language with draggable numbers).
- **Empty strings** must stay editable (`name = ""`), so a student can fill a blank value in.
- **Rules:**
  - Undo and Reset work as now.
  - Checks see the whole program as usual.
  - Validation warns if a marked line has no value to edit.

## Example task

```yaml
codeStages:
  - role: starter
    code: |
      from stage import *
      #@lock-values
      hero = "Zara"
      #@lock-values
      city = "Leeds"
      headline = f"{hero} wins in {city}"
      text(headline, "black", y=200, size=24)
```

Students can change `Zara` and `Leeds` (and nothing else on those lines), then Run to see their own headline.

## Checks wanted

- None new.

## Devices

- Tablets: tapping a value puts the caret inside it, and the on-screen keyboard edits only that value.

## Notes

- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Lesson plan - Python L1 Lesson 8 poster.md`.
