#!/usr/bin/env node
// HSC Audit visual review: screenshots every feature group in the student and
// tutor views, at desktop and tablet widths, on the live site.
//
// Uses the test tutor account only (AUDIT_TUTOR_EMAIL / AUDIT_TUTOR_PASSWORD in
// the gitignored repo-root .env) and made-up students ("Test Ava", "Test Ben")
// in a throwaway live session on the draft test lesson from build-lesson.mjs.
//
//   node scripts/hsc-audit/run-visual-review.mjs --out "<folder>" [--base <url>] [--only desktop|tablet]
//
// Normally run through scripts/hsc-audit/README.md's three steps:
// build-lesson --upsert, run, cleanup --apply.
//
// Every step is best-effort: a step that can't find its button is logged in
// manifest.json (with the buttons it could see) and the run carries on.

import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LESSON_ID } from './build-lesson.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repo = resolve(__dirname, '../..')
const require = createRequire(join(repo, 'package.json'))
const { chromium } = require('playwright')

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : fallback
}
const BASE = arg('base', 'https://headstart-coding-launchpad.github.io/editor/')
const OUT = resolve(arg('out', join(__dirname, '.out', 'Visual Review')))
const ONLY = arg('only', null)
const SCREENS = join(OUT, 'screens')
mkdirSync(SCREENS, { recursive: true })

// The repo-root .env holds the test tutor login (HSC_ENV points at another one,
// e.g. the main checkout's when running from a worktree).
function readEnv() {
  for (const p of [process.env.HSC_ENV, join(repo, '.env')].filter(Boolean)) {
    if (!existsSync(p)) continue
    const env = Object.fromEntries(
      readFileSync(p, 'utf8')
        .split(/\r?\n/)
        .filter((l) => /^AUDIT_TUTOR_/.test(l))
        .map((l) => l.split(/=(.*)/s).slice(0, 2))
    )
    if (env.AUDIT_TUTOR_EMAIL) return env
  }
  throw new Error('AUDIT_TUTOR_EMAIL / AUDIT_TUTOR_PASSWORD not found in .env')
}
const env = readEnv()

const WIDTHS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 1024, height: 768, hasTouch: true },
}

const manifest = {
  base: BASE,
  lesson: LESSON_ID,
  startedAt: new Date().toISOString(),
  shots: [],
  problems: [],
}
const wait = (page, ms) => page.waitForTimeout(ms)

async function visibleButtons(page) {
  try {
    return (await page.locator('button:visible').allInnerTexts())
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 80)
  } catch {
    return []
  }
}

let widthName = 'desktop'
async function shot(page, group, view, label = '') {
  const name = `${group} - ${view}${label ? ` - ${label}` : ''} - ${widthName}.png`
  try {
    await page.screenshot({ path: join(SCREENS, name) })
    manifest.shots.push({ group, view, label, width: widthName, file: `screens/${name}` })
  } catch (e) {
    manifest.problems.push({
      group,
      view,
      label,
      width: widthName,
      error: `screenshot: ${e.message.split('\n')[0]}`,
    })
  }
}

async function step(group, what, page, fn) {
  try {
    await fn()
  } catch (e) {
    manifest.problems.push({
      group,
      step: what,
      width: widthName,
      error: e.message.split('\n')[0],
      buttons: await visibleButtons(page),
    })
    console.warn(`  ✗ ${group}: ${what} — ${e.message.split('\n')[0]}`)
    await page.keyboard.press('Escape').catch(() => {})
  }
}

const btn = (page, name) => page.getByRole('button', { name }).first()
const click = async (page, name, timeout = 6000) => btn(page, name).click({ timeout })

// The student modal and other dialogs sit in .ui-modal-backdrop.
const modal = (page) => page.locator('.ui-modal-backdrop').last()

// At tablet width the student grid folds into a rail on the right.
async function openGrid(tutor) {
  if (
    await tutor
      .getByText('Test Ben', { exact: true })
      .first()
      .isVisible()
      .catch(() => false)
  )
    return
  await tutor.getByRole('button', { name: '‹' }).last().click({ timeout: 4000 })
  await wait(tutor, 800)
}

