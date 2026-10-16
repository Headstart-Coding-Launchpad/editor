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
levelId: scratch-level-1
modules:
  - id: scratch-practice
    type: scratch
    sandbox:
      sandboxStarter: null         # optional — Blockly workspace state for this sandbox (an object or a JSON string)
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
    toolbox: "<xml>...</xml>" # optional — restricts available blocks; empty/omitted = full toolbox (sprites only: Stage code always gets the full Stage toolbox)
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
    # carryBlocksFromLesson: { lesson: scratch-1-11, task: 5 }  # optional instead — the student's own project from an earlier lesson
    allowAddSprite: false     # optional — show a student-facing "Add sprite" picker (default false)
    addSpritePresetIds: []    # optional — restrict the picker to these `lessonTypeAssets/scratch.defaultSprites` ids; omitted/empty = whole library
    allowAddBackdrop: false   # optional — show a student-facing "Add backdrop" picker (default false)
    addBackdropPresetIds: []  # optional — restrict the picker to these `lessonTypeAssets/scratch.defaultBackdrops` ids; omitted/empty = whole library
    allowCreateVariable: false # optional — add a "Make a Variable" button to the Variables flyout (default false)
    allowRemoveSprite: false  # optional — let students remove sprites they added themselves (default false)
    allowRemoveStarterSprites: false # optional — also let removal target author-placed sprites, not just student-added ones (default false; ignored unless allowRemoveSprite is true)
    enableStageCode: false    # optional — give the Stage its own workspace (blocks keyed "__stage__"); carried through automatically when the task carries blocks from an earlier task
    showCostumesTab: false    # optional — show a Costumes tab beside the block editor (default false)
    showSoundsTab: false      # optional — show a Sounds tab beside the block editor (default false)
    allowAddCostume: false    # optional — students can add costumes (emoji or library) in the Costumes tab; needs showCostumesTab
    allowAddSound: false      # optional — students can add sounds (synth or library file) in the Sounds tab; needs showSoundsTab
    highlight: green_flag     # optional — pulse a control once when the task opens; see Highlighting a Control
    slowMo:                   # optional — Slow-mo, Pause, Step and Restart under the stage; see Slow-mo
      enabled: true
    check:
      type: sprite_property
      evaluation: after_run
      spriteName: Rocket
      property: x
      operator: greater_than
      value: 50
```

---

**Carry from an earlier lesson.** `carryBlocksFromLesson: { lesson, task }` starts the task from each student's own saved project (sprites, blocks, backdrops) on that task of an earlier lesson (two-lesson projects), using the stock lesson id. Students the tutor hasn't matched to the class list wait; anyone with nothing saved gets `starterBlocks`. Not with `carryBlocksFrom` on the same task. See [Two-lesson projects](AUTHORING_GUIDE.md#two-lesson-projects-carry-from-an-earlier-lesson).

## Sprite Object

**Stage object:** `role` may be `starter`, `support`, or `complete`; omitted `role` defaults to `support`. The first Starter is the default, and teachers may apply any Starter to a class or individual learner. Starter stages carry `blocks` and `prebuiltStacks` (`predefinedBlocks` is a legacy name, still read; use `prebuiltStacks`). Every Support stage is an offerable read-only reference and carries two fields with different jobs:

| Support stage field | What it's for | If it's missing |
| --- | --- | --- |
| `markdown` | **What the student sees.** The read-only reference panel opened after a failed attempt, by the teacher from the roster, or by a `stageOffer` `preview`. Renders fenced or inline Scratch blocks ([Scratch Markdown Block Reference](scratch-markdown-blocks.md)). | The student's reference panel opens **empty**. |
| `blocks` | **What gets loaded** when the stage replaces the student's work (a teacher's stage push, a `stageOffer` `replace`, or a reset to that stage), and what the teacher's stage tab shows. Same shape as `starterBlocks`. | Replacing loads the task's `starterBlocks`; the teacher's stage tab is empty. |

Write `markdown` on every Support stage. Add `blocks` too when the stage may be pushed to students or linked from a `stageOffer` `replace`. The Builder edits both: the notes box is `markdown`, the stage workspace is `blocks`. A Complete stage can be revealed read-only before the student or teacher explicitly takes it over, using the same preview-then-replace flow as a Support stage. Legacy `core` and `extension` roles remain readable as Support, and `solution` remains readable as Complete.

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
    costumes:                 # optional — each costume is an image or an emoji
      - name: rocket
        image: sprites/rocket.png   # relative to assetsPath, or /assets/shared/...
      - name: boom
        emoji: "💥"           # an emoji costume: { name, emoji }, no image
    emoji: "🚀"               # optional — emoji rendered on stage when no costume image is active
    sounds:                   # optional — this sprite's sounds; omitted = pop, meow, click, chime
      - name: launch
        synth: laser          # a built-in synth sound (see Sounds below)
      - name: countdown
        audio: sounds/countdown.mp3   # an audio file, resolved like a costume image
    studentEditable: true     # optional — when false, students cannot select or view blocks (default true)
```

### Sounds

Sounds belong to a sprite. The `start sound` / `play sound until done` dropdown lists the
selected sprite's own `sounds` by `name`, and a sprite with no `sounds` list gets the four
default synth sounds `pop`, `meow`, `click`, `chime` (so older lessons are unchanged). Each
sound has a `name` and exactly one source:

- `synth` — a built-in sound generated in the browser (no file): `pop`, `meow`, `click`,
  `chime`, `boing`, `laser`, `coin`, `jump`, `power-up`, `game-over`, `beep`, `buzzer`, `bell`,
  `drum`, `snare`, `whoosh`, `splash`, `zap`.
- `audio` — an audio file path (`.mp3`, `.wav`, `.ogg`, `.m4a`), relative to `assetsPath`, a
  `/assets/shared/...` path, or a full URL.
  Files on Firebase Storage load through Web Audio (the bucket's CORS rules are in
  `storage.cors.json`); a file on another host without CORS headers still plays, through a plain
  `<audio>` element.

