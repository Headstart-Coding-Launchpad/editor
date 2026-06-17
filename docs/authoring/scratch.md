# Scratch Lesson Authoring

Everything needed to author a Scratch lesson — task fields, sprite/backdrop/variable objects, prebuilt stacks, block opcodes, check types, and explainer conventions. For envelope and common task fields see `docs/authoring/AUTHORING_GUIDE.md`.

---

## Lesson Envelope (Scratch-specific)

```yaml
id: scratch-motion
type: scratch
title: Moving Sprites
description: Move sprites around the stage.
level: 1
sandboxStarter: null         # optional — Blockly workspace state for sandbox
sandboxToolbox: "<xml>...</xml>"   # optional — Scratch XML toolbox for sandbox
sandboxSprites: []                 # optional — sprite array for sandbox
sandboxBackdrops: []               # optional — backdrop array for sandbox
```

---

## Code Task Fields

```yaml
  - title: Move the sprite
    explainer: Make the sprite move to the right.
    toolbox: "<xml>...</xml>" # optional — restricts available blocks; empty/omitted = full toolbox
    sprites:                  # optional — defaults to one cat sprite
      - id: sprite1
        name: Rocket
        type: arrow           # cat | ball | star | arrow | bat | parrot
        x: -100
        y: 0
        size: 100
        direction: 90
        costumes:             # optional — image costumes
          - name: rocket
            image: sprites/rocket.png
    backdrops:                # optional — defaults to plain white
      - id: backdrop1
        name: Space
        image: backdrops/space.png
    variables:                # optional — defaults to a single 'score' variable
      - name: score
        showOnStage: true
    starterBlocks: null       # optional — Blockly workspace state, keyed by sprite ID for multi-sprite
    completeBlocks: null      # optional — reference solution
    prebuiltStacks: []        # optional — drag-in block stacks shown in the toolbox
    codeStages: []            # optional — intermediate stages (label, blocks, prebuiltStacks)
    carryBlocksFrom: null     # optional — carry saved blocks from task ID
    check:
      type: sprite_property
      evaluation: after_run
      spriteName: Rocket
      property: x
      operator: greater_than
      value: 50
```

---

## Sprite Object

```yaml
sprites:
  - id: sprite1               # required — stable ID
    name: Rocket              # required — display name and check target
    type: arrow               # optional — cat | ball | star | arrow | bat | parrot
    x: -100                   # optional — stage x (-240 to 240)
    y: 0                      # optional — stage y (-180 to 180)
    size: 100                 # optional — percent size (default 100)
    direction: 90             # optional — Scratch direction (default 90)
    visible: true             # optional — initial visibility (default true)
    rotationStyle: all around # optional — all around | left-right | don't rotate
    costume: rocket           # optional — initial costume name
    costumes:                 # optional — image costumes
      - name: rocket
        image: sprites/rocket.png   # relative to assetsPath, or /assets/shared/...
    emoji: "🚀"               # optional — emoji rendered on stage when no costume image is active
    studentEditable: true     # optional — when false, students cannot select or view blocks (default true)
```

---

## Backdrop Object

```yaml
backdrops:
  - id: backdrop1             # required
    name: Space               # required — used by backdrop blocks
    image: backdrops/space.png  # optional — relative to assetsPath, or public root path
    colour: "#ffffff"         # optional — CSS colour for solid backdrop
```

---

## Variable Object

```yaml
variables:
  - name: score               # required
    showOnStage: true         # optional — show monitor overlay on stage
```

---

## Prebuilt Stack Object

Drag-in block stacks appended to the toolbox for the task.

```yaml
prebuiltStacks:
  - id: stack-abc123          # required — stable builder-generated ID
    label: Starter stack      # optional — builder display label
    stack: {}                 # required — Blockly toolbox-compatible block JSON
```

---

## Public Sprite Presets

`public/scratch-assets/sprites.json` defines reusable sprite definitions. Selected in the builder, copied with a new unique ID. Root-relative costume paths allow sharing across lessons:

```json
[
  {
    "id": "rocket",
    "name": "Rocket",
    "type": "arrow",
    "costumes": [{ "name": "rocket", "image": "/assets/shared/sprites/rocket.png" }]
  }
]
```

---

## Scratch Check Types

Scratch checks can be a single object or an array. `evaluation` accepts `manual`, `after_run`, or `continuous` (defaults to `manual`).

### `block_used`
```yaml
check:
  type: block_used
  evaluation: manual
  opcode: control_repeat
  fieldValues:          # optional — require specific input values
    TIMES: "10"
```
`fieldValues` keys are the Blockly input names (e.g. `STEPS`, `DEGREES`, `MESSAGE`). Omit to match any value.

### `sprite_property`
```yaml
check:
  type: sprite_property
  evaluation: after_run
  spriteName: Rocket
  property: x          # x | y | size | direction | visible
  operator: greater_than   # equals | greater_than | less_than
  value: 50
```

### `variable_equals`
```yaml
check:
  type: variable_equals
  evaluation: after_run
  variableName: score
  value: 5
```

