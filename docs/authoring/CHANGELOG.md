# Lesson Authoring Changelog

Author-facing changes that affect how lessons, tasks, topics, checks, assets, or lesson Markdown should be written.

Use this changelog when a platform or documentation change alters the lesson authoring contract. Keep entries newest first and link to the deeper reference doc when the change needs examples or field-level detail.

## What belongs here

- New, renamed, deprecated, or removed lesson YAML/JSON fields.
- New or changed task types, module types, quiz types, checks, feedback checks, or Markdown syntax.
- CLI validation, conversion, publishing, topic, or asset workflow changes that affect authors.
- Builder behavior changes that alter what lesson authors can save, validate, publish, or migrate.
- Compatibility notes for older lessons when authors need to update source files.

## What does not belong here

- Internal refactors with no author-facing lesson behavior change.
- UI polish that does not affect saved lesson fields or authoring workflow.
- Test-only, tooling-only, or deployment-only changes that authors do not need to know about.

## 2026-09-13

### Check comparisons now behave the same in every module

Text operators (`contains`, `not_contains`, `equals`, `not_equals`, `matches_regex`,
`not_matches_regex`) now share one implementation across output, quiz answers, file content,
HTML element checks and Scratch block inputs. Existing checks can change verdict in these cases:

- **`not_contains` with an option list** (`"a","b"`) now passes only when none of the options
  appear. It used to search for the literal quoted text, so it almost always passed. This affects
  output, answer and HTML element, attribute and style checks.
- **An invalid regex** now fails `not_matches_regex` too, instead of passing for every student.
- **Filesystem `fs_file_content` `equals` / `not_equals`** now support `*` wildcards.
- **Scratch `fieldValues`** on `block_used`, `block_run` and `blocks_in_order`:
  - `equals` and `contains` ignore case and surrounding spaces.
  - `contains` supports `*` and option lists.
  - Numbers compare numerically (`10` equals `10.0`).
  - Regex honours `flags`.

Review Scratch checks that relied on case-sensitive field matching, and any `not_contains` check
written with an option list.

### Scratch graphic effects draw on the stage

`set/change [effect] effect` blocks used to update sprite state without changing how the sprite
looked. All seven effects now render. `fisheye` and `whirl` are skipped for costume images hosted
on another site. `motion_setrotationstyle` is now in the default toolbox (it was already in the
catalog and runtime). See `docs/authoring/scratch.md`.

### CLI reads and writes lessons the same way as the Builder

- `lessons get`, `lessons upsert`, `lessons publish-yaml`, `lessons fork` and the
  `tasks` commands now decode and encode
  Scratch block trees and Arcade designs at the Firestore boundary, like the
  web app. Long Scratch scripts and Arcade sprite art can now be published from
  the CLI (Firestore rejected them before), and `lessons get` returns blocks as
  objects rather than JSON strings for lessons saved in the Builder.
- Scratch `starterBlocks`, `completeBlocks` and stage `blocks` can now be written as plain
  objects in lesson files. JSON strings still work and are not encoded twice.
- `lessons delete` also removes the lesson's session reports and feedback, like
  deleting from Admin. The result includes a `cleared` count.
- The Builder now rejects an unknown lesson `type`, as the CLI already did.
- The broken `scripts/yaml-to-json.mjs` script is removed. Use
  `node cli/cli.mjs lessons yaml-to-json` instead.

### Turtle lessons now validate and publish correctly

- The CLI accepts `type: turtle` and `moduleType: turtle`; it previously
  rejected every Turtle lesson.
- The Builder no longer rejects `turtle_position`, `turtle_path_closed`,
  `turtle_command_used` or `turtle_color_used` with "no check value". Both the
  Builder and CLI now check each Turtle check's own fields (`x`/`y`, `value`,
  `command`, `color`) and reject unknown Turtle check types.
- `turtle_command_used` with `command: backward` now passes when students call
  `backward()`/`bk()`/`back()`. Before, it could never pass. A backward move
  still also counts as a `forward` call.
- Python, Arcade and Turtle tasks whose starter lives only in `codeStages` no
  longer get a false "no starter code" warning.

See `docs/authoring/turtle.md`.

## 2026-09-12

### Scratch check fixes that change existing verdicts (backfilled)

These fixes shipped earlier without a changelog entry. Lessons authored while the bugs existed may
need their checks reviewed.

