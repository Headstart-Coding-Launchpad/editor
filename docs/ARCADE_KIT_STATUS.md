# Arcade Kit — implementation status

**Status:** experimental foundation. It is suitable for focused prototyping and
author testing, but not yet ready to be presented as a fully featured,
production lesson type.

**Last reviewed:** 24 July 2026

## Product shape

Arcade Kit is a single-file Python lesson type for pixel-style browser games.
Students import a small classroom API and write update() / draw() functions:

    from headstart_arcade import game, Sprite, keys

    player = Sprite("tile_0278.png", x=72, y=100)

    def update():
        player.x += keys.horizontal * 2

    def draw():
        game.clear("dark_blue")
        player.draw()

    game.run()

The API is deliberately Pygame-inspired but Headstart-specific. It is **not**
the pygame, pygame-ce, or Pygame Zero package, and cannot presently be
installed or used outside Headstart unchanged.

## Implemented

### Lesson-type integration

- Arcade is registered as the "arcade" lesson type and selectable from the Builder.
- Code tasks use one starterCode / completeCode Python source file.
- Builder Starter, Stage, and Complete tabs are available.
- Existing code carry-through, reset, personal sandbox, source persistence, and
  teacher source editing recognise Arcade as a Python-like single-file type.
- The module interface, registry, lesson validation, and source map are updated
  and covered by unit tests.

### Runtime and student workspace

- Games execute in a separate sandboxed iframe with its own Pyodide runtime.
  This keeps a stopped or infinite game from freezing the main classroom UI:
  Stop destroys and recreates the iframe.
- game.run() is converted internally to an async animation loop; students do
  not write async or await.
- game.clear(colour), game.rect(...), game.text(...), and
  game.size(width, height) draw to a pixelated canvas. A shared 16-colour
  palette is used by sprite artwork and these drawing methods. game.delta, game.time,
  game.frame, game.shake(...), camera following, and controllable music/sound
  effects are available for game feel and scrolling worlds.
- Sprite(image, x, y, width, height, frames, frame) supports horizontal sprite
  sheets, simple frame animation, and delta-based velocity movement.
- sprite.touches(other) supplies simple axis-aligned rectangle collision.
- keys.left, keys.right, keys.up, keys.down, keys.space, keys.horizontal,
  keys.vertical, and keys.pressed("…") are available.
- pointer (also available as mouse) supplies logical-canvas position, held,
  just-pressed, and just-released state for both mouse and touch input.
- TileMap supplies character-grid drawing, solid-tile lookup, runtime tile
  replacement with `set_tile(column, row, tile)`, and movement collision. The
  moving sprite receives `last_tile_collisions` with the tiles it hit. The
  camera applies to all world drawing.
- game.sound(name) asks the browser to play a named audio asset. Browser
  autoplay policies can still require the student to click the canvas first.
- A game starts only when the student chooses **Run game**. Editing or resetting
  the source stops the running game, and the idle game area does not load
  Pyodide.
- The game canvas scales to the available preview area while preserving its
  aspect ratio. It uses a four-times higher-resolution backing canvas with
  nearest-neighbour sprite scaling, so enlarged sprite edges stay crisp while
  game coordinates stay the same.
- A collapsible **Assets** section sits under the editor and is closed by
  default, leaving the game area unobstructed.
- A collapsible **Console** under the game uses the same panel presentation as
  the standard Python output panel. It opens only for Python print output,
  stderr, or runtime errors from the game iframe; runtime errors are condensed
  to the relevant source line and error message.

### Assets

- Lesson Firebase Storage assets are available by their relative storage name:
  an upload named tile_0278.png is referenced as
  Sprite("tile_0278.png", ...); a nested upload such as
  sprites/tile_0278.png uses that whole relative path.
- Arcade-wide shared assets are also available in student and Builder previews.
- Static lesson assets are supported where the lesson defines them.
- Builder preview receives the same lesson and shared asset URLs as the student
  game preview.
- Image assets are preloaded before game code begins, so sprites do not appear
  part-way through a new game's first frame.