// At tablet width some top-bar buttons move into "Menu ▾".
async function clickTopBar(tutor, name) {
  const b = btn(tutor, name)
  if (!(await b.isVisible().catch(() => false))) await click(tutor, /^Menu/)
  await btn(tutor, name).click({ timeout: 6000 })
}

// Close any open popover by clicking an empty part of the page.
async function dismiss(tutor) {
  await tutor.keyboard.press('Escape')
  await tutor
    .getByText('Lesson elapsed')
    .first()
    .click({ timeout: 2000 })
    .catch(() => {})
}

async function typeCode(page, code) {
  const editor = page.locator('.cm-content').first()
  await editor.click({ timeout: 6000 })
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await page.keyboard.type(code)
}

async function runCode(page) {
  await click(page, /^(▶\s*)?Run( code| game)?$/i)
}

// Tutor: preview a task in the navigator, then move the whole class to it.
async function moveClassTo(tutor, title) {
  await tutor.getByRole('button', { name: title }).first().click({ timeout: 6000 })
  await wait(tutor, 800)
  const move = btn(tutor, /Move All to This Task/)
  if (await move.isVisible().catch(() => false)) await move.click()
  await wait(tutor, 2500)
}

// End Session asks to confirm in a dialog with its own "End Session" button.
async function endSession(tutor) {
  await click(tutor, 'End Session')
  await tutor.getByRole('button', { name: 'End Session' }).last().click({ timeout: 6000 })
}

// The session report opens over everything after a session ends.
async function closeReport(tutor) {
  const report = tutor.getByRole('dialog', { name: 'Session report' })
  if (await report.isVisible().catch(() => false)) {
    await report.getByRole('button', { name: 'Close' }).click({ timeout: 4000 })
  }
}

async function login(page) {
  await page.goto(BASE + '#/login')
  await page.fill('#email', env.AUDIT_TUTOR_EMAIL)
  await page.fill('#password', env.AUDIT_TUTOR_PASSWORD)
  await page.click('button[type=submit]')
  await page.waitForURL((u) => !String(u).includes('login'), { timeout: 20000 })
}

async function joinAsStudent(page, name) {
  await page.goto(BASE + `#/lesson/${LESSON_ID}`)
  const input = page.getByPlaceholder('e.g. Jamie')
  await input.waitFor({ timeout: 20000 })
  await input.fill(name)
  await page.keyboard.press('Enter')
}

