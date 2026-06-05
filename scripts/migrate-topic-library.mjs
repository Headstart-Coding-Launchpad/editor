/**
 * One-off migration: reads public/assets/topic-library.json
 * and writes each topic as a document to Firestore topicLibrary/{id}.
 *
 * Usage:
 *   node scripts/migrate-topic-library.mjs [--dry-run]
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS to be set to a service account JSON file,
 * or run inside the Firebase Cloud Shell where ADC is already configured.
 * Uses FIREBASE_PROJECT_ID / GCLOUD_PROJECT / GOOGLE_CLOUD_PROJECT when set,
 * otherwise falls back to the default project in .firebaserc.
 *
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   export FIREBASE_PROJECT_ID=headstartcoding-repl
 *   node scripts/migrate-topic-library.mjs --dry-run
 *   node scripts/migrate-topic-library.mjs
 */

import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp, getApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDryRun  = process.argv.includes('--dry-run')
const srcPath   = join(__dirname, '..', 'public', 'assets', 'topic-library.json')
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

async function main() {
  const projectId = await resolveProjectId()

  try {
    getApp()
  } catch {
    initializeApp(projectId ? { projectId } : undefined)
  }

  if (!projectId) {
    console.warn(
      'No Firebase project ID found. Set FIREBASE_PROJECT_ID or add a default project to .firebaserc.'
    )
  } else {
    console.log(`Using Firebase project: ${projectId}`)
  }

  const db = getFirestore()
  const raw  = await readFile(srcPath, 'utf-8')
  const data = JSON.parse(raw)
  const topics = Array.isArray(data) ? data : data?.topics
  if (!Array.isArray(topics)) throw new Error('topic-library.json has no topics array')

  console.log(`Found ${topics.length} topics.${isDryRun ? ' (DRY RUN — no writes)' : ''}`)

  let success = 0
  let failed  = 0

  for (const topic of topics) {
    const id = topic.id
    if (!id) {
      console.warn(`  SKIP <no id>: ${JSON.stringify(topic).slice(0, 60)}`)
      failed++
      continue
    }
    if (isDryRun) {
      console.log(`  DRY  ${id}`)
    } else {
      try {
        await db.collection('topicLibrary').doc(id).set(topic)
        console.log(`  OK   ${id}`)
      } catch (err) {
        console.error(`  FAIL ${id}: ${err.message}`)
        failed++
        continue
      }
    }
    success++
  }

  console.log(`\nDone. ${success} succeeded, ${failed} failed.`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => { console.error(err); process.exit(1) })
