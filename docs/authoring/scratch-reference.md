# Scratch Reference

Scratch-specific task fields, objects, and block opcodes.

---

## Code Task Fields

```yaml
- title: Move the Rocket
  explainer: Make the rocket move to the right.
  toolbox: "<xml>...</xml>"   # optional — restricts blocks; empty/omitted = full toolbox
  sprites: []                  # optional — defaults to one cat sprite
  backdrops: []                # optional — defaults to plain white
  variables: []                # optional — defaults to a single 'score' variable
  starterBlocks: null          # optional — Blockly workspace state, keyed by sprite ID for multi-sprite
  completeBlocks: null         # optional — reference solution
  prebuiltStacks: []           # optional — drag-in block stacks shown in the toolbox
  codeStages: []               # optional — intermediate stages (label, blocks, prebuiltStacks)
  carryBlocksFrom: null        # optional — carry saved blocks from task ID
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
