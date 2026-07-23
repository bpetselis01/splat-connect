import { test, expect } from '@playwright/test'

const TITLE = 'Seeded Switch-Adapted Bubble Machine'

test('tapping a tutorial navigates to its detail screen', async ({ page }) => {
  await page.goto('/home')
  await page.getByText(TITLE).click()

  await expect(page.getByText(TITLE).last()).toBeVisible()
  await expect(page.getByText('A seeded, approved tutorial used by E2E tests.')).toBeVisible()
  await expect(page.getByText('EASY', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('Micro switch × 2')).toBeVisible()
  await expect(page.getByText('Soldering iron')).toBeVisible()
})

test('tapping Preview Tutorial navigates to the preview screen', async ({ page }) => {
  await page.goto('/home')
  await page.getByText(TITLE).click()
  await page.getByText('Preview Tutorial').click()

  await expect(page.getByText('Open in Browser')).toBeVisible()
})
