# Arcade Kit Lesson Authoring

Arcade Kit is a single-file Python lesson type for small pixel-style browser
games. It provides the built-in `headstart_arcade` module; it is not Pygame,
Pygame Zero, or a general Python package.

## Lesson and task shape

Use `type: arcade` at lesson level. Arcade tasks use the same source-stage
fields as a Python code task: `starterCode`, `completeCode`, `codeStages`,
`carryCodeFrom`, and `copyCode`.

## Visual design tools

The Builder can attach portable pixel art and tilemaps to each Arcade code
state. The data belongs to the Starter tab as `arcadeDesign`, a code stage as
`codeStages[n].arcadeDesign`, and the Complete tab as `completeArcadeDesign`.
It remains in the lesson JSON: generated images do not require Firebase
Storage and downloaded lessons keep their artwork.

Set `arcadeTools` on an Arcade task to choose what learners can edit:

| Value | Student tools |
|---|---|
| `none` | No visual tools (default) |
| `sprites` | Pixel sprite editor only |
| `tilemaps` | Tilemap editor only |
| `both` | Both editors |

Students begin with a private copy of the authored design for their active
state. Their edits save alongside their local Arcade code; watched students
share a throttled snapshot for teacher inspection, but do not change the
published lesson or another learner's project.

Sprites use an 8 by 8 pixel grid and optional equal-length animation frames.
The editor makes a generated, named asset such as `player.png` (the `.png`
suffix is added automatically); it is listed
alongside normal lesson assets and can be inserted as
`Sprite("player.png", frames=4)`. Tilemaps can paint those assets, set `solid`
and arbitrary properties, and add object spawns. Each map is available as a
named `.tilemap` design asset; **Insert Python** adds a compact
`TileMap("world.tilemap")` declaration without overwriting other source code.

```yaml
id: move-a-sprite
type: arcade
title: Move a Sprite
description: Make a player respond to the arrow keys.
tasks:
  - title: Move the player
    starterCode: |
      from headstart_arcade import game, Sprite, keys

      player = Sprite("player.png", x=72, y=100)

      def update():
          player.x += keys.horizontal * 2

      def draw():
          game.clear("navy")
          player.draw()

      game.run()
```

Students start a game with **Run game**. Editing or resetting code stops it;
there is no automatic run on opening a task or while typing.

## `headstart_arcade` API

```python
from headstart_arcade import game, Sprite, keys
```

### `game`

