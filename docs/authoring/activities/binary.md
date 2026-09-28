# Binary Activity

A Binary task is an **activity**: a bounded exercise that can sit anywhere in a lesson, between
code tasks of any module. Students toggle bit tiles, type decimal answers and add in binary. There
is no Run button, no personal sandbox, no sharing and no carry-through. Progress is saved on the
device, mirrored to the teacher's student card, and marked when the student presses
**Check answers**.

Set `taskType: activity` and `activityType: binary` on the task (the `type: binary` YAML shorthand
arrives with the Builder activity gallery; for now write both fields). The task's `title` and
`description` / `explainer` show above the activity.

## Complete example

```yaml
id: binary-basics
type: python
title: Binary Basics
description: Count in binary, convert both ways, then print a binary number in Python.
tasks:
  - title: Make the numbers
    taskType: activity
    activityType: binary
    description: Click the bits to turn them on. Make each number.
    mode: make_number
    bits: 4
    items:
      - id: a
        target: 5
      - id: b
        target: 12
      - id: c
        target: 15
  - title: Binary to decimal
    taskType: activity
    activityType: binary
    description: What number do these bits make?
    mode: to_decimal
    bits: 8
    items:
      - id: a
        value: "00001010"
      - id: b
        value: "01000001"
  - title: Add in binary
    taskType: activity
    activityType: binary
    description: Add the two numbers. Remember 1 + 1 = 10, so carry the 1.
    mode: add
    bits: 4
    requireCarries: true
    items:
      - id: a
        a: "0011"
        b: "0101"
  - title: Binary in Python
    starterCode: |
      print(bin(5))
    check:
      type: output
      operator: contains
      value: "0b101"
```

## Task fields

| Field | Required | Notes |
|---|:---:|---|
| `taskType` | Yes | `activity` |
| `activityType` | Yes | `binary` |
| `mode` | Yes | `make_number`, `to_binary`, `to_decimal` or `add` (see below). |
| `bits` | No | Number of bit columns, 1–16. Default `8`. |
| `showPlaceValues` | No | Show 128 / 64 / … above each column. Default `true`. |
| `showDecimal` | No | Show the running decimal value under the bits. Default `true` for `make_number`, `false` otherwise (it would give the answer away). |
| `requireCarries` | No | `add` only: the carry row must be filled in too. Default `false`. |
| `items` | Yes | One or more questions. Each needs a unique `id` (keeps saved progress attached to the right question). |

## Modes and item fields

| Mode | Student does | Item fields |
|---|---|---|
| `make_number` | Toggles bits to make a decimal number; the running total is shown. | `target`: whole number from 0 to 2^bits − 1 |
| `to_binary` | Same, without the running total. | `target` |
| `to_decimal` | Reads a bit pattern and types the decimal number. | `value`: exactly `bits` binary digits, quoted in YAML (`"0101"`) |
| `add` | Adds two binary numbers by toggling the answer bits (and the carries when `requireCarries`). | `a`, `b`: exactly `bits` binary digits each; `a + b` must fit in `bits` |

Overflow, hex, ASCII and pixel modes are planned follow-ups.

## Marking and hints

- **Check answers** marks every question. The task passes when all are right.
- Wrong answers get a short hint that never gives the answer away, e.g. "Your bits make 6,
  which is too big. Check the 2 column." The hint shows in the usual feedback banner.
- Toggling a bit is a *discrete* change: the teacher's card updates within a moment. Typing a
  decimal answer is *continuous*: it only streams while the teacher is watching that student.

## Teacher tools

- The student card shows `n/m correct`; the student modal shows the student's bits read-only.
- **Edit answers** in the modal lets the teacher change the student's bits directly; an edit
  that makes every question right is marked as passed (teacher assisted).
- **Stage → Start again** clears the student's answers; **Complete (show answers)** fills them in.
- Go Live on a Binary task is teacher-only: the teacher's own Presentation View broadcast shows
  the class the teacher's bits. A student's answers are never broadcast.

## Validation

Every Binary validation message is listed under "Activity tasks" in
[validation-errors.md](../validation-errors.md).
