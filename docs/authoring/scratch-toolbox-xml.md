# Scratch Toolbox XML

How to write the `toolbox` field for a Scratch task to control which blocks students can use.

---

## Overview

The `toolbox` field on a Scratch task is an XML string. It lists the categories and blocks that appear in the student's block palette. If the field is empty or omitted, students get the full default toolbox.

```yaml
- title: Move the Sprite
  toolbox: "<xml>...</xml>"
```

---

## XML Structure

```xml
<xml>
  <category name="CATEGORY_NAME" colour="#HEXCOLOUR">
    <block type="opcode_name"/>
    <block type="another_opcode"/>
  </category>
  <category name="ANOTHER_CATEGORY" colour="#HEXCOLOUR">
    <block type="opcode_name"/>
  </category>
</xml>
```

Rules:
- The root element must be `<xml>`.
- Each `<category>` groups related blocks under a labelled section.
- Each `<block type="..."/>` adds one block to its category.
- Categories with no `<block>` children are automatically hidden.
- Block order inside a category is fixed by the platform; ordering in the XML is ignored.

---

## Standard Categories

Use these names and colours to match the platform's visual style.

| Category   | Colour    |
|------------|-----------|
| Events     | `#FFAB19` |
| Motion     | `#4C97FF` |
| Looks      | `#9966FF` |
| Control    | `#FFAB19` |
| Sensing    | `#5CB1D6` |
| Operators  | `#59C059` |
| Variables  | `#FF8C1A` |
| Sound      | `#CF63CF` |

You may use any name and colour for a custom category, but prefer the standard names when the blocks belong to a known Scratch group.

---

## Available Blocks by Category

### Events (`#FFAB19`)

| Opcode | Block |
|--------|-------|
| `event_whenflagclicked` | when green flag clicked |
| `event_whenkeypressed` | when key pressed |
| `event_whenthisspriteclicked` | when this sprite clicked |
| `event_whenbackdropswitchesto` | when backdrop switches to |
| `event_broadcast` | broadcast |
| `event_broadcastandwait` | broadcast and wait |
| `event_whenbroadcastreceived` | when I receive |

### Motion (`#4C97FF`)

| Opcode | Block |
|--------|-------|
| `motion_movesteps` | move steps |
| `motion_turnright` | turn right |
| `motion_turnleft` | turn left |
| `motion_pointindirection` | point in direction |
| `motion_gotoxy` | go to x/y |
| `motion_goto` | go to |
| `motion_glidesecstoxy` | glide secs to x/y |
| `motion_glideto` | glide to |
| `motion_ifonedge_bounce` | if on edge, bounce |
| `motion_setx` | set x |
| `motion_sety` | set y |
| `motion_changexby` | change x by |
| `motion_changeyby` | change y by |
| `motion_setrotationstyle` | set rotation style |
| `motion_xposition` | x position |
| `motion_yposition` | y position |
| `motion_direction` | direction |

### Looks (`#9966FF`)

| Opcode | Block |
|--------|-------|
| `looks_sayforsecs` | say for seconds |
| `looks_say` | say |
| `looks_think` | think |
| `looks_thinkforsecs` | think for seconds |
| `looks_show` | show |
| `looks_hide` | hide |
| `looks_setsizeto` | set size to |
| `looks_changesizeby` | change size by |
| `looks_switchcostumeto` | switch costume to |
| `looks_nextcostume` | next costume |
| `looks_costumenumber` | costume number |
| `looks_costumenumbername` | costume number/name |
| `looks_switchbackdropto` | switch backdrop to |
| `looks_nextbackdrop` | next backdrop |
| `looks_backdropnumbername` | backdrop number/name |
| `looks_seteffectto` | set effect to |
| `looks_changeeffectby` | change effect by |
| `looks_cleargraphiceffects` | clear graphic effects |

### Control (`#FFAB19`)

| Opcode | Block |
|--------|-------|
| `control_wait` | wait |
| `control_wait_until` | wait until |
| `control_repeat` | repeat |
| `control_repeat_until` | repeat until |
| `control_forever` | forever |
| `control_if` | if then |
| `control_if_else` | if then else |
| `control_stop` | stop all |

### Sensing (`#5CB1D6`)

| Opcode | Block |
|--------|-------|
| `sensing_askandwait` | ask and wait |
| `sensing_answer` | answer |
| `sensing_keypressed` | key pressed? |
| `sensing_mousedown` | mouse down? |
| `sensing_touchingedge` | touching edge? |
| `sensing_touchingobject` | touching object? |
| `sensing_distanceto` | distance to |
| `sensing_timer` | timer |
| `sensing_resettimer` | reset timer |