Validation errors on a sound with no name, two sounds with the same name on one sprite, a
sound with both or neither of `synth`/`audio`, or an unknown `synth` id. Sound names in
`starterBlocks`/`completeBlocks` (the `SOUND_MENU` field) must match the sprite's sound names.
Validation doesn't check this, so test the blocks in the Builder.

---

## Backdrop Object

```yaml
backdrops:
  - id: backdrop1             # required
    name: Space               # required — used by backdrop blocks
    image: backdrops/space.png  # optional — relative to assetsPath, or public root path
    colour: "#ffffff"         # optional — CSS colour for solid backdrop
    current: true             # optional — the Stage starts on this backdrop
```

The Stage shows the backdrop marked `current: true` when the task loads and after **Reset Stage**. With none marked it starts on the first one listed, so the list order can stay whatever the project's `next backdrop` steps need. Mark only one: validation warns when more than one backdrop is `current` (the first marked one wins), and errors when `current` isn't `true` or `false`. In the Builder, pick **Start** next to a backdrop; the starting one shows **Starts here**. Like the rest of `backdrops`, the flag is copied by `carryBlocksFrom`.

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
    stack: {}                 # required — Blockly toolbox-compatible block JSON (stored as JSON text; any length)
```

**Student mechanic:** a prebuilt stack is not a separate chip or button — it's inserted into the toolbox category matching its root block's type (e.g. a `say` stack appears in the Looks flyout, next to the plain `say` block). There's no click-to-insert:
- **Drag** the stack out of its flyout into the workspace to add it, exactly like any other block. It arrives as a normal, fully editable/movable/deletable block stack — nothing marks it as special. Dragging alone does not run it.
- **Click** any block or stack — whether still sitting in the flyout or already dragged into the workspace — to run it immediately as a standalone script. Clicking in the flyout runs it as a one-off without adding it to the workspace.
- If the stack starts with a `when green flag clicked` hat and has been dragged into the workspace, the green-flag **Run** button also runs it along with every other green-flag script.

**The stack's block types don't need to already be in the task's `toolbox`.** The platform resolves the root block's category (Motion, Looks, Control, etc.) and appends the stack there, creating that category if the toolbox doesn't have it yet — so a task's toolbox can be restricted to only the blocks taught so far, even down to every block deselected, while a prebuilt stack still hands out a scaffolded script that uses blocks ahead of it. The one exception is a minimal/flat toolbox that already has blocks listed directly under `<xml>` (no categories) — that authored pattern is left as-is, and a stack only appends there if its root block type is already one of those root-level blocks — see [Scratch Toolbox XML](scratch-toolbox-xml.md).

## Populated Block-State JSON

Scratch uses two related JSON shapes. Use the toolbox-stack shape for
`prebuiltStacks[].stack`; use the workspace-state shape for `starterBlocks`,
`completeBlocks`, and `codeStages[].blocks`.

- A **toolbox stack** is one root block, with any further blocks joined below
  it through `next`. Do not wrap it in `blocks.blocks` and do not include
  workspace-only `id`, `x`, or `y` values.
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
- **Write a workspace state as the object itself, or as its JSON string.**
  `starterBlocks`, `completeBlocks`, and `codeStages[].blocks` accept either.
  Firestore rejects documents nested deeper than 20 levels, and every
  `next: { block: ... }` costs two levels, so the Builder and the CLI both
  serialise these fields to JSON strings when they save (since 13 September
  2026; before that the CLI didn't, and authors had to serialise by hand).
  Strings you've already serialised are stored as they are, never encoded twice.
  `lessons get` returns the object form.
- **Write a toolbox stack (`prebuiltStacks[].stack`) as an object.** A stack
  is a root block with every block below it nested through
  `next: { block: ... }`, so a long stack is as deep as a long script. Since
  5 October 2026 the Builder and the CLI store each `prebuiltStacks[].stack`
  (on the task and on each code stage) as a JSON string too, and decode it
  on read; the rest of the entry (`id`, `label`) stays a real object. Stacks
  saved earlier as plain objects still load. `lessons validate` reports any
  part of a lesson that would still be nested deeper than Firestore's 20
  levels once stored — see
  [validation errors](validation-errors.md#lesson-envelope).

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

Use that object (or its JSON string) as `starterBlocks`, `completeBlocks`, or a
stage’s `blocks` value; the Builder and CLI serialise it when saving. For example, this support stage supplies a connected
green-flag-and-say stack for `sprite1` (loaded if the stage replaces the student's work) plus
the `markdown` the student reads in the reference panel; a `complete` stage uses the identical
`blocks` shape and differs only in `role`.

```json
{
  "label": "Run a greeting",
  "role": "support",
  "markdown": "Start with a hat block, then add a say block:\n\n```scratch\nwhen green flag clicked\nsay [Hello!] for (2) seconds\n```",
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

### A dropdown-menu block field

A field picked from the block's own dropdown menu (a Blockly `field_dropdown`)
is not a text/number value, so it does not use an input shadow. It goes
directly in the block's own `fields` object, keyed by the field name:

```json
{ "type": "motion_setrotationstyle", "fields": { "STYLE": "left-right" } }
```

**The stored value is the option's underlying value, not its visible label —
and for a sprite-target menu that value is the sprite's `id`, not its `name`.**
`motion_goto`'s `TO` field (and `motion_glideto`'s, alongside its own `SECS`
shadow) offers "random position", "mouse pointer", and every sprite on stage:

```json
{
  "type": "motion_glideto",
  "fields": { "TO": "sprite1" },
  "inputs": {
    "SECS": { "shadow": { "type": "math_number", "fields": { "NUM": "1" } } }
  }
}
```

| `TO` value | Menu option |
|---|---|
| `_random_` | random position |
| `_mouse_` | mouse pointer |
| a sprite's `id` (e.g. `sprite1`, `rocket` — see `sprites[].id` above; not the display `name`) | that sprite |