- **2026-09-11: `fieldValues` now match dropdown fields.** `block_used` and `blocks_in_order`
  `fieldValues` only read number/text inputs, so a condition on a dropdown (e.g. `motion_goto`
  `TO`, `looks_switchcostumeto` `COSTUME`) could never pass. It now reads the block's own field
  first.
- **2026-09-09: `blocks_in_order` waits for the student.** Starter stacks that connect the
  surrounding blocks directly (the usual "insert a block between these two" task) were reported as
  failed before the student did anything. A gap now counts as pending until the wrong block is
  actually placed.
- **2026-09-07: `sprite_property_delta` and `sprite_property_changed` work.** The "before run"
  sprite snapshot was aliased to live state, so the delta was always 0 and "changed" was always
  false for every task using these checks. If a lesson avoided these check types because they never
  passed, they are safe to use now.


### New Turtle module task type

Added `moduleType: turtle` — a single-file Python task type for turtle
graphics, running a hand-built shim of the real `turtle` module (`import
turtle` works as written) inside the shared Pyodide worker, drawing onto a
responsive canvas with a fixed logical coordinate space matching real
turtle's centre-origin, y-up convention. Supports the core movement/pen
command set (forward/backward/left/right/penup/pendown/pencolor/goto/
setheading/home/reset), plus circle, begin_fill/end_fill/fillcolor/color,
stamp, write, bgcolor, and colormode. New check types: `turtle_position`,
`turtle_heading`, `turtle_path_closed`, `turtle_segment_count`,
`turtle_path_length`, `turtle_command_used`, `turtle_color_used` (takes an
optional `kind: "pen" | "fill"`), and `turtle_stamp_count`. The student's
drawing now also syncs live to the teacher — both when watching an
individual student and when "Go Live" broadcasts a turtle task to the whole
class — via the same channels that already sync live code. Multiple
`Turtle()` instances, per-task canvas size, and a reference-image comparison
feature are not implemented. See `docs/authoring/turtle.md`.

### New `companionOf` lesson field links a solo challenge to its parent lesson

A `soloOnly` "solo challenge" lesson can now set `companionOf: "<parent-lesson-id>"` to link it to the lesson it extends. The Admin lesson list groups a solo lesson under its linked parent (collapsible, same pattern as class forks), and students who finish the parent lesson — live or solo — are offered a "Try the Solo Challenge" button that drops them straight into the companion in solo mode. The field is set only on the solo lesson; the parent lesson document is unchanged. Set it via the Builder's new "Solo challenge companion of" text field in `LessonMetaPanel.jsx`, or the CLI. See "Solo Companion Metadata" in `docs/authoring/lesson-schema.md`.

## 2026-09-11

### New `allowRemoveSprite` / `allowRemoveStarterSprites` Scratch task fields

Scratch tasks can now opt in to letting students remove sprites from their workspace with `allowRemoveSprite: true`. By default this only allows removing sprites the student added themselves via the existing "Add sprite" picker (`studentAdded: true`) — author-placed starter sprites stay protected. Set `allowRemoveStarterSprites: true` alongside it to also allow removing author-placed sprites; a workspace can never be emptied to zero sprites, and removal asks the student to confirm first. The Scratch Playground sets both flags so every sprite there is removable. See `docs/authoring/scratch.md`.

## 2026-09-05

### New `allowSharing` task field for student workspace sharing

Tasks can now opt in to student workspace sharing with `allowSharing: true`. When set, students working on that task get a **Share with class** button; the teacher is notified, previews the exact snapshot, and approves or declines it. Approved workspaces go into a class-wide **Shared work** gallery that persists across task changes until the teacher removes them, and classmates open them as a non-destructive sandbox copy they can run and edit without touching their own work.

The field is off unless explicitly set, so existing lessons are unaffected and need no changes. It is valid on any code task in any lesson type, and rejected by CLI and Builder validation on `quiz` and `information` tasks, which have no workspace to share. Set it on tasks where seeing a classmate's approach helps — open-ended builds, creative tasks, "solve it your own way" problems — and leave it off where you want independent work. See `docs/authoring/lesson-schema.md`.

## 2026-09-04

### Topic library removed from Scratch lessons

The topic library (inline `[[wiki-links]]`, hover cards, and the browse dialog) no longer renders on Scratch lessons at all — `useTopicLibrary` now returns no topics whenever the lesson type is `scratch`, regardless of a topic's `types` field. A topic tagged `["scratch"]` (or left untagged, normally "all types") will never appear on a Scratch lesson; `[[topic-id]]` syntax in a Scratch explainer now renders as plain text instead of a link. This also removes the teacher's "📖" topic-library button from the Student Grid/Student Modal while viewing a Scratch lesson. No change for any other lesson type. Existing Scratch lessons need no changes — any `[[..]]`/`topicLinks` authored there simply stop resolving to links; authors should stop adding them for Scratch going forward. See `docs/authoring/TOPIC_LIBRARY_SCHEMA.md`.

