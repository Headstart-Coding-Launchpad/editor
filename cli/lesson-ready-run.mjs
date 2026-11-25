// `hsc lessons ready`: the browser half. Each planned run (cli/lesson-ready.mjs planTask) opens
// the task on the app's no-session #/shot page (src/app/views/ShotView.jsx, as `lessons
// screenshot` does) with the run's code put in as the starter, presses Run, and reads what the
// child would see: the check banner (pass or fail, and its hint), the output, and the setup
// error text.
//
// No Firebase writes: ShotView's previewMode keeps code in memory, and on top of that every
// request to Firestore, the Realtime Database, Auth and Functions is blocked here (Storage
// file reads are allowed, for images and sounds). Blocked requests are listed in the report.
//
// Needs the repo's dev dependencies (@playwright/test) and Chromium, like `lessons screenshot`.

/* global window, document, location -- page callbacks only */
import { findShotTask, prepareShotLesson } from './lesson-screenshot-input.mjs'
import { launchBrowser, withTrailingSlash } from './lesson-screenshot.mjs'
import { SETUP_ERROR_TEXT } from '../src/shared/puzzle/setupCode.js'

const SHOT_GLOBAL = '__HSC_SHOT__'
// The smallest screen LaunchPad is built for (CLAUDE.md: fits 1366x768).
export const READY_VIEWPORT = { width: 1366, height: 768 }

const BLOCKED_HOSTS =
  /(^|\.)(firestore\.googleapis\.com|firebaseio\.com|firebasedatabase\.app|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|firebaseinstallations\.googleapis\.com|cloudfunctions\.net|firebaselogging-pa\.googleapis\.com)$/i
const STORAGE_HOSTS =
  /(^|\.)(firebasestorage\.googleapis\.com|firebasestorage\.app|storage\.googleapis\.com)$/i

/** 'block' for any Firebase request that could write (Storage reads are allowed), else 'allow'. */
export function guardDecision(url, method = 'GET') {
  let host
  try {
    host = new URL(url).hostname
  } catch {
    return 'allow'
  }
  if (STORAGE_HOSTS.test(host)) return /^(GET|HEAD)$/i.test(method) ? 'allow' : 'block'
  return BLOCKED_HOSTS.test(host) ? 'block' : 'allow'
}

// A traceback header; the panel's status word covers a crash whose traceback is folded away.
// Not any line starting "Error:", which a program may print on purpose.
export const RUN_ERROR = /Traceback \(most recent call last\)/

/**
 * What the child sees after a run, read from the page: the check banner (CheckFeedbackBanner,
 * role="status" with its ✓ / ! / 💡 icon), the output panel's text and the setup error.
 * Runs in the browser (page.evaluate), so it may only use its arguments.
 */
export function readShotVerdict([setupErrorText, runErrorSource] = []) {
  const runError = new RegExp(runErrorSource, 'm')
  let banner = null
  for (const el of document.querySelectorAll('[role="status"]')) {
    const icon = [...el.querySelectorAll('span')].find((s) =>
      ['✓', '!', '💡'].includes((s.textContent ?? '').trim())
    )
    if (!icon) continue
    const close = el.querySelector('button[aria-label="Dismiss"]')
    const text = (el.textContent ?? '').replace(close?.textContent ?? '', '').trim()
    banner = { passed: icon.textContent.trim() === '✓', text: text.replace(/^[✓!💡]\s*/u, '') }
    break
  }
  const panels = [...document.querySelectorAll('[data-testid="output-panel"]')]
  // The panel's header holds its title and status word ("Ran OK" / "Error"); the rest is the
  // output. A crash's traceback may be folded away under "What Python said", so the status
  // word is what says the run errored.
  const headers = panels.map((el) => el.firstElementChild?.textContent ?? '')
  const output = panels.map((el, i) => (el.textContent ?? '').slice(headers[i].length)).join('\n')
  return {
    verdict: banner ? (banner.passed ? 'passed' : 'failed') : null,
    hintShown: banner && !banner.passed ? banner.text : null,
    output,
    setupError: output.includes(setupErrorText),
    runError:
      headers.some((t) => /Error(?![a-z])/.test(t)) ||
      output.includes(setupErrorText) ||
      runError.test(output),
  }
}