A similar shape backs `control_create_clone_of`'s `CLONE_OPTION`, which takes
only `_myself_` or a sprite `id` (no `_random_` and no `_mouse_`),
`sensing_touchingobject`'s `TOUCHINGOBJECTMENU`
(which adds `_edge_`), and `sensing_distanceto`'s `DISTANCETOMENU` (no
`_random_` option). A costume/backdrop-target menu —
`looks_switchcostumeto`'s `COSTUME`, `looks_switchbackdropto` /
`event_whenbackdropswitchesto`'s `BACKDROP` — takes the costume/backdrop's
`name` directly, since those have no separate id.

A fixed-option menu with no sprite/costume/backdrop involved — e.g.
`motion_setrotationstyle`'s `STYLE` (`left-right` / `don't rotate` / `all
around`), `looks_seteffectto` / `looks_changeeffectby`'s `EFFECT`, or
`operator_mathop`'s `OPERATOR` — takes the option's label text verbatim,
exactly as it reads on the block.

---

## Public Sprite Presets

The sprite/backdrop library the builder's own "Add sprite"/"Add backdrop" pickers and the student-facing pickers above draw from is `lessonTypeAssets/scratch.defaultSprites` / `.defaultBackdrops` in Firestore — admin-curated via Admin → Shared Assets → Scratch (`DefaultSpritesEditor` / `DefaultBackdropsEditor` in `SharedAssetsPanel.jsx`), fetched with `useTypeAssets('scratch')`. Selected presets are copied with a new unique ID via `createSpriteFromPreset` / `createBackdropFromPreset` in `src/shared/spritePresets.js`.

`public/scratch-assets/sprites.json` is a legacy static preset file (same shape) that predates the Firestore-based library above and is not currently read by any code path — do not add sprites there.

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

### A multi-costume preset

A preset can carry several costumes, so a student who adds it from the picker can switch between them (for example a walk cycle with `next costume`), and each costume is also offered by the **+ Add costume** picker. Upload each image as a shared Scratch asset first, then point each costume's `image` at the hosted `url` the upload returns:

```bash
node cli/cli.mjs assets upload-type scratch ./dog-sit.png
node cli/cli.mjs assets upload-type scratch ./dog-walk1.png
node cli/cli.mjs assets upload-type scratch ./dog-walk2.png
```

```json
[
  {
    "id": "dog",
    "name": "Dog",
    "type": "cat",
    "size": 80,
    "costume": "dog-sit",
    "costumes": [
      {
        "name": "dog-sit",
        "image": "https://firebasestorage.googleapis.com/v0/b/<bucket>/o/shared%2Fscratch%2Fassets%2Fdog-sit.png?alt=media&token=<token>"
      },
      {
        "name": "dog-walk1",
        "image": "https://firebasestorage.googleapis.com/v0/b/<bucket>/o/shared%2Fscratch%2Fassets%2Fdog-walk1.png?alt=media&token=<token>"
      },
      {
        "name": "dog-walk2",
        "image": "https://firebasestorage.googleapis.com/v0/b/<bucket>/o/shared%2Fscratch%2Fassets%2Fdog-walk2.png?alt=media&token=<token>"
      }
    ]
  }
]
```

- A preset has the same fields as an entry in a task's `sprites` list. Its `id` is the **preset** id (the one `addSpritePresetIds` lists); the sprite gets a fresh `spriteN` id when it is added to a task. `id` and a non-empty `name` are required — entries without them are dropped when the list is saved.
- Each costume is `{ name, image }`. `costume` names the costume worn first; omitted, the first costume is used. Costume names are what `switch costume to` and `sprite_property` `property: costume` checks match, case-sensitively.
- **Use full `https://` URLs (or `/assets/shared/...` site paths) for preset costume images.** A relative path such as `sprites/dog.png` is resolved against the `assetsPath` of whichever lesson the sprite is added to, so it breaks in every lesson that doesn't hold that file.
- `showInEditor` on the uploaded shared assets doesn't matter here: Scratch loads a costume straight from its `image` URL and never reads `showInEditor`.
- `assets set-default-sprites` **replaces the whole list**. Fetch the current list with `node cli/cli.mjs assets list-type scratch`, add your entry to its `defaultSprites`, and send the full list back. See [Lesson Asset CLI](lesson-assets-cli.md#shared-lesson-type-assets).

---

## Student-Added Sprites, Backdrops, and Variables

Three per-task toggles let students extend their own project beyond what the author placed, without breaking checks that assume an author-known sprite/variable set:

- `allowAddSprite` / `addSpritePresetIds` — shows an "Add sprite" picker in the student's sprite panel, sourced from the admin-curated `lessonTypeAssets/scratch.defaultSprites` library (managed in Admin → Shared Assets → Scratch, the same `DefaultSpritesEditor` used to seed the builder's own "Add sprite" picker). `addSpritePresetIds` optionally narrows the picker to a chosen subset of that library for this task; omitted or empty offers the whole library. The picker opens over the page (below the Add tile, or above it when there's no room) and is sized to the screen, so a student on a small laptop, a tablet or with the browser zoomed in can scroll to the last sprite.
- `allowAddBackdrop` / `addBackdropPresetIds` — same pattern for backdrops, sourced from `lessonTypeAssets/scratch.defaultBackdrops` (`DefaultBackdropsEditor`).
- `allowCreateVariable` — adds a "Make a Variable" button to the Variables toolbox flyout. The student is prompted for a name (must be non-empty and not collide, case-insensitively, with any existing variable name); the new variable becomes available immediately in every variable dropdown block (`data_variable`, `data_setvariableto`, etc.) for every sprite in the task.
- `allowRemoveSprite` — shows a ✕ on each sprite's tile in the student's sprite panel. By default this only ever lets a student remove a sprite *they* added via the "Add sprite" picker above (`studentAdded: true`) — author-placed starter sprites always stay protected, even with this flag on. Set `allowRemoveStarterSprites: true` alongside it to lift that restriction and let removal target every sprite, author-placed or not (used by the freeform Scratch Playground, which has no starter code to protect). A workspace can never be emptied entirely — the ✕ is disabled once only one sprite remains — and removal asks the student to confirm first, since it deletes that sprite's code and costumes.

**Checks never see these.** A student-added sprite, a student-added backdrop, or a student-created variable is decorative only:

- `sprite_property`, `sprite_property_delta`, `sprite_property_changed`, `block_used`, `blocks_in_order`, `block_count`, and `block_run` checks with no `spriteName` (or a `spriteName` that doesn't match) only ever consider author-authored sprites — a student-added sprite can never become the fallback target.
- `variable_equals` / `variable_compare` checks reference a `variableName` your task authored; since a student cannot create a variable whose name collides with one that already exists, a student-created variable can never satisfy a check written against an author-defined name.

Both are enforced structurally (author sprites/variables are always distinguishable from student-added ones), not by convention, so no extra authoring care is needed beyond picking `variableName`/`spriteName` values that match what you authored.

**Persistence.** Student-added sprites/backdrops, created variables, and added costumes/sounds persist the same way as everything else in the task — saved, carried through (`carryBlocksFrom`), and pushed by remote reset/teacher-live-view — under a `__meta__` key alongside the per-sprite Blockly workspace state, opaque to any code that only stores or forwards the state blob.

---

## Costumes and Sounds Tabs

Two per-task toggles add tabs beside the block editor for the selected sprite, as in Scratch.
Both are off by default, and the Stage (with `enableStageCode`) always shows only Code:

- `showCostumesTab` — a **Costumes** tab listing the sprite's costumes. Clicking one puts it on
  (the same as the Costume property). `allowAddCostume` adds an **+ Add costume** button
  offering every costume in the admin sprite library (`lessonTypeAssets/scratch.defaultSprites`;
  an emoji-only library sprite offers its emoji) plus a full emoji picker. A new costume is put
  on straight away. Adding to a sprite drawn from its emoji or shape with no costumes first
  keeps that look as `costume1`.
- `showSoundsTab` — a **Sounds** tab listing the sprite's sounds with a ▶ preview.
  `allowAddSound` adds an **+ Add sound** button offering every built-in synth sound plus the
  admin sound-file library (`lessonTypeAssets/scratch.defaultSounds`, managed in Admin → Shared
  Assets → Scratch → Default sounds, or `node cli/cli.mjs assets upload-sound scratch <file>`). An added
  sound appears in that sprite's sound blocks immediately.

Students can add costumes and sounds to **any** sprite, including author-placed ones. Added
entries are saved with the student's work (under `__meta__.addedCostumes` / `addedSounds`,
keyed by sprite id) and show in the teacher's live view. A costume check
(`sprite_property` `property: costume`) still works on author-named costumes; student-added
costume names are whatever the student picked, so don't write checks that expect them. The
Scratch Playground turns all four toggles on.

---

## Highlighting a Control

`highlight` pulses a ring around one control on each student's screen when the task opens (once
per task), so a Level 1 student who keeps missing the green flag can't miss it. It stops when
the student uses the control (presses it, opens the tab, taps the category heading) or after 20
seconds. With reduced motion it's a still outline.

