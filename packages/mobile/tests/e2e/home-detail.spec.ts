import { test, expect } from '@playwright/test'
import { createContributor, createTutorial, uniqueTitle } from './helpers'

test('tapping a tutorial navigates to its detail screen', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Mobile Detail')
  await createTutorial(contributor.id, { title, status: 'approved', difficulty: 'easy' })

  await page.goto('/home')
  await page.getByText(title).click()

  // .last() throughout: the library screen stays mounted behind the detail
  // screen, so the title, description and badge each match twice.
  await expect(page.getByText(title).last()).toBeVisible()
  await expect(page.getByText('Created by a Playwright E2E test.').last()).toBeVisible()
  await expect(page.getByText('Easy', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('E2E part × 2')).toBeVisible()
  await expect(page.getByText('E2E tool')).toBeVisible()
})

test('tapping Preview Tutorial navigates to the preview screen', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Mobile Preview')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/home')
  await page.getByText(title).click()
  await page.getByText('Preview Tutorial').click()

  await expect(page.getByText('Open in Browser')).toBeVisible()
})
