# Keyboard Activity

A Keyboard task is an **activity** (see [binary.md](binary.md) for what that means: no Run, no
sandbox, no sharing or carry-through; saved on the device and marked for the teacher). Students
practise typing lines of text, finding keys, typing symbols on a **UK** keyboard, using
shortcuts such as Ctrl+C, and fixing mistakes in a line with the arrow keys, Backspace and Delete
(without retyping it).

Write `type: keyboard` on the task (the YAML shorthand for `taskType: activity` +
`activityType: keyboard`, which also works). In the Builder, choose the **Activity** format and pick
**Keyboard skills**.

## Complete example

```yaml
id: keyboard-skills
type: python
title: Keyboard Skills
description: Capital letters with Shift, UK symbols and the copy/paste shortcuts.
tasks:
  - title: Type with capitals
    type: keyboard
    description: Hold **Shift** for each capital letter. Don't use Caps Lock!
    mode: type_text
    requireShiftForCapitals: true
    minAccuracy: 0.9
    items:
      - id: a
        text: Hello World
      - id: b
        text: My name is Sam.
  - title: Find the keys
    type: keyboard
    mode: find_key
    items:
      - id: a
        key: Enter
        prompt: Find the key that starts a new line
      - id: b
        key: Backspace
        hardwareOnly: true
  - title: Symbols
    type: keyboard
    description: Some symbols need Shift. On a UK keyboard `@` is Shift + '.
    mode: symbols
    items:
      - id: a
        char: "@"
      - id: b
        char: "£"
      - id: c
        char: '"'
  - title: Copy and paste
    type: keyboard
    mode: shortcuts
    items:
      - id: a
        combo: Ctrl+C
        prompt: Select a word and copy it
      - id: b
        combo: Ctrl+V
        prompt: Paste the word you copied
  - title: Fix the garbled transmission
    type: keyboard
    mode: edit_text
    description: Fix the mistakes in the captain's message. Don't type it all again!
    items:
      - id: a
        start: "the rocket is redy to lanch"
        target: "The rocket is ready to launch."
        prompt: Use the arrow keys to get to each mistake
      - id: b
        start: "Captain  Ada  says hello"
        target: "Captain Ada says hello"
        requireKeys: [Delete]
        prompt: Put the cursor before each extra space and press Delete
      - id: c
        start: "Launch at noon noon"
        target: "Launch at noon"
        requireKeys: [select]
  - title: Print your name
    starterCode: |
      print("My name is Sam")
    check:
      type: output
      operator: contains
      value: "My name is"
```

## Task fields

| Field | Required | Notes |
|---|:---:|---|
| `type` | Yes | `keyboard` in YAML (JSON: `taskType: activity` + `activityType: keyboard`) |
| `mode` | Yes | `type_text`, `find_key`, `symbols`, `shortcuts` or `edit_text`. |
| `layout` | No | `uk` (the only layout so far, and the default). |
| `items` | Yes | One or more items, each with a unique `id`. |
| `requireShiftForCapitals` | No | `type_text`: a capital typed with Caps Lock doesn't count; the hint says to hold Shift. Can also be set per item. |
| `minAccuracy` | No | `type_text`: fraction of characters that must be right, above 0 and at most 1. Default `1` (exact). |
| `targetWpm` | No | `type_text`: optional speed goal in words a minute. Accuracy is always checked; speed only when this is set. No history is kept between lessons. |
| `minKept` | No | `edit_text`: share (above 0, at most 1; default `0.9`) of the characters `start` and `target` have in common that must survive untouched. Deleting the line and typing it again fails. |
| `showTarget` | No | `edit_text`: show the fixed line above the edit box ("Make it say: …"). Default `true`; set `false` for a find-the-mistakes challenge. |

## Item fields by mode