async function runWidth(browser, wName) {
  widthName = wName
  const vp = WIDTHS[wName]
  console.log(`\n== ${wName} (${vp.width}×${vp.height})`)
  const tCtx = await browser.newContext({ viewport: vp, hasTouch: !!vp.hasTouch })
  const aCtx = await browser.newContext({ viewport: vp, hasTouch: !!vp.hasTouch })
  const bCtx = await browser.newContext({ viewport: vp, hasTouch: !!vp.hasTouch })
  const tutor = await tCtx.newPage()
  const ava = await aCtx.newPage()
  const ben = await bCtx.newPage()

  // --- Joining a lesson
  await step('01 Joining', 'landing page', ava, async () => {
    await ava.goto(BASE)
    await wait(ava, 3000)
    await shot(ava, '01 Joining', 'student', 'landing')
  })
  await login(tutor)
  await tutor.goto(BASE + `#/lesson/${LESSON_ID}?teacher=true`)
  // A second width finds the first width's session ended: restart it.
  // A run that stopped early can leave its session running: end it first.
  await btn(tutor, /^(Start|Restart|End) Session$/).waitFor({ timeout: 30000 })
  if (await btn(tutor, 'End Session').isVisible()) {
    await endSession(tutor)
    await wait(tutor, 3000)
    await tutor.goto(BASE + `#/lesson/${LESSON_ID}?teacher=true`)
    await btn(tutor, /^(Start|Restart) Session$/).waitFor({ timeout: 30000 })
  }
  await wait(tutor, 1500)
  await closeReport(tutor)
  if (await btn(tutor, 'Restart Session').isVisible()) {
    await click(tutor, 'Restart Session')
    await btn(tutor, 'Start Session').waitFor({ timeout: 15000 })
  }
  await step('01 Joining', 'name entry and waiting room', ava, async () => {
    await ava.goto(BASE + `#/lesson/${LESSON_ID}`)
    const input = ava.getByPlaceholder('e.g. Jamie')
    await input.waitFor({ timeout: 20000 })
    await input.fill('Test Ava')
    await shot(ava, '01 Joining', 'student', 'name entry')
    await wait(tutor, 1500)
    await shot(tutor, '01 Joining', 'tutor', 'joining list')
    await ava.keyboard.press('Enter')
    await wait(ava, 3000)
    await shot(ava, '01 Joining', 'student', 'waiting room')
  })
  await step('01 Joining', 'Ben joins', ben, () => joinAsStudent(ben, 'Test Ben'))
  await wait(tutor, 2500)
  await shot(tutor, '01 Joining', 'tutor', 'waiting')
  await click(tutor, 'Start Session')
  await wait(ava, 4000)

  // --- Lesson layout, information tasks
  await shot(ava, '02 Lesson layout', 'student', 'introduction')
  await shot(tutor, '02 Lesson layout', 'tutor', 'introduction')
  await step('02 Lesson layout', 'information task', tutor, async () => {
    await moveClassTo(tutor, /What Is Python/)
    await shot(ava, '02 Lesson layout', 'student', 'information task')
    await shot(tutor, '02 Lesson layout', 'tutor', 'information task')
  })
  // --- Python editor, checks, side-quests
  await step('03 Python editor', 'python task', tutor, async () => {
    await moveClassTo(tutor, /Write Your Own print/)
    await shot(ava, '03 Python editor', 'student', 'starter with line hint')
    await typeCode(ava, 'print("Hello from Ava")')
    await runCode(ava)
    await wait(ava, 6000)
    await shot(ava, '04 Checks and hints', 'student', 'pass')
  })
  await step('04 Checks and hints', 'failing run with hint', ben, async () => {
    await typeCode(ben, 'print(Hello)')
    await runCode(ben)
    await wait(ben, 6000)
    await shot(ben, '04 Checks and hints', 'student', 'fail with hint')
  })
  await shot(tutor, '18 Student grid', 'tutor', 'pass and fail')
  await step('15 Topic Library', 'open topic library', ava, async () => {
    await click(ava, /Topic library/)
    await wait(ava, 1500)
    await shot(ava, '15 Topic Library', 'student')
    await ava.keyboard.press('Escape')
  })

  await step('25 Reports and feedback', 'rate this task', tutor, async () => {
    await click(tutor, /Rate this task/)
    await wait(tutor, 800)
    await shot(tutor, '25 Reports and feedback', 'tutor', 'rate this task')
    await tutor.keyboard.press('Escape')
  })
  await step('17 Session controls', 'focus menu', tutor, async () => {
    await dismiss(tutor)
    await click(tutor, /Focus Class/)
    await wait(tutor, 600)
    await shot(tutor, '17 Session controls', 'tutor', 'focus class menu')
    await tutor.keyboard.press('Escape')
  })
  await step('24 Sandbox and side-quests', 'side-quest', ava, async () => {
    await click(ava, /Break it, then fix it/)
    await wait(ava, 2000)
    await shot(ava, '24 Sandbox and side-quests', 'student', 'side-quest')
    await click(ava, /Back|✕|Close/).catch(() => {})
  })
  await wait(tutor, 1500)
  await shot(tutor, '24 Sandbox and side-quests', 'tutor', 'card on side-quest')

  // --- Student modal and remote actions
  await step('19 Student modal', 'open modal', tutor, async () => {
    await openGrid(tutor)
    await tutor.getByText('Test Ben', { exact: true }).first().click({ timeout: 6000 })
    await wait(tutor, 2000)
    await shot(tutor, '19 Student modal', 'tutor', 'modal')
    await modal(tutor)
      .getByRole('button', { name: /^Support/ })
      .click({ timeout: 6000 })
    await wait(tutor, 800)
    await shot(tutor, '05 Support stages', 'tutor', 'support menu')
    await tutor.keyboard.press('Escape')
    await modal(tutor).getByRole('button', { name: /^More/ }).click({ timeout: 6000 })
    await wait(tutor, 800)
    await shot(tutor, '19 Student modal', 'tutor', 'more menu')
  })
  await step('19 Student modal', 'thumbs up', tutor, async () => {
    await modal(tutor).getByRole('button', { name: /^More/ }).click() // close the More menu
    await modal(tutor)
      .getByRole('button', { name: /thumbs up/ })
      .click({ timeout: 6000 })
    await wait(ben, 700)
    await shot(ben, '19 Student modal', 'student', 'thumbs up toast')
  })
  await step('16 Live badges', 'award a badge', tutor, async () => {
    await modal(tutor).getByRole('button', { name: /^More/ }).click({ timeout: 6000 })
    await wait(tutor, 500)
    await modal(tutor)
      .getByRole('button', { name: /Award badge/ })
      .click({ timeout: 6000 })
    await wait(tutor, 1000)
    await shot(tutor, '16 Live badges', 'tutor', 'award picker')
    const picker = tutor.getByRole('dialog', { name: /Award badge/ })
    await picker
      .locator('button')
      .filter({ hasNotText: /Award|Cancel|Close|✕|×/ })
      .first()
      .click()
    // Once a badge is selected the button reads "Award 🐛 Bug Hunter", never just "Award".
    await picker.getByTestId('badge-award-confirm').click({ timeout: 6000 })
    await wait(ben, 800)
    await shot(ben, '16 Live badges', 'student', 'badge card')
    await wait(ben, 4000)
    await shot(ava, '16 Live badges', 'student', 'classmate toast')
  })
  await step('19 Student modal', 'close modal', tutor, async () => {
    await tutor.keyboard.press('Escape')
    await click(tutor, /^✕$/).catch(() => {})
  })

  // --- Help, peer help, sharing
  await step('22 Help and peer help', 'help', ben, async () => {
    await click(ben, /Help/)
    await wait(ben, 1000)
    await shot(ben, '22 Help and peer help', 'student', 'help bubble')
    await wait(tutor, 1500)
    await shot(tutor, '22 Help and peer help', 'tutor', 'help on card')
    await click(tutor, /Peer help/)
    await wait(tutor, 800)
    await shot(tutor, '22 Help and peer help', 'tutor', 'peer help menu')
    await tutor.keyboard.press('Escape')
  })
  await step('23 Workspace sharing', 'share', ava, async () => {
    await click(ava, /Share/)
    await wait(ava, 1200)
    await shot(ava, '23 Workspace sharing', 'student', 'share')
    await click(ava, /Share with|Send|Yes/).catch(() => {})
    await wait(tutor, 2000)
    await shot(tutor, '23 Workspace sharing', 'tutor', 'approval')
  })

  // --- Every task kind in turn
  const TASKS = [
    ['05 Support stages', /Copy Out a print/, 'copy code panel'],
    [
      '03 Python editor',
      /Favourite Animal/,
      'input()',
      async () => {
        await runCode(ava)
        await wait(ava, 5000)
      },
    ],
    ['07 Code Arrange', /Build a print\(\) Line/, ''],
    [
      '06 Quizzes',
      /Spot the Correctly/,
      'multiple choice',
      async () => {
        await ava
          .locator('main button, [class*=quiz] button')
          .first()
          .click({ timeout: 4000 })
          .catch(() => {})
        await wait(ava, 1500)
      },
    ],
    ['06 Quizzes', /Match the Vocabulary/, 'match'],
    ['06 Quizzes', /Fill In the Rectangle/, 'fill in the blank'],
    ['06 Quizzes', /How Confident/, 'confidence'],
    [
      '06 Quizzes',
      /Show and tell/,
      'short answer',
      async () => {
        await ava.locator('textarea').first().fill('I made a game about space.', { timeout: 4000 })
        await click(ava, /Submit/)
        await wait(ava, 1500)
      },
    ],
    [
      '06 Quizzes',
      /What next\?/,
      'poll task',
      async () => {
        await ava.getByText('Make a game').first().click({ timeout: 6000 })
        await wait(ava, 1500)
      },
    ],
    [
      '10 Turtle',
      /Draw a square/,
      '',
      async () => {
        await runCode(ava)
        await wait(ava, 8000)
      },
    ],
    [
      '11 HTML',
      /Add a heading/,
      '',
      async () => {
        await runCode(ava)
        await wait(ava, 3000)
      },
    ],
    ['08 Scratch', /Sprite, Say Hello/, ''],
    ['08 Scratch', /What Will the Sprite Say/, 'scratch quiz'],
    ['09 Electronics', /Watch a Display/, ''],
    ['12 Arcade Kit', /Button Press Moves/, ''],
    ['13 Filesystem and Desktop', /Make a Documents folder/, 'filesystem'],
    ['13 Filesystem and Desktop', /Open the File Manager/, 'desktop'],
    ['14 Activities', /Type with capitals/, 'keyboard'],
    ['14 Activities', /Mouse practice/, 'mouse'],
    ['14 Activities', /Make the numbers/, 'binary'],
    ['02 Lesson layout', /What You Learned/, 'recap'],
  ]
  for (const [group, title, label, act] of TASKS) {
    await step(group, `task ${title}`, tutor, async () => {
      await moveClassTo(tutor, title)
      await wait(ava, 2500)
      if (act) await act()
      await shot(ava, group, 'student', label)
      await shot(tutor, group, 'tutor', label)
    })
  }

  // --- Polls and countdown (on the recap task)
  await step('21 Polls and countdown', 'live poll', tutor, async () => {
    await click(tutor, /📊 Poll/)
    await wait(tutor, 1000)
    await shot(tutor, '21 Polls and countdown', 'tutor', 'poll setup')
    await tutor.getByPlaceholder('What would you like to do next?').fill('Ready for the next bit?')
    await tutor.getByPlaceholder('Option 1').fill('Yes')
    await tutor.getByPlaceholder('Option 2').fill('Not yet')
    await click(tutor, /Launch poll/)
    await wait(ava, 2500)
    await shot(ava, '21 Polls and countdown', 'student', 'poll card')
    await ava
      .getByText('Yes', { exact: true })
      .last()
      .click({ timeout: 4000 })
      .catch(() => {})
    await wait(tutor, 1500)
    await shot(tutor, '21 Polls and countdown', 'tutor', 'poll tally')
    await click(tutor, /Close poll/, 3000).catch(() => {})
    await click(tutor, /Remove from screens/, 3000).catch(() => {})
    await dismiss(tutor)
  })
  await step('21 Polls and countdown', 'countdown', tutor, async () => {
    await dismiss(tutor)
    await click(tutor, /countdown/i)
    await wait(tutor, 800)
    await shot(tutor, '21 Polls and countdown', 'tutor', 'countdown menu')
    await click(tutor, /^1( min)?$/)
    await wait(ava, 2000)
    await shot(ava, '21 Polls and countdown', 'student', 'countdown')
    await shot(tutor, '21 Polls and countdown', 'tutor', 'countdown running')
  })

  // --- Session controls, presentation, edit lesson, feedback, rating
  await step('17 Session controls', 'pause coding', tutor, async () => {
    await openGrid(tutor)
    await click(tutor, /Pause Coding/)
    await wait(ava, 2000)
    await shot(ava, '17 Session controls', 'student', 'paused')
    await click(tutor, /Resume/)
  })
  await step('25 Reports and feedback', 'feedback modal', tutor, async () => {
    await clickTopBar(tutor, /^Feedback$/)
    await wait(tutor, 800)
    await shot(tutor, '25 Reports and feedback', 'tutor', 'feedback modal')
    await tutor.keyboard.press('Escape')
  })
  await step('26 Edit Lesson', 'edit lesson modal', tutor, async () => {
    await clickTopBar(tutor, /Edit Lesson/)
    await wait(tutor, 2000)
    await shot(tutor, '26 Edit Lesson', 'tutor')
    await tutor.keyboard.press('Escape')
    await tutor
      .getByRole('button', { name: 'Cancel' })
      .last()
      .click({ timeout: 4000 })
      .catch(() => {})
  })
  await step('20 Presentation and broadcast', 'presentation window', tutor, async () => {
    const present = await tCtx.newPage()
    await present.goto(BASE + `#/lesson/${LESSON_ID}?teacher=true&present=true`)
    await wait(present, 6000)
    await shot(present, '20 Presentation and broadcast', 'presentation window')
    await present.close()
  })
  await step('24 Sandbox and side-quests', 'teacher sandbox', tutor, async () => {
    await click(tutor, /^Sandbox$/)
    await wait(tutor, 2000)
    await shot(tutor, '24 Sandbox and side-quests', 'tutor', 'class sandbox setup')
    await click(tutor, /Go Live & Send to Students/, 3000).catch(() => {})
    await wait(ava, 3000)
    await shot(ava, '24 Sandbox and side-quests', 'student', 'class sandbox')
    await shot(tutor, '24 Sandbox and side-quests', 'tutor', 'class sandbox live')
    await click(tutor, /Deactivate Sandbox|Cancel Sandbox|Exit Sandbox/i)
    await wait(tutor, 2000)
  })

  // --- Badge Summary, end of session, report
  await step('16 Live badges', 'badge summary', tutor, async () => {
    await moveClassTo(tutor, /Badge Summary/)
    await wait(ava, 4000)
    await shot(ava, '16 Live badges', 'student', 'badge summary')
    await shot(tutor, '16 Live badges', 'tutor', 'badge summary')
  })
  await step('25 Reports and feedback', 'end session', tutor, async () => {
    await endSession(tutor)
    await wait(ava, 4000)
    await shot(ava, '25 Reports and feedback', 'student', 'end screen')
    await shot(tutor, '25 Reports and feedback', 'tutor', 'session report')
  })

  // --- Builder and Admin, as the test tutor (teacher role)
  await step('27 Lesson Builder', 'builder', tutor, async () => {
    await tutor.goto(BASE + '#/builder')
    await wait(tutor, 5000)
    await shot(tutor, '27 Lesson Builder', 'tutor')
  })
  await step('28 Admin Portal', 'admin', tutor, async () => {
    await tutor.goto(BASE + '#/admin')
    await wait(tutor, 4000)
    await shot(tutor, '28 Admin Portal', 'tutor', 'teacher role')
  })

  // --- Solo study (fresh device, no session running)
  await step('29 Solo study', 'solo lesson', ava, async () => {
    const solo = await (
      await browser.newContext({ viewport: vp, hasTouch: !!vp.hasTouch })
    ).newPage()
    await solo.goto(BASE + `#/lesson/${LESSON_ID}`)
    await wait(solo, 5000)
    await shot(solo, '29 Solo study', 'student', 'choice')
    await click(solo, /Solo|Work on my own|Study/).catch(() => {})
    await wait(solo, 3000)
    await shot(solo, '29 Solo study', 'student', 'solo lesson')
    await solo.goto(BASE + '#/playground/python')
    await wait(solo, 5000)
    await shot(solo, '29 Solo study', 'student', 'python playground')
  })

  await tCtx.close()
  await aCtx.close()
  await bCtx.close()
}

const browser = await chromium.launch()
try {
  for (const w of Object.keys(WIDTHS)) if (!ONLY || ONLY === w) await runWidth(browser, w)
} finally {
  await browser.close()
  manifest.finishedAt = new Date().toISOString()
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(
    `\n${manifest.shots.length} screenshots, ${manifest.problems.length} problems → ${OUT}`
  )
}
