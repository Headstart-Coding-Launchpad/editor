import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { db, storage } from './firebase.mjs'

function storagePath(lessonId, filename) {
  return `lessons/${lessonId}/assets/${filename}`
}

function buildDownloadUrl(bucketName, path, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=${token}`
}

function validateFilename(filename) {
  if (!filename || typeof filename !== 'string') return 'filename is required'
  if (basename(filename) !== filename) return 'filename must not contain path components'
  if (filename.startsWith('.')) return 'filename must not start with a dot'
  return null
}

export async function listLessonAssets(lessonId) {
  const snap = await db.collection('lessons').doc(lessonId).get()
  if (!snap.exists) throw new Error(`Lesson '${lessonId}' not found`)
  return { lessonId, storageAssets: snap.data().storageAssets ?? [] }
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
    const updated = [...current.filter(a => a.name !== filename), { name: filename, url, showInEditor: false }]
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