// The task as a run shows it: the run's code as its starter, shown in solo whatever its taskMode.
function runTaskCopy(lesson, taskId, code) {
  const prepared = prepareShotLesson(lesson, {
    task: String(taskId),
    openTask: null,
    code,
    codeStage: null,
  })
  const task = { ...findShotTask(prepared, taskId) }
  delete task.taskMode
  return task
}

// Runs in the browser before the app loads: picks the run named in ?ready= and hands its lesson
// to ShotView. Storage is cleared so no run sees what an earlier one left.
function installShot([key, data]) {
  // Init scripts also run in frames: only the page itself is set up.
  if (window !== window.top) return
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    // Storage may be unavailable on an error page.
  }
  const pick = new URLSearchParams(location.search).get('ready')
  const variant = data.variants[pick]
  if (!variant) return
  const swap = (tasks) =>
    (tasks ?? []).map((t) =>
      t?.type === 'group'
        ? { ...t, subtasks: swap(t.subtasks) }
        : String(t?.id) === String(variant.taskId)
          ? variant.task
          : t
    )
  window[key] = {
    lesson: { ...data.lesson, tasks: swap(data.lesson.tasks) },
    taskId: variant.taskId,
  }
}

async function guardNetwork(context, blocked) {
  await context.route('**/*', (route) => {
    const req = route.request()
    if (guardDecision(req.url(), req.method()) === 'block') {
      const u = new URL(req.url())
      blocked.push(`${req.method()} ${u.host}${u.pathname.slice(0, 60)}`)
      return route.abort('blockedbyclient')
    }
    return route.continue()
  })
  await context.routeWebSocket(/firebaseio\.com|firebasedatabase\.app/i, (ws) => {
    blocked.push(`WebSocket ${new URL(ws.url()).host}`)
    ws.close()
  })
}

// Waits for the check banner (up to `timeoutMs`) and for the output to stop changing: the
// output panel types its text out, so it is read once it has held still for a second.
async function waitForVerdict(page, timeoutMs) {
  const args = [SETUP_ERROR_TEXT, RUN_ERROR.source]
  const verdictBy = Date.now() + timeoutMs
  const outputBy = Date.now() + 20_000
  let seen = await page.evaluate(readShotVerdict, args)
  let still = 0
  while (Date.now() < outputBy && (still < 4 || (!seen.verdict && Date.now() < verdictBy))) {
    await page.waitForTimeout(250)
    const next = await page.evaluate(readShotVerdict, args)
    still = next.output === seen.output ? still + 1 : 0
    seen = next
  }
  return seen
}

// Presses Run and answers each input() question from `answers`, in order, until the run ends.
// A question past the answers given stops the run as not checked: nothing is made up.
async function runAnswering(page, answers) {
  const run = page
    .locator('[data-highlight-target~="run"], [data-highlight-target~="green_flag"]')
    .first()
  await run.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {
    throw new Error('could not find the Run button')
  })
  const status = async () =>
    page
      .locator('[data-testid="output-panel"]')
      .first()
      .evaluate((el) => el.firstElementChild?.textContent ?? '')
      .catch(() => '')
  const before = await status()
  await run.click({ timeout: 6000 })
  const field = page.getByPlaceholder('Type your input…').first()
  const running = async () => /^(Stop|Running…)$/.test(((await run.textContent()) ?? '').trim())
  // Wait for the run to start (the button says Stop, or the output's status word changes), so a
  // slow start is never read as a finished run. A run too quick to see goes on after 15s.
  const startBy = Date.now() + 15_000
  while (!(await running()) && (await status()) === before) {
    if (Date.now() > startBy) break
    await page.waitForTimeout(100)
  }
  let next = 0
  const deadline = Date.now() + 60_000
  while (await running()) {
    if (Date.now() > deadline) throw new Error('the run did not finish within 60 seconds')
    if (await field.isVisible().catch(() => false)) {
      if (next >= answers.length) {
        throw new Error(
          `the run asked input() question ${next + 1}, but ${answers.length} answer(s) were given`
        )
      }
      await field.fill(answers[next++])
      await field.press('Enter')
      await page.waitForTimeout(300)
      continue
    }
    await page.waitForTimeout(200)
  }
  // A Turtle picture plays its drawing after the run ends.
  await page
    .locator('[data-testid="turtle-canvas"][data-playing="true"]')
    .first()
    .waitFor({ state: 'detached', timeout: 120_000 })
    .catch(() => {
      throw new Error('the turtle was still drawing after 2 minutes')
    })
}

