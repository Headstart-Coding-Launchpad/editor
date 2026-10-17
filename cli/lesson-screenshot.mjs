// `hsc lessons screenshot`: PNGs of lesson tasks as students and tutors see them, for lesson
// images. Student views render on the app's no-session #/shot page (src/app/views/ShotView.jsx):
// the lesson is handed to the page by Playwright, so Drafts work and nothing is written to
// Firebase. Session views (tutor grid, Shared work…) run on a throwaway copy of the lesson; see
// lesson-screenshot-session.mjs.
//
// Needs the repo's dev dependencies (@playwright/test) and Chromium
// (`npx playwright install chromium`), like `scratch render`.
//
// A shot whose panel can't be found fails with its task named and writes no file, so a UI change
// never produces a wrong image. tests/lessonScreenshotHooks.test.jsx keeps the hooks in place.

/* global window, document -- only inside page callbacks, which run in Chromium */
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  CROP_TEST_IDS,
  findShotTask,
  isSessionView,
  prepareShotLesson,
  shotFileName,
  shotTaskId,
} from './lesson-screenshot-input.mjs'

export const DEFAULT_BASE = 'https://headstart-coding-launchpad.github.io/editor/'
const SHOT_GLOBAL = '__HSC_SHOT__'

async function loadChromium() {
  try {
    return (await import('@playwright/test')).chromium
  } catch (e) {
    throw new Error(
      `lessons screenshot needs the repo's dev dependencies (@playwright/test). Run npm install at the repo root. (${e.message})`
    )
  }
}

export async function launchBrowser() {
  const chromium = await loadChromium()
  try {
    return await chromium.launch()
  } catch (e) {
    throw new Error(
      `Could not start Chromium. Run npx playwright install chromium. (${e.message.split('\n')[0]})`
    )
  }
}

export function withTrailingSlash(base) {
  return base.endsWith('/') ? base : `${base}/`
}

const testIdSelector = (ids) => ids.map((id) => `[data-testid="${id}"]`).join(', ')

// The first visible element for a crop, or null.
export async function findCrop(page, crop, scope = page) {
  for (const id of CROP_TEST_IDS[crop] ?? []) {
    const all = scope.locator(`[data-testid="${id}"]`)
    const n = await all.count()
    for (let i = 0; i < n; i++) {
      const el = all.nth(i)
      if (await el.isVisible().catch(() => false)) return el
    }
  }
  return null
}

// Python and Turtle editors show "Getting Python ready…" until Pyodide loads.
async function waitForPython(page) {
  await page
    .getByText(/Getting Python ready/)
    .first()
    .waitFor({ state: 'hidden', timeout: 90_000 })
    .catch(() => {
      throw new Error('Python did not finish loading within 90 seconds')
    })
}

async function settle(page, ms) {
  await page.evaluate(() => document.fonts?.ready).catch(() => {})
  await page
    .waitForFunction(() => [...document.images].every((img) => img.complete), null, {
      timeout: 15_000,
    })
    .catch(() => {})
  // No hover states or tooltips in the picture.
  await page.mouse.move(0, 0)
  await page.waitForTimeout(ms)
}

export async function clickByName(page, name) {
  const byRole = page.getByRole('button', { name }).first()
  if (await byRole.isVisible().catch(() => false)) return byRole.click({ timeout: 6000 })
  const tab = page.getByRole('tab', { name }).first()
  if (await tab.isVisible().catch(() => false)) return tab.click({ timeout: 6000 })
  await page
    .getByText(name, { exact: true })
    .first()
    .click({ timeout: 6000 })
    .catch(() => {
      throw new Error(`Could not find "${name}" to click`)
    })
}

// Run, answering each input() prompt in turn, then wait for the run to finish.
export async function runTask(page, inputs = [], scope = page) {
  const run = scope
    .locator('[data-highlight-target~="run"], [data-highlight-target~="green_flag"]')
    .first()
  await run.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {
    throw new Error('Could not find the Run button')
  })
  await run.click({ timeout: 6000 })
  for (const value of inputs) {
    const field = scope.getByPlaceholder('Type your input…').first()
    await field.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {
      throw new Error(`The run never asked for input "${value}"`)
    })
    await field.fill(value)
    await field.press('Enter')
    await page.waitForTimeout(300)
  }
  // Python and Turtle say Stop / Running… while running. The Scratch green flag has no text,
  // and its scripts may run for ever, so the shot's wait covers it.
  await page
    .waitForFunction(
      (el) => !/^(Stop|Running…)$/.test((el?.textContent ?? '').trim()),
      await run.elementHandle(),
      { timeout: 60_000 }
    )
    .catch(() => {
      throw new Error('The run did not finish within 60 seconds')
    })
  // A Turtle picture plays its drawing after the run ends.
  await scope
    .locator('[data-testid="turtle-canvas"][data-playing="true"]')
    .first()
    .waitFor({ state: 'detached', timeout: 120_000 })
    .catch(() => {
      throw new Error('The turtle was still drawing after 2 minutes')
    })
}

