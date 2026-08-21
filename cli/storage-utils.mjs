import { basename } from 'node:path'

// Shared by assets.mjs (per-lesson Storage assets) and type-assets.mjs (per-lesson-type
// shared Storage assets) so both stay in sync on download-URL shape and filename rules.

export function buildDownloadUrl(bucketName, path, token) {
  const tokenParam = token ? `&token=${token}` : ''
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media${tokenParam}`
}

export function validateFilename(filename) {
  if (!filename || typeof filename !== 'string') return 'filename is required'
  if (basename(filename) !== filename) return 'filename must not contain path components'
  if (filename.startsWith('.')) return 'filename must not start with a dot'
  return null
}

export function validateSlug(value, label) {
  if (!/^[a-z0-9-]+$/.test(value ?? '')) {
    throw new Error(`${label} must be a lowercase slug (letters, digits, hyphens only)`)
  }
}

export async function listBucketAssets(bucket, prefix) {
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
