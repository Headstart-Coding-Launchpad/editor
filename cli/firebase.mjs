import { readFile } from 'node:fs/promises'
import { join, dirname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp, getApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.stderr.write(
    'ERROR: GOOGLE_APPLICATION_CREDENTIALS is not set.\n' +
    'Add it to cli/.env or set it in your shell environment.\n' +
    'Download the service account JSON from: Firebase Console → Project Settings → Service Accounts\n'
  )
  process.exit(1)
}

const __dirname = dirname(fileURLToPath(import.meta.url))

// Resolve a relative path against the cli/ directory so cli/.env can use bare filenames.
if (!isAbsolute(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = join(__dirname, process.env.GOOGLE_APPLICATION_CREDENTIALS)
}
const firebaseRcPath = join(__dirname, '..', '.firebaserc')

async function resolveProjectId() {
  const envProjectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT

  if (envProjectId) return envProjectId

  try {
    const raw = await readFile(firebaseRcPath, 'utf-8')
    return JSON.parse(raw)?.projects?.default ?? null
  } catch {
    return null
  }
}

const projectId = await resolveProjectId()
const storageBucket =
  process.env.FIREBASE_STORAGE_BUCKET ||
  (projectId ? `${projectId}.firebasestorage.app` : undefined)

try {
  getApp()
} catch {
  initializeApp({ ...(projectId ? { projectId } : {}), ...(storageBucket ? { storageBucket } : {}) })
}

export const db = getFirestore()
export const storage = getStorage()
