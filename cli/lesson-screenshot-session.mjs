// `hsc lessons screenshot`, session views: the tutor page, the student grid, a student's modal,
// the Shared work gallery and a student's own screen in a live session.
//
// These need a real live session, so they never touch the lesson itself. The CLI copies the
// lesson to a throwaway draft ("[Screenshot] …", id `shot-…`), the test tutor
// (AUDIT_TUTOR_EMAIL / AUDIT_TUTOR_PASSWORD, as for scripts/hsc-audit) runs a session on it with
// made-up "Test …" students, and afterwards the copy, its session reports and every lesson-keyed
// Realtime Database node are deleted, even when a shot fails.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findShotTask, replaceTask, shotTaskId } from './lesson-screenshot-input.mjs'
import { clickByName, runTask, withTrailingSlash, writeShot } from './lesson-screenshot.mjs'
import { encodeLessonForFirestore } from '../src/shared/lessonBlocksCodec.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ENV_KEYS = [
  'AUDIT_TUTOR_EMAIL',
  'AUDIT_TUTOR_PASSWORD',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_DATABASE_URL',
]

function parseEnvFile(path) {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => l.split(/=(.*)/s).slice(0, 2))
      .map(([k, v]) => [k, v.trim().replace(/^["']|["']$/g, '')])
  )
}

// The test tutor login and the app's Firebase keys: the shell or cli/.env first, then HSC_ENV,
// then the repo-root .env.
export function readSessionEnv(env = process.env) {
  const found = {}
  const files = [env.HSC_ENV, join(ROOT, '.env')].filter((p) => p && existsSync(p))
  const sources = [env, ...files.map(parseEnvFile)]
  for (const key of ENV_KEYS) found[key] = sources.map((s) => s[key]).find(Boolean)
  const missing = ENV_KEYS.filter((k) => !found[k])
  if (missing.length) {
    throw new Error(
      `Session views need ${missing.join(', ')} (in cli/.env, the repo-root .env, or the file HSC_ENV names)`
    )
  }
  return found
}

export function throwawayLessonId(now = Date.now(), random = Math.random()) {
  return `shot-${now.toString(36)}${Math.floor(random * 1e6).toString(36)}`
}

// shareTaskIds: tasks a shot shares work on. Sharing shows only on tasks with allowSharing, so
// the copy (never the lesson) turns it on there.
export function buildThrowawayLesson(lesson, id, shareTaskIds = []) {
  let tasks = lesson.tasks
  for (const taskId of shareTaskIds) {
    tasks = replaceTask(tasks, taskId, (t) => ({ ...t, allowSharing: true }))
  }
  const copy = {
    ...lesson,
    id,
    tasks,
    title: `[Screenshot] ${lesson.title ?? lesson.id}`,
    draft: true,
  }
  // Out of every level, course and lineage, so nothing lists it as a real lesson.
  for (const key of ['levelId', 'level', 'companionOf', 'fork', 'forkOf', 'sourceLessonId']) {
    delete copy[key]
  }
  return copy
}

// Every top-level Realtime Database node keyed by lesson id, read from the rules so new ones
// are included (as scripts/hsc-audit/cleanup.mjs does).
export function lessonKeyedNodes(rulesText) {
  const rules = JSON.parse(rulesText.replace(/^\s*\/\/.*$/gm, '')).rules
  return Object.entries(rules)
    .filter(([, v]) => v && typeof v === 'object' && Object.keys(v).some((k) => k.startsWith('$')))
    .map(([k]) => k)
}

async function signInTutor(env) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.VITE_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: env.AUDIT_TUTOR_EMAIL,
        password: env.AUDIT_TUTOR_PASSWORD,
        returnSecureToken: true,
      }),
    }
  ).then((r) => r.json())
  if (!res.idToken) throw new Error(`Test tutor sign-in failed: ${res.error?.message}`)
  return res.idToken
}

// Removes the copy and everything its session wrote. The CLI's service account has no Realtime
// Database access, so those nodes go with the test tutor's own teacher rights.
async function removeThrowawayLesson(db, id, env, log) {
  if (!/^shot-[a-z0-9]+$/.test(id)) throw new Error(`Refusing to delete "${id}": not a shot copy`)
  const problems = []
  try {
    const token = await signInTutor(env)
    const nodes = lessonKeyedNodes(readFileSync(join(ROOT, 'database.rules.json'), 'utf8'))
    const call = (top, method, query = '') =>
      fetch(`${env.VITE_FIREBASE_DATABASE_URL}/${top}/${id}.json?auth=${token}${query}`, {
        method,
      }).then((r) => r.json().catch(() => null))
    for (const top of nodes) {
      const found = await call(top, 'GET', '&shallow=true')
      if (found == null) continue
      // Some nodes can be deleted by a teacher but not read whole; try those anyway.
      const res = await call(top, 'DELETE')
      if (res?.error && !found.error) problems.push(`${top}/${id}: ${res.error}`)
    }
  } catch (e) {
    problems.push(e.message)
  }
  // Ending the session made a share link per Test student (request #77); they go too.
  try {
    const reports = await db.collection('lessons').doc(id).collection('sessionReports').get()
    for (const report of reports.docs) {
      for (const link of report.data().shareLinks ?? []) {
        if (link?.shareId) await db.collection('sharedWork').doc(link.shareId).delete()
      }
    }
  } catch (e) {
    problems.push(`share links: ${e.message}`)
  }
  await db.recursiveDelete(db.collection('lessons').doc(id))
  if (problems.length) log(`! cleanup of ${id} left: ${problems.join('; ')}`)
  else log(`Removed the throwaway copy ${id}`)
}

