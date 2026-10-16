# Predict mode: answer boxes that fit the value, and predicting the type

- **Status:** open
- **Kind:** module
- **Requested by:** Lesson Gen agent (Ryan asked for it, filed straight to LaunchPad Dev, as with builds 1–25), 2026-10-16
- **Lessons blocked:** none. Improves the LG-P6 pilots, Python Level 1 Lesson 8 (`caakmdqj5j`) and Level 2B Lesson 8 (`qj8152siy2`), both taught Tue 20 Oct, and every later predict task.

## Need

Ryan (2026-10-16, clicking through `qj8152siy2`): "When building the lesson tell it what it will be, and then if it's Boolean have a selector, if it's number a number field etc. Also a prediction what data type is this too."

Today every predict tag is a free text box (`docs/authoring/python.md`, Name-Tag Panel: "predictions are typed as text"). So:
- **A true/false prediction is typed.** On `qj8152siy2`'s task 9 ("Is the Door Open?", `door_open = not has_key`), the student types `True`. A typo or `yes` is marked wrong for spelling, not for the idea.
- **A number goes into a text box.** On a tablet that brings up the letter keyboard.
- **The kind of value can't be predicted at all.** Whether `input()` gives text or a number, and whether `int()` changed it, is one of our most-seen misconceptions (`"5"` against `5`; Known Misconceptions, "the result of `int()` not stored back"). The panel shows type labels (`text`, `number`, `true/false`) after Run, but a student can't predict one.

**Closest existing capability:** `showVariables.mode: predict` with `predict: [names]` and `variables_predicted`. That check is already forgiving by type: quotes are optional for text, `5.0` matches `5`, and True/False ignore capitals.

## What's wanted

**1. The author says what kind of answer each tag takes.**

```yaml
showVariables:
  mode: predict
  predict:
    - name: door_open
      answer: boolean     # True / False buttons
    - name: coins
      answer: number      # a number field (numeric keypad on tablets)
    - name: greeting      # plain name: today's text box, unchanged
```

- `boolean` shows two buttons, **True** and **False** (words, not colours), at least 44 px.
- `number` shows a number field that takes whole numbers and decimals, with a numeric keypad on touch screens.
- `text` (the default, and what a plain name means) keeps today's text box. Showing the quote marks around the box would help students see it's text.
- Optionally `choices: [...]` for a short list the author gives (e.g. three colour names), shown as buttons.
- A plain list of names keeps working exactly as today.

**2. A tag that asks for the type, not the value.**

```yaml
showVariables:
  mode: predict
  predictType: [age, answer]   # pick the kind of value, not the value
```

- The student picks from the panel's own type labels: **text**, **number**, **true/false**, and **list** where the level has met lists (`choices` can limit them).
- After Run, the real type label shows with ✓ or ✗, as for values.
- New check `types_predicted` (`names` optional), like `variables_predicted`.
- A task may predict a value for one tag and a type for another (e.g. `answer` holds what `input()` gave: predict its type; `age = int(answer)`: predict its type).

## Example task

```yaml
- title: Text or Number?
  moduleType: python
  showVariables:
    mode: predict
    predictType: [typed, age]
  codeStages:
    - role: starter
      code: |
        typed = "12"      # what the player typed
        age = int(typed)
  check:
    - type: types_predicted
```

## Checks wanted

- `variables_predicted` unchanged, judging the typed or picked answer by the same rules.
- `types_predicted` (new).

## Devices and accessibility

- All buttons are at least 44 px, with words, never colour alone. The screen reader says "door_open: predict True or False".

## Session report

- Record picked answers like today's `predictions`, with type predictions marked as such, so a later report check can see the `"5"` against `5` confusion directly.

## Notes

- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Lesson plan - Python L2B Lesson 8 for loops.md`.
- p6-26's "how many times?" box is a `number` answer in this sense, so the two can share the field.