async function runOne(page, base, key, { expectVerdict, inputs = [] }) {
  const errors = []
  const onError = (e) => errors.push(e.message.split('\n')[0])
  page.on('pageerror', onError)
  try {
    await page.goto(`${withTrailingSlash(base)}?ready=${encodeURIComponent(key)}#/shot`)
    const shown = page.locator('[data-testid="shot-page"], [data-testid="shot-empty"]').first()
    await shown.waitFor({ timeout: 60_000 }).catch(() => {
      throw new Error(`no screenshot page at ${base} ${errors.join('; ')}`.trim())
    })
    if (await page.getByTestId('shot-empty').isVisible()) {
      throw new Error(`${base} has no #/shot page (it needs a LaunchPad deploy)`)
    }
    await page
      .getByText(/Getting Python ready/)
      .first()
      .waitFor({ state: 'hidden', timeout: 90_000 })
      .catch(() => {
        throw new Error('Python did not finish loading within 90 seconds')
      })
    await runAnswering(page, inputs)
    // The check banner follows the end of the run.
    const seen = await waitForVerdict(page, expectVerdict ? 5000 : 800)
    return { status: 'done', ...seen, ...(errors.length ? { pageErrors: errors.slice(0, 5) } : {}) }
  } catch (e) {
    return {
      status: 'not_checked',
      reason: `the run could not be made: ${e.message.split('\n')[0]}`,
    }
  } finally {
    page.off('pageerror', onError)
  }
}

/**
 * Makes every planned run that isn't skipped, one at a time in one browser. Returns
 * `{ results: { [taskId]: { starter, complete } }, network: { blocked }, run }`.
 */
export async function runPlannedTasks({ lesson, plans, base, log = () => {} }) {
  const jobs = []
  const variants = {}
  for (const plan of plans) {
    for (const run of plan.runs) {
      if (run.skip) continue
      const key = `${plan.id}:${run.role}`
      variants[key] = { taskId: plan.id, task: runTaskCopy(lesson, plan.id, run.code ?? '') }
      jobs.push({ plan, run, key })
    }
  }
  const results = {}
  const blocked = []
  const started = Date.now()
  const browser = await launchBrowser()
  try {
    const context = await browser.newContext({ viewport: READY_VIEWPORT })
    await guardNetwork(context, blocked)
    await context.addInitScript(installShot, [SHOT_GLOBAL, { lesson, variants }])
    const page = await context.newPage()
    for (const [i, { plan, run, key }] of jobs.entries()) {
      const result = await runOne(page, base, key, {
        expectVerdict: run.expect === 'pass' || run.expect === 'not_pass',
        inputs: run.inputs ?? [],
      })
      ;(results[plan.id] ??= {})[run.role] = result
      const said =
        result.status !== 'done'
          ? `not checked (${result.reason})`
          : `${result.verdict ?? 'no check result'}${result.runError ? ', error in output' : ''}`
      log(`[${i + 1}/${jobs.length}] task ${plan.id} ${run.role}: ${said}`)
    }
    await context.close()
  } finally {
    await browser.close()
  }
  return {
    results,
    network: { blocked: [...new Set(blocked)], blockedCount: blocked.length },
    run: {
      runs: jobs.length,
      seconds: Math.round((Date.now() - started) / 1000),
      viewport: READY_VIEWPORT,
    },
  }
}
