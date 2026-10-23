# Station activity (Phase 1: Mouse and Keyboard Lessons 1–4)

Request: [`2026-10-22-station-activity-…`](../authoring/authoring-requests/2026-10-22-station-activity-one-saved-space-station-each-child-builds-w.md)
(platform #95, Hub #101, approved by Ryan 2026-10-23). Course design: Lesson Gen's
`Mouse and Keyboard Skills.md` §5 and §5a. Activity contract: [activities.md](activities.md).

Each child has **one space station** that comes back every week. Each lesson teaches one mouse
or keyboard skill and the child uses it, the way it really works on a computer, to add a part
they can see. Phase 1 covers:

| Lesson | Skill | What happens on the station |
|---|---|---|
| 1 Power Up | click presses / chooses | The station is dark. Click the three power buttons to light each section; click a swatch for the hull and light colours (swatches are Lesson 1 only). |
| 2 Special Delivery | double-click opens, one click selects | Crates arrive. One click selects a crate (outline); a double-click opens it and the crew inside walk to their posts. Click a crew member to make them captain. |
| 3 Build It | drag moves; Ctrl+Z undoes | Drag modules from a tray onto empty spots; they snap in. Ctrl+Z (Cmd+Z on a Mac) puts the last change back. |
| 4 The Catalogue | scroll moves through a long list | Scroll a long catalogue, click to order this week's parts (the best one is at the very bottom), then drag each into place. |

Phases 2–4 (right-click menu, hover tags, text on parts, copy/paste, PNG and share link) are
not built yet. The model leaves room for them (parts carry a `state` object; goals are a list).

## Model (pure, `src/activities/station/station.js`)

### The station layout (in code, not authored)

The scene is Lesson Gen's Phase 1 art (#109), a 1600 x 1000 picture (1.6:1) in `public/station/phase-1/`
(`parts.json` and the PNGs; 128 px cells, one PNG per state, a white `-glow.png` mask per part).
`station.js` holds the layout (copied from `parts.json`); `art.js` holds every art path.

- **Sections** (Lesson 1 power): `left` (`power-1`), `core` (`power-2`), `right` (`power-3`). Each has a power button.
- **Spots**: 18 as 0-1 fractions of the picture, each with `cells`, `accepts` (`module`, `part`, `crew`
  or `power`) and optional `flipY` + `onlyCanHang` (hangs under the hull: only parts with `canHang`,
  drawn upside down), `flipX` (the left docking arm is mirrored) and `behindHull` (crew show
  through the portholes). Module spots `top-module-1/2`, `bottom-module-1/2` (2x2), end spots
  `end-left/right` (2x1), part spots `top-part-1/2`, `bottom-part-1/2`, `ring-top` (1x1), crew spots
  `crew-1`...`crew-4`. `spotTakes(spot, part)` is the rule: kind accepted, part cells fit inside the
  spot's cells, and a hanging spot needs `canHang`. Empty spots show as dashed pads from Lesson 3
  and the fitting ones light up while a part is held.
- **Posts**: the four crew spots, where crew stand once a crate is opened.
- **Swatches**: 8 hull colours and 8 light colours (named, e.g. `blue`, `orange`). Shown in Lesson 1 only.

Draw order: backdrop, interior (dark, lit fades in over it as sections are powered: 0, 1/3, 2/3, all),
crew (behind the hull), hull (dark under lit), the hull colour (a flat colour through `hull-glow.png`,
multiplied), the power buttons, then parts, pads and the captain badge. The lights colour is the
glow around lit buttons and the hull.

### The parts catalogue (in code)

`PARTS`: `{ id, label, kind: 'module' | 'part' | 'crate' | 'crew', lesson, cells: [w, h], canHang }`.
Phase 1: crates `crate-1`-`crate-3` (each holds one crew member: `crew-robot-1`, `crew-robot-2`,
`crew-plant`; `crew-robot-3` is in the art and the catalogue but has no crate yet); modules `solar`,
`dome`, `greenhouse`, `docking-arm` (Lesson 3 tray); Lesson 4 catalogue `telescope`, `dish`, `flag`,
`antenna`, `beacon`, `satellite`, `cargo-pod` and, last (the prize at the very bottom), the module
`rainbow-ring`. The art's `module-fuel-tank` (1x2) is not used: no spot is free for it in Lesson 4.

### Task fields

| Field | Required | Meaning |
|---|---|---|
| `lesson` | yes | 1–4 in Phase 1. Sets the starting scene: everything from earlier lessons is already there in a default place (catch-up), and this lesson's setup is added (dark station / crates / tray / catalogue). |
| `items` | yes | This week's goals, done in any order: `{ id, goal, target?, prompt? }`. |
| `catalogue` | no | Part ids on offer: the Lesson 3 tray or the Lesson 4 catalogue. Defaults to the lesson's own list. |
| `coreItems` | no | How many goals make the task pass (default all). The FIRST this many goals are the round (station-only rule: not any N); the rest are bonus. |
| `crates` | no | Lesson 2: the crates in the bay (1-5 of `crate-1`..`crate-5`) as `{ id, sticker? }`. Default the first three, no stickers. |
| `note` | no | Lesson 2: the delivery note, a list of stickers (`<colour>-<shape>`). |

Goal items also take the build-job fields below. Goals (`goal`) and the method each one needs:

| Goal | Target | Done when | Method recorded / required |
|---|---|---|---|
| `power_on` | a section id, or none = all four | that section (or all) is lit | `click` (Enter/Space on the focused button records `keyboard` and also counts) |
| `pick_colour` | `hull` or `lights` | a swatch is chosen | `click` / `keyboard` |
| `select` | a part id, or none = any | a part is selected by a single click | `click` |
| `open_crate` | a crate id, or none = any | a crate is opened | **`double_click` only.** Enter opens it too (keyboard access) but the goal stays open with the hint "Now try a double-click". |
| `choose_captain` | none | a crew member is made captain | `click` |
| `place_part` | a part id, or none = any | the part sits on a spot | `drag` or `pick_drop` (click to pick up, click to drop: the trackpad fallback). Both count; the method is recorded. |
| `undo` | none | a change is undone | `ctrl_z` / `cmd_z` only (the tutor's undo never counts) |
| `order_part` | a part id, or none = any | the part is ordered from the catalogue | `click`; `scrolled: true` is recorded when the catalogue was scrolled first |

### Build jobs (Hub #101, Lesson Gen LG-P8 "Build jobs")

Optional goal fields that make each lesson a few short jobs. All of it is pure model
(`station.js`); `ui.jsx` only draws the cards and blinks.

- **First-N core.** `gradeStationTask` counts `coreDone` over the first `core` goals only and
  `done = coreDone >= core`; `counted` (core done so far, then core + bonus done) feeds the progress
  text, the card and the summary, and `flags` (one boolean per goal) feeds `RoundProgress`'s optional
  `flags` prop. Other activities still count any N (`coreCountOf` is unchanged).
- **`blockedBy(task, state, action)`** returns the goal that refuses an action, and
  `stationAction` then returns the state unchanged (no undo entry, no mark). Refusals: an ordered
  goal (`order`) not done yet refuses a step that is not `nextInOrder`; an `open_crate` goal with
  `onlyNoted` refuses a crate whose sticker is not on the `note`, even once done. The UI calls the
  same function to blink the goal's card and the thing pressed (`data-blink` 0/1 alternate so a
  repeat restarts the animation; reduced motion swaps the shake for an outline flash).
- **`match`** (`pick_colour`) and **`card`** (`order_part`, `place_part`; `goalPart(item)` is
  `card || target`) only change `completes()`. Hints say "look at the card" and never the answer.
- **Crates and stickers.** `CRATE_IDS` is five ids; `crateIdsFor(task)` is the task's bay
  (default three). `crate-4` holds `crew-robot-3`, `crate-5` is empty. `stickerOf(task, crate)` and
  `isNoted` read the task, so the saved scene is unchanged. Stickers are `<colour>-<shape>`
  (`STICKERS`), drawn as SVG paths from `art.js` `STICKER_PATHS`. A carried scene whose crates come
  from a bigger bay opens exactly the crates it has (catch-up).
- **`count`.** `multiParts(task)` is the set of parts a `place_part` goal counts more than once:
  the tray never runs out of them (`trayParts`), a `place` without `from` adds a copy, with `from`
  moves one, and saved scenes keep duplicates only for those parts. `open_crate` counts the open
  crates. `undo` counts `state.undos`, which only a ctrl_z / cmd_z press that really undoes
  increments (the tutor's undo does not).
- **Not built:** the "sort into the right place" job. Spots accept by part kind, so there is no
  group to sort into without new art.
- The Builder editor does not expose the build-job fields; they are YAML-only (it says so under
  the goals list), though its crate target choices follow `crates`.

### State (`v: 1`, small)

```js
{
  v: 1,
  scene: {
    hull: 'blue', lights: 'orange',
    power: { core: true, left: false, … },
    placed: { 'top-module-1': 'solar', … }, // spot id → part id
    crates: { 'crate-1': 'open', … },         // closed | open
    crew: { 'crew-robot-1': 'crew-1', … }, // crew id → crew spot id
    captain: 'crew-robot-1' | null,
    ordered: ['telescope'],                    // ordered, not yet placed
  },
  done: { [itemId]: { method, at, scrolled? } },
  selected: 'crate-1' | null,
  undo: [ /* up to 15 earlier scenes, device only */ ],
  undos: 0,                                    // Ctrl/Cmd+Z presses that really undid something
  device: { touch },
}
```

`serializeShared` keeps only the last `undo` step (the rest is device only), so the tutor's Undo last change has one step to put back. `classifyChange`: every station change is a
discrete step (a click, a drop); pointer moves during a drag are UI state, not activity state.

### Helpers

`initialState(task)` = `{ scene: sceneForLesson(task.lesson), … }`.
`sceneForLesson(n)`: the default scene after lessons `1…n-1` (all power on, default colours;
crates open with crew at posts and the first crew captain; Lesson 3 modules on default spots
(`dome` top-module-1, `greenhouse` top-module-2, `solar` bottom-module-1, `docking-arm` end-left);
Lesson 4 parts on default spots) plus lesson `n`'s setup.
`applyCarried(task, carried)`: the saved scene wins; anything unlocked by earlier lessons that
it lacks is added in a default place (catch-up after a missed lesson); this lesson's setup is
added if it isn't there yet. Pure and idempotent. Saved ids the station no longer has (an older
spot, post or part id, or a part that no longer fits its spot) are dropped, then caught up.
`stationAction(state, action, task)` → next state: `{ type: 'power' | 'colour' | 'select' |
'open' | 'captain' | 'place' | 'order' | 'undo', …, method }`, pushing the previous scene onto
`undo` for undoable actions and marking any goal it completes.

## Carry between lessons (host change)

Today activities are device-only. The station is the first activity carried between lessons.
It reuses the tutor-mediated roster route of typing history and `carryCodeFromLesson`
(students never read or write Firestore):

- **Activity contract:** an optional `carrySlot: { id: 'station', extract(state), apply(task,
  carried) }` on `defineActivity`. `extract` keeps the scene only.
- **Save (tutor's TeacherView):** for a matched student on a task whose activity has a
  `carrySlot`, the roster work saver saves `extract(state)` from their `currentAnswer` to
  `classes/{classId}/roster/{rosterId}/work/slot__station` (debounced as today). One slot per
  student, whichever lesson it came from: the latest station wins.
- **Load (tutor's TeacherView):** when a student is matched and on (or reaches) a slot task,
  the tutor reads `slot__station` and writes it to the student's carry inbox
  `carryInbox/{lessonId}/{anonymousId}/{taskId}` with kind `activity_slot`, plus the carry
  status (`found` | `none`), as cross-lesson carry does.
- **Student:** a live student on a slot task with no station state of their own yet waits on
  the status ("Fetching your station…", with the tutor's existing "Use the starter"). `found`
  → `apply(task, carried)`; `none` / `starter` → `initialState(task)`. Solo, presentation,
  Builder preview and "No class" sessions never wait: they start from `initialState(task)`
  (the catch-up scene). No localStorage scan across lessons (shared-device risk).

## Interaction (UI, `src/activities/station/ui.jsx`)

- The station fills the task area (`ownsLayout`). Targets ≥ 44 px. Touch is blocked
  (`touchFallback: 'block'`, "This needs a mouse or trackpad").
- **Click** a power button or swatch. **Click** a part to select it (outline); click empty space
  to clear.
- **Double-click** uses the browser's own `dblclick` event (the student's own speed). A single
  click never opens.
- **Drag** from the tray or catalogue with Pointer Events and pointer capture; on drop, snap to
  the nearest empty spot that accepts the part within reach, otherwise it goes back to the tray.
  **Click-to-pick-up, click-to-drop** works too (trackpad lifts never drop a part in the wrong
  place: a lifted pointer with no spot under it puts the part back).
- **Ctrl+Z / Cmd+Z** while the station has focus undoes the last change.
- **Catalogue**: a tall scrolling list (Lesson 4); click "Order" on a part to put it in the tray.
- Goals list beside the station with ticks as they're done (the round progress helpers), and a
  pass message when the first `coreItems` goals are done; they can keep building after. A goal
  with a build-job field has a target card under its line (order steps, the colour, the stickers on
  the note, the part picture, or "Exactly n" with a counter); one click on a crate shows its
  sticker large; a refused step blinks.
- **Station upgraded!** When the core goals complete, the scene plays a short moment: lights sweep
  across the hull and the newest thing built (a placed part, the captain, an opened crate's crew)
  pops with a glow and sparkles. It plays on the change, not when a finished station is opened.
  Reduced motion: no movement; a still glow on the newest part and a tinted hull.
- Targets are at least 44 px: the scene has a 560 px minimum width (it scrolls sideways when the
  area is narrower), where a 1x1 spot is 44.8 px. Each goal line has a ~32 px picture of the part,
  crate or badge it is about.
- Reduced motion: crew walk and power-up fade become instant.

## Tutor visibility

- **Card:** a mini-station (`CardSummary`) and "3/5 goals" (the first `coreItems` goals).
- **Modal:** the full station read-only, live, with each goal's method ("opened by
  double-click").
- **Help:** the tutor's **Undo last change** (Lessons 1–2 have no Ctrl+Z yet) and the usual
  Edit answers / Start again / Complete.
- **Reports:** item progress with methods.

## Build order

1. Model, definition, validation, docs page (`station.js`, `definition.js`).
2. Carry slot (host) in parallel with 1, against the contract above.
3. UI and tutor views.
4. Browser click-through, then a real Mac and Chromebook with Ryan.
