import { test, expect } from '@playwright/test'

// Lesson builder flows — fully self-contained (no Firebase, no Pyodide).
// The builder is a separate HTML entry point at /builder/.
// baseURL is http://localhost:5173/editor/, so 'builder/' resolves correctly.

test.describe('Builder — initial load', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage so no restore-prompt appears between tests
    await page.evaluate(() => localStorage.clear())
  })

  test('builder page loads and shows lesson-type chooser', async ({ page }) => {
    await page.goto('builder/', { timeout: 30000 })

    // The builder brand text is rendered in the card header
    await expect(page.getByText('Headstart Coding - LaunchPad | Lesson Builder')).toBeVisible({
      timeout: 10000,
    })

    // The "Choose a lesson type" heading appears in LessonTypeChooser
    await expect(page.getByRole('heading', { name: 'Choose a lesson type' })).toBeVisible({
      timeout: 5000,
    })

    // All three lesson-type buttons should be visible
    // NOTE: button text comes from the <span style={s.choiceName}> children.
    await expect(page.getByText('Python')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Web')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Scratch')).toBeVisible({ timeout: 5000 })

    // Upload existing JSON button
    await expect(page.getByRole('button', { name: 'Upload existing JSON' })).toBeVisible({
      timeout: 5000,
    })
  })

  test('restore prompt appears when in-progress lesson exists in localStorage', async ({
    page,
  }) => {
    // Seed localStorage with a plausible in-progress lesson before navigating
    await page.goto('builder/', { timeout: 30000 })
    await page.evaluate(() => {
      localStorage.setItem(
        'headstart_builder_current',
        JSON.stringify({ id: 'test-lesson', type: 'python', title: 'Test Lesson', tasks: [] })
      )
    })
    await page.reload({ timeout: 30000 })

    // The restore-prompt card should appear
    await expect(page.getByText(/You have an unsaved lesson in progress/)).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: 'Start fresh' })).toBeVisible({ timeout: 5000 })
  })

  test('clicking Start fresh from restore prompt returns to type chooser', async ({ page }) => {
    await page.goto('builder/', { timeout: 30000 })
    await page.evaluate(() => {
      localStorage.setItem(
        'headstart_builder_current',
        JSON.stringify({ id: 'test-lesson', type: 'python', title: 'Test Lesson', tasks: [] })
      )
    })
    await page.reload({ timeout: 30000 })

    await expect(page.getByRole('button', { name: 'Start fresh' })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'Start fresh' }).click()

    // After dismissing the restore prompt the type-chooser should appear
    await expect(page.getByRole('heading', { name: 'Choose a lesson type' })).toBeVisible({
      timeout: 5000,
    })
  })

  test('clicking Restore from restore prompt opens the builder view', async ({ page }) => {
    await page.goto('builder/', { timeout: 30000 })
    await page.evaluate(() => {
      localStorage.setItem(
        'headstart_builder_current',
        JSON.stringify({ id: 'test-lesson', type: 'python', title: 'Test Lesson', tasks: [] })
      )
    })
    await page.reload({ timeout: 30000 })

    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'Restore' }).click()

    // BuilderView should now be visible — the type-chooser heading should be gone.
    await expect(page.getByRole('heading', { name: 'Choose a lesson type' })).not.toBeVisible({
      timeout: 5000,
    })

    // The metadata panel "Lesson Details" header should be visible.
    // NOTE: update the selector if LessonMetaPanel markup changes.
    await expect(page.getByText('Lesson Details')).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Builder — creating a new lesson', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => localStorage.clear())
  })

  test('choosing Python opens the builder view', async ({ page }) => {
    await page.goto('builder/', { timeout: 30000 })

    await expect(page.getByRole('heading', { name: 'Choose a lesson type' })).toBeVisible({
      timeout: 10000,
    })

    // Click the Python button
    // The button text contains "Python" in a child span — use the button that contains "Python"
    await page
      .getByRole('button', { name: /Python/ })
      .first()
      .click()

    // BuilderView renders with a "New Lesson" or "New Task" button, or a metadata panel.
    // The brand bar or a task-list panel should appear.
    // We check for the "Add Task" / "Add Group" or metadata input area.
    // NOTE: if the BuilderView initial state changes (e.g. it auto-adds a blank task), update assertions.
    //
    // The simplest stable signal: the lesson-type chooser heading is GONE.
    await expect(page.getByRole('heading', { name: 'Choose a lesson type' })).not.toBeVisible({
      timeout: 5000,
    })
  })

  test('choosing Web opens the builder view', async ({ page }) => {
    await page.goto('builder/', { timeout: 30000 })

    await expect(page.getByRole('heading', { name: 'Choose a lesson type' })).toBeVisible({
      timeout: 10000,
    })

    await page.getByRole('button', { name: /Web/ }).first().click()

    await expect(page.getByRole('heading', { name: 'Choose a lesson type' })).not.toBeVisible({
      timeout: 5000,
    })
  })

  test('choosing Scratch opens the builder view', async ({ page }) => {
    await page.goto('builder/', { timeout: 30000 })

    await expect(page.getByRole('heading', { name: 'Choose a lesson type' })).toBeVisible({
      timeout: 10000,
    })

    await page
      .getByRole('button', { name: /Scratch/ })
      .first()
      .click()

    await expect(page.getByRole('heading', { name: 'Choose a lesson type' })).not.toBeVisible({
      timeout: 5000,
    })
  })
})

test.describe('Builder — Python lesson metadata', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => localStorage.clear())
    await page.goto('builder/', { timeout: 30000 })
    // Choose Python to enter the builder
    await expect(page.getByRole('heading', { name: 'Choose a lesson type' })).toBeVisible({
      timeout: 10000,
    })
    await page
      .getByRole('button', { name: /Python/ })
      .first()
      .click()
    // Wait for builder to render
    await expect(page.getByRole('heading', { name: 'Choose a lesson type' })).not.toBeVisible({
      timeout: 5000,
    })
  })

  test('builder view contains a lesson-ID input field', async ({ page }) => {
    // LessonMetaPanel renders a text input for the lesson ID.
    // It is typically labelled "Lesson ID" or has a placeholder like "e.g. my-lesson".
    // NOTE: update the label or placeholder string if LessonMetaPanel changes.
    const idInput = page.getByLabel(/Lesson ID/i)
    await expect(idInput).toBeVisible({ timeout: 10000 })
  })

  test('builder view contains a lesson-title input field', async ({ page }) => {
    // LessonMetaPanel has a "Title" or "Lesson title" labelled input.
    // NOTE: update the label string if LessonMetaPanel changes.
    const titleInput = page.getByLabel(/title/i).first()
    await expect(titleInput).toBeVisible({ timeout: 10000 })
  })

  test('typing a lesson ID populates the input', async ({ page }) => {
    const idInput = page.getByLabel(/Lesson ID/i)
    await expect(idInput).toBeVisible({ timeout: 10000 })
    await idInput.fill('my-test-lesson')
    await expect(idInput).toHaveValue('my-test-lesson')
  })

  test('"New" button is visible in the builder toolbar', async ({ page }) => {
    // BuilderView has a "New" button in its toolbar (BuilderView.jsx line 584).
    // NOTE: update the name if the button label changes.
    const newBtn = page.getByRole('button', { name: /^New$/i })
    await expect(newBtn).toBeVisible({ timeout: 10000 })
  })
})
