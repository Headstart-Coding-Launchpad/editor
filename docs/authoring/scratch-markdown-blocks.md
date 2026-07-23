# Scratch Markdown Block Reference

This is the complete reference for writing Scratch blocks in author-facing Markdown (`explainer`, `description`, and `syntax`). It documents every block currently recognised by the renderer.

For the task toolbox XML and check opcodes, see [Scratch Toolbox XML](scratch-toolbox-xml.md). For all other Markdown features, see [Markdown Renderer Reference](markdown-renderer.md).

---

## How to render a block

Use `scratch:` inside inline code for one block:

```
Use `scratch:move (10) steps` to move the sprite.
```

Use a `scratch` fenced block for a stack. The source text in the tables below is exactly what belongs after `scratch:` or on a line in the fence.

````markdown
```scratch
when green flag clicked
move (10) steps
```
````

Use square brackets for menu and text inputs (`[space]`, `[Hello!]`), round brackets for number/value inputs (`(10)`), and angle brackets for Boolean inputs (`<touching [edge]?>`). Substitute values freely while retaining the brackets.

The renderer ignores ordinary spacing differences and is case-insensitive. It also accepts the small set of aliases noted below. Do not use block opcodes (such as `motion_movesteps`) in Markdown: opcodes are for toolbox XML and checks, not rendered block text.

### C-block stacks

For `repeat`, `forever`, `if`, and related C-blocks, indent each nested level by two spaces. Use `else` only for the second mouth, and `end` to close each open C-block. `else` and `end` control the layout; they do not render as blocks.

````markdown
```scratch
if <touching [edge]?> then
  turn right (15) degrees
else
  move (10) steps
end
```
````

---

## Complete block list

### Events

| Opcode | Write this for rendering | Shape |
|---|---|---|
| `event_whenflagclicked` | `when green flag clicked` | Hat |
| `event_whenkeypressed` | `when [space] key pressed` | Hat |
| `event_whenthisspriteclicked` | `when this sprite clicked` | Hat |
| `event_whenbackdropswitchesto` | `when backdrop switches to [backdrop1]` | Hat |
| `event_broadcast` | `broadcast [message1]` | Stack |
| `event_broadcastandwait` | `broadcast [message1] and wait` | Stack |
| `event_whenbroadcastreceived` | `when I receive [message1]` | Hat |

### Motion

| Opcode | Write this for rendering | Shape |
|---|---|---|
| `motion_movesteps` | `move (10) steps` | Stack |
| `motion_turnright` | `turn right (15) degrees` | Stack |
| `motion_turnleft` | `turn left (15) degrees` | Stack |
| `motion_pointindirection` | `point in direction (90)` | Stack |
| `motion_gotoxy` | `go to x: (0) y: (0)` | Stack |
| `motion_goto` | `go to [random position]` | Stack |
| `motion_glidesecstoxy` | `glide (1) secs to x: (0) y: (0)` | Stack |
| `motion_glideto` | `glide (1) secs to [random position]` | Stack |
| `motion_ifonedge_bounce` | `if on edge, bounce` | Stack |
| `motion_setx` | `set x to (0)` | Stack |
| `motion_sety` | `set y to (0)` | Stack |
| `motion_changexby` | `change x by (10)` | Stack |
| `motion_changeyby` | `change y by (10)` | Stack |
| `motion_setrotationstyle` | `set rotation style [left-right]` | Stack |
| `motion_xposition` | `x position` | Reporter |
| `motion_yposition` | `y position` | Reporter |
| `motion_direction` | `direction` | Reporter |

### Looks

| Opcode | Write this for rendering | Shape |
|---|---|---|
| `looks_sayforsecs` | `say [Hello!] for (2) seconds` | Stack |
| `looks_say` | `say [Hello!]` | Stack |
| `looks_think` | `think [Hmm...]` | Stack |
| `looks_thinkforsecs` | `think [Hmm...] for (2) seconds` | Stack |
| `looks_show` | `show` | Stack |
| `looks_hide` | `hide` | Stack |
| `looks_setsizeto` | `set size to (100) %` | Stack |
| `looks_changesizeby` | `change size by (10)` | Stack |
| `looks_switchcostumeto` | `switch costume to [costume1]` | Stack |
| `looks_nextcostume` | `next costume` | Stack |
| `looks_costumenumber` | `costume number` | Reporter |
| `looks_costumenumbername` | `costume [number]` | Reporter |
| `looks_switchbackdropto` | `switch backdrop to [backdrop1]` | Stack |
| `looks_nextbackdrop` | `next backdrop` | Stack |
| `looks_backdropnumbername` | `backdrop [name]` | Reporter |
| `looks_seteffectto` | `set [color] effect to (0)` | Stack |
| `looks_changeeffectby` | `change [color] effect by (25)` | Stack |
| `looks_cleargraphiceffects` | `clear graphic effects` | Stack |

