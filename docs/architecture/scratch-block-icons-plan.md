# Scratch Block Icon Plan

Accepted implementation reference for the Scratch block icon mapping.

## Goal

Add a small emoji/icon cue to every Scratch block name wherever students or lesson authors choose, read, or see Scratch blocks:

- Scratch blocks rendered in Markdown explanations.
- Scratch block choices in the Markdown editor toolbar.
- Scratch block names in Blockly itself.
- Scratch block pickers used by checks, toolbox setup, predefined blocks, and prebuilt stacks.

The icon should reinforce the action or concept, not decorate it. Students who struggle with reading should be able to recognise a block by colour, shape, and a repeated visual cue.

## Implementation Shape

Add `icon` to each entry in `src/shared/scratchBlockCatalog.js`, then derive all author-facing labels from that single catalog.

Suggested shared helpers:

```js
export function scratchBlockDisplayLabel(opcodeOrBlock) {
  const block = typeof opcodeOrBlock === 'string' ? SCRATCH_BLOCK_BY_OPCODE[opcodeOrBlock] : opcodeOrBlock
  return block?.icon ? `${block.icon} ${block.label}` : block?.label ?? ''
}

export function scratchBlockDisplaySample(opcodeOrBlock) {
  const block = typeof opcodeOrBlock === 'string' ? SCRATCH_BLOCK_BY_OPCODE[opcodeOrBlock] : opcodeOrBlock
  return block?.icon ? `${block.icon} ${block.sample}` : block?.sample ?? ''
}
```

Keep plain-text matching for backward compatibility:

- `patterns` should recognise both `sample` and `icon + sample`.
- Existing aliases should still match without icons.
- Markdown toolbar insertion can use the icon sample, while old lessons such as `` `scratch:move (10) steps` `` continue to render.

For Blockly labels, import the catalog/helper into `src/modules/scratch/scratch.js` and prefix every `message0` with the block icon. Dynamic dropdown values should stay unprefixed unless they are also block names; for example `mouse pointer`, sprite names, costume names, sound names, variable names, and backdrop names should remain as authored data.

## Proposed Icon Map

### Events

| Opcode | Current text | Proposed | Why |
|---|---|---|---|
| `event_whenflagclicked` | when green flag clicked | 🟢 when green flag clicked | Green start cue; Markdown already has a green-flag SVG, so implementation may use that visual instead of the emoji. |
| `event_whenkeypressed` | when key pressed | ⌨️ when key pressed | Keyboard input. |
| `event_whenthisspriteclicked` | when sprite clicked | 👆 when sprite clicked | Click/tap action. |
| `event_whenbackdropswitchesto` | when backdrop switches to | 🖼️ when backdrop switches to | Stage/backdrop image. |
| `event_broadcast` | broadcast | 📣 broadcast | Send a message. |
| `event_broadcastandwait` | broadcast and wait | 📣⏳ broadcast and wait | Send, then pause. |
| `event_whenbroadcastreceived` | when I receive | 📥 when I receive | Incoming message. |

### Motion

| Opcode | Current text | Proposed | Why |
|---|---|---|---|
| `motion_movesteps` | move steps | 👣 move steps | Movement by steps. |
| `motion_turnright` | turn right | ↪️ turn right | Right rotation. |
| `motion_turnleft` | turn left | ↩️ turn left | Left rotation. |
| `motion_pointindirection` | point in direction | 🧭 point in direction | Direction/compass cue. |
| `motion_gotoxy` | go to x/y | 🎯 go to x/y | Move to exact target coordinates. |
| `motion_goto` | go to | 📍 go to | Move to a named place. |
| `motion_glidesecstoxy` | glide secs to x/y | 🛝 glide secs to x/y | Smooth slide-like movement. |
| `motion_glideto` | glide to | 🛝 glide to | Smooth slide-like movement. |
| `motion_ifonedge_bounce` | if on edge, bounce | ↩️ if on edge, bounce | Rebound/turn back at the edge. |
| `motion_setx` | set x | ↔️ set x | Horizontal position. |
| `motion_sety` | set y | ↕️ set y | Vertical position. |
| `motion_changexby` | change x | ➡️ change x | Horizontal change. |
| `motion_changeyby` | change y | ⬆️ change y | Vertical change. |
| `motion_setrotationstyle` | set rotation style | 🔄 set rotation style | Rotation behaviour. |
| `motion_xposition` | x position | ↔️ x position | Horizontal coordinate reporter. |
| `motion_yposition` | y position | ↕️ y position | Vertical coordinate reporter. |
| `motion_direction` | direction | 🧭 direction | Direction reporter. |