export async function writeShot(page, shot, outPath, scope = page) {
  await mkdir(dirname(outPath), { recursive: true })
  if (shot.crop === 'page') {
    await page.screenshot({ path: outPath })
    return
  }
  const el = await findCrop(page, shot.crop, scope)
  if (!el) {
    throw new Error(
      `No visible "${shot.crop}" panel (looked for ${CROP_TEST_IDS[shot.crop].join(', ')})`
    )
  }
  await el.screenshot({ path: outPath })
}

async function captureStudentShot(browser, lesson, shot, { base, outPath, scale }) {
  const shown = findShotTask(lesson, shotTaskId(shot))
  const context = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    hasTouch: shot.hasTouch,
    deviceScaleFactor: scale,
  })
  const errors = []
  try {
    const page = await context.newPage()
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(
      ([key, data]) => {
        window[key] = data
      },
      [SHOT_GLOBAL, { lesson: prepareShotLesson(lesson, shot), taskId: shown.id }]
    )
    await page.goto(`${withTrailingSlash(base)}#/shot`)
    const ready = page.locator(testIdSelector(['shot-page', 'shot-empty'])).first()
    await ready.waitFor({ timeout: 60_000 }).catch(() => {
      // A build from before the screenshot page shows its landing page here instead.
      throw new Error(
        `No screenshot page at ${base} (not loaded, or a build without it). ${errors.join('; ')}`.trim()
      )
    })
    if (await page.getByTestId('shot-empty').isVisible()) {
      throw new Error(`${base} has no screenshot page yet (it needs a LaunchPad deploy)`)
    }
    await page
      .locator(testIdSelector(['task-workspace', 'task-instructions']))
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 })
      .catch(() => {})
    await waitForPython(page)
    for (const name of shot.click) {
      await clickByName(page, name)
      await page.waitForTimeout(500)
    }
    if (shot.run) await runTask(page, shot.inputs)
    await settle(page, shot.wait ?? (shot.run ? 1500 : 800))
    await writeShot(page, shot, outPath)
  } finally {
    await context.close()
  }
}

/**
 * Captures every shot. Each result is { task, view, crop, file } or { task, view, error }:
 * a failed shot writes no file and the rest carry on.
 */
export async function captureLessonShots({
  lesson,
  shots,
  base = DEFAULT_BASE,
  outDir = '.',
  scale = 1,
  sessionEnv = null,
  log = () => {},
}) {
  const outPathFor = (shot) => resolve(outDir, shot.out ?? shotFileName(shot))
  const results = new Array(shots.length)
  const browser = await launchBrowser()
  try {
    for (const [i, shot] of shots.entries()) {
      if (isSessionView(shot.view)) continue
      const outPath = outPathFor(shot)
      try {
        await captureStudentShot(browser, lesson, shot, { base, outPath, scale })
        results[i] = { task: shotTaskId(shot), view: shot.view, crop: shot.crop, file: outPath }
        log(`✓ task ${shotTaskId(shot)} → ${outPath}`)
      } catch (e) {
        results[i] = { task: shotTaskId(shot), view: shot.view, error: e.message.split('\n')[0] }
        log(`✗ task ${shotTaskId(shot)}: ${results[i].error}`)
      }
    }

    const sessionIdx = shots.map((s, i) => (isSessionView(s.view) ? i : -1)).filter((i) => i >= 0)
    if (sessionIdx.length > 0) {
      const { captureSessionShots } = await import('./lesson-screenshot-session.mjs')
      const sessionResults = await captureSessionShots({
        browser,
        lesson,
        shots: sessionIdx.map((i) => shots[i]),
        base,
        scale,
        env: sessionEnv,
        outPathFor,
        log,
      })
      sessionIdx.forEach((i, j) => (results[i] = sessionResults[j]))
    }
  } finally {
    await browser.close()
  }
  return results
}