```yaml
    highlight: green_flag            # or: highlight: { target: green_flag }
```

| Target | Points at |
|---|---|
| `green_flag` (or `run`) | The green flag above the stage |
| `stop` | The stop sign |
| `costumes_tab` | The Costumes tab (needs `showCostumesTab`, or validation warns) |
| `sounds_tab` | The Sounds tab (needs `showSoundsTab`, or validation warns) |
| `category:<name>` | A category heading in the block palette: `Motion`, `Looks`, `Sound`, `Events`, `Control`, `Sensing`, `Operators`, `Variables` or `My Blocks`. The palette scrolls to it |

Any other target is a validation error. When the control is out of sight, the way to it pulses
instead: the **Stage** or **Blocks** tab on a narrow screen, the collapsed Stage rail, or the
"Show blocks palette" button. A category your `toolbox` leaves out has no heading, so nothing
pulses.

Tutors can pulse the same controls live, for the whole class ("Highlight Class" in the top bar)
or one student (the More menu in their workspace view).

---

## Slow-mo

`slowMo` lets students watch their scripts run one block at a time. Use it where the in-between
states matter, such as two quick costume switches that look like one, or a Next Costume after a
Switch Costume. Students no longer need wait blocks just to see each state.

```yaml
  - id: 18
    moduleType: scratch
    title: Watch the costumes change
    slowMo:
      enabled: true       # off unless true
      speed: 1            # optional — blocks a second to start at (default 1; the slider goes 0.25–4)
      timeline: [costume, backdrop, x, y, variables]   # optional — what each timeline card shows (default: all five)
```

**Controls.** Four large buttons appear under the stage, each with an icon and a word, plus a
speed slider. The green flag still does a normal, full-speed run.

| Button | What it does |
|---|---|
| 🐢 **Slow-mo** | Runs the green-flag scripts slowly, at the slider's speed. Pressed while paused, it carries on |
| ⏸️ **Pause** | Holds the run before its next block |
| 👣 **Step** | Runs just the next block, then pauses. Pressed before a run, it starts one paused |
| ⏮️ **Restart** | Stops the run, puts the stage back to the start and clears the timeline (same as Reset Stage) |

**While it runs:**

- **Glow:** the running block glows in its script. When several scripts run at once, each script's
  current block glows. Under reduced motion the glow is a still outline.
- **One frame per block:** the stage redraws after every block, so two quick switches show both
  costumes.
- **Speed:** each script runs at most `speed` blocks a second, on its own clock, so scripts that run
  together move together. A block that takes time (wait, glide, play until done, ask) takes as long
  as it normally would, and the next block follows straight after.
- **Other scripts:** key presses, sprite clicks and broadcasts during a slow-mo run go slowly too.