### Looks

| Opcode | Current text | Proposed | Why |
|---|---|---|---|
| `looks_sayforsecs` | say for seconds | 💬 say for seconds | Speech bubble for spoken text. |
| `looks_say` | say | 💬 say | Speech bubble. |
| `looks_think` | think | 💭 think | Thought bubble. |
| `looks_thinkforsecs` | think for seconds | 💭 think for seconds | Thought bubble plus duration in text. |
| `looks_show` | show | 👁️ show | Visible. |
| `looks_hide` | hide | 🚫👁️ hide | Not visible. |
| `looks_setsizeto` | set size | 🔍 set size | Size/zoom cue. |
| `looks_changesizeby` | change size | 📏 change size | Size measurement/change. |
| `looks_switchcostumeto` | switch costume to | 🎭 switch costume to | Costume/appearance. |
| `looks_nextcostume` | next costume | 🎭 next costume | Costume/appearance. |
| `looks_costumenumber` | costume number | #️⃣ costume number | Numeric costume reporter. |
| `looks_costumenumbername` | costume number/name | 🏷️ costume number/name | Costume label/name reporter. |
| `looks_switchbackdropto` | switch backdrop to | 🖼️ switch backdrop to | Stage/backdrop image. |
| `looks_nextbackdrop` | next backdrop | 🖼️ next backdrop | Stage/backdrop image. |
| `looks_backdropnumbername` | backdrop number/name | 🏷️ backdrop number/name | Backdrop label/name reporter. |
| `looks_seteffectto` | set effect to | ✨ set effect to | Visual effect. |
| `looks_changeeffectby` | change effect by | ✨ change effect by | Visual effect change. |
| `looks_cleargraphiceffects` | clear graphic effects | 🧽 clear graphic effects | Clear/remove effects. |

### Sound

| Opcode | Current text | Proposed | Why |
|---|---|---|---|
| `sound_play` | start sound | 🔊 start sound | Sound begins. |
| `sound_playuntildone` | play sound until done | ▶️🔊 play sound until done | Play and continue until complete. |
| `sound_stopallsounds` | stop all sounds | 🔇 stop all sounds | Muted/stopped sound. |

### Control

| Opcode | Current text | Proposed | Why |
|---|---|---|---|
| `control_wait` | wait | ⏳ wait | Waiting for time. |
| `control_wait_until` | wait until | ⏱️ wait until | Waiting for a condition/time point. |
| `control_repeat` | repeat | 🔁 repeat | Loop/repeat. |
| `control_repeat_until` | repeat until | 🔁⏱️ repeat until | Loop until a condition. |
| `control_forever` | forever | ♾️ forever | Infinite loop. |
| `control_if` | if then | ❓ if then | Decision/condition. |
| `control_if_else` | if then else | 🔀 if then else | Branching path. |
| `control_stop` | stop all | 🛑 stop all | Stop sign. |
| `control_create_clone_of` | create a clone of | ➕ create a clone of | Add another copy. |
| `control_start_as_clone` | when I start as a clone | 🆕 when I start as a clone | New clone begins. |
| `control_delete_this_clone` | delete this clone | 🗑️ delete this clone | Remove/delete. |

### Sensing

