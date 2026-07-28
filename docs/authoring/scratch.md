# Scratch Module Code-Task Authoring

For the exact Markdown text that renders each supported Scratch block, see [Scratch Markdown Block Reference](scratch-markdown-blocks.md). Use [Scratch Toolbox XML](scratch-toolbox-xml.md) for raw toolbox configuration.

Everything needed to author a Scratch lesson — task fields, sprite/backdrop/variable objects, prebuilt stacks, block opcodes, check types, and explainer conventions. For envelope and common task fields see `docs/authoring/AUTHORING_GUIDE.md`.

---

## Composed Lesson and Scratch Module

```yaml
id: scratch-motion
type: composed
title: Moving Sprites
description: Move sprites around the stage.
level: 1
modules:
  - id: scratch-practice
    type: scratch
    sandbox:
      sandboxStarter: null         # optional — Blockly workspace state for this sandbox
      sandboxToolbox: "<xml>...</xml>"   # optional — Scratch XML toolbox
      sandboxSprites: []                 # optional — sprite array
      sandboxBackdrops: []               # optional — backdrop array
```

---

## Code Task Fields

```yaml
  - title: Move the sprite
    moduleType: scratch
    moduleId: scratch-practice # optional — omit when one Scratch workspace is enough
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
    codeStages: []            # optional — intermediate stages (label, role?, blocks, prebuiltStacks)
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

**Stage object:** `role` may be `starter`, `support`, or `complete`; omitted `role` defaults to `support`. The first Starter is the default, and teachers may apply any Starter to a class or individual learner. Starter stages carry `blocks`, `predefinedBlocks`, and `prebuiltStacks`. Every Support stage is an offerable read-only reference; it uses `markdown` and renders fenced or inline Scratch blocks. A Complete stage can be revealed read-only before the student or teacher explicitly takes it over, using the same preview-then-replace flow as a Support stage. Legacy `core` and `extension` roles remain readable as Support, and `solution` remains readable as Complete.

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

## Populated Block-State JSON

Scratch uses two related JSON shapes. Use the toolbox-stack shape for
`prebuiltStacks[].stack`; use the workspace-state shape for `starterBlocks`,
`completeBlocks`, and `codeStages[].blocks`.

- A **toolbox stack** is one root block. Do not wrap it in `blocks.blocks` and
  do not include workspace-only `id`, `x`, or `y` values.
- A **workspace state** is keyed by `sprites[].id`. Each sprite value is a
  Blockly workspace snapshot with its top-level blocks at `blocks.blocks`.
  Use the optional `x` and `y` values to place a top-level block in the
  workspace. `id` values emitted by Blockly may be omitted; Blockly assigns
  them when it loads the state.
- A text or number value belongs in an input shadow's `fields` object, not in
  the parent block's `fields` object. Text uses `text` / `TEXT`; numbers use
  `math_number` / `NUM`.
- Join two stack blocks with `next: { block: ... }`. For a nested value or
  statement input, use `inputs.INPUT_NAME.block` instead.

### A filled toolbox stack

This creates a drag-in **say “Hello!” for 2 seconds** block. It is a valid
value for one entry in `prebuiltStacks`; the stable `id` may be any unique
string.

```json
{
  "id": "say-hello-for-two-seconds",
  "label": "Say Hello",
  "stack": {
    "type": "looks_sayforsecs",
    "inputs": {
      "MESSAGE": {
        "shadow": {
          "type": "text",
          "fields": { "TEXT": "Hello!" }
        }
      },
      "SECS": {
        "shadow": {
          "type": "math_number",
          "fields": { "NUM": "2" }
        }
      }
    }
  }
}
```

### A pre-placed starter block

This places that block at `(24, 24)` in the workspace for the sprite whose ID
is `sprite1`. The key must match `sprites[].id`, not the sprite's display
name. In a multi-sprite task, add another sibling key such as `sprite2` for
that sprite's workspace. When stage code is enabled, the Stage workspace uses
the key `__stage__`.

```json
{
  "sprite1": {
    "blocks": {
      "blocks": [
        {
          "type": "looks_sayforsecs",
          "x": 24,
          "y": 24,
          "inputs": {
            "MESSAGE": {
              "shadow": {
                "type": "text",
                "fields": { "TEXT": "Welcome!" }
              }
            },
            "SECS": {
              "shadow": {
                "type": "math_number",
                "fields": { "NUM": "2" }
              }
            }
          }
        }
      ]
    }
  }
}
```

Use that same object as `starterBlocks`, `completeBlocks`, or a stage's
`blocks` value. For example, this support stage supplies a connected
green-flag-and-say stack for `sprite1`; a `solution` stage uses the identical
shape and differs only in `role`.

```json
{
  "label": "Run a greeting",
  "role": "support",
  "blocks": {
    "sprite1": {
      "blocks": {
        "blocks": [
          {
            "type": "event_whenflagclicked",
            "x": 24,
            "y": 24,
            "next": {
              "block": {
                "type": "looks_sayforsecs",
                "inputs": {
                  "MESSAGE": {
                    "shadow": {
                      "type": "text",
                      "fields": { "TEXT": "Hello!" }
                    }
                  },
                  "SECS": {
                    "shadow": {
                      "type": "math_number",
                      "fields": { "NUM": "2" }
                    }
                  }
                }
              }
            }
          }
        ]
      }
    }
  }
}
```

The Scratch builder can also generate these values: edit the starter or stage
workspace (or a prebuilt stack), then save the lesson. The examples above are
the serialization shape used by that loader and serializer, so hand-authored
values can be mixed with builder-authored ones.

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

Scratch checks can be a single object or an array. Prefer `evaluation: continuous` for block-structure checks that can pass while the learner edits, and `evaluation: after_run` for checks that need the green flag/run state. `manual` is a legacy value and should not be used in new lessons.

Students should not see a failure just because they are still building. Continuous checks can pass as soon as the workspace is correct; off-track feedback should be modelled as a nudge/authoring warning rather than a hard fail while the learner is mid-edit.

`feedbackChecks` use the same Scratch check shapes and require a completion `check`. Use `show: on_idle` for guidance after the learner pauses editing blocks, or `show: after_attempt` for feedback after a Scratch check evaluates. `mode: blocking` fails completion when matched; `mode: nudge` shows guidance without failing. `incorrectChecks` is a legacy alias for blocking feedback.

### `block_used`
```yaml
check:
  type: block_used
  evaluation: continuous
  spriteName: Sprite 1  # optional
  opcode: control_repeat
  fieldValues:          # optional — require specific input values
    TIMES: "10"