const wait = (page, ms) => page.waitForTimeout(ms)
const btn = (page, name) => page.getByRole('button', { name }).first()

async function login(page, base, env) {
  await page.goto(`${base}#/login`)
  await page.fill('#email', env.AUDIT_TUTOR_EMAIL)
  await page.fill('#password', env.AUDIT_TUTOR_PASSWORD)
  await page.click('button[type=submit]')
  await page
    .waitForURL((u) => !String(u).includes('login'), { timeout: 30_000 })
    .catch(() => {
      throw new Error('The test tutor could not sign in')
    })
}

async function joinAsStudent(page, base, id, name) {
  await page.goto(`${base}#/lesson/${id}`)
  const input = page.getByPlaceholder('e.g. Jamie')
  await input.waitFor({ timeout: 30_000 }).catch(() => {
    throw new Error(`${name} could not reach the name box`)
  })
  await input.fill(name)
  await page.keyboard.press('Enter')
}

// Tutor: preview the task in the navigator, then move the whole class to it.
async function moveClassTo(tutor, title) {
  await btn(tutor, title)
    .click({ timeout: 10_000 })
    .catch(() => {
      throw new Error(`The tutor navigator has no "${title}" button`)
    })
  await wait(tutor, 800)
  const move = btn(tutor, /Move All to This Task/)
  if (await move.isVisible().catch(() => false)) await move.click()
  await wait(tutor, 2500)
}

// At tablet width the student grid folds into a rail on the right.
async function openGrid(tutor) {
  if (
    await tutor
      .getByTestId('student-grid')
      .isVisible()
      .catch(() => false)
  )
    return
  await tutor
    .getByRole('button', { name: /^‹( Show)?$/ })
    .last()
    .click({ timeout: 4000 })
  await wait(tutor, 800)
}

async function closeDialogs(page) {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape')
    await wait(page, 200)
  }
}

async function typeCode(page, code) {
  const editor = page.locator('[data-testid="task-workspace"] .cm-content').first()
  await editor.click({ timeout: 10_000 }).catch(() => {
    throw new Error('No code editor on this task')
  })
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  // One insert, so the editor's auto-indent and bracket closing leave the code as written.
  await page.keyboard.insertText(code)
}

async function shareAndApprove(student, tutor, name) {
  await student
    .getByRole('button', { name: 'Share with class' })
    .click({ timeout: 10_000 })
    .catch(() => {
      throw new Error(`${name} has no Share button on this task`)
    })
  const banner = tutor.getByTestId('share-request-banner').filter({ hasText: name }).first()
  await banner.waitFor({ timeout: 15_000 }).catch(() => {
    throw new Error(`The tutor never saw ${name}'s share request`)
  })
  await banner.getByRole('button', { name: 'Review' }).click()
  await btn(tutor, /Approve & share/)
    .click({ timeout: 10_000 })
    .catch(() => {
      throw new Error(`Could not approve ${name}'s share`)
    })
  await wait(tutor, 1000)
  await closeDialogs(tutor)
}

async function settle(page, ms) {
  await page.mouse.move(0, 0)
  await wait(page, ms)
}