**Step with several scripts.** Each Step lets exactly one block through. The scripts take turns
(round-robin) in the order they started: with two green-flag scripts, Step runs a block from the
first, then the second, then the first again. If every script is busy inside a block (for example,
a `wait 2 seconds`), the Step is kept and the next script that is ready goes. Only one Step is kept,
so tapping Step five times during a long wait doesn't race five blocks afterwards.

**Timeline.** A strip under the stage gets one card per step, showing the `timeline` fields: the
running sprite's costume (a picture and its name), the backdrop, x and y (rounded), and each
variable. On a tablet it scrolls with a swipe. Tapping a card shows the stage as it was at that
step, with "Back to now" to return. If the run was playing, it pauses; nothing in the run changes.
Each card has a text label for screen readers, such as "Step 3. Cat: switch costume to costume2.
Costume costume2, Backdrop Blue Sky, x 0, y 0, score 1". The timeline keeps the first 500 steps,
then says so. A C block (repeat, forever, if) gets no card of its own, because the blocks inside it
already have one. `timeline: []` hides the strip.

**Checks.** There are no slow-mo checks. A slow-mo run counts as a green-flag run, so every check
works as it does after a normal Run:

- `run_attempted` and run-only tasks pass when Slow-mo or Step starts the run.
- After-run checks are judged when the slow run finishes. Stop and Restart skip that end-of-run check,
  just as Stop does for a normal run.
- `after_block_placed` checks and the "still building" rule don't depend on runs, so they're
  unchanged.

**Tutors.** A tutor watching a student sees the same glow and a line such as "Slow-mo · step 4 ·
paused" under the stage. In Go Live and presentation, the tutor's own Slow-mo, Pause, Step and
Restart drive what the class sees: the glowing blocks, the stage and the step number. Students
can't use the controls while they're watching. The timeline isn't sent, so each person's timeline is
their own. The session report records slow-mo use per student per task (`slowMoUsed`,
`slowMoRuns`, `slowMoSteps`; see [Session reports](session-reports.md)).

**Builder:** Scratch setup → Student additions → Slow-mo (on/off, starting speed, timeline fields).
Validation flags a `slowMo` that isn't an object, an `enabled` that isn't true or false, or a speed
that isn't a positive number. It warns about a speed outside 0.25–4 (it's clamped), unknown timeline
fields or keys, and a `slowMo` with no `enabled`.

---

## Scratch Check Types

Scratch checks can be a single object or an array. Every Scratch check type on this page is listed by `node cli/cli.mjs lessons capabilities`, and a misspelt Scratch check type fails validation. Prefer `evaluation: after_block_placed` for block-structure checks that can pass while the learner edits, and `evaluation: after_run` for checks that need the green flag/run state. `manual` is a legacy value and should not be used in new lessons.

- **Leaving `evaluation` out means `after_run`.** The Builder shows the same default.
- **Only `block_used`, `blocks_in_order` and `block_count` can use `evaluation: after_block_placed`.** They are the checks decided by the blocks alone. Any other type (`sprite_property`, `variable_compare`, `block_run`, …) needs a run, so validation rejects it with `after_block_placed`.
- **Mixed lists: every check must pass.** You can mix `after_block_placed` and `after_run` checks in one list. While the learner edits, the `after_block_placed` checks are judged as they build. When the learner runs the project, **every** check in the list is judged, block checks included (against the blocks as they are now), so a missing block can't pass on a run alone.

Students should not see a failure just because they are still building. `after_block_placed` checks can pass as soon as the workspace is correct; off-track feedback should be modelled as a nudge/authoring warning rather than a hard fail while the learner is mid-edit.

**When checks run and what logs an attempt.** `after_block_placed` checks (and `on_idle` feedback checks) are evaluated shortly after an edit to the blocks: a block placed, moved or deleted, or a field edit committed — the learner leaves the text field or presses Enter, or picks a dropdown value. Each evaluation is logged as one attempt in the session report. Typing inside a text field (for example a Say message) does not run checks or log attempts; the edit is checked once, with the final text, when the field is committed. `after_run` checks are evaluated when the learner runs the project.

**Still building: no fail while the workspace is unchanged or has a loose block.** While the learner is placing blocks, a failing `after_block_placed` check is held back when either:

- the blocks are the same as when the task opened (the `starterBlocks`, or the blocks carried in by `carryBlocksFrom`); block ids and positions are ignored, so dragging a script around still counts as unchanged; or
- a block that isn't a hat (`when green flag clicked`, `when this sprite clicked`, `when I start as a clone` and the other `when …` blocks) sits loose on the canvas: a stack, a single block or a reporter not yet snapped under a hat or into another block.

While held back, the learner sees no fail state and no hint, no attempt is logged in the session report, and `on_idle` feedback checks don't show. A **pass is never held back**: as soon as the checks pass the task completes, loose block or not. Once every block is attached (and something has changed), checks are judged as normal. Pressing Run and the Check button are not affected. The tutor still sees the student's blocks live as they build. The rule lives in `src/modules/scratch/stillBuilding.js`, which works on stored workspace JSON so the CLI can use it too.

`feedbackChecks` use the same Scratch check shapes and require a completion `check`. Use `show: on_idle` for guidance after the learner pauses editing blocks, or `show: after_attempt` for feedback after a Scratch check evaluates. `mode: blocking` fails completion when matched; `mode: nudge` shows guidance without failing. `incorrectChecks` is a legacy alias for blocking feedback. Avoid using `after_run` check types (`block_run`, `sprite_property`/`variable_compare` reading run-dependent state) as `on_idle` feedback checks — idle evaluation happens purely from editing, without a fresh run, so an `after_run` check there is judged against the last Run's state rather than the learner's current unedited workspace.