### `variable_compare`
```yaml
check:
  type: variable_compare
  evaluation: after_run
  variableName: score
  operator: greater_than   # equals | greater_than | less_than
  value: 5
```
Use `variable_compare` for non-equality operators; `variable_equals` is legacy but still supported.

### `blocks_in_order`
```yaml
check:
  type: blocks_in_order
  evaluation: manual
  spriteName: Sprite 1   # optional — if omitted, any sprite satisfying it passes
  sequence:
    - event_whenflagclicked
    - opcode: motion_movesteps   # object form — allows fieldValues
      fieldValues:
        STEPS: "50"
    - motion_turnright           # plain string — any value accepted
```
Passes if any connected stack contains the opcodes **consecutively** (no gaps). Each sequence item can be a plain opcode string or an object with `opcode` and optional `fieldValues`.

### `block_count`
```yaml
check:
  type: block_count
  evaluation: manual
  spriteName: Sprite 1   # optional
  opcode: motion_movesteps
  operator: equals
  value: 3
```

### `costume_is`
```yaml
check:
  type: costume_is
  evaluation: after_run
  spriteName: Sprite 1   # optional — falls back to first sprite
  value: costume2        # exact costume name, case-sensitive
```

### `block_run`
```yaml
check:
  type: block_run
  evaluation: after_run
  opcode: motion_movesteps
  fieldValues:          # optional — also require the block to have specific values in the workspace
    STEPS: "50"
```
Note: event hat blocks (`event_whenflagclicked` etc.) are not tracked by `block_run` — use `block_used` to check for a hat's presence instead. When `fieldValues` is set, the block must both have executed and currently have those input values in the workspace.

---

## Scratch Block Opcodes

Available opcodes for `toolbox` XML, `block_used`, `blocks_in_order`, `block_count`, and `block_run` checks.

**Events**
- `event_whenflagclicked`
- `event_whenkeypressed`
- `event_whenthisspriteclicked`
- `event_whenbackdropswitchesto`
- `event_broadcast`
- `event_broadcastandwait`
- `event_whenbroadcastreceived`

**Motion**
- `motion_movesteps` · `motion_turnright` · `motion_turnleft`
- `motion_gotoxy` · `motion_goto`
- `motion_glidesecstoxy` · `motion_glideto`
- `motion_pointindirection` · `motion_ifonedge_bounce`
- `motion_setx` · `motion_sety` · `motion_changexby` · `motion_changeyby`
- `motion_xposition` · `motion_yposition` · `motion_direction`
- `motion_setrotationstyle`

**Looks**
- `looks_sayforsecs` · `looks_say` · `looks_think` · `looks_thinkforsecs`
- `looks_show` · `looks_hide`
- `looks_setsizeto` · `looks_changesizeby`
- `looks_switchcostumeto` · `looks_nextcostume` · `looks_costumenumber`
- `looks_switchbackdropto` · `looks_nextbackdrop`

**Sound**
- `sound_play` · `sound_playuntildone` · `sound_stopallsounds`

**Control**
- `control_wait` · `control_repeat` · `control_forever`
- `control_if` · `control_if_else` · `control_stop`

**Sensing**
- `sensing_askandwait` · `sensing_answer` · `sensing_keypressed`
- `sensing_mousedown` · `sensing_touchingedge` · `sensing_touchingobject`

**Operators**
- `operator_equals` · `operator_gt` · `operator_lt`
- `operator_and` · `operator_or` · `operator_not`
- `operator_add` · `operator_subtract` · `operator_join`

**Variables**
- `data_variable` · `data_setvariableto` · `data_changevariableby`

---

## Writing Scratch Explainers

Scratch tasks use the standard Markdown `explainer` field. Describe blocks by name in inline code rather than pasting XML.

```markdown
## Move the Sprite

Use these blocks:

1. Add `when green flag clicked`.
2. Add `move [] steps` underneath it.
3. Change the number to `150`.

> The check passes when the sprite moves far enough to the right.
```

**Input slot conventions:**

| Pattern | Meaning |
|---|---|
| `move [] steps` | Numeric or text input slot |
| `if <> then` | Boolean input slot |
| `set [score] to []` | Dropdown or variable field + input slot |
| `key [space] pressed?` | Dropdown value |

Recognised block names are automatically rendered as coloured Scratch block pills. See `docs/authoring/markdown-renderer.md` for the full Scratch block rendering reference.

---

## Minimal JSON Example

```json
{
  "id": "scratch-minimal",
  "type": "scratch",
  "title": "Scratch Minimal",
  "description": "A short Scratch lesson.",
  "tasks": [
    {
      "id": 1,
      "title": "Move",
      "explainer": "Move the sprite to the right.",
      "sprites": [{ "id": "sprite1", "name": "Sprite 1", "type": "cat", "x": 0, "y": 0, "size": 100, "direction": 90 }],
      "check": { "type": "sprite_property", "evaluation": "after_run", "spriteName": "Sprite 1", "property": "x", "operator": "greater_than", "value": 50 }
    }
  ]
}
```
