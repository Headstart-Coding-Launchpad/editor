# The Stage: a guide for lesson writers

The Stage is the 400 × 400 drawing pane a Python task gets when its code imports the `stage`
module. This guide puts everything about it in one place: how its coordinates work, every call,
how to place things, the mistakes students make, and how to design Stage tasks and checks. It is
written for lesson writers (Lesson Gen's **Make It Real** lessons are built on it) and tutors.

The exact contract (every field, check and error) is in
[python.md → Stage](python.md#stage-drawing-beside-the-console). Where this guide and python.md
differ, python.md wins.

---

## 1. The Stage at a glance

```
(0, 0) ──────── x goes right ────────▶ (400, 0)
  │
  │        (100, 100)        (300, 100)
  │
  y              (200, 200)
  goes            the middle
  down
  │        (100, 300)        (300, 300)
  ▼
(0, 400)                               (400, 400)
```

- **400 wide, 400 tall**, always. It scales to fit the screen, but the numbers never change.
  `WIDTH` and `HEIGHT` are both `400`.
- **(0, 0) is the top-left corner.** `x` goes right; `y` goes **down**. A bigger `y` is lower.
- **The middle is (200, 200)**, and it is where everything goes when no `x` or `y` is given.
- **`x` and `y` are always the middle of the thing drawn**: the centre of a circle, square,
  rectangle, polygon, text, emoji or grid. Never a corner.
- **`angle=` turns clockwise**, around the shape's own middle.

How it compares with the other drawing places students meet:

| | Stage | Turtle | Arcade Kit |
|---|---|---|---|
| Where (0, 0) is | top-left corner | the middle | top-left corner |
| Which way `y` goes | down | up | down |
| What `x`, `y` place | the middle of the shape | where the turtle is | a rectangle's top-left corner |
| Turning | `angle=` clockwise | `left()` anticlockwise | — |

Say this out loud in lessons that follow a Turtle lesson: "On the Stage, y goes **down**."

## 2. Every call

```python
from stage import *        # or: import stage, then stage.circle(50)
```

Calls are **size first**. The simplest call is just the size; colour, then position, then the
rest are added as students grow. Every value can also be given by name (`colour="red"`, `x=100`;
`color=` works too). Every call draws straight away, on top of what is already there.

| Call | Simplest | Grown up | Draws |
|---|---|---|---|
| `circle` | `circle(50)` | `circle(50, "red", x=100, y=80)` | a circle, radius 50 (100 across) |
| `square` | `square(80)` | `square(80, "gold", x=300, y=100, angle=45)` | a square, 80 along each side |
| `rect` | `rect(120, 60)` | `rect(120, 60, "teal", x=200, y=350)` | a rectangle 120 wide, 60 tall |
| `polygon` | `polygon(6, 60)` | `polygon(3, 60, "green", angle=180)` | a regular shape: 6 sides, 60 from centre to each corner, one corner pointing up |
| `line` | `line(0, 0, 400, 400)` | `line(0, 200, 400, 200, "grey", width=4)` | a line between two points (the only call placed by its ends) |
| `text` | `text("Hi")` | `text("Score: " + str(s), "navy", x=200, y=30, size=24)` | words centred on (x, y), size 16 by default; a number is drawn as text |
| `stamp` | `stamp("🚀")` | `stamp("🚀", x=80, y=320, size=64)` | one emoji, size 32 by default, in Noto Color Emoji on every device (emoji in `text()` too) |
| `grid` | `grid(rows)` | `grid(rows, palette=["white", "red"], cell=20)` | a list of rows as squares (see 5) |
| `grid` (flat) | `grid(pixels, width=8)` | `grid(pixels, width=8, cell=30, y=150)` | one long list, 8 squares to a row |
| `background` | `background("skyblue")` | | fills the whole stage |
| `clear` | `clear()` | | wipes the stage back to white |
| `hue` | `hue(120)` | `hue(i * 9, light=70)` | draws nothing: gives back a colour round the colour wheel |

**Extras on every shape** (`circle`, `square`, `rect`, `polygon`):

| Keyword | Does | Also works on |
|---|---|---|
| `angle=45` | turns it 45° clockwise around its middle | `text`, `stamp` |
| `opacity=0.5` | half see-through (0 invisible, 1 solid, the default) | `line`, `text`, `stamp` |
| `outline="black"` | an outline on top of the fill | |
| `width=4` | outline thickness (needs `outline=`) | `line` (line thickness) |
| `colour=None` | no fill, just the outline (needs `outline=`) | |

Default colours: **royal blue** for shapes, **black** for text and lines, so a first `circle(50)`
shows clearly on white.

## 3. Colours

A colour is text:

- a colour name: `"red"`, `"gold"`, `"skyblue"`, `"cornflowerblue"` (any CSS name);
- a hex code: `"#ff0000"` or `"#f00"`;
- a PICO-8 name from Arcade Kit: `"dark_blue"`, `"dark_purple"`, `"dark_green"`, `"dark_gray"`,
  `"light_gray"`, `"peach"` (a space or `grey` works too);
- what `hue()` gives back: `hue(0)` red, `hue(60)` yellow, `hue(120)` green, `hue(240)` blue,
  wrapping every 360. `light=` below 50 is darker, above 50 paler.

`hue()` is the way into colour with loops: `circle(200 - i * 10, hue(i * 20))` in a `for` loop is
a rainbow target.

## 4. Placing things

Because `x` and `y` are the middle, the edges of a shape are half its size either side:

| To put… | Write | Because |
|---|---|---|
| a 100 square in the top-left corner | `square(100, x=50, y=50)` | its middle is half of 100 in from each edge |
| a 100 square in the bottom-right corner | `square(100, x=350, y=350)` | 400 − 50 |
| a ground strip along the bottom | `rect(400, 60, "green", y=370)` | 400 − 60 ÷ 2 |
| a sun in the top-right | `circle(40, "gold", x=340, y=60)` | 40 in from the edges, plus a gap |
| a title at the top | `text("My Planet", size=28, y=30)` | text is centred too |
| four circles in a row | `for i in range(4): circle(40, x=50 + i * 100)` | middles at 50, 150, 250, 350 |
| a shape on top of another | draw it **after** | later calls draw on top |

Rules of thumb to teach:

1. **Think in 50s.** 0, 50, 100 … 400. Places at multiples of 50 are easy to say, to check and to
   see on the target ghost.
2. **Middle first.** Leave out `x` and `y` until the picture needs them; everything starts in the
   middle.
3. **Smaller y is higher up.** The sky is near `y=0`, the ground near `y=400`.
4. **Draw the background first** (`background()` or a big `rect`), then the things in front.

## 5. Pictures from lists (`grid`)

A list of rows is a picture, one square per value:

```python
heart = [
    [0, 1, 0, 1, 0],
    [1, 1, 1, 1, 1],
    [0, 1, 1, 1, 0],
    [0, 0, 1, 0, 0],
]
grid(heart, palette=["white", "red"])   # 0 is the first palette colour, 1 the second
```

- With a `palette`, a whole number picks that palette colour (0 is the first).
- Without one, whole numbers are the 16 PICO-8 colours (0 black, 7 white, 8 red …).
- A colour name or hex code is drawn as that colour; `None` draws nothing there.
- `cell=` is the square size (default: as big as fits); `x`, `y` place the grid's middle.
- `grid(pixels, width=8)` draws one long list 8 to a row. This is how real images are stored, and
  students can change a picture with one `for` loop before they meet lists of lists.
- At most 100 × 100. Grids don't take `angle`, `opacity` or `outline`.

## 6. When it draws

- **On Run.** The picture is rebuilt from nothing every Run; nothing is saved but the code.
- **While `input()` waits**, the Stage shows what has been drawn so far, so a story can draw a
  scene and then ask its question. The finished picture replaces it when the run ends.
- **With scrubbing or `runOnOpen`**, the Stage also redraws as a preview: when the task opens,
  while a number or colour is dragged, and half a second after typing stops. A preview never
  checks or counts as a Run. See [python.md → Live scrubbing](python.md#live-scrubbing-scrub).
- **In Slow-mo**, the drawing builds up step by step on replay.
- A run that draws more than 20,000 things (or 200,000 grid squares) stops: "is a loop drawing
  forever?".

## 7. Mistakes students make (and what they see)

Every mistake stops the run with a plain-English message on the student's own line. The common
ones, worth pre-empting in the lesson text:

| Mistake | They see |
|---|---|
| Position first, the old way: `circle(200, 200, 50)` | "circle(): the second value is the colour, like 'red'. To place it, write x=200, y=200, like circle(50, x=200, y=200)" |
| A misspelt colour: `"redd"` | "circle(): 'redd' isn't a colour I know. Try a name like 'red' or a hex code like '#ff0000'" |
| A number in quotes: `y="20"` | "rect(): y should be a number, like 200, not the text '20'" |
| No size: `circle()` | "circle() needs a radius, like circle(50)" |
| The wrong word: `rotation=` | "square() has no rotation= — did you mean angle=?" |
| A flat list with no width | "grid(): pixels is one long list. Say how many squares fit in a row, like grid(pixels, width=8)" |
| A shape that "vanished" | no error: it is off the stage (`x` or `y` past 400 or below 0) or under a later shape |
| Expecting `y` to go up | no error: the shape is upside-down from where they meant |

The last two are the ones a tutor will be called over for. "Where is (x, y)? Which way does y
go?" usually fixes both.

## 8. Designing Stage tasks

### Choose the check for the goal

| The task wants… | Use | Notes |
|---|---|---|
| "Make your picture match this one" | `stage_matches_target` + `stageTarget` | `tolerance` 0.01 (default) for exact copies; a little more (0.02–0.05) when shapes are placed by eye |
| "Draw at least three circles" | `stage_shape_count` | `kind`, `min`, `max`; `sides` with `kind: polygon` |
| "Use the colour gold somewhere" | `stage_colour_used` | fill, outline, text, background or a grid square |
| "The top-middle square is red" | `stage_pixel` | by `x`/`y`, by grid `row`/`col`, or by `index` |
| "Write your name on the stage" | `stage_text_shown` | `contains` ignores capitals |
| "Use a loop" / "use `angle=`" | `code` checks | stage checks see the picture, not the method |

All stage checks need a Run, and look only at what is drawn after the last `clear()`. Text and
emoji are checked by what they say and roughly where (within 12 px), never by pixels, because
fonts differ between devices.

### Rules for Make It Real and other Stage lessons

- **Give positions as numbers in 50s**, and say which way `y` goes the first time it matters.
- **Show, don't describe, the goal.** For a placement task use a `stageTarget`: its faint ghost
  shows students where things go, and **Differences** tells them where they are off ("near x 42,
  y 18 the target is red but yours is white").
- **Start from something that draws.** Give a starter that already puts a picture on the Stage, so
  the first Run shows something. Add `scrub` on Modify steps ("make the sun bigger") so students
  drag the number and see it change; Make It Your Own steps suit `scrub: { afterPass: true }`.
- **Hints name colours in words** and never rely on colour alone: "colour the top middle square
  red", not "make it this colour".
- **Introduce in this order:** a shape in the middle → size → colour → `x`/`y` → `angle`/`opacity`
  → loops with `hue()` → `grid`. It matches the size-first order of the calls.
- **`input()` and the Stage mix**: draw the scene before asking, and it stays up while the student
  answers. Programs with `input()` don't run on open.
- **Keep it on the stage**: a picture students design themselves should fit 0–400 both ways;
  remind them that a shape half off the edge is cut off.

## 9. What the tutor sees

- The student's card shows a small thumbnail of their last drawing; the student modal shows it
  beside their code (under it on a narrow screen), with **Bigger picture** for more room.
- While the tutor has a student open, scrub and typing previews redraw on the tutor's screen too,
  not only on Run.
- After a scrub, the card and modal show whether the checks passed or failed with the new value.
- In **Go Live**, the presenter's drawing shows on every screen.
- The Stage has a screen-reader description of every shape in words ("a red square, size 80,
  turned 45°, in the middle").

## See also

- [python.md → Stage](python.md#stage-drawing-beside-the-console): the full contract, target
  pictures, every check field and error.
- [python.md → Live scrubbing](python.md#live-scrubbing-scrub): drag-to-change values.
- [turtle.md](turtle.md): the Turtle's centred, y-up world.
- [arcade.md](arcade.md): Arcade Kit, which shares the PICO-8 colours.
