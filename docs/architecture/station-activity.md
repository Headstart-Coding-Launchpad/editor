# Station activity (Phase 1: Mouse and Keyboard Lessons 1–4)

Request: [`2026-10-22-station-activity-…`](../authoring/authoring-requests/2026-10-22-station-activity-one-saved-space-station-each-child-builds-w.md)
(platform #95, Hub #101, approved by Ryan 2026-10-23). Course design: Lesson Gen's
`Mouse and Keyboard Skills.md` §5 and §5a. Activity contract: [activities.md](activities.md).

Each child has **one space station** that comes back every week. Each lesson teaches one mouse
or keyboard skill and the child uses it, the way it really works on a computer, to add a part
they can see. Phase 1 covers:

| Lesson | Skill | What happens on the station |
|---|---|---|
| 1 Power Up | click presses / chooses | The station is dark. Click power buttons to light each section; click a swatch for the hull and light colours. |
| 2 Special Delivery | double-click opens, one click selects | Crates arrive. One click selects a crate (outline); a double-click opens it and the crew inside walk to their posts. Click a crew member to make them captain. |
| 3 Build It | drag moves; Ctrl+Z undoes | Drag modules from a tray onto empty spots; they snap in. Ctrl+Z (Cmd+Z on a Mac) puts the last change back. |
| 4 The Catalogue | scroll moves through a long list | Scroll a long catalogue, click to order this week's parts (the best one is at the very bottom), then drag each into place. |

Phases 2–4 (right-click menu, hover tags, text on parts, copy/paste, PNG and share link) are
not built yet. The model leaves room for them (parts carry a `state` object; goals are a list).

## Model (pure, `src/activities/station/station.js`)

### The station layout (in code, not authored)

- **Sections** (Lesson 1 power): `core`, `left`, `right`, `dock`. Each has a power button.
- **Spots**: `spot-1` … `spot-10`, centres as 0–1 fractions of the 2:1 station drawing (hull strips at
  the far left and right, two pads on each side of both wings), each with `accepts` (part kinds).
  Empty spots always show as dashed docking pads from Lesson 3 and light up while a part is held.
- **Posts**: `post-1` … `post-4`, where crew stand once a crate is opened.
- **Swatches**: 8 hull colours and 8 light colours (named, e.g. `blue`, `orange`).

### The parts catalogue (in code)

`PARTS`: `{ id, label, kind: 'module' | 'crate' | 'crew', lesson, cells: [w, h], art }`.
Phase 1: crates `crate-1`–`crate-3` (each holds one crew member: `crew-robot`, `crew-pilot`,
`crew-plant`; the pilot is a helmet with a dark visor, no face); modules `solar`, `dome`, `greenhouse`,
`docking-arm` (Lesson 3 tray); catalogue parts `telescope`, `dish`, `flag` and extras
`antenna`, `lab`, `rocket-pad`, ending with `space-slide` (the best part, at the very bottom).
`art` is a placeholder (emoji + CSS shape) until Lesson Gen's art set lands (#109: PNG per
state, 128 px cells, a white glow PNG per part tinted in code). Swapping art changes only
`art.js`.

### Task fields

| Field | Required | Meaning |
|---|---|---|
| `lesson` | yes | 1–4 in Phase 1. Sets the starting scene: everything from earlier lessons is already there in a default place (catch-up), and this lesson's setup is added (dark station / crates / tray / catalogue). |
| `items` | yes | This week's goals, done in any order: `{ id, goal, target?, prompt? }`. |
| `catalogue` | no | Part ids on offer: the Lesson 3 tray or the Lesson 4 catalogue. Defaults to the lesson's own list. |
| `coreItems` | no | How many goals make the task pass (default all). The rest are bonus. |

Goals (`goal`) and the method each one needs:

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

### State (`v: 1`, small)

```js
{
  v: 1,
  scene: {
    hull: 'blue', lights: 'orange',
    power: { core: true, left: false, … },
    placed: { 'spot-3': 'solar', … },        // spot id → part id
    crates: { 'crate-1': 'open', … },         // closed | open
    crew: { 'crew-robot': 'post-1', … },      // crew id → post id
    captain: 'crew-robot' | null,
    ordered: ['telescope'],                    // ordered, not yet placed
  },
  done: { [itemId]: { method, at, scrolled? } },
  selected: 'crate-1' | null,
  undo: [ /* up to 15 earlier scenes, device only */ ],
  device: { touch },
}
```

`serializeShared` keeps only the last `undo` step (the rest is device only), so the tutor's Undo last change has one step to put back. `classifyChange`: every station change is a
discrete step (a click, a drop); pointer moves during a drag are UI state, not activity state.

### Helpers

`initialState(task)` = `{ scene: sceneForLesson(task.lesson), … }`.
`sceneForLesson(n)`: the default scene after lessons `1…n-1` (all power on, default colours;
crates open with crew at posts and the first crew captain; Lesson 3 modules on default spots;
Lesson 4 parts on default spots) plus lesson `n`'s setup.
`applyCarried(task, carried)`: the saved scene wins; anything unlocked by earlier lessons that
it lacks is added in a default place (catch-up after a missed lesson); this lesson's setup is
added if it isn't there yet. Pure and idempotent.
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
  pass message when the core goals are done; they can keep building after.
- Reduced motion: crew walk and power-up glow become instant.

## Tutor visibility

- **Card:** a mini-station (`CardSummary`) and "3/5 goals".
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
