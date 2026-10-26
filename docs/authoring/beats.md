# Beat Maker: a guide for lesson writers

Beat Maker is the `beats` Python module. A drum pattern is a string, `play()` plays the patterns
together, and the Stage shows them as a **step sequencer**: one row of squares per drum, lit where
there's an `x`, with a playhead sweeping across in time. It is Make It Real's second build
(Lesson Gen `LG-P9 Make it real.md` §1).

Beat Maker lives on the [Stage](stage.md): a task gets it by importing `beats` in a Python task.
There are no new task fields and no new checks. Patterns are strings and numbers, so the
existing `variable_*` and `code` checks judge every beat task, and **every task can be done and
checked with the sound off**.

---

## 1. The lesson moment

```python
from beats import *
kick  = "x...x...x...x..."
snare = "....x.......x..."
hat   = "x.x.x.x.x.x.x.x."
play(kick, snare, hat, tempo=100)
```

Press Run: the grid appears and the beat plays. Change one character, Run again, and hear it.

## 2. Every call

```python
from beats import *        # gives play and stop only; or: import beats, then beats.play(...)
```

| Call | What it does |
|---|---|
| `play(kick, snare, hat, clap, tempo=100)` | Plays up to four patterns together. Positional patterns go to kick, snare, hat, clap **in that order**. |
| `play(hat="x.x.", clap="..x.")` | Patterns can also be given by name, in any order, mixed with positional ones. `hats=`, `hihat=` and plurals work too. |
| `play(**beat)` | A dict of instrument to pattern (Level 3): `beat = {"kick": "x...", "clap": "..x."}`. |
| `play(kick, None, hat)` | `None` leaves a drum out. |
| `stop()` | The beat won't play: every `play()` before it is dropped. |

- **`from beats import *` gives only `play` and `stop`.** `kick`, `snare`, `hat`, `clap` and
  `tempo` stay the student's own variable names, and show in the name-tag panel as usual.
- **`tempo`** is beats a minute, **40 to 240**, default 100. A step is a sixteenth note, so 16
  steps are one bar: at tempo 100 a step is 0.15 s and 16 steps take 2.4 s.

### Patterns

- One character per step: **`x`** is a hit, **`.`** is a rest. **`X`** is a louder hit (an accent).
- Nothing else: no spaces, no `-`, no `o`. Step 0 is the first character, so the grid's step
  numbers are the string's indexes.
- 1 to **64** steps (four bars of 16).
- **A list of strings is joined into one pattern** (Level 3): `["x...", "x.x."]` is 8 steps, and
  `["x", ".", "x", "."]` works too.
- **Different lengths:** the longest pattern sets the length; **a shorter pattern repeats** until
  the longest ends. `play("x...", "....x.......x...")` plays the kick four times. On the grid the
  repeated squares are drawn faded with a dashed edge, so students can see what is heard.

### Several `play()` calls: a song

Each `play()` in one run is a **part**, and the parts play **one after another**, each at its own
tempo (Level 4: `verse()` then `chorus()`). The grid shows every part, stacked, labelled "Part 1 ·
tempo 100". At most 32 `play()` calls per run.

## 3. When it plays

- **On Run.** The program runs first, then the beat plays. Nothing plays while the code runs, and
  a program that asks `input()` plays once it has finished.
- **It plays the whole song 4 times, then stops** (a very short beat repeats until it has played
  at least 8 seconds; a long song plays fewer times, never more than a minute in all). The
  **Play** / **Stop** button on the grid plays it again or stops it.
- **Stop, Run, Reset or leaving the task stops it.** Only one beat plays at a time on a screen.
- Slow-mo shows the grid as it builds up, without playing. Go Live shows the presenter's grid on
  every screen without sound; each viewer can press Play.

## 4. Sound controls

Above the grid:

| Control | What it does |
|---|---|
| **▶ Play / ■ Stop** | Plays or stops the beat. |
| **🔊 Sound on / 🔇 Sound off** | Mute. Remembered on this device (`headstart_beats_muted`). |
| **Volume** | 0-100 %, remembered on this device (`headstart_beats_volume`). Even 100 % is capped at a safe level, and a limiter stops loud stacks of hits from blasting. |
| **💾 Save my beat** | Downloads `my-beat.wav`: the beat, played as many times as on the page. |