## 2026-09-02

### New optional `recordingUrl` field for per-class recordings

Lessons can now carry an optional `recordingUrl` field: an unlisted YouTube link to that class's recorded live session. It's meant to be set per-class on a class's forked lesson (`lessons fork`), not on the shared source lesson, since each class recorded a different session. When present, solo students see a small pop-out player (bottom-right, pausable/hideable) on the lesson page; it never appears during a live session or teacher presentation. The video must be set to **Unlisted** on YouTube — students are login-less and never authenticate with Google, so a Private video would just show a "request access" screen. Only `youtube.com`/`youtu.be` links validate; Google Drive links do not, because Drive's embed has no JS control API to pause/resume the widget in place. See `docs/authoring/lesson-schema.md`.

### Electronics `locked: true` components are now interactive

A "Fixed" (`locked: true`) component previously had every one of its controls disabled for students, so a fully locked demo board was inert: the switch would not flip, the button would not press, and the potentiometer would not turn. `locked` now freezes only a part's *structure* — position, rotation, `props`, pins, and deletion — while its `controls` state stays live on the canvas and in the inspector. `push_button` (`pressed`), `slide_switch` (`closed`), `potentiometer`/`sensor` (`value`), `transistor` (`baseHigh`), and `servo_motor` (`angle`) all respond on a locked part. This makes the documented pre-wired demo board pattern work as its example already described: `controls: {}` leaves the switch open and the student flips it to light the LED. Existing lessons need no changes — a locked demo board gains its intended interactivity automatically. A read-only workspace (teacher live view, Support/Complete stage preview) remains fully inert. See `docs/authoring/electronics.md`.

### Electronics wire format corrected: `from`/`to` are `componentId.pin` strings

`docs/authoring/electronics.md` previously documented a wire as `from: { component: battery1, pin: positive }`. That shape does not work. The runtime uses `wire.from`/`wire.to` directly as graph keys in `buildGraph` and string-splits them in `pinPoint`, so it accepts only the flat form `from: battery1.positive`. An object-form wire produces no error — `lessons validate` still passes — but connects nothing in the simulation and draws nothing on the board, leaving the parts placed but entirely unwired and every check involving them permanently failing. The doc's only populated wire example carried the wrong shape, so any board authored from it was dead on arrival. Wires are strings; **Checks** endpoint selectors remain `{ type, pin }` objects, which is the likely source of the confusion. Existing lessons with object-form wires need their wires rewritten. No runtime change. See `docs/authoring/electronics.md`.

### Electronics `controls` documented

`docs/authoring/electronics.md` now documents the `controls` map, which was previously undocumented and appeared only as `controls: {}` in examples. It holds live, student-adjustable state keyed by component id, separate from the fixed `props`: `slide_switch` uses `closed`, `push_button` uses `pressed`, `transistor` uses `baseHigh`, and `potentiometer`/`sensor` use `value`. Switches and buttons default to open/at-rest, so a demo board's LED starts dark until the student toggles it. No runtime change. See `docs/authoring/electronics.md`.

### Electronics tasks should write `starterCircuit` even when a starter stage exists

The student workspace reads `codeStages[0].circuit` and falls back to `starterCircuit`, and the lesson validator follows the same fallback — but the Builder's task editor checks `starterCircuit` alone, so a draft electronics task with only a starter stage shows "This draft task has no starter breadboard yet" over an otherwise working task while `lessons validate` reports it clean. `docs/authoring/electronics.md` now says to write both, and adds a complete pre-wired demo-board example showing the whole shape. No runtime change. See `docs/authoring/electronics.md`.

### Electronics pin names documented for every component type

`docs/authoring/electronics.md` now lists the pin names for all 16 electronics component types, not just the seven newer parts. `battery`, `resistor`, `led`, `push_button`, `slide_switch`, `potentiometer`, `motor`, `buzzer`, and `terminal` previously had no documented pins, so authoring a `starterCircuit` meant guessing — and a wire naming a pin that does not exist silently never connects rather than failing validation. Buttons and switches use `a`/`b`, batteries `positive`/`negative`, LEDs `anode`/`cathode`, potentiometers `left`/`wiper`/`right`, and a junction has the single pin `pin`. No runtime change; `COMPONENT_PINS` in `src/modules/electronics/circuit.js` remains the source of truth. See `docs/authoring/electronics.md`.

