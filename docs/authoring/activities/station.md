# Space Station Activity

> **Phase 1 only.** The station covers Mouse and Keyboard Lessons 1 to 4 (power and colours,
> double-click, drag and Ctrl+Z, a scrolling catalogue). Right-click menus, hover tags, text on
> parts, copy and paste, and PNG / share link are not built yet; `lesson` must be 1, 2, 3 or 4.
> Design: [station-activity.md](../../architecture/station-activity.md).

A Space station task is an **activity** (see [binary.md](binary.md) for what that means: no Run,
no sandbox, no sharing; marked as you go). Each child has **one space station** that comes back
every week. Each lesson teaches one mouse or keyboard skill, and the child uses it, the way it
really works on a computer, to add something they can see. The station is carried from lesson to
lesson through the tutor's roster match (the host side of this is built separately); if a child
missed a lesson, earlier parts are added in default places so they can carry on.

Write `type: station` on the task (the YAML shorthand for `taskType: activity` +
`activityType: station`, which also works). In the Builder, choose the **Activity** format and
pick **Space station**.

| Lesson | Skill | What happens on the station |
|---|---|---|
| 1 Power Up | click presses / chooses | The station is dark. Click the three power buttons to light each section; click a swatch for the hull and light colours (swatches are in this lesson only). |
| 2 Special Delivery | double-click opens, one click selects | Crates arrive. One click selects a crate; a double-click opens it and the crew inside walk to their posts. Click a crew member to make them captain. |
| 3 Build It | drag moves; Ctrl+Z undoes | Drag modules from a tray onto empty spots; they snap in. Ctrl+Z (Cmd+Z on a Mac) puts the last change back. |
| 4 The Catalogue | scroll moves through a long list | Scroll a long catalogue, click to order parts, then drag each into place. |

## Complete example

Lesson 3, "Build It".

```yaml
id: station-build-it
type: python
title: Build It
description: Drag parts onto the space station.
tasks:
  - title: Build your station
    type: station
    description: Drag a part from the tray onto an empty spot. Made a mistake? Ctrl+Z puts it back.
    lesson: 3
    coreItems: 3
    items:
      - id: solar
        goal: place_part
        target: solar
        prompt: Drag the solar panel onto the station.
      - id: dome
        goal: place_part
        target: dome
        prompt: Drag the dome onto the station.
      - id: undo
        goal: undo
        prompt: Press Ctrl+Z (Cmd+Z on a Mac) to put the last part back.
      - id: any
        goal: place_part
        prompt: Add any other part you like.
```

## Task fields

| Field | Required | Notes |
|---|:---:|---|
| `type` | Yes | `station` in YAML (JSON: `taskType: activity` + `activityType: station`) |
| `lesson` | Yes | `1` to `4` (Phase 1). Sets the starting station: everything from earlier lessons is already there in default places (catch-up), then this lesson's setup is added (dark station, crates, tray, catalogue). |
| `items` | Yes | This week's goals, done in any order (see below). |
| `catalogue` | No | Part ids on offer: the Lesson 3 tray or the Lesson 4 catalogue. Lessons 1 and 2 have none. Default: the lesson's own list (Lesson 3: `solar`, `dome`, `greenhouse`, `docking-arm`; Lesson 4: `telescope`, `dish`, `flag`, `antenna`, `beacon`, `satellite`, `cargo-pod`, `rainbow-ring`, the best one last, at the very bottom). |
| `coreItems` | No | How many goals make the task pass, 1 to the number of `items`. **The first this many goals are required; the rest are bonus** (put the required goals first). Default: all goals. |
| `crates` | No | Lesson 2 only. The crates in the delivery bay, 1 to 5, each `{ id, sticker? }` with `id` from `crate-1` to `crate-5`, in the order shown. Default: `crate-1` to `crate-3`, no stickers. `crate-4` holds `crew-robot-3`; `crate-5` is empty (a good decoy). |
| `note` | No | Lesson 2 only. The delivery note: a list of stickers, each a colour and a shape like `red-star`. Used by `open_crate` with `onlyNoted`. Every note sticker must be on a crate. |

## Item fields

| Field | Required | Notes |
|---|:---:|---|
| `id` | Yes | Short unique id (`power`, `hull`, …). |
| `goal` | Yes | What the child does (table below). |
| `target` | Depends | What the goal is about: a power section (`left`, `core`, `right`), `hull` or `lights`, a part id or a crate id. Leave out for "any" (or all three sections for `power_on`). Required for `pick_colour`. |
| `prompt` | No | The instruction shown. Default: a plain sentence made from the goal and target. |
| `order` | No | `power_on`, `open_crate`, `place_part`. A list of at least 2 ids to do in this order (sections, crates or parts). Shown as a numbered card. A wrong next step blinks and changes nothing. Not with `target`. |
| `match` | No | `pick_colour`. The colour that counts, from the hull or light colours. Mission Control's card shows it. Other swatches still recolour but do not count. |
| `card` | No | `order_part`, `place_part`. A part id shown as a picture ("find the one in the picture"); the part on the card is the target, so do not also set `target`. |
| `onlyNoted` | No | `open_crate`. `true`: done when every crate the `note` lists is open and no other is. Opening a decoy blinks and it stays shut. |
| `count` | No | `place_part` (lesson 3, needs a `target`), `open_crate`, `undo`. Done at exactly this many (2 or more). |