Scratch picks the one hint to show with the shared rule in [Which hint is shown](AUTHORING_GUIDE.md#which-hint-is-shown). Run-time checks (`evaluation: after_run`, such as `block_run` or `sprite_property`) only contribute hints after the learner presses Run; while the learner is placing blocks, only an `after_block_placed` check that has definitely failed (not one that is still incomplete) can supply the hint. If no failed check has a hint, the learner sees the generic "Not quite, try again!" banner.

### `block_used`
```yaml
check:
  type: block_used
  evaluation: after_block_placed
  spriteName: Sprite 1  # optional
  opcode: control_repeat
  fieldValues:          # optional — require specific input values
    TIMES: "10"
```
`fieldValues` keys are the Blockly input names (e.g. `STEPS`, `DEGREES`, `MESSAGE`). Omit to match any value. Values can be plain strings (meaning `equals`), or objects with `operator`, `value` and optional `flags`, for example `STEPS: { operator: greater_than_or_equal, value: "10" }`.

Comparisons follow the same rules as every other check:

- Text ignores case and surrounding spaces.
- `*` matches anything, and `"a","b"` passes `contains` if any option is present (`not_contains` only if none are).
- When both values are numbers they compare as numbers, so `"10"` equals `"10.0"`.
- `greater_than`, `less_than` and the other numeric operators need both values to be numbers.
- `matches_regex` uses `flags` (e.g. `i`); an invalid pattern fails.

### One of several opcodes

When more than one block is equally correct (turn right or turn left), give `opcode` a list.
Any one of the blocks counts. This works in `block_used`, `block_run`, `block_count` and in
each `blocks_in_order` sequence item. A plain string still means exactly that one block.

Short form: a list of opcodes. The check's `fieldValues` apply to whichever block matched:
```yaml
check:
  type: block_used
  evaluation: after_block_placed
  opcode: [motion_turnright, motion_turnleft]
  fieldValues:
    DEGREES: "90"       # must be an input of every block in the list
```
Use the short form's `fieldValues` only with keys that every listed block has (both turn
blocks have `DEGREES`). Validation warns when a key is an input of one listed block but not
another, e.g. `DEGREES` with `[motion_turnright, motion_movesteps]`. The warning only knows
number and text inputs, so it can't spot dropdown fields such as `motion_goto`'s `TO`.

Long form: a list of `{ opcode, fieldValues }` entries, each with its own values:
```yaml
check:
  type: block_used
  evaluation: after_block_placed
  opcode:
    - opcode: motion_turnright
      fieldValues: { DEGREES: "90" }
    - opcode: motion_turnleft
      fieldValues: { DEGREES: "90" }
```
You can mix plain opcodes and `{ opcode, fieldValues }` entries in one list. A plain opcode
uses the check's shared `fieldValues`. An entry's own `fieldValues` are added on top of the
shared ones and win where both set the same key.

The Builder shows a list as "any of: …". It can't edit the list, so change it in the lesson
YAML. Its **Use one block** button replaces the list with its first opcode.

### `sprite_property`
```yaml
check:
  type: sprite_property
  evaluation: after_run
  spriteName: Rocket
  property: x          # x | y | size | direction | visible | costume
  operator: greater_than   # equals | not_equals | greater_than | greater_than_or_equal | less_than | less_than_or_equal
  value: 50
```
The four "bigger/smaller" operators need numbers; `costume` (a name) works with `equals` and `not_equals` only.

### `sprite_property_delta`
```yaml
check:
  type: sprite_property_delta
  evaluation: after_run
  spriteName: Rocket
  property: x          # x | y | size | direction
  operator: greater_than   # equals | not_equals | greater_than | greater_than_or_equal | less_than | less_than_or_equal
  value: 10
```
The change is a number, so use it with `x`, `y`, `size` or `direction` only: with `costume` it always fails. For "the costume must switch", use `sprite_property_changed`.

Compares the change in `property` between the state just before Run and the state after Run finishes — use this for "moved by at least N" style checks rather than an absolute position.

### `sprite_property_changed`
```yaml
check:
  type: sprite_property_changed
  evaluation: after_run
  spriteName: Rocket
  property: costume
```
Passes if `property` differs from its value just before Run, regardless of direction or amount — use this when any change counts (e.g. "the costume must switch").

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
  operator: greater_than   # equals | not_equals | greater_than | greater_than_or_equal | less_than | less_than_or_equal
  value: 5
```
Use `variable_compare` for non-equality operators; `variable_equals` is legacy but still supported. The field is `variableName`: a `variable_compare` written with `name:` instead fails validation (it would otherwise never pass).

### `blocks_in_order`
```yaml
check:
  type: blocks_in_order
  evaluation: after_block_placed
  spriteName: Sprite 1   # optional — if omitted, any sprite satisfying it passes
  sequence:
    - event_whenflagclicked
    - opcode: motion_movesteps   # object form — allows fieldValues
      fieldValues:
        STEPS: "50"
    - motion_turnright           # plain string — any value accepted
    - opcode: [motion_turnright, motion_turnleft]   # either turn counts here
      fieldValues:
        DEGREES: "90"
```
Passes if any connected stack contains the opcodes **consecutively** (no gaps). Each sequence item can be a plain opcode string or an object with `opcode` and optional `fieldValues`. An item's `opcode` can also be a list of alternatives, in the short or long form from [One of several opcodes](#one-of-several-opcodes). Put the list under the item's `opcode:`. A bare list as the item itself (`- [motion_turnright, motion_turnleft]`) is rejected, because lessons can't store a list directly inside a list. A block of any listed opcode counts for that position, including when the after-block-placed check decides whether a block sits in the wrong place. A stack is followed from its top block through `next` only: blocks inside a C block (`control_repeat`, `control_forever`, `control_if`, …) are not part of the stack around them and don't start a stack of their own, so a sequence can't match there — check them with `block_used` or `block_count` instead.

### `block_count`
```yaml
check:
  type: block_count
  evaluation: after_block_placed
  spriteName: Sprite 1   # optional
  opcode: motion_movesteps
  operator: equals
  value: 3