- Builder authors can create compact 8 by 8 or 16 by 16 pixel sprites
  (including copied equal-duration animation frames) and tilemaps per Starter,
  Stage, or Complete code state. Tile images can be replaced, tiles removed,
  and maps resized from the visual editor.
  Generated images are portable data URLs and appear alongside uploaded assets.
- Arcade tasks can expose sprites, tilemaps, both, or neither to students.
  Students edit private copies that persist with their code; the active
  student's design is throttled to the teacher for inspection and resets with
  the matching code state.
- Tilemaps can store solid/custom tile properties and object spawns. `TileMap`
  now provides `tile_properties`, `tile_property`, `objects`, and
  `find_objects` for authored map data.

### Current verification

- Unit tests cover Arcade runtime document creation, asset injection, empty
  source handling, and the lesson-module contract.
- Full test suite: **102 files, 1,470 tests passing** (24 July 2026).
- Production Vite build passes.
- npm run docs:check passes.

## Not yet implemented

### Classroom and authoring gaps

- **No runtime-state completion flow for games.** Existing code checks and
  stages work, but Arcade Run does not yet report score, collision, or
  rendered-pixel results to completion checks.
- **No insert button for uploaded/static assets.** Their names must currently
  be typed or copied into Sprite("…"). Sprites and tilemaps made in the
  Builder's own pixel-editor design tools are unaffected by this — those
  already insert on click (see `StudentWorkspace.jsx`'s generated-asset and
  generated-tilemap buttons).
- **No authored example lesson or included starter asset pack.** ship.png in
  early examples is illustrative only; authors must upload that asset or use
  their own name.
- **No authored canvas configuration panel.** Authors use game.size(...) in
  code; the Builder has no width/height, frame-rate, or scaling fields.
- The focused Arcade authoring guide documents the supported API, but the
  cross-cutting lesson schema remains shared with Python code tasks.

### Runtime and game-engine gaps

- Games are **single file only**. There are no Python modules, level files,
  save files, or per-game project folders.
- Rendering supports images, horizontal sprite sheets, tile maps, rectangles,
  and text. There are no particles, custom fonts, or palette tools.
- Collision supports rectangles and solid tile maps, including lightweight
  gravity and velocity helpers. There is no full physics engine, pathfinding,
  multiplayer, or gamepad support.
- Sound supports effect volume and a single looping music channel; there is no
  mixer, preload feedback, or audio editor.
- Pointer input works with touch, but there are no mobile-specific control
  overlays such as a virtual D-pad.
- The first game run downloads an additional Pyodide runtime into the sandboxed
  iframe. It depends on the Pyodide CDN and network availability; it is not
  bundled or shared with the existing Python Web Worker. This means the first
  explicit **Run game** can take a few seconds, especially on a slow connection;
  later runs are normally faster when the browser cache is available.
- Teacher live/source views mirror code only. They do not currently render a
  student's running game canvas.
- Arcade games do not use the existing Python worker runtime, Python tests,
  input(), output panel, variable checks, or .launchpad code-file export.

### Validation gaps

- Browser-level end-to-end coverage of the Pyodide iframe loop and real Firebase
  assets is not automated.
- The local browser-control environment could not reach the local Vite server,
  so the browser smoke check could not run there. The production build and unit
  suite did run successfully.

## Recommended next milestones

1. Make game completion meaningful: add explicit Arcade checks for code,
   runtime errors, score/state events, and collision/goal events; show results
   through the existing student and teacher feedback paths.
2. Build an Arcade asset picker that previews images and inserts the exact
   Sprite("relative/path.png") value into the editor.
3. Add a small official pixel asset pack plus one complete lesson (for example,
   "Dodge the Meteors") to establish the intended API and authoring pattern.
4. Add a focused Arcade authoring guide and a YAML/schema reference.
5. Decide whether the experimental iframe Pyodide runtime is acceptable for
   production or should be replaced by a dedicated compiled/runtime package.
6. Add browser E2E tests for run/stop, keyboard movement, lesson assets, and
   teacher/student views.

## Immediate author guidance

For now, use small PNG/WebP images, upload them at the lesson level, copy their
relative name into Sprite, and test in the Builder preview before publishing.
Do not make task progression depend on an Arcade check until milestone 1 is
complete.