## Goals and methods

Every goal records **how** it was done, and only the listed method completes it. The tutor sees
the method ("opened by double-click").

| Goal | Lessons | Target | Done when | Method that counts |
|---|---|---|---|---|
| `power_on` | 1 | a section id, or none = all three | that section (or all) is lit | `click`; Enter or Space on the focused button records `keyboard` and also counts |
| `pick_colour` | 1 | `hull` or `lights` (required) | a swatch is chosen | `click` or `keyboard` |
| `select` | 2, 3, 4 | a part or crate id, or none = any | a crate (Lesson 2) or part is selected by one click. The default prompt in Lesson 2 is "Select a crate." | `click` |
| `open_crate` | 2 | `crate-1` to `crate-5` (the crates in the task), or none = any | a crate is opened | **`double_click` only.** Enter opens the crate (keyboard access) but the goal stays open with the hint "Now try a double-click." |
| `choose_captain` | 2 | none | a crew member is made captain | `click` |
| `place_part` | 3, 4 | a part id, or none = any | the part sits on a spot | `drag`, or `pick_drop` (click to pick up, click to drop: the trackpad fallback). Both count. |
| `undo` | 3, 4 | none | a change is undone | `ctrl_z` or `cmd_z` only. The tutor's "Undo last change" never counts. |
| `order_part` | 4 | a part id, or none = any | the part is ordered from the catalogue | `click`; whether the child scrolled the list first is recorded too |

Parts you can name as targets: crates `crate-1` to `crate-5` (each holds a crew member: `crew-robot-1`,
`crew-robot-2`, `crew-plant`, `crew-robot-3`; `crate-5` is empty; they stand in the portholes); Lesson 3 modules
`solar`, `dome`, `greenhouse`, `docking-arm`; Lesson 4 catalogue parts `telescope`, `dish`, `flag`,
`antenna`, `beacon`, `satellite`, `cargo-pod` and the module `rainbow-ring` (the prize, last in the
list). `place_part` and `order_part` targets must be in the task's catalogue.

Where parts fit (Lesson Gen's art, 18 spots): a 2x2 module goes on one of the four module spots (two
on top, two hanging under the hull); the docking arm also fits the two end spots; small parts go on
the part spots (two on top, two under, one on the top of the ring). Only parts that can hang
(`solar`, `rainbow-ring`, `dish`, `antenna`, `beacon`, `satellite`, `cargo-pod`) go under the hull,
drawn upside down; the dome, greenhouse, telescope and flag never do. Empty spots a part fits light
up while the child holds it.

Station saved before this art (older spot, post and part ids) is read gracefully: ids the station
no longer has are dropped and the catch-up puts the lesson's parts back in default places.

## Build jobs

