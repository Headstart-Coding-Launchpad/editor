/**
 * One-off migration: reads all lesson JSON files from public/lessons/
 * and writes each as a document to Firestore lessons/{id}.
 *
 * Usage:
 *   node scripts/migrate-lessons.mjs [--dry-run]
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS to be set to a service account JSON file,
 * or run inside the Firebase Cloud Shell where ADC is already configured.
 *
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   node scripts/migrate-lessons.mjs --dry-run
 *   node scripts/migrate-lessons.mjs
 */

import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp, cert, getApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDryRun  = process.argv.includes('--dry-run')
const lessonsDir = join(__dirname, '..', 'public', 'lessons')

// Initialise Firebase Admin — uses ADC if GOOGLE_APPLICATION_CREDENTIALS is set
try {
  getApp()
} catch {
  initializeApp()
}

const db = getFirestore()

async function main() {
  const files = (await readdir(lessonsDir)).filter(f => f.endsWith('.json'))
  console.log(`Found ${files.length} lesson files.${isDryRun ? ' (DRY RUN — no writes)' : ''}`)

  let success = 0
  let failed  = 0

  for (const file of files) {
    const filePath = join(lessonsDir, file)
    try {
      const raw  = await readFile(filePath, 'utf-8')
      const data = JSON.parse(raw)
      const id   = data.id ?? file.replace('.json', '')

      if (!id) {
        console.warn(`  SKIP ${file} — no id field found`)
        failed++
        continue
      }

      if (isDryRun) {
        console.log(`  DRY  ${id} (${file})`)
      } else {
        await db.collection('lessons').doc(id).set(data)
        console.log(`  OK   ${id}`)
      }
      success++
    } catch (err) {
      console.error(`  FAIL ${file}: ${err.message}`)
      failed++
    }
  }

  console.log(`\nDone. ${success} succeeded, ${failed} failed.`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => { console.error(err); process.exit(1) })
