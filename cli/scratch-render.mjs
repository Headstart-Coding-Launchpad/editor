// `hsc scratch render`: draws a Scratch script exactly as the app does and saves it as SVG.
//
// The block definitions need a real browser to measure text, so this serves
// cli/scratch-render/ through Vite and draws it in headless Chromium (Playwright). Both are
// the repo's own dev dependencies: run it from a checkout with `npm install` done at the root
// and Chromium installed (`npx playwright install chromium`).

/* global window -- only inside page callbacks, which run in Chromium */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PAGE = '/cli/scratch-render/index.html'

async function loadTooling() {
  try {
    const [{ createServer }, { chromium }] = await Promise.all([
      import('vite'),
      import('@playwright/test'),
    ])
    return { createServer, chromium }
  } catch (e) {
    throw new Error(
      `scratch render needs the repo's dev dependencies (vite, @playwright/test). Run npm install at the repo root. (${e.message})`
    )
  }
}

// job: from buildRenderJob (scratch-render-input.mjs).
export async function renderScratchSvg(job, { embedFont = true } = {}) {
  const { createServer, chromium } = await loadTooling()
  const server = await createServer({
    root: ROOT,
    configFile: false,
    logLevel: 'error',
    appType: 'mpa',
    // Own cache, so this never disturbs a running `npm run dev`.
    cacheDir: resolve(ROOT, 'node_modules/.vite-scratch-render'),
    optimizeDeps: { entries: [PAGE.slice(1)], include: ['blockly'] },
    server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false },
  })
  let browser = null
  try {
    await server.listen()
    const { port } = server.httpServer.address()
    try {
      browser = await chromium.launch()
    } catch (e) {
      throw new Error(
        `Could not start Chromium. Run npx playwright install chromium. (${e.message.split('\n')[0]})`
      )
    }
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`http://127.0.0.1:${port}${PAGE}`)
    await page
      .waitForFunction(() => window.renderScratchReady === true, null, { timeout: 60_000 })
      .catch(() => {
        throw new Error(`The render page did not load. ${errors.join('; ')}`)
      })
    return await page.evaluate(([j, o]) => window.renderScratch(j, o), [job, { embedFont }])
  } finally {
    await browser?.close()
    await server.close()
  }
}
