# Space Station Activity

> **Phase 1 only.** The station covers Mouse and Keyboard Lessons 1 to 4 (power and colours,
> double-click, drag and Ctrl+Z, a scrolling catalogue), in three **worlds**: the space station,
> the zoo and the toy shop (see [Worlds](#worlds)). Right-click menus, hover tags, text on
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
| `world` | No | `station` (the default), `zoo` or `toyshop`. A task is a station task unless it says otherwise, whatever its `lesson`. See [Worlds](#worlds). |
| `lesson` | Yes (station) | `1` to `4` (Phase 1). In the zoo it is 3 and in the toy shop 4, so it may be left out there. Sets the starting station: everything from earlier lessons is already there in default places (catch-up), then this lesson's setup is added (dark station, crates, tray, catalogue). |
| `items` | Yes | This week's goals, done in any order (see below). |
| `catalogue` | No | Part ids on offer: the Lesson 3 tray or the Lesson 4 catalogue (the zoo's animals, the toy shop's toys). Lessons 1 and 2 have none. Default: the lesson's own list (Lesson 3: `solar`, `dome`, `greenhouse`, `docking-arm`; Lesson 4: `telescope`, `dish`, `flag`, `antenna`, `beacon`, `satellite`, `cargo-pod`, `rainbow-ring`, the best one last, at the very bottom). |
| `coreItems` | No | How many goals make the task pass, 1 to the number of `items`. **The first this many goals are required; the rest are bonus** (put the required goals first). Default: all goals. |
| `crates` | No | Lesson 2 only. The crates in the delivery bay, 1 to 5, each `{ id, sticker? }` with `id` from `crate-1` to `crate-5`, in the order shown. Default: `crate-1` to `crate-3`, no stickers. `crate-4` holds `crew-robot-3`; `crate-5` is empty (a good decoy). |
| `note` | No | Lesson 2 only. The delivery note: a list of stickers, each a colour and a shape like `red-star`. Used by `open_crate` with `onlyNoted`. Every note sticker must be on a crate. |
| `mistakes` | No | Lesson 3 only (the station or the zoo; in the zoo it is the keeper putting an animal in the wrong enclosure, see [Worlds](#worlds)). The clumsy robot's drops: 1 to 4 parts already on the station at the start, each `{ part, spot }` (`part` from the tray, `spot` one of the 18 spots that takes it). Needs an `undo_mistakes` goal. Only Ctrl+Z / Cmd+Z removes them, one drop per press, after the child's own changes. They are marked with a red `!`, and a drag of one blinks and changes nothing. They are **never saved as the child's station**: they are left out of what is carried to the next lesson. Do not name a mistake part in a `place_part` goal. |

## Item fields

| Field | Required | Notes |
|---|:---:|---|
| `id` | Yes | Short unique id (`power`, `hull`, …). |
| `goal` | Yes | What the child does (table below). |
| `target` | Depends | What the goal is about: a power section (`left`, `core`, `right`), `hull` or `lights`, a part id or a crate id (an enclosure kind for `sort`). Leave out for "any" (or all three sections for `power_on`). Required for `pick_colour`. |
| `prompt` | No | The instruction shown. Default: a plain sentence made from the goal and target. |
| `order` | No | `power_on`, `open_crate`, `place_part`. A list of at least 2 ids to do in this order (sections, crates or parts). Shown as a numbered card. A wrong next step blinks and changes nothing. Not with `target`. |
| `match` | No | `pick_colour`. The colour that counts, from the hull or light colours. Mission Control's card shows it. Other swatches still recolour but do not count. |
| `card` | No | `order_part`, `place_part`. A part id shown as a picture ("find the one in the picture"); the part on the card is the target, so do not also set `target`. |
| `onlyNoted` | No | `open_crate`. `true`: done when every crate the `note` lists is open and no other is. Opening a decoy blinks and it stays shut. |
| `count` | No | `place_part` (lesson 3, needs a `target`), `open_crate`, `undo`. Done at exactly this many (2 or more). |
| `pattern` | `light_pattern` | `{ left: on, core: off, right: on }`: which power sections must be on. Every section needs `on` or `off` (`true` / `false` also work) and at least one must be on. |

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
| `light_pattern` | 1 | none (uses `pattern`) | the three power buttons match the pattern card, after a press | `click` or `keyboard` |
| `undo_mistakes` | 3 | none (uses the task's `mistakes`) | every preset mistake has been taken back | `ctrl_z` or `cmd_z` only |
| `sort` | 3 (zoo only) | an enclosure kind (`ice`, `grass`, `jungle`, `water`), or none = every animal | every animal in the tray (or of that kind) is in an enclosure that takes its kind | `drag` or `pick_drop` |

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
| Several of a kind (Lesson 1) | two `power_on` goals with an `order` (a second start-up card in a new order); two `pick_colour` goals with `match` on the same target (a second Mission Control colour) | One card at a time. A goal in a series counts only once every goal before it in the list is done; a later card waits (no frame on its next step). When a power goal finishes with another still to come, **all sections switch off** so it can be done from the start. Two `match` goals for the same target must be different colours. |
| Light pattern (Lesson 1) | `light_pattern` with `pattern: { left: on, core: off, right: on }` | A card with three power buttons, each On or Off. Power buttons **toggle** in Lesson 1 (click again = off); the goal is done when they match. It joins the same series as the start-up cards, so put it after them and the station starts dark. |
| Undo the robot's drops (Lesson 3) | task `mistakes: [{ part: greenhouse, spot: top-module-2 }]` and an `undo_mistakes` goal | The scene starts with those parts placed and marked. A card says how many are left to put back. Each Ctrl+Z (Cmd+Z) removes one; done when all are gone. |
| Their own choice | the plain goals (`pick_colour` with no `match`, `place_part` with no `target`) | The usual goal line. |

Stickers are a colour and a shape joined with a dash: colours `red`, `blue`, `green`, `yellow`,
`purple`, `orange`; shapes `star`, `circle`, `triangle`, `square`, `heart` (for example
`red-star`). They are drawn in code, so no image files are needed.

Notes:

- A Lesson 1 round can be four jobs: the start-up card, a second start-up card in a new order, a
  Mission Control colour and a light pattern.
- On Lesson 3 and Lesson 4 the **Parts tray sits directly under the station picture** (so a child
  never has to scroll to find it); the Lesson 4 catalogue stays in the side column, because scrolling
  it is the skill being taught.
- An ordered goal only refuses while it is not done. Things not in its `order` are never refused.
  `open_crate` with `onlyNoted` refuses a decoy even after the goal is done.
- `count` on `place_part` copes with the same part more than once: drag from the tray each time;
  dragging a placed copy moves it. Only Lesson 3 (the 2x2 `solar` has four spots).
- **Sorting** ("fuel to the tank, plants to the greenhouse") is a zoo job (the `sort` goal, see
  [Worlds](#worlds)); the station's own spots accept by part kind, not by a custom group.

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
    coreItems: 4
    items:
      - id: order
        goal: power_on
        order: [left, core, right]
        prompt: Switch on the sections in the order on the start-up card.
      - id: order2
        goal: power_on
        order: [right, core, left]
        prompt: The station went dark! Switch it on again in the new order.
      - id: match
        goal: pick_colour
        target: hull
        match: red
        prompt: Mission Control shows a colour. Click the hull colour that matches it.
      - id: pattern
        goal: light_pattern
        pattern: { left: on, core: off, right: on }
        prompt: Make the lights look like the pattern card. Click a button again to switch it off.
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
    description: The clumsy robot dropped a part in the wrong place! Put it back with Ctrl+Z, then follow the plan card.
    lesson: 3
    coreItems: 3
    mistakes:
      - part: docking-arm
        spot: end-right
    items:
      - id: robot
        goal: undo_mistakes
        prompt: The clumsy robot dropped a part. Press Ctrl+Z (Cmd+Z on a Mac) to put them back.
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

## Worlds

A task builds in one **world**. Each world is a place with its own spots and parts (Lesson Gen's
art, in `public/station/<world>/`). Write `world: zoo` or `world: toyshop` on the task; leave it out
for the space station. A task with no `world` is always a station task, even in lesson 3 or 4.

| World | Lesson | What the child builds | Goals that work there |
|---|---|---|---|
| `station` | 1 to 4 | the space station (everything above) | all except `sort` |
| `zoo` | 3 (drag) | a zoo with four enclosures; animals dragged from a tray | `place_part`, `select`, `undo`, `undo_mistakes`, `sort` |
| `toyshop` | 4 (scroll) | a toy shop window; toys ordered from a long catalogue, then dragged into the window | `order_part`, `place_part`, `select`, `undo` |

The build jobs that make sense carry over: `order`, `card` and `count` on `place_part`, `card` on
`order_part`, `undo` with `count`, `mistakes` with `undo_mistakes` (zoo), and `coreItems`. The jobs
about power, colours, crates, stickers and the delivery note are station only. Naming a goal, target,
card, order id or catalogue part that is not in the task's world is an error (`Task 1 item 2: goal
"power_on" isn't in the zoo world.`).

### The zoo

Four enclosures, each with its own kind, and twelve spots. Every spot sits inside one enclosure and
takes only that enclosure's animals, so the animal must go in the right place.

| Enclosure (`sort` target) | Animals | Spots |
|---|---|---|
| Ice and pool (`ice`) | `ice-penguin`, `ice-polar-bear` (2x2) | `ice-1` (2x2), `ice-2`, `ice-3` |
| Grassland (`grass`) | `grass-lion`, `grass-zebra`, `grass-giraffe` (2x2) | `grass-1` (2x2), `grass-2`, `grass-3` |
| Jungle (`jungle`) | `jungle-monkey`, `jungle-parrot` | `jungle-1`, `jungle-2`, `jungle-3` |
| Pond (`water`) | `water-duck`, `water-hippo` (2x2) | `water-1` (2x2), `water-2`, `water-3` |

- While a child holds an animal its own enclosure glows, so they can see where it belongs.
- Dropping an animal in the wrong enclosure does not snap: the enclosure blinks red, the animal goes
  back to where it came from and the hint says it does not live there. The tutor's card counts the
  wrong drops ("2 wrong homes").
- **`sort`**: done when every animal in the tray is in an enclosure that takes its kind. `target:
  water` limits it to the pond's animals. `catalogue` picks the animals in the tray (default all
  nine), so `catalogue: [ice-penguin, water-duck]` is a two-animal sort.
- **`mistakes`** in the zoo is the clumsy keeper: `{ part: grass-lion, spot: ice-2 }` puts the lion
  in the ice enclosure at the start. The spot must fit the animal but be in a different enclosure.
  `undo_mistakes` takes them back with Ctrl+Z, as in the station. They are not saved.

### The toy shop

A shop window with a shelf of six small spots and a floor of two 2x2 spots and two small ones. The
catalogue lists the toys in a fixed order and the best one, `toy-rainbow-castle`, is last, at the very
bottom, so the child has to scroll to find it: `toy-teddy-bear`, `toy-robot`, `toy-kite`, `toy-yo-yo`,
`toy-car`, `toy-spinning-top`, `toy-rocket` (2x2), `toy-rainbow-castle` (2x2). Toys fit any free spot
big enough (the 2x2 toys only the two floor spots in the middle). It works like Lesson 4: `order_part`
then `place_part`, with `card` for "find the one in the picture".

### One saved scene per world

Each world's build is saved separately: a child's station, zoo and toy shop all come back, and the
Grand Opening can show them all. What is carried is `{ v: 2, worlds: { station: ..., zoo: ... } }` (an
older save is the station's), kept in the same `station` slot. A task only loads its own world's
scene; the other worlds' scenes ride along so they are never lost.

### Example lesson with all three worlds

```yaml
id: station-three-worlds
type: python
title: Station, zoo and toy shop
description: One task in each world, the station, the zoo and the toy shop.
tasks:
  - title: "Lesson 2: Special Delivery (station)"
    type: station
    description: Crates have arrived. A double-click opens one.
    lesson: 2
    items:
      - id: open
        goal: open_crate
        prompt: Double-click a crate to open it.
      - id: captain
        goal: choose_captain
  - title: "Lesson 3: Zoo Day (zoo)"
    type: station
    world: zoo
    description: The keeper put the lion in the wrong enclosure. Put it back with Ctrl+Z, then drag each animal home.
    coreItems: 2
    mistakes:
      - part: grass-lion
        spot: ice-2
    items:
      - id: keeper
        goal: undo_mistakes
        prompt: The clumsy keeper put the lion in the wrong place. Press Ctrl+Z (Cmd+Z on a Mac) to put it back.
      - id: sort
        goal: sort
        prompt: Drag each animal into the enclosure where it lives. The right home glows while you drag.
      - id: giraffe
        goal: place_part
        target: grass-giraffe
        prompt: Bonus - find the giraffe a spot in the grassland.
  - title: "Lesson 3: Zoo Day, water animals (zoo)"
    type: station
    world: zoo
    lesson: 3
    description: Only the pond animals today.
    catalogue: [water-duck, water-hippo, ice-penguin]
    items:
      - id: ponds
        goal: sort
        target: water
        prompt: Take the pond animals home.
      - id: order
        goal: place_part
        order: [ice-penguin, water-duck]
        prompt: Follow the plan card, penguin first, then the duck.
  - title: "Lesson 4: The Toy Shop (toyshop)"
    type: station
    world: toyshop
    description: Scroll the catalogue. The best toy is at the very bottom!
    coreItems: 2
    items:
      - id: find
        goal: order_part
        card: toy-rainbow-castle
        prompt: The shopkeeper is holding up a toy. Find it in the catalogue and order it.
      - id: place
        goal: place_part
        card: toy-rainbow-castle
        prompt: Put the toy from the picture in the shop window.
      - id: kite
        goal: order_part
        target: toy-kite
        prompt: Bonus - order the kite too.
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