## 2026-09-01

### New lesson-level `soloOnly` field

Lessons can now set `soloOnly: true` on the envelope to hard-force solo mode always — the live/wait choice screen is never offered to students, regardless of URL (`?solo=true` becomes redundant) or whether a live session exists for the lesson. Authored via the Builder's "Solo-only lesson" checkbox next to "Draft workflow". Default is `false`/absent (unchanged live/solo behaviour). See `docs/authoring/lesson-schema.md` and `docs/authoring/lesson-schema-yaml.md`.

### `code_arrange` lines no longer each require a blank

A `code_arrange` line can now have zero `slot` parts (all `type: "text"`) — useful for fixed context like a variable declaration the student doesn't need to arrange. Validation now only requires at least one blank somewhere across the whole task, not on every individual line. See `docs/authoring/lesson-schema.md`.

## 2026-08-20

### `estimatedMinutes` now accepts decimal values

`estimatedMinutes` previously had to be a positive whole number; it now accepts any positive number, e.g. `estimatedMinutes: 7.5`. The Builder's task editor input steps by 0.5 minutes. See `docs/authoring/lesson-schema.md` and `docs/authoring/lesson-schema-yaml.md`.

## 2026-08-18 (2)

### Added a Paint app to the Desktop module

New `paint` desktop app: a freehand drawing canvas (Brush/Eraser, 8-colour palette + custom
colour, three brush sizes, Undo, Clear) with the same explicit Open/Save/Save As model as Text
Editor. `availableApps` now also accepts `"paint"`. Saved drawings store their image as a
`data:image/png;...` URL directly on the file entry's `content` — Image Viewer and File Manager
now fall back to reading that when there's no authored `src`/asset, so a Paint drawing previews
like any other image with no other authoring change needed. No new check type. See
`docs/authoring/desktop.md`.

## 2026-08-18 (1)

### Added a simulated Browser + search engine to the Desktop module

New `browser` desktop app: a simulated web browser (Back/Forward/Refresh/Home, editable address
bar) over a new task field, `siteGraph` — a lesson-authored, read-only set of fake pages with
content, links, an optional `sponsored` flag, `kind: 'search'` (an inline search box), `kind:
'broken'` (unreachable pages), and `kind: 'download'` (writes into `/Downloads/` via the existing
Filesystem `fs` map). `availableApps` now also accepts `"browser"`.

New check types: `browser_visited` (`visited`/`not_visited`, field `pageId`) and `search_query`
(`contains`/`not_contains`/`equals`, field `text`), backed by two new desktop-state fields —
`browserVisited` (dedup visit log) and `lastSearchQuery` — alongside the existing `fs`/`recycleBin`/
`windows`. Downloads reuse `fs_path`/`fs_file_content`; no new check type was needed for them.

`siteGraph` has no visual Builder editor yet — author it as JSON/YAML on the task, the same gap
`sandboxStarterDesktop` has. See `docs/authoring/desktop.md`.

## 2026-08-17

### Corrected Scratch `evaluation` values and documented `sprite_property_delta`/`sprite_property_changed`

`docs/authoring/scratch.md` previously told authors to write `evaluation: continuous` for block-structure checks (`block_used`, `blocks_in_order`, `block_count`); the runtime only ever recognizes `after_block_placed`, `after_run`, and `manual` — `continuous` silently fell into the after-run bucket, so a check authored exactly as documented would only ever evaluate after Run, never continuously. Use `evaluation: after_block_placed` instead. No published lesson used `continuous`, so no content migration is needed.

Also documented two previously-unlisted check types that were already implemented and available in the Builder: `sprite_property_delta` (change in a property since before Run) and `sprite_property_changed` (property differs from before Run, any amount).

Added a warning to the `block_run` section: a block is marked "executed" the instant it runs, before its field values are inspected, and this app's click-to-run-a-single-block feature means a bare click into a block (e.g. to edit its text) already counts as a run. Omitting `fieldValues` on a `block_run` check for a block with student-editable input can pass on an unedited/default value — set `fieldValues` (e.g. `operator: not_equals, value: ""`) to require the student's own input.

See `docs/authoring/scratch.md#scratch-check-types`.

### Prebuilt Scratch stacks no longer require their blocks to be in the toolbox

