// Scratch "looks" graphic effects (set/change/clear graphic effect blocks).
//
// The runtime stores each effect as `effect_<name>` on sprite state. This module turns
// those numbers into pixels, porting the maths from Scratch 3's sprite shader
// (scratch-render, src/shaders/sprite.frag) so effects look the way students expect.
//
// Two paths:
// - Pixel path: draw the sprite unrotated into a small offscreen canvas, remap its
//   pixels with applyGraphicEffectsToPixels, then draw that onto the stage. Exact for all
//   seven effects.
// - Fallback path: a costume image loaded from another origin (e.g. Firebase Storage)
//   taints the canvas, so its pixels can't be read. Ghost, colour and brightness then use
//   canvas alpha and CSS filters, and pixelate/mosaic are drawn with scaled drawImage
//   calls. Fisheye and whirl need pixel access and are skipped for those costumes.

export const GRAPHIC_EFFECT_NAMES = [
  'color',
  'fisheye',
  'whirl',
  'pixelate',
  'mosaic',
  'brightness',
  'ghost',
]

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function readGraphicEffects(state) {
  const effects = {}
  for (const name of GRAPHIC_EFFECT_NAMES) {
    const value = Number(state?.[`effect_${name}`])
    effects[name] = Number.isFinite(value) ? value : 0
  }
  return effects
}

export function hasGraphicEffects(effects) {
  return GRAPHIC_EFFECT_NAMES.some((name) => effects[name] !== 0)
}

// Shader uniforms, matching scratch-render's EffectTransform.
export function effectUniforms(effects) {
  return {
    color: effects.color / 200,
    fisheye: Math.max(0, (effects.fisheye + 100) / 100),
    whirl: (-effects.whirl * Math.PI) / 180,
    pixelate: Math.abs(effects.pixelate) / 10,
    mosaic: clamp(Math.round((Math.abs(effects.mosaic) + 10) / 10), 1, 512),
    brightness: clamp(effects.brightness, -100, 100) / 100,
    ghost: 1 - clamp(effects.ghost, 0, 100) / 100,
  }
}

function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h /= 6
    if (h < 0) h += 1
  }
  return [h, max === 0 ? 0 : delta / max, max]
}

function hsvToRgb(h, s, v) {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  switch (((i % 6) + 6) % 6) {
    case 0:
      return [v, t, p]
    case 1:
      return [q, v, p]
    case 2:
      return [p, v, t]
    case 3:
      return [p, q, v]
    case 4:
      return [t, p, v]
    default:
      return [v, p, q]
  }
}

// Returns a new RGBA buffer the same size as `source`, with every effect applied.
// `skinSize` is the sprite's drawn size in stage pixels, which sets the pixelate block size.
export function applyGraphicEffectsToPixels(source, width, height, effects, skinSize = width) {
  const u = effectUniforms(effects)
  const out = new Uint8ClampedArray(source.length)
  const pixelTexels = u.pixelate > 0 ? skinSize / u.pixelate : 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Texture coordinates of this pixel's centre, 0..1.
      let tx = (x + 0.5) / width
      let ty = (y + 0.5) / height

      if (effects.mosaic !== 0) {
        tx = (u.mosaic * tx) % 1
        ty = (u.mosaic * ty) % 1
      }
      if (pixelTexels > 0) {
        tx = (Math.floor(tx * pixelTexels) + 0.5) / pixelTexels
        ty = (Math.floor(ty * pixelTexels) + 0.5) / pixelTexels
      }
      if (effects.whirl !== 0) {
        const ox = tx - 0.5
        const oy = ty - 0.5
        const factor = Math.max(1 - Math.hypot(ox, oy) / 0.5, 0)
        const angle = u.whirl * factor * factor
        const sin = Math.sin(angle)
        const cos = Math.cos(angle)
        // GLSL mat2(cos, -sin, sin, cos) is column-major.
        tx = cos * ox + sin * oy + 0.5
        ty = -sin * ox + cos * oy + 0.5
      }
      if (effects.fisheye !== 0) {
        const vx = (tx - 0.5) / 0.5
        const vy = (ty - 0.5) / 0.5
        const length = Math.hypot(vx, vy)
        if (length > 0) {
          const r = Math.pow(Math.min(length, 1), u.fisheye) * Math.max(1, length)
          tx = 0.5 + r * (vx / length) * 0.5
          ty = 0.5 + r * (vy / length) * 0.5
        }
      }

      const dst = (y * width + x) * 4
      if (tx < 0 || tx >= 1 || ty < 0 || ty >= 1) continue // transparent
      const src = (Math.floor(ty * height) * width + Math.floor(tx * width)) * 4
      let r = source[src] / 255
      let g = source[src + 1] / 255
      let b = source[src + 2] / 255
      let a = source[src + 3] / 255
      if (a === 0) continue

      if (effects.color !== 0) {
        let [h, s, v] = rgbToHsv(r, g, b)
        if (v < 0.11 / 2) [h, s, v] = [0, 1, 0.11 / 2]
        else if (s < 0.09) [h, s] = [0, 0.09]
        ;[r, g, b] = hsvToRgb((((h + u.color) % 1) + 1) % 1, s, v)
      }
      if (effects.brightness !== 0) {
        r = clamp(r + u.brightness, 0, 1)
        g = clamp(g + u.brightness, 0, 1)
        b = clamp(b + u.brightness, 0, 1)
      }
      a *= u.ghost

      out[dst] = Math.round(r * 255)
      out[dst + 1] = Math.round(g * 255)
      out[dst + 2] = Math.round(b * 255)
      out[dst + 3] = Math.round(a * 255)
    }
  }
  return out
}

