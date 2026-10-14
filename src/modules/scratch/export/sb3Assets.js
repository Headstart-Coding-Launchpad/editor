// Browser half of the .sb3 export: draws every costume and backdrop to a PNG (emoji and the
// built-in shapes with the stage's own drawing code; image costumes fetched CORS-safely), turns
// sounds into files (synth sounds rendered offline to WAV, audio files fetched), names each
// asset by the MD5 of its bytes, then zips project.json and the assets with fflate.
import { md5 } from '../../../shared/md5.js'
import { buildZip } from '../../../shared/exportWork/zip.js'
import {
  canvasToPngBytes,
  loadImage,
  makeCanvas,
  fetchBytes,
} from '../../../shared/exportWork/pictures.js'
import { resolveAssetFileUrl } from '../../../shared/assetPaths'
import {
  STAGE_H,
  STAGE_W,
  drawEmojiAtOrigin,
  drawScratchSpriteAtOrigin,
} from '../ScratchWorkspace.jsx'
import { getSynthSound, renderSynthSound, resolveSpriteSounds } from '../scratchSounds.js'
import { buildSb3Project, describeAsset } from './sb3Translator.js'
import { spriteCostumes } from './projectModel.js'
import { encodeWav } from './wav.js'

// A sprite at size 100 is 48 stage pixels across (radius 24, see ScratchWorkspace's
// spriteTransform). Costumes are drawn at 2× and marked bitmapResolution 2, so they show at
// the same size in Scratch.
const COSTUME_PX = 96
const SOUND_RATE = 22050

async function emojiFontReady() {
  try {
    await document.fonts?.load("48px 'Noto Color Emoji'")
  } catch {
    // Falls back to the system emoji font.
  }
}

/**
 * An image cache for every costume/backdrop image the project uses, keyed by resolved URL as
 * the stage drawing expects: `{ url: HTMLImageElement }`, plus the raw bytes for SVG costumes.
 * Images that can't be fetched (no CORS on the host) are left out and noted.
 */
export async function loadProjectImages(model, assetsPath, notes) {
  const urls = new Set()
  for (const sprite of model.sprites) {
    for (const costume of sprite.costumes ?? []) {
      if (costume.image) urls.add(resolveAssetFileUrl(assetsPath, costume.image))
    }
  }
  for (const backdrop of model.backdrops) {
    if (backdrop.image) urls.add(resolveAssetFileUrl(assetsPath, backdrop.image))
  }
  const images = {}
  await Promise.all(
    [...urls].filter(Boolean).map(async (url) => {
      try {
        images[url] = (await loadImage(url)).img
      } catch (error) {
        notes.push(`Couldn't download the image ${url.split('/').pop()} (${error.message}).`)
      }
    })
  )
  return images
}

/** One costume drawn on a square canvas `size` px across, as the stage draws it. */
export function drawCostumeCanvas(sprite, costume, images, assetsPath, size = COSTUME_PX) {
  const canvas = makeCanvas(size, size)
  const ctx = canvas.getContext('2d')
  const r = size / 2
  const url = costume?.image ? resolveAssetFileUrl(assetsPath, costume.image) : ''
  const img = url ? images[url] : null
  ctx.save()
  ctx.translate(r, r)
  if (img) {
    ctx.drawImage(img, -r, -r, size, size)
  } else if (costume?.emoji || sprite?.emoji) {
    drawEmojiAtOrigin(ctx, costume?.emoji || sprite.emoji, r)
  } else {
    drawScratchSpriteAtOrigin(ctx, sprite?.type ?? 'cat', r * 0.94)
  }
  ctx.restore()
  return canvas
}

/** One backdrop drawn at stage size. */
export function drawBackdropCanvas(backdrop, images, assetsPath) {
  const canvas = makeCanvas(STAGE_W, STAGE_H)
  const ctx = canvas.getContext('2d')
  const url = backdrop?.image ? resolveAssetFileUrl(assetsPath, backdrop.image) : ''
  const img = url ? images[url] : null
  if (img) {
    ctx.drawImage(img, 0, 0, STAGE_W, STAGE_H)
  } else {
    ctx.fillStyle = backdrop?.colour ?? '#ffffff'
    ctx.fillRect(0, 0, STAGE_W, STAGE_H)
  }
  return canvas
}

