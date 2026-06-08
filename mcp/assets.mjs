import { z } from 'zod'
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

export function registerAssetTools(server) {
  server.tool(
    'list_lesson_assets',
    'List Firebase Storage asset files for a lesson. Returns the storageAssets array from the lesson document in Firestore.',
    { lessonId: z.string().describe('Lesson ID slug') },
    async ({ lessonId }) => {
      try {
        const snap = await db.collection('lessons').doc(lessonId).get()
        if (!snap.exists) {
          return { content: [{ type: 'text', text: JSON.stringify({ lessonId, storageAssets: [], note: 'Lesson not found in Firestore' }) }] }
        }
        const storageAssets = snap.data().storageAssets ?? []
        return { content: [{ type: 'text', text: JSON.stringify({ lessonId, storageAssets }) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: err.message }) }] }
      }
    }
  )

  server.tool(
    'upload_lesson_asset',
    'Upload a base64-encoded asset file to Firebase Storage at lessons/{lessonId}/assets/{filename}. Returns the download URL and updates storageAssets on the lesson document in Firestore.',
    {
      lessonId: z.string().describe('Lesson ID slug (e.g. "html-3-7")'),
      filename: z.string().describe('Filename with extension (e.g. "hero.png")'),
      base64Content: z.string().describe('File contents as a base64-encoded string'),
      mimeType: z.string().optional().describe('MIME type (e.g. "image/png"). Defaults to "application/octet-stream".'),
    },
    async ({ lessonId, filename, base64Content, mimeType = 'application/octet-stream' }) => {
      if (!/^[a-z0-9-]+$/.test(lessonId)) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'lessonId must be a lowercase slug (letters, digits, hyphens only)' }) }] }
      }
      const filenameError = validateFilename(filename)
      if (filenameError) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: filenameError }) }] }
      }

      try {
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

        // Update storageAssets on the lesson if it exists in Firestore
        const lessonRef = db.collection('lessons').doc(lessonId)
        const snap = await lessonRef.get()
        if (snap.exists) {
          const current = snap.data().storageAssets ?? []
          const updated = [...current.filter(a => a.name !== filename), { name: filename, url, showInEditor: false }]
          await lessonRef.update({ storageAssets: updated })
        }

        return { content: [{ type: 'text', text: JSON.stringify({ success: true, lessonId, filename, url, bytes: buffer.length }) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: err.message }) }] }
      }
    }
  )

  server.tool(
    'delete_lesson_asset',
    'Delete an asset file from Firebase Storage and remove it from storageAssets on the lesson document in Firestore.',
    {
      lessonId: z.string().describe('Lesson ID slug'),
      filename: z.string().describe('Filename to delete'),
    },
    async ({ lessonId, filename }) => {
      const filenameError = validateFilename(filename)
      if (filenameError) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: filenameError }) }] }
      }

      try {
        const bucket = storage.bucket()
        try {
          await bucket.file(storagePath(lessonId, filename)).delete()
        } catch (err) {
          if (err.code !== 404) throw err
          // File absent from Storage — still clean up Firestore below
        }

        const lessonRef = db.collection('lessons').doc(lessonId)
        const snap = await lessonRef.get()
        if (snap.exists) {
          const updated = (snap.data().storageAssets ?? []).filter(a => a.name !== filename)
          await lessonRef.update({ storageAssets: updated })
        }

        return { content: [{ type: 'text', text: JSON.stringify({ success: true, lessonId, filename }) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: err.message }) }] }
      }
    }
  )
}