```
`operator` is one of `equals`, `not_equals`, `greater_than`, `greater_than_or_equal`, `less_than`, `less_than_or_equal`. The live check (while the learner builds and on Run) and `test-checks` support the same six. `block_count` counts blocks by opcode only. It doesn't use `fieldValues`. With a list of
opcodes, for example `opcode: [motion_turnright, motion_turnleft]`, it counts the blocks of
every listed opcode together: one turn right and two turn lefts count as 3. `fieldValues` on a
long-form entry are ignored here too, and validation warns about them.

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
Note: event hat blocks (`event_whenflagclicked` etc.) are not tracked by `block_run` — use `block_used` to check for a hat's presence instead. When `fieldValues` is set, the block must both have executed and currently have those input values in the workspace. With a list of opcodes (see [One of several opcodes](#one-of-several-opcodes)), the check passes when any listed block ran. If that block has `fieldValues`, a block of the same opcode in the workspace must hold them.

**Always set `fieldValues` when the block has a student-editable input (text, number).** A block is marked "executed" the instant it runs, before its field values are inspected — and this app's click-to-run-a-single-block feature means a bare click on the block (e.g. while a student is clicking in to edit its text) already counts as a run. Without `fieldValues`, `block_run` only asserts "this opcode executed at least once," which can pass on a still-blank/default field. For a task like "type your own message into this say block," require the field to be non-empty rather than leaving `fieldValues` unset:
```yaml
    fieldValues:
      MESSAGE:
        operator: not_equals
        value: ""
```

### `run_attempted`

For demo tasks ("press the green flag and watch"): passes once the learner has pressed the
**green flag** on this task. Clicking a single script, or pressing a key that starts a
`when key pressed` script, never counts. When it is the task's only run-time check it is judged
the moment the flag is pressed, so a project with a `forever` loop, or one the learner stops,
still completes. Scratch has no error status, so `requireSuccess` is ignored (the validator warns).
Leave `evaluation` unset; `after_block_placed` is rejected. It is a completion check only, and
combines with block checks in a list: then the flag press alone isn't enough, and the block checks
must pass too (judged against the blocks when the flag is pressed). `test-checks` reports it as skipped (it needs a run). Full
reference: [python.md](python.md#run-attempted-check-run_attempted).

```yaml
check:
  type: run_attempted
  hint: Click the green flag to watch the cat dance.
```

### Verifying Scratch checks

Run `test-checks` with no `--cases` file to check every Scratch task's checks against its own blocks (no Firebase needed):

```bash
node cli/cli.mjs lessons test-checks lesson.yaml --yaml          # every Scratch task
node cli/cli.mjs lessons test-checks lesson.yaml --task 7         # one task
```

Each task is checked against these stages: `complete` (`completeBlocks`), `starter` (the first Starter stage's `blocks`, else `starterBlocks`), `complete:<label>` for each Complete-role code stage (legacy `solution` stages included), and `support:<label>` for each Support-role code stage that has `blocks` (a stage with no `role` is Support), in authored order. Checks go through the same per-sprite rules as the classroom: a check with `spriteName` looks at that sprite, falling back to the first sprite when no sprite has that name; one without passes if any sprite satisfies it.

Only block checks are evaluated: `block_used`, `blocks_in_order` and `block_count`. Run-time checks (`sprite_property`, `sprite_property_delta`, `sprite_property_changed`, costume, variable and `block_run` checks) need a Run and are reported as `skipped`, so a stage whose block checks pass but has run-time checks reads `incomplete`. Verify those in the Builder.

```yaml
tasks:
  - taskId: 7
    title: Move the rocket
    stages:
      - stage: complete
        completion:
          result: fail                # pass | fail | incomplete (run-time checks skipped) | none
          checks:
            - index: 1
              type: blocks_in_order
              result: fail            # pass | fail | skipped
              sprite: any             # the sprite that decided it; `any` when no sprite passes
              actual:                 # on a fail: each script's opcodes (block_used / block_count: the count)
                - - event_whenflagclicked
                  - motion_movesteps
              reason: the blocks are in this order but a fieldValues condition doesn't match
            - index: 2
              type: sprite_property
              result: skipped
              reason: "run-time check: needs a Run, which the CLI never does"
        feedback:
          - index: 1
            type: block_used
            opcode: motion_turnright
            mode: blocking
            show: after_attempt
            hint: Remove the turn block.
            result: silent            # fires | silent | skipped
      - stage: starter
        # …
warnings:
  - Task 7 complete stage fails completion check 1 (blocks_in_order)
summary:
  tasks: 1
  stagesChecked: 2
  failed: 1                           # number of warnings
  skippedRuntimeChecks: 1
```

`warnings` lists:

- a Complete stage that fails a completion check (`Task … <stage> stage fails completion check N (type)`);
- a feedback check that fires on a Complete stage (it would show to a student who got it right);
- a starter that already passes every completion check;
- a Support stage that passes completion (`Task … support:<label> stage passes every completion check`), or passes every block check with run-time checks skipped: revealing it would hand the student the answer;
- a Debug Code Task (`taskActivity`) whose blocking feedback checks all stay silent on the starter (the bug they describe isn't in the starter);
- stage blocks that aren't valid JSON.

The command exits with status 1 when there are warnings. `lessons validate` also warns when the Complete blocks fail a block check, or the starter already passes, without the per-check detail.

### Testing student variations

`--cases` takes Scratch cases too, so you can check each check against the wrong and partial answers students actually make (a block appended at the bottom, the wrong sound block, a dropdown left on its default, a Support stage resubmitted unchanged) without hand-reading Blockly JSON. A case gives either whole `blocks` (the same JSON shape as `starterBlocks`), or a `stage` to start from plus `edits`:

```bash
node cli/cli.mjs lessons test-checks lesson.yaml --cases scratch-cases.yaml
```

```yaml
cases:                                   # or tasks: [{ id: 7, cases: [...] }], as for code cases
  - task: 7
    name: start sound instead of play sound until done
    stage: complete                      # a stage id from the no --cases run, or a role
    edits:
      - op: replaceOpcode
        target: sound_playuntildone
        opcode: sound_play
    expect:
      completion: fail                   # pass | fail (required)
      blocking: fail                     # optional: fail = a blocking feedback check fires
      feedback: [1]                      # optional: the feedback checks that should fire
  - task: 7
    name: extra block appended at the bottom
    stage: complete
    edits:
      - { op: appendBlock, opcode: motion_movesteps, inputs: { STEPS: 10 } }
    expect: { completion: pass, feedback: [] }
  - task: 7
    name: Support stage resubmitted unchanged
    stage: support                       # the first Support stage with blocks
    expect: { completion: fail }
  - task: 7
    name: whole workspace
    blocks:
      sprite1:
        blocks:
          blocks:
            - type: event_whenflagclicked
    expect: { completion: fail }
