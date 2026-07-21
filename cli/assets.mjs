import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { db, storage } from './firebase.mjs'
import { mergeStorageAssets } from '../src/shared/storageAssets.js'

function storagePath(lessonId, filename) {
  return `lessons/${lessonId}/assets/${filename}`
}

function buildDownloadUrl(bucketName, path, token) {
  const tokenParam = token ? `&token=${token}` : ''
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media${tokenParam}`
}

function validateFilename(filename) {
  if (!filename || typeof filename !== 'string') return 'filename is required'
  if (basename(filename) !== filename) return 'filename must not contain path components'
  if (filename.startsWith('.')) return 'filename must not start with a dot'
  return null
}

async function listStoredLessonAssets(lessonId) {
  const bucket = storage.bucket()
  const prefix = storagePath(lessonId, '')
  const [files] = await bucket.getFiles({ prefix })
  const assets = await Promise.all(files
    .filter(file => file.name !== prefix)
    .map(async file => {
      const [metadata] = await file.getMetadata()
      const token = metadata.metadata?.firebaseStorageDownloadTokens?.split(',')[0] ?? ''
      return {
        name: file.name.slice(prefix.length),
        url: buildDownloadUrl(bucket.name, file.name, token),
      }
    }))
  return assets.filter(asset => asset.name)
}

export async function listLessonAssets(lessonId) {
  const snap = await db.collection('lessons').doc(lessonId).get()
  if (!snap.exists) throw new Error(`Lesson '${lessonId}' not found`)
  const folderAssets = await listStoredLessonAssets(lessonId)
  return { lessonId, storageAssets: mergeStorageAssets(snap.data().storageAssets ?? [], folderAssets) }
}

export async function uploadLessonAsset(lessonId, filename, base64Content, mimeType = 'application/octet-stream') {
  if (!/^[a-z0-9-]+$/.test(lessonId)) {
    throw new Error('lessonId must be a lowercase slug (letters, digits, hyphens only)')
  }
  const filenameError = validateFilename(filename)
  if (filenameError) throw new Error(filenameError)

  const bucket = storage.bucket()
  const path = storagePath(lessonId, filename)
  const token = randomUUID()
  const buffer = Buffer.from(base64Content, 'base64')

  await bucket.file(path).save(buffer, {
    metadata: {
      contentType: mimeType,
      metadata: { firebaseStorageDownloadTokens: token },
    },
  })

  const url = buildDownloadUrl(bucket.name, path, token)

  const lessonRef = db.collection('lessons').doc(lessonId)
  const snap = await lessonRef.get()
  if (snap.exists) {
    const current = snap.data().storageAssets ?? []
    const updated = [...current.filter(a => a.name !== filename), { name: filename, url, showInEditor: true }]
    await lessonRef.update({ storageAssets: updated })
  }

  return { success: true, lessonId, filename, url, bytes: buffer.length }
}

export async function deleteLessonAsset(lessonId, filename) {
  const filenameError = validateFilename(filename)
  if (filenameError) throw new Error(filenameError)

  const bucket = storage.bucket()
  try {
    await bucket.file(storagePath(lessonId, filename)).delete()
  } catch (err) {
    if (err.code !== 404) throw err
  }

  const lessonRef = db.collection('lessons').doc(lessonId)
  const snap = await lessonRef.get()
  if (snap.exists) {
    const updated = (snap.data().storageAssets ?? []).filter(a => a.name !== filename)
    await lessonRef.update({ storageAssets: updated })
  }

  return { success: true, lessonId, filename }
}
