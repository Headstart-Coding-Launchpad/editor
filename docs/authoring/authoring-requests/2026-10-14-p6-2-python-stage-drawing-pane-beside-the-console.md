# Python Stage: a drawing pane beside the console (prototype)

- **Status:** open
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, sent straight to LaunchPad Dev at Ryan's request, bypassing pipeline-ui), 2026-10-14
- **Lessons blocked:** none yet. This is build 2 of 6 in Lesson Gen's P6 Visual learning plan, and the plan's keystone.

## Need

Ryan wants Python students to "use code to do something visually very easily", the way Brilliant does. Today Python output is console text. The Python track's final projects are all console-only. Visual output appears only in an optional demo that students skip about every session.

**Closest existing capabilities:**
- **`turtle`** (`docs/authoring/turtle.md`) draws, but it's a separate workspace with a turtle-path model. One turtle, instant drawing, no pixel grids, no shapes placed by coordinate, and no target comparison.
- **`arcade`** (`docs/authoring/arcade.md`) draws, but it's a game loop with no checks on game state (only `code` and `run_attempted`).
- **`python`** has no graphics at all.

None of them lets an ordinary console-Python task also draw. None can check a drawing against a target picture.

**The prototype question:** after a pilot, Ryan will choose between three options:
1. The Stage beside the console in the normal `python` workspace.
2. The Stage as its own workspace.
3. Extending Turtle instead.

So please build it in whichever shape keeps those three options open. The preferred shape is a pane inside the `python` workspace that appears only once the code draws. `print()` keeps going to the console.

## Example task

```yaml
- id: 20
  moduleType: python          # stage pane appears when the code calls stage functions
  title: A list is a picture
  codeStages:
    - role: starter
      code: |
        from stage import *

        heart = [
            [0, 1, 0, 1, 0],
            [1, 1, 1, 1, 1],
            [0, 1, 1, 1, 0],
            [0, 0, 1, 0, 0],
        ]
        grid(heart, palette=["white", "red"])
        print("Rows:", len(heart))
  stageTarget:                 # optional: faint ghost the student draws over; diff after Run
    code: |
      from stage import *
      grid([[0,1,0,1,0],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]], palette=["white","red"])
  check:
    - type: stage_matches_target
      tolerance: 0.02          # fraction of pixels allowed to differ
    - type: output
      operator: contains
      value: "Rows: 4"
```

Suggested starter library. Names are a proposal; keep it small, and every call should draw something straight away:

| Call | Draws |
|---|---|
| `background(colour)` | fills the stage |
| `rect(x, y, w, h, colour)` | a rectangle |
| `circle(x, y, r, colour)` | a circle |
| `line(x1, y1, x2, y2, colour, width=2)` | a line |
| `text(x, y, words, colour, size=16)` | text |
| `stamp(emoji, x, y, size=32)` | an emoji |
| `grid(rows, palette=None, cell=None)` | a 2D list as a pixel grid; values index `palette`, or are colours themselves |
| `clear()` | wipes the stage |

- **Colours:** CSS colour names, hex strings, and the PICO-8 names Arcade already uses.
- **Size:** a fixed 400×400 stage, like Turtle.
- **Coordinates:** pick one convention and document it. Prefer matching Arcade Kit or Turtle, so students don't learn two systems. Tell us which you chose.

**Phase 2 (not needed for the prototype):**
- Picture values for function and return lessons, Bootstrap-style: `circle(50, "red")` returns a picture; `beside(a, b)`, `above(a, b)` and `overlay(a, b)` combine pictures; `show(pic)` draws one.
- A simple `frame` / animation loop.

## Checks wanted

- **Outcome checks:**
  - `stage_matches_target`: the rendered stage matches the `stageTarget` render within a tolerance.
  - `stage_shape_count`: by kind, with min and max.
  - `stage_colour_used`: a colour appears.
  - `stage_pixel`: a grid cell or point has a colour.
  - `stage_text_shown`: some text was drawn.
- **Feedback:** with a target set, after Run the student can toggle a **diff view** that highlights where their drawing differs from the target. The target ghost can be shown or hidden.
- **Method (optional):** the existing `code` checks are enough, e.g. "used `grid`".
- **Test tooling:** `lessons test-checks` should evaluate stage checks like other run checks.

## Devices

- **Desktop:** the stage scales to fit beside the editor.
- **Tablet and narrow screens:** it stacks above the console.
- **Diff and ghost toggles:** touch targets at least 44 px.
- **Rendering:** drawing is instant, as Turtle's is, so there's no performance worry on Chromebooks.

## Notes

- **Ages:** 11–16. Pixel art, generative art and filters, not cartoon mascots.
- **Accessibility:**
  - Provide a text description of what's on the stage for screen readers (a list of the shapes, the text and the grid size).
  - Stage checks never rely on colour alone in their hints: name the colour.
- **Teacher:** sync like Turtle's live view. The finished drawing goes to the student card, and it works in **Go Live**.
- **Persistence:** no persistence needed, the same as Turtle.
- **Later:** a gallery for sharing creations is a later P6 build, so keep the drawing serialisable.
- **With build 3:** Python slow-mo should draw the stage step by step, and the name-tag panel (build 1) sits beside the stage.

## Resolution

