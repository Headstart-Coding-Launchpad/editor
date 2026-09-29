# Binary Activity

A Binary task is an **activity**: a bounded exercise that can sit anywhere in a lesson, between
code tasks of any module. Students toggle bit tiles, type decimal answers, add in binary, spot
overflow, convert to and from hex, use ASCII codes and draw pixel pictures. There
is no Run button, no personal sandbox, no sharing and no carry-through. Progress is saved on the
device, mirrored to the teacher's student card, and marked when the student presses
**Check answers**.

Write `type: binary` on the task (the YAML shorthand for `taskType: activity` +
`activityType: binary`, which also works). In the Builder, choose the **Activity** format and
pick **Binary**. The task's `title` and `description` / `explainer` show above the activity.

## Complete example

```yaml
id: binary-basics
type: python
title: Binary Basics
description: Count in binary, convert both ways, then print a binary number in Python.
tasks:
  - title: Make the numbers
    type: binary
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
    type: binary
    description: What number do these bits make?
    mode: to_decimal
    bits: 8
    items:
      - id: a
        value: "00001010"
      - id: b
        value: "01000001"
  - title: Add in binary
    type: binary
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
| `type` | Yes | `binary` in YAML (JSON: `taskType: activity` + `activityType: binary`) |
| `mode` | Yes | `make_number`, `to_binary`, `to_decimal`, `add`, `overflow`, `hex`, `ascii` or `pixels` (see below). |
| `bits` | No | Number of bit columns, 1–16. Default `8`. Not used by `ascii` (always 8-bit codes) or `pixels`. |
| `showPlaceValues` | No | Show 128 / 64 / … above each column. Default `true`. |
| `showDecimal` | No | Show the running decimal value under the bits. Default `true` for `make_number`, `false` otherwise (it would give the answer away). |
| `requireCarries` | No | `add` and `overflow`: the carry row must be filled in too. Default `false`. |
| `codeFormat` | No | `ascii` only: `binary` (8-bit codes, default) or `decimal` (65, 66, …). |
| `showTable` | No | `ascii` only: show a fold-out ASCII lookup table. Default `false`. |
| `width`, `height` | `pixels` | `pixels` only: grid size, each a whole number from 1 to 16. |
| `items` | Yes | One or more questions. Each needs a unique `id` (keeps saved progress attached to the right question). |

## Modes and item fields

| Mode | Student does | Item fields |
|---|---|---|
| `make_number` | Toggles bits to make a decimal number; the running total is shown. | `target`: whole number from 0 to 2^bits − 1 |
| `to_binary` | Same, without the running total. | `target` |
| `to_decimal` | Reads a bit pattern and types the decimal number. | `value`: exactly `bits` binary digits, quoted in YAML (`"0101"`) |
| `add` | Adds two binary numbers by toggling the answer bits (and the carries when `requireCarries`). | `a`, `b`: exactly `bits` binary digits each; `a + b` must fit in `bits` |
| `overflow` | Adds two numbers whose sum is too big, sets the bits that are left, and answers "Did it overflow?" (Yes/No). | `a`, `b`: exactly `bits` binary digits each; `a + b` must **not** fit in `bits` |
| `hex` | Converts between binary, hex and decimal. Binary is shown and answered in groups of 4 bits (nibbles). | `value`, `from`, `to` (see [Hex](#hex)) |
| `ascii` | Encodes text as ASCII codes, or decodes codes into text. | `text`, `direction` (see [ASCII](#ascii)) |
| `pixels` | Draws a picture from rows of bits, or writes the bits for a picture. | `rows`, `direction` (see [Pixels](#pixels)) |

### Overflow

The answer bits are the sum with the last carry thrown away: with 4 bits, `1100 + 0110` (12 + 6
= 18 = `10010`) leaves `0010`. The student must also answer **Yes** to "Did it overflow?".
Every overflow item overflows (validation checks this), so mix overflow tasks with `add` tasks
if you want students to decide. Saying **No** gets the hint "The last carry had no column left
to go into, so it was lost. That is an overflow."

### Hex

| Field | Notes |
|---|---|
| `from` | `binary`, `hex` or `decimal`: how `value` is written and shown. |
| `to` | `binary`, `hex` or `decimal`, different from `from`: what the student answers in. |
| `value` | Quote it in YAML. `binary`: exactly `bits` digits (`"00101111"`). `hex`: 0-9 and A-F (either case), at most 2^bits − 1 (`"FF"` for 8 bits). `decimal`: a whole number from 0 to 2^bits − 1. |

Answering in binary uses bit tiles grouped in fours. Hex answers are typed and marked without
caring about case, a `0x` prefix or leading zeros (`2F`, `2f`, `0x2F` and `02F` all count).

### ASCII

| Field | Notes |
|---|---|
| `text` | 1–16 printable ASCII characters (codes 32–126: letters, digits, space and symbols; no accents or emoji). Quote it in YAML if it starts or ends with a space or contains `:` or `#`. |
| `direction` | `encode`: the student types each character's code (one box per character). `decode`: the codes are shown and the student types the text. |

