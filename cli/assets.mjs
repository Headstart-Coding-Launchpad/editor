import { randomUUID } from 'node:crypto'
import { db, storage } from './firebase.mjs'
import { mergeStorageAssets } from '../src/shared/storageAssets.js'
import {
  buildDownloadUrl,
  validateFilename,
  validateSlug,
  listBucketAssets,
} from './storage-utils.mjs'

function storagePath(lessonId, filename) {
  return `lessons/${lessonId}/assets/${filename}`
}

export async function listLessonAssets(lessonId) {
  const snap = await db.collection('lessons').doc(lessonId).get()
  if (!snap.exists) throw new Error(`Lesson '${lessonId}' not found`)
  const folderAssets = await listBucketAssets(storage.bucket(), storagePath(lessonId, ''))
  return {
    lessonId,
    storageAssets: mergeStorageAssets(snap.data().storageAssets ?? [], folderAssets),
  }
}

export async function uploadLessonAsset(
  lessonId,
  filename,
  base64Content,
  mimeType = 'application/octet-stream'
) {
  validateSlug(lessonId, 'lessonId')
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
    const updated = [
      ...current.filter((a) => a.name !== filename),
      { name: filename, url, showInEditor: true },
    ]
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
    const updated = (snap.data().storageAssets ?? []).filter((a) => a.name !== filename)
    await lessonRef.update({ storageAssets: updated })
  }

  return { success: true, lessonId, filename }
}
