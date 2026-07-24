import { describe, expect, it } from 'vitest'
import { buildArcadeIframeSrc } from '../runtime.js'

describe('buildArcadeIframeSrc', () => {
  it('embeds the supplied game code and the small Arcade Kit API', () => {
    const src = buildArcadeIframeSrc({ code: 'game.run()' })
    expect(src).toContain('const source = "game.run()"')
    expect(src).toContain("sys.modules['headstart_arcade']")
    expect(src).toContain('async def run(self)')
    expect(src).toContain('runner_body = tree.body or [ast.Pass')
    expect(src).toContain('js.hsArcadeNextFrame()')
    expect(src).not.toContain('js.__hsArcadeNextFrame()')
    expect(src).toContain('js.hsArcadeReady()')
    expect(src).toContain("say('ready')")
    expect(src).toContain('function fitCanvas()')
    expect(src).toContain("addEventListener('resize', fitCanvas)")
    expect(src).toContain('context.imageSmoothingEnabled = false')
    expect(src).toContain('const BACKING_SCALE = 4')
    expect(src).toContain('function setCanvasSize(width, height)')
    expect(src).toContain('function formatPythonError(error)')
    expect(src).toContain("File \"<game>\", line")
    expect(src).toContain('function preloadImages()')
    expect(src).toContain("const assetsReady = preloadImages()")
    expect(src).toContain('Promise.all([loadPyodide')
    expect(src).toContain("status.style.display = 'grid';")
    expect(src).toContain('callbacks = caller.f_locals')
    expect(src).toContain("pyodide.setStdout({ batched: text => say('console'")
    expect(src).toContain('class _Pointer:')
    expect(src).toContain('class TileMap:')
    expect(src).toContain('class _Camera:')
    expect(src).toContain('def apply_gravity(self, amount=800, terminal_velocity=None):')
    expect(src).toContain('def move_with_tiles(self, tile_map):')
    expect(src).toContain('def on_ground(self, sprite):')
    expect(src).toContain('module.pointer, module.mouse')
    expect(src).toContain('module.Sprite, module.TileMap')
    expect(src).toContain('canvas.addEventListener(\'pointerdown\'')
    expect(src).toContain('globalThis.hsArcadeSetCamera')
    expect(src).toContain('globalThis.hsArcadeShake')
    expect(src).toContain('globalThis.hsArcadeMusic')
    expect(src).toContain('context.drawImage(img, sourceFrame * sourceWidth')
  })

  it('passes named assets to the sandbox without permitting markup injection', () => {
    const src = buildArcadeIframeSrc({
      code: '</script><img>',
      assets: [{ name: 'ship.png', url: 'data:image/png;base64,abc' }],
    })
    expect(src).toContain('"ship.png":"data:image/png;base64,abc"')
    expect(src).not.toContain('const source = "</script>')
    expect(src).toContain('\\u003c/script>')
  })

  it('makes generated tilemap files available to TileMap by name', () => {
    const src = buildArcadeIframeSrc({
      tilemaps: [{ name: 'world.tilemap', data: { rows: ['.#'], tileSize: 16, tiles: { '#': 'wall.png' }, properties: { '#': { solid: true } }, objects: [] } }],
    })
    expect(src).toContain('"world.tilemap"')
    expect(src).toContain('globalThis.hsArcadeTileMap')
    expect(src).toContain("source.get('tiles', {})")
    expect(src).toContain('def draw(self, tiles=None):')
  })
})
