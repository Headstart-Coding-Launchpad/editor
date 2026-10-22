# Keyboard Activity

A Keyboard task is an **activity** (see [binary.md](binary.md) for what that means: no Run, no
sandbox, no sharing or carry-through; saved on the device and marked for the teacher). Students
practise typing lines of text, finding keys, typing symbols on a **UK** keyboard, using
shortcuts such as Ctrl+C, fixing mistakes in a line with the arrow keys, Backspace and Delete
(without retyping it), typing whole blocks of real code with their indentation (`type_code`), and a
timed falling-words warm-up with code tokens (`falling_words`).

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
  - title: Type the loop
    type: keyboard
    mode: type_code
    language: python
    minAccuracy: 0.95
    targetCpm: 90
    items:
      - id: a
        code: |
          for i in range(3):
              print("Hi")
      - id: b
        code: |
          if score > 10:
              print("You win!")
          else:
              print("Keep going")
  - title: Type the list
    type: keyboard
    mode: type_code
    language: html
    items:
      - id: a
        code: |
          <ul>
            <li>Milk</li>
          </ul>
  - title: Falling code
    type: keyboard
    mode: falling_words
    durationSeconds: 90
    words: ["print(", "</p>", "for i in", "if x ==", "<h1>", "input(", "[1, 2]", '"hi"']
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
| `mode` | Yes | `type_text`, `find_key`, `symbols`, `shortcuts`, `edit_text`, `type_code` or `falling_words`. |
| `layout` | No | `uk` (the only layout so far, and the default). |
| `coreItems` | No | How many items make the round, 1 to the number of `items`. The task passes when that many are done; later items are **bonus** reps. Default: all items. Ignored (with a warning) for `falling_words`, which is one round with no item list. |
| `items` | Yes | One or more items, played in order, each with a unique `id`. Every mode except `falling_words`, which has `words` instead. |
| `requireShiftForCapitals` | No | `type_text`: a capital typed with Caps Lock doesn't count; the hint says to hold Shift. Can also be set per item. **Off when left out of the YAML**; the Builder turns it on for a new task, so write `true` when you want it. |
| `minAccuracy` | No | `type_text` and `type_code`: fraction of characters that must be right, above 0 and at most 1. Default `1` (exact) for `type_text`, `0.9` for `type_code`. |
| `targetWpm` | No | `type_text`: optional speed goal in words a minute. Accuracy is always checked; speed only when this is set. Scores are kept across lessons for matched students; see [Typing history](#typing-history-showhistory). |
| `minKept` | No | `edit_text`: share (above 0, at most 1; default `0.9`) of the characters `start` and `target` have in common that must survive untouched. Deleting the line and typing it again fails. |
| `showTarget` | No | `edit_text`: show the fixed line above the edit box ("Make it say: …"). Default `true`; set `false` for a find-the-mistakes challenge. |
| `language` | No | `type_code`: `python` (default) or `html`. Colours the code and sets the Tab width: 4 spaces for Python, 2 for HTML. |
| `targetCpm` | No | `type_code`: optional speed goal in characters a minute (only correct characters count). Speed is always shown; it is only checked when this is set. |
| `durationSeconds` | No | `falling_words`: length of the round, a whole number from 15 to 300. Default `60`. |
| `showHistory` | No | `type_text`, `type_code` and `falling_words`: `true` shows each student their last and best score from earlier lessons beside every item, and how far they've come once they finish it. Items (`type_text`, `type_code`) can set their own `showHistory: true` or `false`. See [Typing history](#typing-history-showhistory). |
| `words` | Yes (`falling_words`) | `falling_words`: the words or code tokens that fall, at most 100. Tokens may contain symbols and spaces (`for i in`, `[1, 2]`), up to 20 characters each, with no space at either end. Quote them in YAML. |

## Item fields by mode

| Mode | Item fields | Notes |
|---|---|---|
| `type_text` | `text` (required, ≤ 200 characters, only characters on the layout) | The line is shown with each typed character marked right or wrong, plus accuracy (and speed when `targetWpm` is set). Enter or reaching the end finishes the line. |
| `find_key` | `key`: one typeable character or a named key (`Enter`, `Backspace`, `Tab`, `Shift`, `Space`, `CapsLock`, `Delete`, `Escape`, `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`); optional `prompt` | After two wrong presses the key lights up on a keyboard picture. |
| `symbols` | `char`: one character on the layout; optional `prompt` | Symbols that need Shift only count when Shift was held. UK examples: Shift + 2 = `"`, Shift + ' = `@`, Shift + 3 = `£`. |
| `shortcuts` | `combo` like `Ctrl+C` (`Ctrl` also matches Cmd on a Mac), or Shift with a non-typing key such as `Shift+Tab` or `Shift+ArrowLeft` (`Shift+A` is just typing, so it is rejected); `prompt` (a warning if missing); optional `practiceText` for the practice box | Browser-reserved shortcuts (Ctrl+W, Ctrl+T, Ctrl+N, Ctrl+Q, Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+Shift+T, Ctrl+Shift+N, Ctrl+Shift+W, Alt+F4, Alt+Tab) are rejected: the page never sees them, so teach those with a quiz question. Copying/cutting/pasting with the right-click menu is noticed and the hint asks for the keys instead. The item's shortcut counts wherever the student presses it on the page, and the browser's own action (such as Ctrl+S's save dialog) is blocked; copy, cut, paste, select-all, undo and redo only count in the practice box because they act on its text. A Tab shortcut (`Shift+Tab`) is practised in a row of three fields instead of the practice box (`practiceText` is not used), and focus really moves back a field. |
| `edit_text` | `start` and `target` (both required, ≤ 200 characters on the layout, and different); optional `prompt`; optional `requireKeys`: a list of `Backspace`, `Delete`, `ArrowLeft`, `ArrowRight`, `Home`, `End` and `select` (any Shift selection: Shift + an arrow, Home or End, or Ctrl+A) | The student edits `start` in place: arrows, Home/End and Shift selection move and select, Backspace deletes left, Delete deletes right, typing inserts (replacing a selection); clicking a letter puts the cursor before it. Paste and drag-drop do nothing. The line finishes when it matches `target` exactly (capitals and punctuation included). It then passes only if it was **edited, not retyped** (see `minKept`) and every `requireKeys` key was used. |
| `type_code` | `code` (required): a block of code with newlines and indentation, ≤ 1000 characters and ≤ 30 lines, only characters on the layout; optional `prompt` | See [Typing code](#typing-code-type_code). |
| `falling_words` | No items: the task's `words` list | See [Falling words](#falling-words-falling_words). |

Any item may set `hardwareOnly: true`: it then only counts when typed on a real keyboard, not
the on-screen one. `type_text` and `type_code` items may also set `showHistory` (overrides the
task's).

## Typing code (`type_code`)

The block is shown in a monospace box, coloured like code, with faint dots for indentation spaces
and a ↵ at the end of each line. As the student types, each character turns green (right) or red
(wrong), newlines and indentation included, and a caret shows where the next character goes.

- **Enter** types a newline. There is **no auto-indent**: students type the indentation themselves.
- **Tab** at the start of a line types spaces up to the next tab stop (4 for Python, 2 for HTML),
  so one Tab and four spaces count the same. Tab after code on a line does nothing. **Backspace**
  in the indentation removes back to the previous tab stop; elsewhere it removes one character.
  Each Backspace that removes something counts as a correction. The cursor is always at the end,
  so Delete and the arrow keys do nothing.
- **Esc** leaves the typing area (Tab is kept for indentation). Paste and drag-drop do nothing.
- Tabs at the start of a line in `code` become spaces (a tab stop each); trailing spaces and the
  final newline of a YAML `|` block are dropped.
- The block finishes when the student has typed as many characters as it has. It passes when the
  accuracy is at least `minAccuracy`, and, when `targetCpm` is set, the speed is at least that.
  Hints: "Check the spaces at the start of each line. Press Tab once for each step in (4
  spaces).", "Look for the red letters and symbols, then try again a little slower.", "Nearly!
  Try again a little faster (aim for 90 characters a minute)."
- Accuracy, characters a minute and corrections show under the block while typing.

## Falling words (`falling_words`)

A timed warm-up. Words or code tokens fall from the top of the play area; typing one exactly
(capitals, symbols and spaces included) clears it. What the student has typed shows under the play
area, red when it no longer matches the start of any token on screen; Backspace fixes it, and Enter
or Esc empties it. When two tokens on screen match, the lowest one is cleared.

- **Points only, no lives.** A cleared token scores 10 points plus one per character; a token that
  reaches the bottom is missed and costs 5 points (the score never goes below 0).
- The round **always runs for the full `durationSeconds`** and then completes, whatever the score:
  it is a warm-up, and the score is the outcome. Tokens come a little faster as the round goes on.
- The student presses **Start**. The round pauses when the tab is hidden or the play area loses
  focus ("Paused: click here to carry on"). **Play again** starts a new round.
- With *reduce motion* turned on in the device settings, tokens fall 1.5 times slower and a miss
  doesn't shake the play area.

## Results

Each typing item stores a small result, so typing history can read every typing mode the same
way. Every typing mode records `mode`, `accuracy` (0–1), `cpm` (correct characters a minute),
`wpm` (`cpm` / 5), `corrections` (Backspace presses that removed something), `timeMs` and `done`:

| Mode | Also records |
|---|---|
| `type_text` | `typed`, `shiftCapitals`, `capsLockCapitals`, `source` |
| `type_code` | `typed`, `source` |
| `falling_words` | `cleared`, `missed`, `score`, `source` (stored as one item with id `round`; `accuracy` is the share of keystrokes that matched the start of a token on screen) |

## Typing history (`showHistory`)

Every finished `type_text`, `type_code` and `falling_words` result is kept across lessons, so
students, tutors and parents can see progress (no lesson field needed for that). It is saved by
the **tutor's** browser, not the student's:

- Only for students the tutor has matched to the class list (👥 Match students). A session with
  no class, or a student who isn't matched, saves nothing. Results a student finished before
  being matched are saved as soon as they are matched.
- Each result is saved once (date, lesson, task, item, mode, characters and words a minute,
  accuracy, corrections, time, and `score` for falling words), on the student's class-list entry.
  The teacher's **Complete (show answers)** results and answers the tutor edited are never saved.
- Scores are kept per mode: `type_text`, `type_code` and `falling_words` are compared only with
  themselves. The class fork of a lesson counts as the stock lesson.

With `showHistory: true` the student sees, beside each item:

```text
📈 Last time: 62 cpm, 91% · Best: 75 cpm
```

`Last time` is the average of their most recent earlier session in that mode, and `Best` their
best single item before today (characters a minute, then accuracy). When they finish an item faster
than their first session, it adds "You went from 40 to 75 characters a minute." (and "New best!"
when they beat their best). Nothing shows until the student has a score from an earlier lesson, so
a first lesson looks exactly as before. Slower results get no comment.

```yaml
- title: Timed challenge
  type: keyboard
  mode: type_code
  showHistory: true
  items:
    - id: a
      code: print("Ready")
```

The tutor always sees the history (with or without `showHistory`): a `📈 Last 62 · Best 75 cpm ·
first 40` line on the student card and a **📈 Typing history** list of recent scores in the
StudentModal. The [session report](../session-reports.md#typing-history) puts each matched
student's score next to their previous one, anonymised. Admin → Classes → Students → **Typing**
lists a student's saved scores for progress conversations with parents.

## Devices without a keyboard

Keyboard tasks need a physical keyboard. On a tablet with no keyboard the student sees a note
and a built-in **on-screen UK keyboard** (with one-shot Shift and Ctrl keys) that works for every
item except `hardwareOnly` ones and `edit_text` items, which need arrow keys and a Delete key the
on-screen keyboard doesn't have yet, and `type_code` and `falling_words` tasks, which need Tab
and symbols the on-screen keyboard hides (those show a "needs a real keyboard" note instead). An **I have a keyboard** button hides it, and pressing any real
key proves a keyboard is there. The teacher's card and modal show an "On-screen keyboard" badge
for work done this way.

## Mac and Chromebook keyboards

Families use their own computers, so the keys being taught may be named differently or be
missing. The browser reports each platform's equivalent as the Windows key, so the same item
passes on every machine. Prompts, hints and the keyboard picture use the student's own names
(the platform comes from the browser; iPads count as "other"):

| Taught as | Mac | Chromebook | Counts in |
|---|---|---|---|
| Backspace | the key labelled **delete** | Backspace | `find_key`, `type_text`, `edit_text`, `type_code`, `falling_words` |
| Delete | **fn + delete** | **Alt + Backspace** | `find_key`, `edit_text` `requireKeys` |
| Caps Lock | caps lock (turning it *off* counts too) | **Alt + Search** | `find_key`, `requireShiftForCapitals` |
| Home / End | **fn + ← / →** or **Cmd + ← / →** | **Search + ← / →** | `edit_text` |
| Enter | return | Enter | `find_key` |
| Ctrl in shortcuts | Cmd | Ctrl | `shortcuts` (`Ctrl` matches Cmd) |

- The teacher's card and modal show a **Mac** or **Chromebook** badge for work done on one
  (recorded in the activity's own state, like the on-screen keyboard badge).
- **Not yet checked on real devices:** Chromebook Alt + Search (Caps Lock) and Search + arrows
  (Home / End) rely on ChromeOS turning them into Caps Lock / Home / End before the browser sees
  them; Mac fn combinations likewise. Report anything that doesn't register.
- **Known gap:** `symbols` mode uses the UK Windows layout. A UK Mac keyboard puts some symbols
  elsewhere (`@` is Shift + 2, `"` is Shift + ', `#` is Alt + 3), so the key picture and "Press
  Shift + '" hints can be wrong on a Mac.

## Marking and hints

- **One round, marked as you go.** An activity task is one round: a single goal of 3-8 reps that moves on by itself, with no in-task navigation; if you want the class to look at one answer together, make it its own task. Keyboard items finish themselves (a line typed,
  a key found, a shortcut used) and tick straight away; the next item then appears by itself. There
  is no Check button and no Previous / Next: the student sees a progress strip (`3 of 5 done`).
  An item that finished but isn't right (a typed line with too many mistakes) shows its hint and
  **Try again**.
- **Core, then bonus.** The task passes when `coreItems` items are done (all by default). After
  that the student sees "Done! ⭐ Bonus round" and the rest are labelled Bonus. When every item is
  done they get "You did it! N done" with **Play again**, which clears the items on that device
  and never un-passes the task or logs a fail.
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
- `type_code` cards add the average accuracy and speed of the blocks finished so far: `2/3 done ·
  94% · 71 cpm`. While the tutor watches a student, the modal shows the block with every typed
  character marked as they type it.
- `falling_words` cards read `falling: playing · 12 cleared · 2 missed` during the round (live
  while the tutor watches that student) and `falling: 23 cleared · 4 missed · 250 pts` at the end;
  the modal shows the score, cleared, missed, accuracy and speed.
- **Stage → Start again** clears the results; **Complete (show answers)** marks every item done.
- **Edit answers** works as for other activities.
- Go Live is teacher-only on Keyboard tasks; a student's work is never broadcast.

## Validation

See the Keyboard table in [validation-errors.md](../validation-errors.md).