| Opcode | Current text | Proposed | Why |
|---|---|---|---|
| `sensing_askandwait` | ask and wait | ❔ ask and wait | Ask a question. |
| `sensing_answer` | answer | 💬 answer | Returned answer text. |
| `sensing_keypressed` | key pressed? | ⌨️ key pressed? | Keyboard input. |
| `sensing_mousedown` | mouse down? | 🖱️ mouse down? | Mouse button input. |
| `sensing_touchingedge` | touching edge? | 🧱 touching edge? | Boundary/edge. |
| `sensing_touchingobject` | touching object? | ✋ touching object? | Touch/contact. |
| `sensing_distanceto` | distance to | 📏 distance to | Measuring distance. |
| `sensing_timer` | timer | ⏱️ timer | Timer reporter. |
| `sensing_resettimer` | reset timer | 🔄⏱️ reset timer | Restart timer. |

### Operators

| Opcode | Current text | Proposed | Why |
|---|---|---|---|
| `operator_equals` | equals | 🟰 equals | Equality. |
| `operator_gt` | greater than | 🔼 greater than | Bigger/more than. |
| `operator_lt` | less than | 🔽 less than | Smaller/less than. |
| `operator_and` | and | 🔗 and | Both linked conditions. |
| `operator_or` | or | 🔀 or | Either branch/path. |
| `operator_not` | not | 🚫 not | Negation. |
| `operator_add` | add | ➕ add | Addition. |
| `operator_subtract` | subtract | ➖ subtract | Subtraction. |
| `operator_multiply` | multiply | ✖️ multiply | Multiplication. |
| `operator_divide` | divide | ➗ divide | Division. |
| `operator_mod` | mod | 🧮 mod | Maths/remainder. |
| `operator_round` | round | 🎯 round | Aim for nearest whole number. |
| `operator_mathop` | math operation | 🧮 math operation | General maths operation. |
| `operator_random` | pick random | 🎲 pick random | Random choice. |
| `operator_join` | join | 🧩 join | Pieces joined together. |
| `operator_letter_of` | letter of | 🔤 letter of | Letters/text. |
| `operator_length` | length of | 📏 length of | Measure length. |
| `operator_contains` | contains | 🔎 contains | Search/find inside. |

### Variables

| Opcode | Current text | Proposed | Why |
|---|---|---|---|
| `data_variable` | variable | 📦 variable | A stored value. |
| `data_setvariableto` | set variable | 📝 set variable | Write a value. |
| `data_changevariableby` | change variable | 🔁 change variable | Update/change stored value. |
| `data_showvariable` | show variable | 👁️ show variable | Make variable visible. |
| `data_hidevariable` | hide variable | 🚫👁️ hide variable | Hide variable display. |

## Accepted Choices

The mapping above was approved and implemented with readable icon cues:

- Blockly labels include a leading 48px `field_image` SVG badge generated from each block's `badgeIcon` when present, otherwise its `icon`. `blockMessage()` reserves `%1` for the badge and shifts the original placeholders, while `blockArgs()` prepends the image field. The markdown tests assert that every shifted Blockly `message0` has matching `args0`, which protects no-input blocks from the placeholder mismatch that previously broke Scratch rendering.
- Markdown toolbar examples insert icon-prefixed Scratch samples.
- The Markdown renderer recognises both old plain-text samples and new icon-prefixed samples, then renders the icon as a larger white-backed badge.
- Existing icon-free Scratch snippets render with the icon badge visually.
- Builder/editor React surfaces use the larger white-backed badge where rich markup is supported.

## Testing Plan

- Update catalog coverage tests so every Scratch block has a non-empty `icon`.
- Add markdown tests confirming plain old samples and icon-prefixed samples both render as Scratch blocks.
- Add picker/toolbar tests confirming labels include icons but inserted blocks remain valid Scratch markdown.
- Run `npm test`.
- Run `npm run docs:check` because this plan adds a docs file and updates the docs inventory.
