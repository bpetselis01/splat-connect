import { test, expect } from '@playwright/test'

test('the library lists the seeded approved tutorial and hides the seeded pending one', async ({ page }) => {
  await page.goto('/library')

  await expect(page.getByRole('heading', { name: 'Toy Adaptation Library' })).toBeVisible()
  await expect(page.getByText('Seeded Switch-Adapted Bubble Machine')).toBeVisible()
  await expect(page.getByText('Seeded Pending Plush Toy')).toHaveCount(0)
})

test('the search box filters the grid by title', async ({ page }) => {
  await page.goto('/library')

  await page.getByPlaceholder('Search by toy name…').fill('Bubble Machine')
  await expect(page.getByText('Seeded Switch-Adapted Bubble Machine')).toBeVisible()

  await page.getByPlaceholder('Search by toy name…').fill('Nonexistent Toy Name')
  await expect(page.getByText('No tutorials found.')).toBeVisible()
})

test('the difficulty filter narrows the grid to the selected difficulty', async ({ page }) => {
  await page.goto('/library')

  await page.getByRole('button', { name: 'hard', exact: true }).click()
  await expect(page.getByText('Seeded Switch-Adapted Bubble Machine')).toHaveCount(0)

  await page.getByRole('button', { name: 'easy', exact: true }).click()
  await expect(page.getByText('Seeded Switch-Adapted Bubble Machine')).toBeVisible()
})