| API | Description |
|---|---|
| `game.run()` | Starts the animation loop. Calls `setup()` once when present, then calls `update()` and `draw()` every frame. Place this at the end of the source file. |
| `game.size(width, height)` | Sets the logical pixel dimensions of the game canvas. The displayed canvas scales responsively while preserving that ratio; Arcade Kit renders through a higher-resolution backing canvas, so existing logical coordinates remain stable when enlarged and sprites retain crisp pixel edges. |
| `game.clear(colour='#020617')` | Fills the entire canvas with a CSS colour. |
| `game.rect(x, y, width, height, colour='white')` | Draws a filled rectangle. |
| `game.text(text, x, y, colour='white', size=8)` | Draws text using a pixel-style monospace font. |
| `game.sound(name, volume=1)` | Plays a named OGG or WAV sound effect. Some browsers require a click in the game before sound can play. |
| `game.music(name, volume=0.5)` | Starts (or resumes) a looping music track. Starting a different track replaces the current one. |
| `game.stop_music()` | Stops the current music track. |
| `game.delta` | Seconds since the previous game frame, capped at 0.1. Use it to make velocity-based movement consistent. |
| `game.time` / `game.frame` | Elapsed game time in seconds and the number of rendered frames. |
| `game.shake(amount=2, duration=0.15)` | Briefly shakes the game world. Useful for hits and collisions. |
| `game.camera` | Camera object for scrolling worlds; see [Camera](#camera). |

### Game callbacks

`setup()` is optional and runs once at the start. `update()` and `draw()` are
also optional; use `update()` for changing game state and `draw()` for drawing
the current state.

```python
def setup():
    game.size(160, 120)

def update():
    pass

def draw():
    game.clear("navy")
```

### `Sprite`

| API | Description |
|---|---|
| `Sprite(image, x=0, y=0, width=None, height=None, frames=1, frame=0)` | Creates a sprite from an asset name. Omitted dimensions default to 16 by 16 logical pixels. `frames` treats one image as a horizontal sprite sheet. |
| `sprite.draw()` | Draws the sprite at its current position. |
| `sprite.touches(other)` | Returns `True` when this sprite's axis-aligned rectangle overlaps another sprite. |
| `sprite.x`, `sprite.y` | Mutable position values. |
| `sprite.width`, `sprite.height` | Mutable logical dimensions. |
| `sprite.image` | The referenced asset name. |
| `sprite.frame` / `sprite.frames` | The current frame and total horizontal frames in a sprite sheet. |
| `sprite.animate(start=0, end=None, fps=8)` | Advances the current frame through the supplied range. Call it from `update()`. |
| `sprite.vx`, `sprite.vy` / `sprite.move()` | Velocity in logical pixels per second and a helper that applies it using `game.delta`. |
| `sprite.apply_gravity(amount=800, terminal_velocity=None)` | Adds downward velocity using `game.delta`; optionally limits the falling speed. |
| `sprite.move_with_tiles(world)` | Moves using `vx`/`vy`, resolves against a `TileMap`, and sets a blocked velocity to zero. |

For a sprite sheet with four equal-width animation frames:

```python
player = Sprite("player-walk.png", x=72, y=100, frames=4)

def update():
    player.animate(fps=10)
```

### `keys`

| API | Description |
|---|---|
| `keys.left`, `keys.right`, `keys.up`, `keys.down`, `keys.space` | `True` while that key is pressed. |
| `keys.horizontal` | `-1` for left, `1` for right, otherwise `0`. |
| `keys.vertical` | `-1` for up, `1` for down, otherwise `0`. |
| `keys.pressed(name)` | Checks a named key such as `"left"`, `"right"`, `"up"`, `"down"`, or `"space"`. |

Click the game area before using the keyboard controls.

### Pointer input

Use `pointer` for mouse or touch input. `mouse` is an alias for the same
object, for lessons where that name is clearer. Coordinates always use the
logical game canvas, even when the preview is scaled.

```python
from headstart_arcade import pointer

if pointer.just_pressed and pointer.over(button):
    score += 1

player.x = pointer.x
player.y = pointer.y
```

| API | Description |
|---|---|
| `pointer.x`, `pointer.y` | Pointer position in logical canvas pixels. |
| `pointer.down` | `True` while a mouse/touch press is held. |
| `pointer.just_pressed`, `pointer.just_released` | `True` for one game frame when the press starts or ends. |
| `pointer.over(sprite)` | Returns `True` when the pointer is inside a sprite's rectangle. |

### Tile maps

`TileMap` turns simple character rows into a drawable, collision-aware world.
Use a dictionary to map each character to an image asset, and mark one or more
characters as solid. `move()` moves in small steps and stops a sprite before it
enters a solid tile, making it suitable for top-down movement and platformer
collision.

```python
from headstart_arcade import game, Sprite, TileMap, keys

world = TileMap([
    "############",
    "#..........#",
    "#....##....#",
    "############",
], tile_size=16, solid="#")
player = Sprite("player.png", x=20, y=20)

def update():
    world.move(player, keys.horizontal * 80 * game.delta, keys.vertical * 80 * game.delta)

def draw():
    game.clear("navy")
    world.draw({"#": "wall.png"})
    player.draw()
```

Maps made in the visual tilemap editor can be loaded directly by their listed
`.tilemap` asset name. Their tile images, properties, and object spawns are
included automatically, so `draw()` needs no separate tile dictionary.

```python
from headstart_arcade import TileMap

world = TileMap("world_1.tilemap")

def draw():
    world.draw()
```

| API | Description |
|---|---|
| `TileMap(rows, tile_size=16, solid='#')` | Creates a map from rows of characters. `solid` can be a string or collection of solid tile characters. |
| `TileMap("world.tilemap")` | Loads a visual-editor map asset, including its image mapping, properties, and object spawns. |
| `world.draw({character: "image.png"})` | Draws each mapped character using the named image asset. Unmapped characters are empty. |
| `world.collides(sprite)` | Reports whether a sprite overlaps a solid tile. |
| `world.move(sprite, dx, dy)` | Moves and resolves against solid tiles; returns `(hit_x, hit_y)`. |
| `world.on_ground(sprite)` | Reports whether a solid tile is immediately below a sprite. |
| `world.tile_at(column, row)` / `world.is_solid(column, row)` | Reads a map character or whether a tile is solid. |
| `world.tile_properties(column, row)` | Returns a copy of the authored properties for that tile. |
| `world.tile_property(column, row, name, default=None)` | Reads one authored property, such as `"hazard"` or `"damage"`. |
| `world.objects` / `world.find_objects(type)` | Reads authored object spawns or returns matching objects by their `type`. |

For a basic platformer, call `player.apply_gravity()` and
`player.move_with_tiles(world)` from `update()`. Use `world.on_ground(player)`
before giving the player an upward `vy` for a jump.

### Camera

The camera shifts all world drawing, including sprites, tile maps, rectangles,
and text. Follow a player for scrolling levels, or choose a position manually.

```python
game.camera.follow(player)

# Or center the camera at a world coordinate:
game.camera.look_at(160, 120)
```

## Assets

Lesson assets and Arcade-wide shared assets are referenced by their relative
name. For example, an uploaded `sprites/player.png` is used as
`Sprite("sprites/player.png")`. Arcade Kit preloads image assets before game
code starts, preventing sprites from popping into the first frames.

## Runtime notes and limits

The first **Run game** loads a separate Pyodide runtime inside a sandboxed
iframe, so a short initial delay is expected. The runtime is stopped by
destroying that iframe when source changes or the student presses Stop.

Arcade Kit currently supports one Python source file, images, animated sprite
sheets, rectangles, text, simple sprite and tile collision, keyboard and pointer
input, scrolling cameras, and basic audio. It does not yet support Python
packages, file I/O, gamepads, a full physics engine, or completion checks based on game state. See
[ARCADE_KIT_STATUS.md](../ARCADE_KIT_STATUS.md) for the current implementation
status and planned work.