With the sound off the grid and playhead work exactly the same ("Sound is off: watch the grid").
The drums (kick, snare, closed hi-hat, clap) are made in code with Web Audio: no sample files,
nothing to load, nothing to license. Sound starts on Run or Play, which are clicks, so browsers
allow it; if a browser still won't start sound, the beat plays silently and says "press Play
again to hear it". Works on Chromebooks.

## 5. Mistakes students make (and what they see)

| Mistake | They see |
|---|---|
| A wrong character: `"x..ox..."` | "play(): the kick pattern has "o" as its 4th character. Use x for a hit and . for a rest" |
| Spaces to make it readable: `"x... x..."` | "play(): the kick pattern has a space as its 5th character. …" |
| An empty pattern: `""` | "play(): the kick pattern is empty. Give it at least one step, like "x..."" |
| No quotes, or a number | "play(): the kick pattern should be in quotes, like "x...x...x...x...", not the number 5" |
| The tempo without its name: `play(kick, 120)` | "play(): 120 isn't a pattern. To set the speed, give it a name: tempo=120" |
| `tempo=1000` | "play(): tempo goes from 40 (slow) to 240 (very fast), not 1000" |
| `tempo=input(...)` with no `int()` | "play(): tempo should be a number, like tempo=100, not the text "120" (try int())" |
| A drum it doesn't have: `drum="x..."` | "play() has no instrument called "drum". Use kick, snare, hat or clap (and tempo=)" |

## 6. Designing Beat Maker tasks

### Checks

Patterns are strings, so use the existing checks. All of them work with the sound off.

| The task wants… | Use |
|---|---|
| "Add a snare hit on step 14" | `variable_equals` on `snare` with the exact string |
| "Make it faster: tempo 140" | `variable_equals` on the student's `tempo` variable (give the starter `tempo = 100` and `play(..., tempo=tempo)`) |
| "Use `*` to repeat a bar" | `variable_equals` on the result **and** a `code` `contains` `*` check |
| "Add a clap" | `code` `contains` `clap=`, or a `variable_*` check on a `clap` variable |
| "Build the pattern in a loop" | `variable_equals` on the result and a `code_structure` / `code` check for the loop |
| A list of bars (Level 3) | `variable_array_equals` / `variable_array_nth_item` |

A "matches the target beat" check (Hit the target) is not built yet; until then, check the
pattern strings themselves.

### Rules

- **Start from a beat that plays.** The first Run should already make noise and light the grid.
- **Count from 0 and say so.** The grid numbers its steps from 0, like string indexes.
- **The grid is the answer key.** Never write a task that needs the sound to be heard: some
  students have no headphones, share a room or are deaf or hard of hearing.
- **Keep patterns 16 steps** in Level 1; longer patterns get small on narrow screens.
- **Give the tempo a variable** (`tempo = 100`) when a task changes it, so a check can read it.

A demo lesson with three tasks (change one character; tempo; `"x..." * 4`) is in
`exports/beat-maker-demo.json` (validated, not published).

## 7. What the tutor sees

- **The student's card** shows the grid in miniature (rows K, S, H, C), with no sound and no
  buttons.
- **The student modal** and **Show it** show the grid with **Play** and **Sound** buttons, so the
  tutor can play one student's beat on screen share. Nothing plays on the tutor's screen unless
  the tutor presses Play.
- **Export work** adds `<name>_beat.wav` next to the code (a beat on its own makes no Stage PNG).
- The grid has a screen-reader description: "Beat grid, steps counted from 0. 16 steps at 100
  beats a minute; kick on steps 0, 4, 8, 12; …".

## 8. How it works (for developers)

`src/shared/beats/`: `play()` / `stop()` record `beat` / `beat_stop` commands in the run's Stage
command list (the worker's `__hsBeatsCall`), so the beat travels wherever a Stage drawing goes
(`currentStageResult`, Go Live, Show it, share links, Export work). `readBeatSong` turns the
commands back into parts; `timing.js` holds the step maths; `player.js` schedules hits a little
ahead on the AudioContext clock (a lookahead scheduler); `render.js` renders the same hits with an
OfflineAudioContext and Scratch export's WAV encoder. See
[CODEBASE_MAP.md → Beat Maker](../CODEBASE_MAP.md#beat-maker-srcsharedbeats).

## See also

- [stage.md](stage.md): the Stage that Beat Maker draws on.
- [python.md](python.md): variable and code checks.
