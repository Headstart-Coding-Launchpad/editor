import { ARCADE_PALETTE } from './design'

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

// This is intentionally a small, browser-native learning API. The game code is
// isolated in a sandboxed iframe; `game.run()` yields every animation frame, so
// a Stop action is always just an iframe reset.
export function buildArcadeIframeSrc({ code = '', assets = [], tilemaps = [], width = 160, height = 120 } = {}) {
  const assetMap = Object.fromEntries((assets ?? []).filter(asset => asset?.name && asset?.url).map(asset => [asset.name, asset.url]))
  const tilemapData = Object.fromEntries((tilemaps ?? []).filter(tilemap => tilemap?.name && tilemap?.data).map(tilemap => [tilemap.name, tilemap.data]))
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:100%;height:100%;background:#0f172a;display:grid;place-items:center;overflow:hidden}
   canvas{background:#020617;outline:none}
  #status{position:fixed;inset:0;display:grid;place-items:center;color:#e2e8f0;font:14px system-ui;text-align:center;padding:16px;white-space:pre-wrap}
</style></head><body><canvas id="game" width="${Number(width) || 160}" height="${Number(height) || 120}" tabindex="0"></canvas><div id="status">Preparing Arcade Kit…</div>
<script type="module">
const source = ${safeJson(code)};
const assets = ${safeJson(assetMap)};
const tilemaps = ${safeJson(tilemapData)};
const palette = ${safeJson(ARCADE_PALETTE)};
const paletteByName = Object.fromEntries(palette.map(({ name, hex }) => [name, hex]));
const paletteValues = new Set(palette.map(({ hex }) => hex));
const canvas = document.getElementById('game');
const context = canvas.getContext('2d');
const BACKING_SCALE = 4;
let logicalWidth = Number(canvas.getAttribute('width')) || 160;
let logicalHeight = Number(canvas.getAttribute('height')) || 120;
const status = document.getElementById('status');
const keys = new Set();
const images = new Map();
const sounds = new Map();
let music = null;
let cameraX = 0;
let cameraY = 0;
let pointerX = 0;
let pointerY = 0;
let pointerDown = false;
let queuedPointerPress = false;
let queuedPointerRelease = false;
let pointerJustPressed = false;
let pointerJustReleased = false;
let lastFrameAt = null;
let frameDelta = 1 / 60;
let frameTime = 0;
let frameNumber = 0;
let shakeAmount = 0;
let shakeUntil = 0;
let shakeX = 0;
let shakeY = 0;

function isImageAsset(name) {
  return /\\.(avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(name);
}
function preloadImages() {
  return Promise.all(Object.entries(assets).filter(([name]) => isImageAsset(name)).map(([name, url]) => new Promise(resolve => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = url;
    images.set(name, img);
  })));
}

function fitCanvas() {
  const scale = Math.max(1, Math.min(innerWidth / logicalWidth, innerHeight / logicalHeight));
  canvas.style.width = Math.floor(logicalWidth * scale) + 'px';
  canvas.style.height = Math.floor(logicalHeight * scale) + 'px';
}
function setCanvasSize(width, height) {
  logicalWidth = Math.max(1, Number(width));
  logicalHeight = Math.max(1, Number(height));
  canvas.width = logicalWidth * BACKING_SCALE;
  canvas.height = logicalHeight * BACKING_SCALE;
  context.setTransform(BACKING_SCALE, 0, 0, BACKING_SCALE, 0, 0);
  context.imageSmoothingEnabled = false;
  fitCanvas();
}
addEventListener('resize', fitCanvas);
setCanvasSize(logicalWidth, logicalHeight);

function formatPythonError(error) {
  const lines = String(error).replace(/^PythonError:\\s*/, '').split('\\n').map(line => line.trimEnd()).filter(Boolean);
  if (lines.length === 0) return 'The game could not start.';
  let lineNumber = null;
  for (let index = lines.length - 1; index >= 0; index--) {
    const match = lines[index].match(/File "<game>", line (\\d+)/);
    if (match) { lineNumber = match[1]; break; }
  }
  const errorLine = lines[lines.length - 1];
  return lineNumber ? 'Line ' + lineNumber + ': ' + errorLine : errorLine;
}

const say = (type, detail = {}) => parent.postMessage({ headstartArcade: true, type, ...detail }, '*');
function image(name) {
  if (!assets[name]) return null;
  if (!images.has(name)) { const img = new Image(); img.src = assets[name]; images.set(name, img); }
  return images.get(name);
}
function keyDown(name) { return keys.has(name); }
function arcadeColour(value, fallback) {
  const colour = String(value ?? '').trim().toLowerCase();
  return paletteByName[colour] || (paletteValues.has(colour) ? colour : fallback);
}
function normaliseKey(event) {
  const map = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down', ' ':'space', Spacebar:'space' };
  return map[event.key] || event.key.toLowerCase();
}
addEventListener('keydown', event => { const key = normaliseKey(event); keys.add(key); if (['left','right','up','down','space'].includes(key)) event.preventDefault(); });
addEventListener('keyup', event => keys.delete(normaliseKey(event)));

function updatePointer(event) {
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  pointerX = (event.clientX - bounds.left) * logicalWidth / bounds.width;
  pointerY = (event.clientY - bounds.top) * logicalHeight / bounds.height;
}
canvas.addEventListener('pointerdown', event => {
  updatePointer(event);
  pointerDown = true;
  queuedPointerPress = true;
  canvas.focus();
  canvas.setPointerCapture?.(event.pointerId);
});
canvas.addEventListener('pointermove', updatePointer);
canvas.addEventListener('pointerup', event => {
  updatePointer(event);
  pointerDown = false;
  queuedPointerRelease = true;
});
canvas.addEventListener('pointercancel', () => { pointerDown = false; queuedPointerRelease = true; });

function beginFrame() {
  const now = performance.now();
  frameDelta = lastFrameAt == null ? 1 / 60 : Math.min(0.1, Math.max(0, (now - lastFrameAt) / 1000));
  lastFrameAt = now;
  frameTime += frameDelta;
  frameNumber += 1;
  pointerJustPressed = queuedPointerPress;
  pointerJustReleased = queuedPointerRelease;
  queuedPointerPress = false;
  queuedPointerRelease = false;
  if (now < shakeUntil) {
    shakeX = (Math.random() * 2 - 1) * shakeAmount;
    shakeY = (Math.random() * 2 - 1) * shakeAmount;
  } else {
    shakeX = 0;
    shakeY = 0;
  }
}
function worldX(x) { return Number(x) - cameraX + shakeX; }
function worldY(y) { return Number(y) - cameraY + shakeY; }

globalThis.hsArcadeClear = color => { context.fillStyle = arcadeColour(color, paletteByName.black); context.fillRect(0, 0, logicalWidth, logicalHeight); };
globalThis.hsArcadeRect = (x, y, width, height, color) => { context.fillStyle = arcadeColour(color, paletteByName.white); context.fillRect(worldX(x), worldY(y), Number(width), Number(height)); };
globalThis.hsArcadeText = (text, x, y, color, size) => { context.fillStyle = arcadeColour(color, paletteByName.white); context.font = Number(size || 8) + 'px monospace'; context.textBaseline = 'top'; context.fillText(String(text), worldX(x), worldY(y)); };
globalThis.hsArcadeSprite = (name, x, y, width, height, frame = 0, frames = 1) => {
  const img = image(String(name));
  if (!img?.complete || !img.naturalWidth) return;
  const count = Math.max(1, Math.floor(Number(frames) || 1));
  const sourceWidth = img.naturalWidth / count;
  const sourceFrame = ((Math.floor(Number(frame) || 0) % count) + count) % count;
  context.drawImage(img, sourceFrame * sourceWidth, 0, sourceWidth, img.naturalHeight, worldX(x), worldY(y), Number(width || sourceWidth), Number(height || img.naturalHeight));
};
globalThis.hsArcadeTileMap = name => JSON.stringify(tilemaps[String(name)] || null);
globalThis.hsArcadeSound = (name, volume = 1) => {
  const url = assets[String(name)];
  if (!url) return;
  const sound = new Audio(url);
  sound.volume = Math.max(0, Math.min(1, Number(volume)));
  sounds.set(String(name), sound);
  sound.play().catch(() => {});
};
globalThis.hsArcadeMusic = (name, volume = 0.5) => {
  const url = assets[String(name)];
  if (!url) return;
  if (music?.name === String(name)) { music.audio.volume = Math.max(0, Math.min(1, Number(volume))); music.audio.play().catch(() => {}); return; }
  if (music) { music.audio.pause(); music.audio.currentTime = 0; }
  const audio = new Audio(url);
  audio.loop = true;
  audio.volume = Math.max(0, Math.min(1, Number(volume)));
  music = { name: String(name), audio };
  audio.play().catch(() => {});
};
globalThis.hsArcadeStopMusic = () => { if (music) { music.audio.pause(); music.audio.currentTime = 0; music = null; } };
globalThis.hsArcadeKey = keyDown;
globalThis.hsArcadeResize = (w, h) => setCanvasSize(w, h);
globalThis.hsArcadePointerX = () => pointerX;
globalThis.hsArcadePointerY = () => pointerY;
globalThis.hsArcadePointerDown = () => pointerDown;
globalThis.hsArcadePointerJustPressed = () => pointerJustPressed;
globalThis.hsArcadePointerJustReleased = () => pointerJustReleased;
globalThis.hsArcadeSetCamera = (x, y) => { cameraX = Number(x) || 0; cameraY = Number(y) || 0; };
globalThis.hsArcadeDelta = () => frameDelta;
globalThis.hsArcadeTime = () => frameTime;
globalThis.hsArcadeFrame = () => frameNumber;
globalThis.hsArcadeShake = (amount, duration) => { shakeAmount = Math.max(0, Number(amount) || 0); shakeUntil = performance.now() + Math.max(0, Number(duration) || 0) * 1000; };
globalThis.hsArcadeBeginFrame = beginFrame;
globalThis.hsArcadeNextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
globalThis.hsArcadeReady = () => { status.style.display = 'none'; fitCanvas(); canvas.focus(); say('ready'); };

const bootstrap = String.raw\`
import ast, inspect, json, sys, types
import js

class _Keys:
    def pressed(self, key):
        return bool(js.hsArcadeKey(str(key)))
    def __getattr__(self, key):
        if key == 'horizontal': return int(self.pressed('right')) - int(self.pressed('left'))
        if key == 'vertical': return int(self.pressed('down')) - int(self.pressed('up'))
        return self.pressed(key)

class _Pointer:
    @property
    def x(self): return float(js.hsArcadePointerX())
    @property
    def y(self): return float(js.hsArcadePointerY())
    @property
    def down(self): return bool(js.hsArcadePointerDown())
    @property
    def just_pressed(self): return bool(js.hsArcadePointerJustPressed())
    @property
    def just_released(self): return bool(js.hsArcadePointerJustReleased())
    def over(self, sprite):
        return sprite.x <= self.x < sprite.x + sprite.width and sprite.y <= self.y < sprite.y + sprite.height

class Sprite:
    def __init__(self, image, x=0, y=0, width=None, height=None, frames=1, frame=0):
        self.image, self.x, self.y = str(image), x, y
        self.width, self.height = width or 16, height or 16
        self.frames, self.frame = max(1, int(frames)), int(frame)
        self.vx, self.vy = 0, 0
        self.last_tile_collisions = []
        self._animation_time = 0
    def draw(self):
        js.hsArcadeSprite(self.image, self.x, self.y, self.width, self.height, self.frame, self.frames)
    def touches(self, other):
        return self.x < other.x + other.width and self.x + self.width > other.x and self.y < other.y + other.height and self.y + self.height > other.y
    def move(self):
        self.x += self.vx * game.delta
        self.y += self.vy * game.delta
    def apply_gravity(self, amount=800, terminal_velocity=None):
        self.vy += float(amount) * game.delta
        if terminal_velocity is not None:
            self.vy = min(self.vy, float(terminal_velocity))
    def move_with_tiles(self, tile_map):
        hit_x, hit_y = tile_map.move(self, self.vx * game.delta, self.vy * game.delta)
        self.last_tile_collisions = [dict(hit) for hit in tile_map._last_move_collisions]
        if hit_x: self.vx = 0
        if hit_y: self.vy = 0
        return hit_x, hit_y
    def animate(self, start=0, end=None, fps=8):
        end = self.frames - 1 if end is None else int(end)
        start, end = int(start), max(int(start), end)
        self._animation_time += game.delta
        if self._animation_time >= 1 / max(1, float(fps)):
            self._animation_time = 0
            self.frame = start if self.frame >= end else self.frame + 1

class TileMap:
    def __init__(self, rows, tile_size=None, solid=None, properties=None, objects=None):
        source = None
        if isinstance(rows, str):
            source_json = str(js.hsArcadeTileMap(rows))
            if source_json != 'null': source = json.loads(source_json)
            if source is None: raise ValueError('Tilemap asset not found: ' + rows)
        if source:
            rows = source.get('rows', [])
            tile_size = source.get('tileSize', 16) if tile_size is None else tile_size
            solid = source.get('solid', '') if solid is None else solid
            properties = source.get('properties', {}) if properties is None else properties
            objects = source.get('objects', []) if objects is None else objects
            self.tiles = dict(source.get('tiles', {}))
        else:
            self.tiles = {}
        self.rows = [str(row) for row in rows]
        self.tile_size = int(16 if tile_size is None else tile_size)
        self.properties = {str(key): dict(value or {}) for key, value in (properties or {}).items()}
        property_solid = [key for key, value in self.properties.items() if value.get('solid')]
        solid = '#' if solid is None else solid
        self.solid = (set(solid) if isinstance(solid, str) else set(solid)) | set(property_solid)
        self.objects = [dict(item) for item in (objects or [])]
        self._last_move_collisions = []
        self.width = max((len(row) for row in self.rows), default=0) * self.tile_size
        self.height = len(self.rows) * self.tile_size
    def tile_at(self, column, row):
        if row < 0 or row >= len(self.rows) or column < 0 or column >= len(self.rows[row]): return None
        return self.rows[row][column]
    def set_tile(self, column, row, tile):
        column, row = int(column), int(row)
        tile = str(tile)
        if len(tile) != 1: raise ValueError('tile must be one character')
        if row < 0 or row >= len(self.rows) or column < 0 or column >= len(self.rows[row]): return False
        current = self.rows[row]
        self.rows[row] = current[:column] + tile + current[column + 1:]
        return True
    def is_solid(self, column, row):
        return self.tile_at(column, row) in self.solid
    def tile_properties(self, column, row):
        return dict(self.properties.get(self.tile_at(column, row), {}))
    def tile_property(self, column, row, name, default=None):
        return self.tile_properties(column, row).get(str(name), default)
    def find_objects(self, object_type):
        return [dict(item) for item in self.objects if item.get('type') == str(object_type)]
    def draw(self, tiles=None):
        tiles = self.tiles if tiles is None else tiles
        for row_number, row in enumerate(self.rows):
            for column, tile in enumerate(row):
                image = tiles.get(tile) if hasattr(tiles, 'get') else None
                if image:
                    js.hsArcadeSprite(str(image), column * self.tile_size, row_number * self.tile_size, self.tile_size, self.tile_size, 0, 1)
    def collides(self, sprite):
        return bool(self._solid_tile_hits(sprite))
    def _solid_tile_hits(self, sprite):
        left = int(sprite.x // self.tile_size)
        right = int((sprite.x + sprite.width - 0.000001) // self.tile_size)
        top = int(sprite.y // self.tile_size)
        bottom = int((sprite.y + sprite.height - 0.000001) // self.tile_size)
        return [
            {'column': column, 'row': row, 'tile': self.tile_at(column, row), 'properties': self.tile_properties(column, row)}
            for row in range(top, bottom + 1)
            for column in range(left, right + 1)
            if self.is_solid(column, row)
        ]
    def on_ground(self, sprite):
        sprite.y += 1
        grounded = self.collides(sprite)
        sprite.y -= 1
        return grounded
    def move(self, sprite, dx, dy):
        hit_x = hit_y = False
        self._last_move_collisions = []
        recorded = set()
        def record(hits, axis):
            for hit in hits:
                key = (axis, hit['column'], hit['row'])
                if key not in recorded:
                    recorded.add(key)
                    self._last_move_collisions.append({**hit, 'axis': axis})
        steps = max(1, int(max(abs(dx), abs(dy)) // self.tile_size) + 1)
        for _ in range(steps):
            step_x, step_y = dx / steps, dy / steps
            sprite.x += step_x
            x_hits = self._solid_tile_hits(sprite)
            if x_hits:
                sprite.x -= step_x
                hit_x = True
                record(x_hits, 'x')
            sprite.y += step_y
            y_hits = self._solid_tile_hits(sprite)
            if y_hits:
                sprite.y -= step_y
                hit_y = True
                record(y_hits, 'y')
        return hit_x, hit_y

class _Camera:
    def __init__(self): self.x, self.y, self.target = 0, 0, None
    def follow(self, sprite): self.target = sprite
    def look_at(self, x, y): self.target, self.x, self.y = None, float(x) - game.width / 2, float(y) - game.height / 2
    def update(self):
        if self.target:
            self.x = self.target.x + self.target.width / 2 - game.width / 2
            self.y = self.target.y + self.target.height / 2 - game.height / 2
        js.hsArcadeSetCamera(self.x, self.y)

class _Game:
    def __init__(self):
        self.width, self.height, self._namespace = 160, 120, None
        self.camera = _Camera()
    def size(self, width, height):
        self.width, self.height = int(width), int(height)
        js.hsArcadeResize(self.width, self.height)
    def clear(self, color='black'): js.hsArcadeClear(color)
    def rect(self, x, y, width, height, color='white'): js.hsArcadeRect(x, y, width, height, color)
    def text(self, text, x, y, color='white', size=8): js.hsArcadeText(text, x, y, color, size)
    @property
    def delta(self): return float(js.hsArcadeDelta())
    @property
    def time(self): return float(js.hsArcadeTime())
    @property
    def frame(self): return int(js.hsArcadeFrame())
    def sound(self, name, volume=1): js.hsArcadeSound(str(name), float(volume))
    def music(self, name, volume=0.5): js.hsArcadeMusic(str(name), float(volume))
    def stop_music(self): js.hsArcadeStopMusic()
    def shake(self, amount=2, duration=0.15): js.hsArcadeShake(float(amount), float(duration))
    async def run(self):
        caller = inspect.currentframe().f_back
        callbacks = (caller.f_globals if caller else None) or self._namespace or {}
        setup, update, draw = callbacks.get('setup'), callbacks.get('update'), callbacks.get('draw')
        if setup: setup()
        js.hsArcadeReady()
        while True:
            js.hsArcadeBeginFrame()
            if update: update()
            self.camera.update()
            if draw: draw()
            await js.hsArcadeNextFrame()

game, keys, pointer = _Game(), _Keys(), _Pointer()
module = types.ModuleType('headstart_arcade')
module.game, module.keys, module.pointer, module.mouse = game, keys, pointer, pointer
module.Sprite, module.TileMap = Sprite, TileMap
sys.modules['headstart_arcade'] = module

class _RunCall(ast.NodeTransformer):
    def visit_Expr(self, node):
        self.generic_visit(node)
        if isinstance(node.value, ast.Call) and isinstance(node.value.func, ast.Attribute) and node.value.func.attr == 'run':
            node.value = ast.Await(value=node.value)
        return node

tree = ast.parse(_hs_source, filename='<game>')
tree = _RunCall().visit(tree)
ast.fix_missing_locations(tree)
scope = {'__name__': '__main__'}
game._namespace = scope
code = compile(tree, '<game>', 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
if code.co_flags & inspect.CO_COROUTINE:
    await eval(code, scope)
else:
    exec(code, scope)
\`;

try {
  status.textContent = 'Loading game assets…';
  const assetsReady = preloadImages();
  const { loadPyodide } = await import('${PYODIDE_CDN}pyodide.mjs');
  status.textContent = 'Loading game…';
  const [pyodide] = await Promise.all([loadPyodide({ indexURL: '${PYODIDE_CDN}' }), assetsReady]);
  pyodide.setStdout({ batched: text => say('console', { kind: 'stdout', text }) });
  pyodide.setStderr({ batched: text => say('console', { kind: 'stderr', text }) });
  pyodide.globals.set('_hs_source', source);
  status.textContent = 'Loading game…';
  await pyodide.runPythonAsync(bootstrap);
} catch (error) {
  const message = formatPythonError(error);
  status.style.display = 'grid';
  status.textContent = message;
  say('error', { message });
}
</script></body></html>`
}