### Sound

| Opcode | Write this for rendering | Shape |
|---|---|---|
| `sound_play` | `start sound [meow]` | Stack |
| `sound_playuntildone` | `play sound [meow] until done` | Stack |
| `sound_stopallsounds` | `stop all sounds` | Stack |

### Control

| Opcode | Write this for rendering | Shape |
|---|---|---|
| `control_wait` | `wait (1) seconds` | Stack |
| `control_wait_until` | `wait until <>` | Stack |
| `control_repeat` | `repeat (10)` | C-block |
| `control_repeat_until` | `repeat until <>` | C-block |
| `control_forever` | `forever` | C-block |
| `control_if` | `if <> then` | C-block |
| `control_if_else` | `if <> then else` | C-block |
| `control_stop` | `stop all` | Cap |
| `control_create_clone_of` | `create a clone of [myself]` | Stack |
| `control_start_as_clone` | `when I start as a clone` | Hat |
| `control_delete_this_clone` | `delete this clone` | Cap |

### Sensing

| Opcode | Write this for rendering | Shape |
|---|---|---|
| `sensing_askandwait` | `ask [What's your name?] and wait` | Stack |
| `sensing_answer` | `answer` | Reporter |
| `sensing_keypressed` | `key [space] pressed?` | Boolean |
| `sensing_mousedown` | `mouse down?` | Boolean |
| `sensing_touchingedge` | `touching edge?` | Boolean |
| `sensing_touchingobject` | `touching [mouse-pointer]?` | Boolean |
| `sensing_distanceto` | `distance to [mouse-pointer]` | Reporter |
| `sensing_timer` | `timer` | Reporter |
| `sensing_resettimer` | `reset timer` | Stack |

### Operators

| Opcode | Write this for rendering | Shape |
|---|---|---|
| `operator_equals` | `(1) = (2)` | Boolean |
| `operator_gt` | `(1) > (2)` | Boolean |
| `operator_lt` | `(1) < (2)` | Boolean |
| `operator_and` | `<> and <>` | Boolean |
| `operator_or` | `<> or <>` | Boolean |
| `operator_not` | `not <>` | Boolean |
| `operator_add` | `(1) + (2)` | Reporter |
| `operator_subtract` | `(1) - (2)` | Reporter |
| `operator_multiply` | `(1) * (2)` | Reporter |
| `operator_divide` | `(1) / (2)` | Reporter |
| `operator_mod` | `(1) mod (2)` | Reporter |
| `operator_round` | `round (3.14)` | Reporter |
| `operator_mathop` | `abs of (10)` | Reporter |
| `operator_random` | `pick random (1) to (10)` | Reporter |
| `operator_join` | `join [hello] [world]` | Reporter |
| `operator_letter_of` | `letter (1) of [hello]` | Reporter |
| `operator_length` | `length of [hello]` | Reporter |
| `operator_contains` | `[apple] contains [a]?` | Boolean |

`operator_mathop` also accepts: `floor of (10)`, `ceiling of (10)`, `sqrt of (10)`, `sin of (10)`, `cos of (10)`, `tan of (10)`, `asin of (10)`, `acos of (10)`, `atan of (10)`, `ln of (10)`, `log of (10)`, `e ^ of (10)`, and `10 ^ of (10)`.

### Variables

| Opcode | Write this for rendering | Shape |
|---|---|---|
| `data_variable` | `[score]` | Reporter |
| `data_setvariableto` | `set [score] to (0)` | Stack |
| `data_changevariableby` | `change [score] by (1)` | Stack |
| `data_showvariable` | `show variable [score]` | Stack |
| `data_hidevariable` | `hide variable [score]` | Stack |

---

## Accepted aliases

These alternatives render as the same block, but the canonical form above is preferred in new content:

| Canonical block | Also accepted |
|---|---|
| `turn right (15) degrees` | `turn (15) degrees` |
| `set size to (100) %` | `set size to (100)%` |
| `start sound [meow]` | `play sound [meow]` |

## Optional icons

The Markdown editor inserts each block with its category icon. The icon is optional: both `move (10) steps` and its toolbar-inserted icon-prefixed form render as the same Motion block. Prefer the plain canonical text when writing source by hand.

## Keeping this reference current

`src/shared/scratchBlockCatalog.js` is the implementation source of truth. When adding, changing, or removing a Scratch block, update this reference, [Markdown Renderer Reference](markdown-renderer.md), and [Scratch Toolbox XML](scratch-toolbox-xml.md) in the same change.