```

**`stage`** is a stage id as the no-`--cases` run prints it (`complete`, `starter`, `complete:<label>`, `support:<label>`; labels ignore case), or a role (`complete`, `starter`, `support`) for the first stage of that role.

**`edits`** run in order on a copy of the stage's blocks. Each names a block with `target` (or `after` / `inside`): an opcode (the first in reading order), `{ opcode, nth }` (the nth one, counting from 1), or `{ path: [script, position] }` (counting from 1 down a script's top-level stack). `sprite` (name or id) picks the sprite; the default is the first sprite, and `Stage` is the Stage.

| `op` | Fields | Does |
|---|---|---|
| `appendBlock` | `opcode` with optional `fields` and `inputs`, or a whole `block` (Blockly JSON); where: `after`, `inside` (+ `input`, default `SUBSTACK`), `newScript: true`, or `script` N (default 1) | Adds the block after a block, at the end of a C block's slot, loose on the canvas, or at the bottom of script N. An `inputs` number becomes a number slot, any other value a text slot. |
| `replaceOpcode` | `target`, `opcode`, optional `fields` / `inputs` | Changes the block's opcode, keeping its fields and inputs (e.g. `sound_playuntildone` → `sound_play`). |
| `setField` | `target`, `field`, `value` | Sets the block's own field (a dropdown such as `TO`), else the value in the input of that name (`STEPS`, a menu). |
| `removeBlock` | `target`, optional `withBelow: true` | Removes the block; the blocks below move up unless `withBelow`. |

An edit that can't be applied stops the run with an error naming it, such as `Task 7 case "…" edit 2 (setField): the looks_say block has no field or input "TO" (it has: MESSAGE)`.

**`expect.feedback`** lists the feedback checks that should fire: a number is a check's index (from 1), any other text matches a check's `id`, else part of its `hint`. Every other feedback check is expected to stay silent. Leave `feedback` out to skip comparing feedback.

Each case reports:

- `actual.completion`: `pass`, `fail`, `incomplete` (the block checks pass, run-time checks skipped) or `none` (no completion check, compared as `fail`). An `incomplete` completion is not compared; it is listed in `unconfirmed` and counted in `summary.skipped`.
- `actual.blocking`: `fail` when a blocking feedback check fires, `skipped` when none fires but a blocking one needs a run (not compared), else `pass`.
- `actual.checks` and `actual.feedback`: each check's result with its `sprite`, `reason` and `actual` blocks, as in the no-`--cases` run. With `expect.feedback`, each feedback check also gets `expected` (`fires` / `silent`) and `mismatch: true` when it differs. `matchedFeedback` lists the ones that fire.
- `stillBuilding`: whether the variant counts as still building in class (see [Still building](#scratch-check-types)): `value`, a `reason` (`the blocks are the same as the starter` or `a block is loose on the canvas`), and `failsHeldBack`, true when the task has an `after_block_placed` completion check that would fail here, so the student sees no fail and no hint while editing (Run and the Check button still judge it).
- `mismatches`: each difference from `expect`. The command exits with status 1 when any case has one.

A lesson's cases file can mix code cases and Scratch cases: each task is judged by its own module.

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
- `looks_seteffectto` · `looks_changeeffectby` · `looks_cleargraphiceffects`: all seven effects (`color`, `fisheye`, `whirl`, `pixelate`, `mosaic`, `brightness`, `ghost`) draw on the stage using Scratch 3's own maths. For costume images hosted on another site (for example Firebase Storage URLs), `fisheye` and `whirl` can't be drawn, because the browser won't let the page read those pixels; the other five still work.

**Sound**
- `sound_play` · `sound_playuntildone` · `sound_stopallsounds`: the `SOUND_MENU` field is the name of one of the sprite's own `sounds` (see [Sounds](#sounds)).

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
| `move (10) steps` | Number input: round brackets with a value |
| `say [Hello!]` | Text input: square brackets with the text |
| `if <touching [edge]?> then` | Boolean input slot |
| `set [score] to (0)` | Dropdown or variable field + input |

Always put a value in the brackets. An empty `[]` doesn't match any block, so it draws a grey "unknown" block (see [Scratch Markdown Block Reference](scratch-markdown-blocks.md)).
| `key [space] pressed?` | Dropdown value |

Inline Scratch blocks must use the `scratch:` prefix. Fenced `scratch` code blocks are the right format for full stacks, nested C-block mouths, and reporter/Boolean inputs. See `docs/authoring/markdown-renderer.md` for the full Scratch block rendering reference.

---

## Minimal JSON Example

```json
{
  "id": "scratch-minimal",
  "type": "composed",
  "title": "Scratch Minimal",
  "description": "A short Scratch lesson.",
  "tasks": [
    {
      "id": 1,
      "moduleType": "scratch",
      "title": "Move",
      "explainer": "Move the sprite to the right.",
      "sprites": [{ "id": "sprite1", "name": "Sprite 1", "type": "cat", "x": 0, "y": 0, "size": 100, "direction": 90 }],
      "starterBlocks": { "sprite1": { "blocks": { "languageVersion": 0, "blocks": [{ "type": "event_whenflagclicked", "x": 40, "y": 40 }] } } },
      "check": { "type": "sprite_property", "evaluation": "after_run", "spriteName": "Sprite 1", "property": "x", "operator": "greater_than", "value": 50 }
    }
  ]
}
```
