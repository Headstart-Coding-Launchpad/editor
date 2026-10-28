import { test, expect } from '@playwright/test'

// CI smoke: the app boots in a real browser and its first screens render.
// No Firebase calls: CI runs this against a dummy Firebase config (ci.yml, smoke job).

test('landing page shows the lesson-code form', async ({ page }) => {
  const errors = []
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('', { timeout: 30000 })

  await expect(page.getByText('Join a lesson')).toBeVisible({ timeout: 15000 })
  await expect(page.getByLabel('Enter your lesson code')).toBeVisible()
  expect(errors).toEqual([])
})

test('login page shows the sign-in form', async ({ page }) => {
  await page.goto('#/login', { timeout: 30000 })

  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible({ timeout: 15000 })
  await expect(page.getByLabel(/email/i)).toBeVisible()
  await expect(page.getByLabel(/password/i)).toBeVisible()
})
