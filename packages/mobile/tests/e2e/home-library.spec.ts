import { test, expect } from '@playwright/test'

const TITLE = 'Seeded Switch-Adapted Bubble Machine'

test('the library lists the seeded tutorial with its difficulty badge', async ({ page }) => {
  await page.goto('/home')

  await expect(page.getByText(TITLE)).toBeVisible()
  await expect(page.getByText('EASY', { exact: true })).toBeVisible()
})

test('search narrows the list and clearing it restores the tutorial', async ({ page }) => {
  await page.goto('/home')

  await page.getByPlaceholder('Search tutorials').fill('no such toy')
  await expect(page.getByText(TITLE)).toHaveCount(0)

  await page.getByPlaceholder('Search tutorials').fill('')
  await expect(page.getByText(TITLE)).toBeVisible()
})

test('the difficulty filter narrows results', async ({ page }) => {
  await page.goto('/home')

  await page.getByText('Medium', { exact: true }).click()
  await expect(page.getByText(TITLE)).toHaveCount(0)

  await page.getByText('Easy', { exact: true }).click()
  await expect(page.getByText(TITLE)).toBeVisible()
})