function soundFormat(path) {
  const clean = String(path ?? '')
    .split(/[?#]/)[0]
    .toLowerCase()
  if (clean.endsWith('.mp3')) return 'mp3'
  if (clean.endsWith('.wav')) return 'wav'
  return null
}

async function decodeInfo(bytes) {
  const Offline =
    typeof window !== 'undefined'
      ? window.OfflineAudioContext || window.webkitOfflineAudioContext
      : null
  if (!Offline) return null
  try {
    const ctx = new Offline(1, 1, 44100)
    const buffer = await ctx.decodeAudioData(bytes.slice().buffer)
    return { rate: buffer.sampleRate, sampleCount: buffer.length }
  } catch {
    return null
  }
}

/** One sound as a file: { bytes, desc } or null (noted). */
async function soundAsset(sound, assetsPath, spriteName, notes) {
  // A sound file: `audio` (a lesson/library path), or `url` already resolved (library sounds a
  // student added carry both).
  const audioPath = sound?.audio || sound?.url
  if (audioPath) {
    const format = soundFormat(audioPath)
    if (!format) {
      notes.push(`${spriteName}: sound "${sound.name}" isn't MP3 or WAV, so it was left out.`)
      return null
    }
    try {
      const bytes = await fetchBytes(resolveAssetFileUrl(assetsPath, audioPath))
      const info = (await decodeInfo(bytes)) ?? { rate: 44100, sampleCount: 0 }
      const hash = md5(bytes)
      return {
        bytes,
        desc: describeAsset(hash, format, { name: sound.name, format: '', ...info }),
      }
    } catch (error) {
      notes.push(
        `${spriteName}: couldn't download sound "${sound.name}" (${error.message}); left out. Storage CORS must allow this site.`
      )
      return null
    }
  }
  const synth = getSynthSound(sound?.synth) ?? getSynthSound('pop')
  const rendered = await renderSynthSound(synth, SOUND_RATE)
  if (!rendered) {
    notes.push(`${spriteName}: sound "${sound?.name}" couldn't be made in this browser.`)
    return null
  }
  const bytes = encodeWav(rendered.samples, rendered.sampleRate)
  return {
    bytes,
    desc: describeAsset(md5(bytes), 'wav', {
      name: sound?.name ?? 'sound',
      format: '',
      rate: rendered.sampleRate,
      sampleCount: rendered.samples.length,
    }),
  }
}

async function pngAsset(canvas, name, extra) {
  const bytes = await canvasToPngBytes(canvas)
  return { bytes, desc: describeAsset(md5(bytes), 'png', { name, ...extra }) }
}

/**
 * The student's project as a .sb3 (bytes) from a resolved model (./projectModel.js).
 * Returns { sb3, project, unmapped, notes }.
 */
export async function buildSb3({ model, assetsPath, images, notes = [] }) {
  await emojiFontReady()
  const assets = new Map() // md5ext → bytes (identical assets are stored once)
  const keep = (asset) => {
    if (asset) assets.set(asset.desc.md5ext, asset.bytes)
    return asset?.desc ?? null
  }

  const sprites = []
  for (const sprite of model.sprites) {
    const state = model.spriteStates[sprite.id] ?? {}
    const costumeList = spriteCostumes(sprite)
    const costumes = []
    for (const costume of costumeList) {
      const canvas = drawCostumeCanvas(sprite, costume, images, assetsPath)
      costumes.push(
        keep(
          await pngAsset(canvas, costume.name || `costume${costumes.length + 1}`, {
            bitmapResolution: 2,
            rotationCenterX: COSTUME_PX / 2,
            rotationCenterY: COSTUME_PX / 2,
          })
        )
      )
    }
    const sounds = []
    for (const sound of resolveSpriteSounds(sprite)) {
      const desc = keep(await soundAsset(sound, assetsPath, sprite.name, notes))
      if (desc) sounds.push(desc)
    }
    const costumeIndex = costumeList.findIndex((c) => c.name === state.costume)
    sprites.push({
      id: sprite.id,
      name: sprite.name,
      blocksState: model.blocksBySprite[sprite.id],
      costumes,
      sounds,
      currentCostume: costumeIndex >= 0 ? costumeIndex : 0,
      x: state.x,
      y: state.y,
      size: state.size,
      direction: state.direction,
      visible: state.visible,
      rotationStyle: state.rotationStyle,
    })
  }

  const backdropList = model.backdrops.length ? model.backdrops : [{ name: 'backdrop1' }]
  const stageCostumes = []
  for (const backdrop of backdropList) {
    stageCostumes.push(
      keep(
        await pngAsset(
          drawBackdropCanvas(backdrop, images, assetsPath),
          backdrop.name || `backdrop${stageCostumes.length + 1}`,
          { bitmapResolution: 1, rotationCenterX: STAGE_W / 2, rotationCenterY: STAGE_H / 2 }
        )
      )
    )
  }
  const backdropIndex = backdropList.findIndex((b) => b.name === model.backdropName)

  const { project, unmapped } = buildSb3Project({
    sprites,
    stage: {
      blocksState: model.stageBlocks,
      costumes: stageCostumes,
      sounds: [],
      currentCostume: backdropIndex >= 0 ? backdropIndex : 0,
    },
    variables: model.variables,
  })

  const sb3 = await buildZip([
    { name: 'project.json', data: JSON.stringify(project) },
    ...[...assets.entries()].map(([name, data]) => ({ name, data })),
  ])
  return { sb3, project, unmapped, notes }
}