| Mode | Item fields | Notes |
|---|---|---|
| `type_text` | `text` (required, ≤ 200 characters, only characters on the layout) | The line is shown with each typed character marked right or wrong, plus accuracy (and speed when `targetWpm` is set). Enter or reaching the end finishes the line. |
| `find_key` | `key`: one typeable character or a named key (`Enter`, `Backspace`, `Tab`, `Shift`, `Space`, `CapsLock`, `Delete`, `Escape`, `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`); optional `prompt` | After two wrong presses the key lights up on a keyboard picture. |
| `symbols` | `char`: one character on the layout; optional `prompt` | Symbols that need Shift only count when Shift was held. UK examples: Shift + 2 = `"`, Shift + ' = `@`, Shift + 3 = `£`. |
| `shortcuts` | `combo` like `Ctrl+C` (`Ctrl` also matches Cmd on a Mac), or Shift with a non-typing key such as `Shift+Tab` or `Shift+ArrowLeft` (`Shift+A` is just typing, so it is rejected); `prompt` (a warning if missing); optional `practiceText` for the practice box | Browser-reserved shortcuts (Ctrl+W, Ctrl+T, Ctrl+N, Ctrl+Q, Ctrl+Tab, Ctrl+Shift+T, Ctrl+Shift+N, Alt+F4) are rejected: the page never sees them, so teach those with a quiz question. Copying/cutting/pasting with the right-click menu is noticed and the hint asks for the keys instead. The item's shortcut counts wherever the student presses it on the page, and the browser's own action (such as Ctrl+S's save dialog) is blocked; copy, cut, paste, select-all, undo and redo only count in the practice box because they act on its text. A Tab shortcut (`Shift+Tab`) is practised in a row of three fields instead of the practice box (`practiceText` is not used), and focus really moves back a field. |

| `edit_text` | `start` and `target` (both required, ≤ 200 characters on the layout, and different); optional `prompt`; optional `requireKeys`: a list of `Backspace`, `Delete`, `ArrowLeft`, `ArrowRight`, `Home`, `End` and `select` (any Shift selection: Shift + an arrow, Home or End, or Ctrl+A) | The student edits `start` in place: arrows, Home/End and Shift selection move and select, Backspace deletes left, Delete deletes right, typing inserts (replacing a selection); clicking a letter puts the cursor before it. Paste and drag-drop do nothing. The line finishes when it matches `target` exactly (capitals and punctuation included). It then passes only if it was **edited, not retyped** (see `minKept`) and every `requireKeys` key was used. |

Any item may set `hardwareOnly: true`: it then only counts when typed on a real keyboard, not
the on-screen one.

## Devices without a keyboard

Keyboard tasks need a physical keyboard. On a tablet with no keyboard the student sees a note
and a built-in **on-screen UK keyboard** (with one-shot Shift and Ctrl keys) that works for every
item except `hardwareOnly` ones and `edit_text` items, which need arrow keys and a Delete key the
on-screen keyboard doesn't have yet (those items show a "needs a real keyboard" note). An **I have a keyboard** button hides it, and pressing any real
key proves a keyboard is there. The teacher's card and modal show an "On-screen keyboard" badge
for work done this way.

## Marking and hints

- Keyboard items finish themselves (a line typed, a key found, a shortcut used). When every item
  has a result, the task is marked automatically; **Check my work** marks it early.
- Individual keystrokes are *continuous* changes: they only stream to the teacher while the
  teacher is watching that student. Finishing an item is *discrete* and updates the card within
  a moment. Raw keystrokes never leave the device; only the small per-item result is saved.
- Hints are short and specific: "Try holding Shift for capital letters instead of Caps Lock.",
  "Press Shift + 2.", "Use the keys this time: Ctrl + C.", and for `edit_text` "You typed it all
  again. Try moving the cursor to the mistake with the arrow keys." or "Put the cursor just
  before the extra letter and press Delete. Backspace deletes to the left, Delete deletes to the
  right."

## Teacher tools

- The student card shows `n/m done` (plus `· n retyped` for `edit_text` lines typed out again
  instead of edited); the modal shows the student's results read-only, with each retyped line's
  hint.
- **Stage → Start again** clears the results; **Complete (show answers)** marks every item done.
- **Edit answers** works as for other activities.
- Go Live is teacher-only on Keyboard tasks; a student's work is never broadcast.

## Validation

See the Keyboard table in [validation-errors.md](../validation-errors.md).