A `prebuiltStacks` (or legacy `predefinedBlocks`) entry now appears in the correct toolbox flyout category even when the task's `toolbox` doesn't otherwise include that block type — the platform resolves the root block's category and creates it if missing. This lets a task restrict its toolbox to already-taught blocks while still handing out a scaffolded starter stack built from blocks ahead of the current lesson. The Builder's prebuilt-stack editor no longer restricts which block types an author can add to a stack.

This only applies to categorized toolboxes; a minimal/flat toolbox (blocks listed directly under `<xml>`) is unchanged and still requires the stack's root block type to already be present there.

See `docs/authoring/scratch.md#prebuilt-stack-object`.

## 2026-08-04

### Added the Desktop module type

New `desktop` composed-lesson module type: a windowed desktop shell (icon grid, taskbar, draggable/resizable windows) hosting a File Manager app that wraps the Filesystem module's UI plus a Recycle Bin, search, and sort. New task fields: `starterDesktop`/`completeDesktop` (`{ fs, recycleBin, windows }`, reusing the Filesystem module's flat path-map for `fs`), `carryDesktopFrom`, `availableApps` (defaults to `["fileManager"]`), and stage snapshots use a `desktop` key instead of `fs`. `startsInDir` is reused unchanged from the Filesystem module.

New check types: `fs_recycle_bin` (`is_in`/`not_in`), `window_state` (`opened`/`closed`/`minimized`/`maximized`), and `windows_arranged_side_by_side` (a tolerant two-window geometry check). All existing `fs_*` check types work unchanged against a Desktop task's `fs`.

This first release ships File Manager only — Text Editor, Image Viewer, Paint, and a simulated Browser/search engine are planned for later releases. The support-stage reveal ladder is not available for Desktop tasks yet, matching the Filesystem module. See `docs/authoring/desktop.md`.

### Added Text Editor and Image Viewer apps to the Desktop module

Two new Desktop-module apps: **Text Editor** (plain text, no rich formatting yet) and **Image Viewer** (read-only, zoom + next/prev). Opening a file in File Manager now launches the matching app as its own window instead of showing an inline preview, regardless of `availableApps` — `availableApps` (now `fileManager`/`textEditor`/`imageViewer`, with a Builder checkbox picker) only controls which app icons appear on the desktop for standalone launch.

Text Editor is the platform's first explicit-save UI — content lives in a window's local `draftContent` until Save/Save As/Ctrl+S commits it, unlike every other module type's continuous autosave. A window with unsaved changes shows a `•` in its title and asks for confirmation before closing. Window objects gained two optional fields: `filePath` and `draftContent`; several Text Editor windows can now be open at once (windows dedupe by `(appId, filePath)`, not `appId` alone).

No new check types: `window_state` already worked generically by `appId`, and `fs_opened` already worked off the same `openFile` interaction context File Manager uses — both new apps just report through it. See `docs/authoring/desktop.md`.

## 2026-08-03

### Added student-added sprites/backdrops and student-created variables (Scratch)

Five new optional Scratch task fields: `allowAddSprite`, `addSpritePresetIds`, `allowAddBackdrop`, `addBackdropPresetIds`, `allowCreateVariable`. When enabled, students get an "Add sprite"/"Add backdrop" picker (sourced from the admin-curated `lessonTypeAssets/scratch.defaultSprites`/`.defaultBackdrops` library, optionally narrowed per task by the `...PresetIds` fields) and/or a "Make a Variable" flyout button. Student-added sprites/backdrops and student-created variables are decorative only — they never satisfy `sprite_property`, `block_used`, `blocks_in_order`, `block_count`, `block_run`, `variable_equals`, or `variable_compare` checks, which continue to see only the author-authored sprite/variable set. They persist through save, carry-through, and remote reset the same as authored content.

See `docs/authoring/scratch.md#student-added-sprites-backdrops-and-variables`.

### Electronics: generic code checks and lockable wires

Electronics tasks with a `microcontroller` component can now use the shared generic check types — `code`, `code_contains`, `code_equals`, `code_matches_regex`, and their negated variants — alongside the existing `circuit_*` checks. These evaluate against the Micro Controller's MicroPython source, not the raw circuit. The Builder's electronics check editor now exposes this as a **Code** subject (with the same operators and wording as the Python/HTML code check editor), so authors can add these checks without hand-editing lesson JSON/YAML. See `docs/authoring/electronics.md` (Checks section) for an example.

