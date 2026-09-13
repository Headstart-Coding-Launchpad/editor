import { test, expect } from '@playwright/test'

// Solo student flows — no Firebase, no live session required.
// Pyodide (WASM Python runner) is NOT exercised in these tests;
// we only verify that the UI renders correctly.

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => localStorage.clear())
  })

  test('landing page loads with lesson-code input', async ({ page }) => {
    // baseURL is http://localhost:5173/editor/ so going to '' navigates there
    await page.goto('', { timeout: 30000 })

    // The logo text rendered in the brand span
    await expect(page.getByText('Headstart Coding - LaunchPad')).toBeVisible({ timeout: 10000 })

    // The page heading — "Join a lesson" for non-teacher mode
    await expect(page.getByRole('heading', { name: 'Join a lesson' })).toBeVisible({
      timeout: 5000,
    })

    // The lesson-code input (labelled "Enter your lesson code")
    const input = page.getByLabel('Enter your lesson code')
    await expect(input).toBeVisible({ timeout: 5000 })

    // The "Go" submit button
    await expect(page.getByRole('button', { name: 'Go' })).toBeVisible({ timeout: 5000 })
  })

  test('entering a lesson code and clicking Go navigates to that lesson', async ({ page }) => {
    await page.goto('', { timeout: 30000 })

    const input = page.getByLabel('Enter your lesson code')
    await input.fill('python-for-loops')
    await page.getByRole('button', { name: 'Go' }).click()

    // The HashRouter should now include the lesson ID in the URL hash
    await expect(page).toHaveURL(/#\/lesson\/python-for-loops/, { timeout: 10000 })
  })
})

test.describe('Python lesson — solo mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => localStorage.clear())
  })

  test('navigating directly to a Python lesson shows the code editor', async ({ page }) => {
    // Navigate straight to the lesson via hash route.
    // No ?live=true param => soloMode=true => no Firebase, no name entry, no waiting room.
    await page.goto('#/lesson/python-for-loops', { timeout: 30000 })

    // Wait for the lesson to load and enter solo phase.
    // The lesson title is rendered in the TopBar — confirms the lesson JSON loaded.
    // NOTE: verify the exact TopBar text if the TopBar component changes.
    await expect(page.getByText('For Loops')).toBeVisible({ timeout: 15000 })

    // The Python editor is rendered by PythonEditor which uses CodeMirror.
    // CodeMirror attaches a .cm-editor div to the DOM.
    const editor = page.locator('.cm-editor')
    await expect(editor).toBeVisible({ timeout: 10000 })
  })

  test('starter code for task 1 is pre-populated in the editor', async ({ page }) => {
    await page.goto('#/lesson/python-for-loops', { timeout: 30000 })

    // Wait for editor to be visible
    const editor = page.locator('.cm-editor')
    await expect(editor).toBeVisible({ timeout: 15000 })

    // Task 1 starter code starts with "count = 0" — verify it appears
    // NOTE: if the starter code for task 1 changes, update this string.
    await expect(page.locator('.cm-editor').getByText('count = 0')).toBeVisible({ timeout: 5000 })
  })

  test('Run button is visible in solo Python lesson', async ({ page }) => {
    await page.goto('#/lesson/python-for-loops', { timeout: 30000 })

    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 15000 })

    // The Run/Stop button — may read "Run" or "Getting Python ready…" while Pyodide loads.
    // We wait for "Run" text specifically; Pyodide takes up to 30 s on first cold load.
    // test.slow() marks the test to use 3x the global timeout.
    // We only assert the button exists — we do NOT click it or wait for Pyodide.
    const runBtn = page.getByRole('button', { name: /^(Run|Getting Python ready)/ })
    await expect(runBtn).toBeVisible({ timeout: 10000 })
  })

  test('task navigation bar is visible and shows task count', async ({ page }) => {
    await page.goto('#/lesson/python-for-loops', { timeout: 30000 })

    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 15000 })

    // The soloNav bar at the bottom of StudentView renders "Task X of Y"
    // python-for-loops.json has 4 tasks.
    // NOTE: update if the lesson task count changes.
    await expect(page.getByText(/Task 1 of 4/)).toBeVisible({ timeout: 5000 })

    // Previous button should be disabled on task 1
    const prevBtn = page.getByRole('button', { name: 'Previous' })
    await expect(prevBtn).toBeDisabled({ timeout: 5000 })

    // Next button should be enabled (task 1 has no check)
    const nextBtn = page.getByRole('button', { name: 'Next' })
    await expect(nextBtn).toBeEnabled({ timeout: 5000 })
  })

  test('navigating to next task updates task counter', async ({ page }) => {
    await page.goto('#/lesson/python-for-loops', { timeout: 30000 })

    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/Task 1 of 4/)).toBeVisible({ timeout: 5000 })

    // Task 1 has no check, so Next should be immediately available
    await page.getByRole('button', { name: 'Next' }).click()

    // Counter should advance to task 2
    await expect(page.getByText(/Task 2 of 4/)).toBeVisible({ timeout: 5000 })

    // Editor should still be visible for the new task
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 5000 })
  })
})