```
`fieldValues` keys are the Blockly input names (e.g. `STEPS`, `DEGREES`, `MESSAGE`). Omit to match any value. Values can be plain strings for equality/wildcard matching, or objects with `operator` and `value`, for example `STEPS: { operator: greater_than_or_equal, value: "10" }`.

### `sprite_property`
```yaml
check:
  type: sprite_property
  evaluation: after_run
  spriteName: Rocket
  property: x          # x | y | size | direction | visible | costume
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
  evaluation: continuous
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
  evaluation: continuous
  spriteName: Sprite 1   # optional
  opcode: motion_movesteps
  operator: equals
  value: 3
```

### Costume checks
```yaml
check:
  type: sprite_property
  evaluation: after_run
  spriteName: Sprite 1
  property: costume
  operator: equals
  value: costume2        # exact costume name, case-sensitive
```
Legacy `type: costume_is` still loads, but new lessons should use `sprite_property` with `property: costume`.

### `block_run`
```yaml
check:
  type: block_run
  evaluation: after_run
  spriteName: Sprite 1  # optional
  opcode: motion_movesteps
  fieldValues:          # optional — also require the block to have specific values in the workspace
    STEPS:
      operator: greater_than_or_equal
      value: "50"
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
- `looks_switchcostumeto` · `looks_nextcostume`
- `looks_costumenumber` · `looks_costumenumbername`
- `looks_switchbackdropto` · `looks_nextbackdrop` · `looks_backdropnumbername`
- `looks_seteffectto` · `looks_changeeffectby` · `looks_cleargraphiceffects`

**Sound**
- `sound_play` · `sound_playuntildone` · `sound_stopallsounds`

**Control**
- `control_wait` · `control_wait_until`
- `control_repeat` · `control_repeat_until` · `control_forever`
- `control_if` · `control_if_else` · `control_stop`
- `control_create_clone_of` · `control_start_as_clone` · `control_delete_this_clone`

**Sensing**
- `sensing_askandwait` · `sensing_answer` · `sensing_keypressed`
- `sensing_mousedown` · `sensing_touchingedge` · `sensing_touchingobject`
- `sensing_distanceto` · `sensing_timer` · `sensing_resettimer`

**Operators**
- `operator_equals` · `operator_gt` · `operator_lt`
- `operator_and` · `operator_or` · `operator_not`
- `operator_add` · `operator_subtract` · `operator_multiply` · `operator_divide`
- `operator_mod` · `operator_round` · `operator_mathop` · `operator_random`
- `operator_join` · `operator_letter_of` · `operator_length` · `operator_contains`

**Variables**
- `data_variable` · `data_setvariableto` · `data_changevariableby`
- `data_showvariable` · `data_hidevariable`

---

## Adding or Changing Scratch Blocks

Any change to the Scratch block set must update both the Scratch implementation and the authoring surface. Treat the markdown renderer as part of the block feature, especially for blocks that can sit inside other blocks or contain statement mouths.

When adding, renaming, or removing a Scratch block:

1. Update the runtime/editor sources: `SCRATCH_BLOCK_DEFINITIONS`, `DEFAULT_TOOLBOX` or `STAGE_TOOLBOX`, value defaults, display templates, checks, and interpreter handling as needed.
2. Update `src/shared/scratchBlockCatalog.js`; this feeds the markdown renderer, markdown toolbar insertion menu, and Scratch toolbox picker.
3. Confirm the renderer metadata includes the block colour, visual shape, display text, inputs, and mouths:
   - Hat blocks use `shape: hat`.
   - Stack blocks use `shape: stack`.
   - Stop/end blocks use `shape: cap`.
   - Reporter blocks use `shape: reporter`.
   - Boolean blocks use `shape: boolean`.
   - C-blocks use `shape: c` with one mouth; if/else blocks use `shape: c` with two mouths.
4. Add or update markdown renderer examples for blocks that contain reporters, Boolean conditions, variables, dropdowns, or nested statement mouths.
5. Update this opcode list, `docs/authoring/scratch-toolbox-xml.md`, and the Scratch section of `docs/authoring/markdown-renderer.md`.
6. Add tests that prove every toolbox opcode has renderer metadata, and that representative nested blocks render without falling back to grey unknown blocks.

---

## Writing Scratch Explainers

Scratch tasks use the standard Markdown `explainer` field. Describe blocks with Scratch markdown, not Blockly XML.

```markdown
## Move the Sprite

Use these blocks:

1. Add `scratch:when green flag clicked`.
2. Add `scratch:move (10) steps` underneath it.
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

Inline Scratch blocks must use the `scratch:` prefix. Fenced `scratch` code blocks are the right format for full stacks, nested C-block mouths, and reporter/Boolean inputs. See `docs/authoring/markdown-renderer.md` for the full Scratch block rendering reference.

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