Wires now support an optional `wire.locked: true` field, mirroring the existing component `locked` convention: a locked wire cannot be deleted or recolored by students (new wires can still be attached to its pins). The builder's wire inspector gained a "Fixed for students" checkbox alongside the existing color select. See `docs/authoring/electronics.md` for the field description.

No lesson migration is required — omitted `wire.locked` behaves exactly as before (unlocked).

### Arcade Kit now honours the "Web editor" asset flag

Arcade's student workspace and the Builder's author preview now filter both
per-lesson `storageAssets` and Arcade-wide shared assets by `showInEditor`,
matching the existing HTML module behaviour. Generated sprites and tilemaps
from the visual design tools are unaffected.

**Migration note:** shared Arcade assets uploaded before this change default
to `showInEditor: false` and will disappear from lessons until an admin
re-ticks **Web editor** for them in the Admin Portal's Shared Assets panel.

See `docs/authoring/arcade.md#assets` for details.

### Added `taskActivity` field; authoring intent now previewable

Tasks may now carry an optional `taskActivity` field — a plain-text, author-only note on the intended in-class activity (e.g. "Pair-share discussion"). Like `intent`, it is stored but never shown to students, and it is always optional (not required in Draft). It rides along under the existing generic `taskLastChangedAt` timestamp; it has no dedicated `taskActivityLastChangedAt`.

Authoring intent (and the new `taskActivity`) are now also visible in the Builder's inline student/quiz preview and in the teacher's full read-only lesson preview, in an "Authoring metadata" section above the student-facing content. This section is visible by default while `lesson.draft: true`, and collapsed (one click to expand) once Draft is cleared. Both fields remain strictly author-only in every case — never rendered on any student-facing render path.

See `docs/authoring/lesson-schema.md` and `docs/authoring/lesson-schema-yaml.md` for the field reference.

### Added the `code_arrange` task type

New task type for Python and HTML: `taskType: "code_arrange"`. Students assemble a program line by line and run it for real through the same Pyodide/HTML pipeline as an ordinary code task. Completion is decided by the task's normal `check`/`feedbackChecks` against the real run result, not by matching tile identity or order.

`code_arrange` is a distinct task type alongside `python`/`html` code tasks, not a `quiz` sub-type, since quiz tasks must not carry code/output check fields.

Every line in `lines` is authored the same way: as an ordered `parts` array alternating fixed text (`{type: "text", text}`) and blanks (`{type: "slot", id, code}`) — never parsed out of a `___`-marker text blob. A line that's just a single blank with no surrounding text behaves like a traditional whole draggable line; a line mixing text and blanks reads like `for i in range(___):`. There is no separate mode/schema branch for the two — it's purely how many/which parts a line has.

There is exactly one shared tile pool for the whole task: every blank's own correct code, plus the task-level `distractors` list (`{id, code}[]`). Any tile in that pool can be dropped into any blank in the task — whatever tile currently sits in a blank, correct or distractor, is exactly what gets spliced into the assembled program and run.

New fields: `lines` (`{id, parts}[]`, one program line per entry, `parts` joined together and lines joined by newlines), `distractors` (task-level `{id, code}[]`, the shared pool's wrong tiles). HTML tasks also use the ordinary `entryFile` / `starterFiles` fields; the entry file's content is replaced by the assembled lines. There is no `prefixCode`/`suffixCode` — the assembled program is just `lines` joined by newlines, nothing wrapped around them.

See `docs/authoring/lesson-schema.md` ("Code Arrange Task Fields") for the full field reference and an example combining a whole-line blank and a line with an inline blank. See `docs/authoring/python.md` / `docs/authoring/html.md` for module-specific examples. Builder support: choose **Arrange** in the task format picker (composed lessons only) — a visual, reorderable line list where every line uses the same part-by-part composer, plus one shared "Distractor tiles" list, not a raw JSON-shaped form.

## 2026-07-30

### Changed grouped subtask titles

Grouped subtasks now keep their own `title` values instead of being auto-renamed from the parent group title. Authors no longer need `_customTitle`; Builder saves and exports strip that legacy field from grouped subtasks.

See `docs/authoring/lesson-schema-yaml.md` for the updated group example.

## 2026-07-29

### Added authoring changelog maintenance rule

The authoring docs now include this changelog for future lesson-writing changes. When a change affects how lessons are authored, update this file in the same PR with:

- the author-facing impact;
- any required migration or compatibility note;
- links to the detailed reference docs that were updated.

This entry introduces the process only; it does not change the lesson schema or publishing workflow.