### Operators (`#59C059`)

| Opcode | Block |
|--------|-------|
| `operator_equals` | equals |
| `operator_gt` | greater than |
| `operator_lt` | less than |
| `operator_and` | and |
| `operator_or` | or |
| `operator_not` | not |
| `operator_add` | add |
| `operator_subtract` | subtract |
| `operator_multiply` | multiply |
| `operator_divide` | divide |
| `operator_mod` | mod |
| `operator_round` | round |
| `operator_mathop` | math operation |
| `operator_join` | join |
| `operator_letter_of` | letter of |
| `operator_length` | length of |
| `operator_contains` | contains |

### Variables (`#FF8C1A`)

| Opcode | Block |
|--------|-------|
| `data_variable` | variable (reporter) |
| `data_setvariableto` | set variable to |
| `data_changevariableby` | change variable by |
| `data_showvariable` | show variable |
| `data_hidevariable` | hide variable |

### Sound (`#CF63CF`)

| Opcode | Block |
|--------|-------|
| `sound_play` | start sound |
| `sound_playuntildone` | play sound until done |
| `sound_stopallsounds` | stop all sounds |

---

## Common Patterns

### Minimal toolbox — one hat block and one action block

```xml
<xml>
  <category name="Events" colour="#FFAB19">
    <block type="event_whenflagclicked"/>
  </category>
  <category name="Motion" colour="#4C97FF">
    <block type="motion_movesteps"/>
  </category>
</xml>
```

### Movement and loops

```xml
<xml>
  <category name="Events" colour="#FFAB19">
    <block type="event_whenflagclicked"/>
    <block type="event_whenkeypressed"/>
  </category>
  <category name="Motion" colour="#4C97FF">
    <block type="motion_movesteps"/>
    <block type="motion_turnright"/>
    <block type="motion_turnleft"/>
    <block type="motion_ifonedge_bounce"/>
  </category>
  <category name="Control" colour="#FFAB19">
    <block type="control_forever"/>
    <block type="control_repeat"/>
  </category>
</xml>
```

### Conditionals with sensing

```xml
<xml>
  <category name="Events" colour="#FFAB19">
    <block type="event_whenflagclicked"/>
  </category>
  <category name="Control" colour="#FFAB19">
    <block type="control_forever"/>
    <block type="control_if"/>
    <block type="control_if_else"/>
  </category>
  <category name="Sensing" colour="#5CB1D6">
    <block type="sensing_keypressed"/>
    <block type="sensing_touchingedge"/>
  </category>
  <category name="Motion" colour="#4C97FF">
    <block type="motion_movesteps"/>
    <block type="motion_turnright"/>
    <block type="motion_turnleft"/>
    <block type="motion_ifonedge_bounce"/>
  </category>
</xml>
```

### Variables and score tracking

```xml
<xml>
  <category name="Events" colour="#FFAB19">
    <block type="event_whenflagclicked"/>
    <block type="event_whenthisspriteclicked"/>
  </category>
  <category name="Variables" colour="#FF8C1A">
    <block type="data_setvariableto"/>
    <block type="data_changevariableby"/>
    <block type="data_variable"/>
  </category>
  <category name="Control" colour="#FFAB19">
    <block type="control_if"/>
  </category>
  <category name="Operators" colour="#59C059">
    <block type="operator_gt"/>
    <block type="operator_equals"/>
  </category>
</xml>
```

---

## YAML Formatting

Short toolboxes can be written inline. For anything longer, use a YAML block scalar to keep the lesson readable.

```yaml
# Inline — fine for 2–3 blocks
toolbox: "<xml><category name=\"Events\" colour=\"#FFAB19\"><block type=\"event_whenflagclicked\"/></category></xml>"

# Block scalar — preferred for multi-category toolboxes
toolbox: >-
  <xml>
    <category name="Events" colour="#FFAB19">
      <block type="event_whenflagclicked"/>
    </category>
    <category name="Motion" colour="#4C97FF">
      <block type="motion_movesteps"/>
    </category>
  </xml>
```

The `>-` scalar folds the XML into a single line and strips the trailing newline, which is what the platform expects.

---

## Tips

- **Omit `toolbox` entirely** to give students the full default palette. Only restrict when the task is deliberately constrained.
- **Include the hat block.** Always include at least one event block (`event_whenflagclicked` is almost always needed) or students will have no way to start their script.
- **Match checks to the toolbox.** If a `block_used` check requires a block, that block must appear in the toolbox. A block missing from the toolbox can never satisfy the check.
- **Use the builder.** The Lesson Builder has a visual toolbox picker that generates the XML for you. Copy the output into your YAML when you need the raw string.