Each lesson's build can be a few short jobs, all done with the lesson's skill, easiest first
(Lesson Gen's "Build jobs", LG-P8). The target of a job sits on a **card** beside its goal line,
big enough to read from across a room. A wrong move costs nothing: it **blinks** (a short shake and
a red outline; with reduced motion only the outline flashes), changes nothing, and adds no undo step.

| Job (pattern) | How to write it | What the child sees |
|---|---|---|
| In the right order | `power_on` with `order: [left, core, right]`; `open_crate` with `order: [crate-2, crate-1]`; `place_part` with `order: [dome, solar, greenhouse]` | A numbered card (the next step has a frame). A step out of order blinks the card and the thing pressed. |
| Pick the right one: colour | `pick_colour` with `target: hull` and `match: red` | A big colour card. Any swatch recolours, only the matching one counts. |
| Pick the right one: picture | `order_part` or `place_part` with `card: dish` (no `target`) | A picture of the part, no name. Only that part counts. |
| Leave the decoys | task `crates` with a `sticker` each, task `note: [red-star, green-triangle]`, and `open_crate` with `onlyNoted: true` | A sticker on every crate (larger in a reading panel when one click selects the crate) and a delivery note card. A decoy blinks and stays shut. |
| Exactly that many | `place_part` with `target: solar` and `count: 3` (Lesson 3); `open_crate` with `count: 2`; `undo` with `count: 3` | "Exactly 3" with a counter ("1 of 3"). A counted part never runs out of the tray. `undo` counts only Ctrl+Z / Cmd+Z presses that really undo. |
| Their own choice | the plain goals (`pick_colour` with no `match`, `place_part` with no `target`) | The usual goal line. |

Stickers are a colour and a shape joined with a dash: colours `red`, `blue`, `green`, `yellow`,
`purple`, `orange`; shapes `star`, `circle`, `triangle`, `square`, `heart` (for example
`red-star`). They are drawn in code, so no image files are needed.

Notes:

- An ordered goal only refuses while it is not done. Things not in its `order` are never refused.
  `open_crate` with `onlyNoted` refuses a decoy even after the goal is done.
- `count` on `place_part` copes with the same part more than once: drag from the tray each time;
  dragging a placed copy moves it. Only Lesson 3 (the 2x2 `solar` has four spots).
- **Sorting** ("fuel to the tank, plants to the greenhouse") is not built: the station's spots
  accept by part kind, not by a custom group, so there is nothing to sort into yet.

### Example lesson using the build jobs

```yaml
id: station-build-jobs
type: python
title: Station build jobs
description: Four station builds that use the new jobs.
tasks:
  - title: "Lesson 1: Power Up"
    type: station
    description: Your station is dark. Switch it on in the start-up order, then match the colour on the card.
    lesson: 1
    coreItems: 2
    items:
      - id: order
        goal: power_on
        order: [left, core, right]
        prompt: Switch on the sections in the order on the start-up card.
      - id: match
        goal: pick_colour
        target: hull
        match: red
        prompt: Mission Control shows a colour. Click the hull colour that matches it.
      - id: lights
        goal: pick_colour
        target: lights
        prompt: Choose your own light colour.
  - title: "Lesson 2: Special Delivery"
    type: station
    description: Supply crates have arrived! One click selects a crate and shows its sticker. A double-click opens it.
    lesson: 2
    crates:
      - id: crate-1
        sticker: red-star
      - id: crate-2
        sticker: blue-circle
      - id: crate-3
        sticker: green-triangle
      - id: crate-4
        sticker: red-star
      - id: crate-5
    note: [red-star, green-triangle]
    items:
      - id: select
        goal: select
        prompt: Click a crate once to read its sticker.
      - id: noted
        goal: open_crate
        onlyNoted: true
        prompt: Open only the crates on the delivery note. Leave the others shut.
      - id: captain
        goal: choose_captain
  - title: "Lesson 3: Build It"
    type: station
    description: Follow the plan card. Made a mistake? Ctrl+Z puts it back.
    lesson: 3
    coreItems: 2
    items:
      - id: plan
        goal: place_part
        order: [dome, greenhouse]
        prompt: Build in the order on the plan card.
      - id: solars
        goal: place_part
        target: solar
        count: 2
        prompt: Put exactly two solar panels on the station.
      - id: back
        goal: undo
        count: 3
        prompt: Step back three times with Ctrl+Z.
  - title: "Lesson 4: The Catalogue"
    type: station
    description: Scroll the catalogue. The best part is at the very bottom!
    lesson: 4
    coreItems: 2
    items:
      - id: telescope
        goal: order_part
        target: telescope
      - id: find
        goal: order_part
        card: dish
        prompt: The inspector is holding up a part. Find it in the catalogue and order it.
      - id: place
        goal: place_part
        card: dish
        prompt: Put the part from the picture on your station.
```

## Marking and hints

- Goals are marked as you go: a goal ticks the moment it is done with the right method, and the
  task passes when the core goals are done ("Station upgraded!"). The core is the **first**
  `coreItems` goals, not any that many: a bonus goal done early does not finish the round, and the
  progress dots, the card ("1/2 goals") and the pass message all use the first goals. The child can
  keep building after.
- A goal not done yet gets a short hint that never gives the answer away, for example "Now try a
  double-click." or "Drag a part onto an empty spot."
- Every station change is a discrete step (a click, a drop). Dragging itself is not saved.
- When the core goals complete, the station shows a short "Station upgraded!" moment: lights sweep
  across the hull and the newest part pops and sparkles (a still glow when the child prefers
  reduced motion). Each goal in the list has a small picture of the part, crate or badge it is
  about.

## Teacher tools

- The student card shows `n/m goals` (the first `coreItems` goals done, then `+n bonus`) and a small station; the student modal shows the full
  station read-only, live, with each goal's method.
- **Undo last change** puts the child's last change back (Lessons 1 and 2 have no Ctrl+Z yet).
  It never completes an `undo` goal.
- **Edit answers**, **Start again** and **Complete (show answers)** work as for other
  activities.
- The session report lists, for each goal, how many children did it and by which method.

## Devices

The station needs a mouse or trackpad (`requires: finePointer`). Touch is blocked: "This needs a
mouse or trackpad." The station picture is at least 560 px wide (it scrolls sideways on a narrower area) so every target is at least 44 px.

## Validation

Every Space station validation message is listed under "Space station" in
[validation-errors.md](../validation-errors.md).
