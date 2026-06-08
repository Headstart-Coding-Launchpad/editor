import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp, getApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.stderr.write(
    'ERROR: GOOGLE_APPLICATION_CREDENTIALS is not set.\n' +
    'Set it to the path of your Firebase service account JSON file.\n' +
    'Download from: Firebase Console → Project Settings → Service Accounts → Generate new private key\n'
  )
  process.exit(1)
}

const __dirname = dirname(fileURLToPath(import.meta.url))
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
