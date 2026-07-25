import { test, expect } from '@playwright/test'

const TITLE = 'Seeded Switch-Adapted Bubble Machine'

test('tapping a tutorial navigates to its detail screen', async ({ page }) => {
  await page.goto('/home')
  await page.getByText(TITLE).click()

  // .last() throughout: the library screen stays mounted behind the detail
  // screen, so the title, description and badge each match twice.
  await expect(page.getByText(TITLE).last()).toBeVisible()
  await expect(page.getByText('A seeded, approved tutorial used by E2E tests.').last()).toBeVisible()
  await expect(page.getByText('Easy', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('Micro switch × 2')).toBeVisible()
  await expect(page.getByText('Soldering iron')).toBeVisible()
})

test('tapping Preview Tutorial navigates to the preview screen', async ({ page }) => {
  await page.goto('/home')
  await page.getByText(TITLE).click()
  await page.getByText('Preview Tutorial').click()

  await expect(page.getByText('Open in Browser')).toBeVisible()
})