async function captureOne({ shot, tutor, pages, outPath }) {
  const viewer = pages.get(shot.student)
  await settle(tutor, shot.wait ?? 1500)
  if (shot.view === 'tutor') return tutor.screenshot({ path: outPath })
  if (shot.view === 'tutor-grid') {
    await openGrid(tutor)
    return tutor.getByTestId('student-grid').screenshot({ path: outPath })
  }
  if (shot.view === 'student-modal') {
    await openGrid(tutor)
    await tutor
      .getByTestId('student-grid')
      .getByText(shot.student, { exact: true })
      .first()
      .click({ timeout: 6000 })
    await wait(tutor, 2000)
    await settle(tutor, 300)
    await tutor.screenshot({ path: outPath })
    return closeDialogs(tutor)
  }
  if (shot.view === 'shared-work') {
    await btn(viewer, /Shared work \(/)
      .click({ timeout: 10_000 })
      .catch(() => {
        throw new Error(`${shot.student} has no Shared work button (was anything approved?)`)
      })
    const dialog = viewer.getByRole('dialog', { name: 'Shared work' })
    await dialog.waitFor({ timeout: 6000 })
    await settle(viewer, 500)
    await dialog.screenshot({ path: outPath })
    // The gallery closes from its ✕ (or a click outside), not Escape.
    return dialog.getByRole('button', { name: 'Close' }).click({ timeout: 4000 })
  }
  // student-live
  await settle(viewer, shot.wait ?? 800)
  return writeShot(viewer, shot, outPath)
}

async function runSession({ browser, lesson, copyId, shots, base, scale, env, outPathFor, log }) {
  const { width, height, hasTouch } = shots[0]
  const newPage = async () =>
    (
      await browser.newContext({ viewport: { width, height }, hasTouch, deviceScaleFactor: scale })
    ).newPage()
  const names = [...new Set(shots.flatMap((s) => s.students.map((st) => st.name)))]
  const tutor = await newPage()
  const pages = new Map()
  const results = []
  try {
    await login(tutor, base, env)
    await tutor.goto(`${base}#/lesson/${copyId}?teacher=true`)
    await btn(tutor, 'Start Session')
      .waitFor({ timeout: 30_000 })
      .catch(() => {
        throw new Error('The tutor view never offered Start Session')
      })
    for (const name of names) {
      const page = await newPage()
      pages.set(name, page)
      await joinAsStudent(page, base, copyId, name)
    }
    await wait(tutor, 3000)
    await btn(tutor, 'Start Session').click()
    await wait(tutor, 4000)

    for (const shot of shots) {
      const outPath = outPathFor(shot)
      try {
        const task = findShotTask(lesson, shotTaskId(shot))
        await moveClassTo(tutor, task.title)
        for (const st of shot.students) {
          const page = pages.get(st.name)
          if (st.code != null) await typeCode(page, st.code)
          if (st.run) await runTask(page, st.inputs)
        }
        for (const st of shot.students.filter((s) => s.share)) {
          await shareAndApprove(pages.get(st.name), tutor, st.name)
        }
        for (const name of shot.click) await clickByName(pages.get(shot.student), name)
        for (const name of shot.tutorClick) {
          await clickByName(tutor, name)
          await wait(tutor, 500)
        }
        const { mkdir } = await import('node:fs/promises')
        await mkdir(dirname(outPath), { recursive: true })
        await captureOne({ shot, tutor, pages, outPath })
        results.push({ task: shotTaskId(shot), view: shot.view, crop: shot.crop, file: outPath })
        log(`✓ task ${shotTaskId(shot)} (${shot.view}) → ${outPath}`)
      } catch (e) {
        results.push({ task: shotTaskId(shot), view: shot.view, error: e.message.split('\n')[0] })
        log(`✗ task ${shotTaskId(shot)} (${shot.view}): ${e.message.split('\n')[0]}`)
        await closeDialogs(tutor).catch(() => {})
      }
    }

    // End the session so nobody's screen is left in it.
    await btn(tutor, 'End Session')
      .click({ timeout: 6000 })
      .then(() =>
        tutor.getByRole('button', { name: 'End Session' }).last().click({ timeout: 6000 })
      )
      .catch(() => {})
    await wait(tutor, 2000)
  } finally {
    for (const page of [tutor, ...pages.values()]) await page.context().close()
  }
  return results
}

/**
 * Captures session-view shots on a throwaway copy of `lesson`. Shots with the same viewport share
 * one session. Results line up with `shots`.
 */
export async function captureSessionShots({
  browser,
  lesson,
  shots,
  base,
  scale = 1,
  env = null,
  outPathFor,
  log,
}) {
  const sessionEnv = env ?? readSessionEnv()
  const { db } = await import('./firebase.mjs')
  const root = withTrailingSlash(base)
  const groups = new Map()
  shots.forEach((shot, i) => {
    const key = `${shot.width}x${shot.height}${shot.hasTouch ? 't' : ''}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(i)
  })
  const results = new Array(shots.length)
  for (const indexes of groups.values()) {
    const copyId = throwawayLessonId()
    const shareTaskIds = indexes
      .filter((i) => shots[i].students.some((s) => s.share))
      .map((i) => findShotTask(lesson, shotTaskId(shots[i])).id)
    log(`Running a throwaway session on ${copyId}…`)
    try {
      await db
        .collection('lessons')
        .doc(copyId)
        .set(encodeLessonForFirestore(buildThrowawayLesson(lesson, copyId, shareTaskIds)))
      const groupResults = await runSession({
        browser,
        lesson,
        copyId,
        shots: indexes.map((i) => shots[i]),
        base: root,
        scale,
        env: sessionEnv,
        outPathFor,
        log,
      })
      indexes.forEach((i, j) => (results[i] = groupResults[j]))
    } catch (e) {
      for (const i of indexes) {
        results[i] ??= {
          task: shotTaskId(shots[i]),
          view: shots[i].view,
          error: e.message.split('\n')[0],
        }
      }
      log(`✗ session: ${e.message.split('\n')[0]}`)
    } finally {
      await removeThrowawayLesson(db, copyId, sessionEnv, log)
    }
  }
  return results
}