Codes are 8-bit binary (`01001000`) unless the task sets `codeFormat: decimal` (`72`). Binary codes
may be typed without leading zeros. Decoded text is marked exactly: capital and small letters
have different codes, so `Hi` and `hi` are different answers.

### Pixels

| Field | Notes |
|---|---|
| `rows` | Exactly `height` strings of exactly `width` binary digits, top row first. `1` = filled square. Quote each row in YAML. |
| `direction` | `draw`: each row's bits are shown beside an empty grid, and the student clicks or taps squares (arrow keys move, Space fills or clears) to match them. `encode`: the picture is shown and the student types each row's bits. |

`width` and `height` are set on the task and are at most 16. A task's finished answers must stay
small enough to sync (about four full 16 × 16 pictures); validation reports a task that is too
big.

## Complete example: overflow, hex, ASCII and pixels

```yaml
id: binary-beyond
type: python
title: Beyond Binary
description: Overflow, hexadecimal, ASCII codes and pixel pictures.
tasks:
  - title: Too big to fit
    type: binary
    description: Add the numbers. Only 4 bits fit, so what happens to the last carry?
    mode: overflow
    bits: 4
    items:
      - id: a
        a: "1100"
        b: "0110"
      - id: b
        a: "1111"
        b: "0001"
  - title: Hexadecimal
    type: binary
    description: Each hex digit stands for 4 bits.
    mode: hex
    bits: 8
    items:
      - id: a
        value: "00101111"
        from: binary
        to: hex
      - id: b
        value: "3C"
        from: hex
        to: binary
      - id: c
        value: "FF"
        from: hex
        to: decimal
      - id: d
        value: "200"
        from: decimal
        to: hex
  - title: Secret messages
    type: binary
    description: Computers store each letter as a number called its ASCII code.
    mode: ascii
    codeFormat: binary
    showTable: true
    items:
      - id: a
        text: Hi
        direction: encode
      - id: b
        text: "OK!"
        direction: decode
  - title: Pixel pictures
    type: binary
    description: 1 means a filled square and 0 means an empty one.
    mode: pixels
    width: 5
    height: 5
    items:
      - id: heart
        direction: draw
        rows:
          - "01010"
          - "11111"
          - "11111"
          - "01110"
          - "00100"
      - id: arrow
        direction: encode
        rows:
          - "00100"
          - "01110"
          - "10101"
          - "00100"
          - "00100"
```

## Marking and hints

- **Check answers** marks every question. The task passes when all are right.
- Wrong answers get a short hint that never gives the answer away, e.g. "Your bits make 6,
  which is too big. Check the 2 column." The hint shows in the usual feedback banner.
- Toggling a bit or a pixel, or answering Yes/No, is a *discrete* change: the teacher's card
  updates within a moment. Typing (a decimal or hex answer, an ASCII code or text, a row of
  pixel bits) is *continuous*: it only streams while the teacher is watching that student.

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