// CSS filter approximating colour and brightness, for costumes whose pixels can't be read.
export function fallbackCanvasFilter(effects) {
  const parts = []
  if (effects.color !== 0) parts.push(`hue-rotate(${(effects.color / 200) * 360}deg)`)
  if (effects.brightness !== 0) {
    parts.push(`brightness(${1 + clamp(effects.brightness, -100, 100) / 100})`)
  }
  return parts.length ? parts.join(' ') : 'none'
}

let scratchCanvas = null
function getScratchCanvas(size) {
  if (typeof document === 'undefined') return null
  scratchCanvas ??= document.createElement('canvas')
  scratchCanvas.width = size
  scratchCanvas.height = size
  return scratchCanvas
}

// Draws one sprite with its graphic effects. `transform` is {cx, cy, rot, flipH, r} in
// stage pixels; `drawAtOrigin(ctx)` draws the costume centred on (0, 0) within radius r.
// Returns false if effects couldn't be applied, so the caller draws the plain sprite.
export function drawSpriteWithGraphicEffects(ctx, effects, transform, drawAtOrigin) {
  const { cx, cy, rot, flipH, r } = transform
  // Shapes and emoji can reach slightly past r, so leave headroom for them.
  const size = Math.max(2, Math.ceil(r * 2.5))
  const canvas = getScratchCanvas(size)
  const off = canvas?.getContext('2d')
  if (!off) return false

  off.clearRect(0, 0, size, size)
  off.save()
  off.translate(size / 2, size / 2)
  drawAtOrigin(off)
  off.restore()

  let pixelsApplied = false
  try {
    const image = off.getImageData(0, 0, size, size)
    const pixels = applyGraphicEffectsToPixels(image.data, size, size, effects, r * 2)
    image.data.set(pixels)
    off.putImageData(image, 0, 0)
    pixelsApplied = true
  } catch {
    // Tainted by a cross-origin costume image: use the fallback path below, and start the
    // next sprite on a fresh canvas, since browsers may keep a canvas tainted after clearing.
    scratchCanvas = null
  }

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  if (flipH) ctx.scale(-1, 1)
  if (pixelsApplied) {
    ctx.drawImage(canvas, -size / 2, -size / 2)
  } else {
    const u = effectUniforms(effects)
    ctx.globalAlpha *= u.ghost
    ctx.filter = fallbackCanvasFilter(effects)
    drawFallbackTiles(ctx, canvas, size, effects, u)
  }
  ctx.restore()
  return true
}

function drawFallbackTiles(ctx, canvas, size, effects, u) {
  const tiles = effects.mosaic !== 0 ? u.mosaic : 1
  const tileSize = size / tiles
  const blocks = u.pixelate > 0 ? Math.max(1, Math.round((size * 0.8) / u.pixelate)) : 0
  ctx.imageSmoothingEnabled = blocks === 0
  for (let row = 0; row < tiles; row++) {
    for (let col = 0; col < tiles; col++) {
      const x = -size / 2 + col * tileSize
      const y = -size / 2 + row * tileSize
      if (blocks > 0) {
        const tiny = getTinyCanvas(blocks)
        const tinyCtx = tiny?.getContext('2d')
        if (!tinyCtx) continue
        tinyCtx.clearRect(0, 0, blocks, blocks)
        tinyCtx.drawImage(canvas, 0, 0, blocks, blocks)
        ctx.drawImage(tiny, x, y, tileSize, tileSize)
      } else {
        ctx.drawImage(canvas, x, y, tileSize, tileSize)
      }
    }
  }
}

let tinyCanvas = null
function getTinyCanvas(size) {
  if (typeof document === 'undefined') return null
  tinyCanvas ??= document.createElement('canvas')
  tinyCanvas.width = size
  tinyCanvas.height = size
  return tinyCanvas
}
