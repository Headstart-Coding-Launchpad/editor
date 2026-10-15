#!/usr/bin/env node
// HSC Audit visual review: removes everything a run leaves behind for the test
// lesson: its live-session nodes in the Realtime Database, its Firestore lesson
// document with every subcollection (session reports, feedback), and nothing else.
//
//   node scripts/hsc-audit/cleanup.mjs            # dry run: lists what it would remove
//   node scripts/hsc-audit/cleanup.mjs --apply    # removes it
//
// The test tutor account (audit-tutor@headstartcoding.test) is kept for the next term.

import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LESSON_ID } from './build-lesson.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repo = resolve(__dirname, '../..')
const cliDir = dirname(process.env.HSC_CLI || join(repo, 'cli', 'cli.mjs'))
const require = createRequire(join(cliDir, 'package.json'))
require('dotenv').config({ path: join(cliDir, '.env') })
// The app's .env has the Realtime Database URL, API key and test tutor login
// (HSC_ENV points at another one, e.g. the main checkout's from a worktree).
require('dotenv').config({ path: process.env.HSC_ENV || join(repo, '.env') })
const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (creds && !/^[A-Za-z]:|^\//.test(creds))
  process.env.GOOGLE_APPLICATION_CREDENTIALS = join(cliDir, creds)

const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')

const rc = JSON.parse(readFileSync(join(repo, '.firebaserc'), 'utf8'))
const projectId = rc.projects.default
initializeApp({ projectId, credential: applicationDefault() })
const RTDB = process.env.VITE_FIREBASE_DATABASE_URL

const apply = process.argv.includes('--apply')
// Every top-level RTDB node keyed by lesson id, read from the rules so new ones are included.
const rulesText = readFileSync(join(repo, 'database.rules.json'), 'utf8').replace(
  /^\s*\/\/.*$/gm,
  ''
)
const rules = JSON.parse(rulesText).rules
const lessonKeyed = Object.entries(rules)
  .filter(([, v]) => v && typeof v === 'object' && Object.keys(v).some((k) => k.startsWith('$')))
  .map(([k]) => k)

// RTDB: the CLI's service account has no Realtime Database access, so sign in
// as the test tutor and use its own teacher rights (the rules let teachers write
// every lesson-keyed node).
const signIn = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.VITE_FIREBASE_API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.AUDIT_TUTOR_EMAIL,
      password: process.env.AUDIT_TUTOR_PASSWORD,
      returnSecureToken: true,
    }),
  }
).then((r) => r.json())
if (!signIn.idToken) throw new Error(`Test tutor sign-in failed: ${signIn.error?.message}`)
const rtdb = (path, method = 'GET') =>
  fetch(`${RTDB}/${path}.json?auth=${signIn.idToken}${method === 'GET' ? '&shallow=true' : ''}`, {
    method,
  }).then((r) => r.json())
for (const top of lessonKeyed) {
  const path = `${top}/${LESSON_ID}`
  const found = await rtdb(path)
  if (found == null) continue
  // Some nodes can be deleted by a teacher but not read whole; try those anyway.
  const note = found.error ? ' (not readable whole, trying anyway)' : ''
  console.log(`${apply ? 'Removing' : 'Would remove'} RTDB ${path}${note}`)
  if (!apply) continue
  const res = await rtdb(path, 'DELETE')
  if (res?.error) console.warn(`  could not remove ${path}: ${res.error}`)
}

const fs = getFirestore()
const lessonDoc = fs.collection('lessons').doc(LESSON_ID)
if ((await lessonDoc.get()).exists) {
  for (const sub of await lessonDoc.listCollections()) {
    const n = (await sub.count().get()).data().count
    console.log(`${apply ? 'Removing' : 'Would remove'} lessons/${LESSON_ID}/${sub.id} (${n} docs)`)
  }
  console.log(`${apply ? 'Removing' : 'Would remove'} lessons/${LESSON_ID}`)
  if (apply) await fs.recursiveDelete(lessonDoc)
}
console.log(apply ? 'Clean.' : 'Dry run only. Add --apply to remove.')
process.exit(0)
