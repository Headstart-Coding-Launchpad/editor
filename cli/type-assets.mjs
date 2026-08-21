import { randomUUID } from 'node:crypto'
import { db, storage } from './firebase.mjs'
import { mergeStorageAssets } from '../src/shared/storageAssets.js'
import { buildDownloadUrl, validateFilename, validateSlug, listBucketAssets } from './storage-utils.mjs'
import {
  normalizeSpritePresets,
  normalizeBackdropPresets,
  createBackdropFromPreset,
} from '../src/shared/spritePresets.js'

// Mirrors the admin "Shared Assets" panel: lesson-type-wide files and Scratch defaults
// live in Firestore `lessonTypeAssets/{type}`, with files in Storage under `shared/{type}/assets/`.

function storagePath(type, filename) {
  return `shared/${type}/assets/${filename}`
}

function typeAssetsRef(type) {
  return db.collection('lessonTypeAssets').doc(type)
}

function normalizeListInput(input, key) {
  if (Array.isArray(input)) return input
  if (input && Array.isArray(input[key])) return input[key]
  throw new Error(`Expected an array or an object with a "${key}" array`)
}

function assertScratchType(type, feature) {
  if (type !== 'scratch') throw new Error(`${feature} is only supported for the 'scratch' lesson type`)
}

export async function listTypeAssets(type) {
  validateSlug(type, 'type')
  const snap = await typeAssetsRef(type).get()
  const data = snap.exists ? snap.data() : {}
  const folderAssets = await listBucketAssets(storage.bucket(), storagePath(type, ''))
  return {
    type,
    storageAssets: mergeStorageAssets(data.storageAssets ?? [], folderAssets),
    defaultSprites: data.defaultSprites ?? [],
    defaultBackdrops: data.defaultBackdrops ?? [],
  }
}

export async function uploadTypeAsset(type, filename, base64Content, mimeType = 'application/octet-stream') {
  validateSlug(type, 'type')
  const filenameError = validateFilename(filename)
  if (filenameError) throw new Error(filenameError)

  const bucket = storage.bucket()
  const path = storagePath(type, filename)
  const token = randomUUID()
  const buffer = Buffer.from(base64Content, 'base64')

  await bucket.file(path).save(buffer, {
    metadata: {
      contentType: mimeType,
      metadata: { firebaseStorageDownloadTokens: token },
    },
  })

  const url = buildDownloadUrl(bucket.name, path, token)

  const ref = typeAssetsRef(type)
  const snap = await ref.get()
  const current = snap.exists ? (snap.data().storageAssets ?? []) : []
  const updated = [...current.filter(a => a.name !== filename), { name: filename, url, showInEditor: false }]
  await ref.set({ storageAssets: updated }, { merge: true })

  return { success: true, type, filename, url, bytes: buffer.length }
}

export async function setDefaultSprites(type, input) {
  validateSlug(type, 'type')
  assertScratchType(type, 'Default sprites')
  const sprites = normalizeSpritePresets(normalizeListInput(input, 'sprites'))
  await typeAssetsRef(type).set({ defaultSprites: sprites }, { merge: true })
  return { success: true, type, count: sprites.length, defaultSprites: sprites }
}

// Uploads a local image to the type's shared assets and, in the same call, appends it as a
// new default backdrop entry — the admin panel requires two separate steps for this.
export async function uploadDefaultBackdrop(type, filename, base64Content, mimeType, { id, name, colour } = {}) {
  validateSlug(type, 'type')
  assertScratchType(type, 'Default backdrops')

  const uploadResult = await uploadTypeAsset(type, filename, base64Content, mimeType)

  const ref = typeAssetsRef(type)
  const snap = await ref.get()
  const existingBackdrops = normalizeBackdropPresets(snap.exists ? snap.data().defaultBackdrops : [])

  let backdrop
  if (id) {
    if (existingBackdrops.some(b => b.id === id)) throw new Error(`Backdrop id '${id}' already exists`)
    backdrop = { id, name: name ?? id, colour: colour ?? '#ffffff', image: uploadResult.url }
  } else {
    const generated = createBackdropFromPreset(existingBackdrops, null)
    backdrop = { ...generated, ...(name ? { name } : {}), ...(colour ? { colour } : {}), image: uploadResult.url }
  }

  await ref.set({ defaultBackdrops: [...existingBackdrops, backdrop] }, { merge: true })

  return { success: true, type, backdrop, asset: uploadResult }
}
