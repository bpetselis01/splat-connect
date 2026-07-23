import { test, expect } from '@playwright/test'

const APPROVED_TUTORIAL_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

test('the detail page renders the seeded tutorial in full', async ({ page }) => {
  await page.goto(`/tutorials/${APPROVED_TUTORIAL_ID}`)

  await expect(page.getByRole('heading', { name: 'Seeded Switch-Adapted Bubble Machine' })).toBeVisible()
  await expect(page.getByText('A seeded, approved tutorial used by E2E tests.')).toBeVisible()
  await expect(page.getByText(/By\s+Seed Contributor/)).toBeVisible()

  await expect(page.getByRole('link', { name: '📄 Download Tutorial PDF' })).toHaveAttribute(
    'href',
    'https://placeholder.invalid/tutorial.pdf'
  )
  await expect(page.getByRole('link', { name: '↓ mount.stl' })).toBeVisible()

  await expect(page.getByRole('heading', { name: '🔩 Parts needed' })).toBeVisible()
  await expect(page.getByText(/Micro switch\s*×\s*2/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Buy Micro switch from Jaycar' })).toBeVisible()

  await expect(page.getByRole('heading', { name: '🔧 Tools needed' })).toBeVisible()
  await expect(page.getByText('Soldering iron')).toBeVisible()
})

test('an unknown tutorial id renders a 404', async ({ page }) => {
  const response = await page.goto('/tutorials/00000000-0000-0000-0000-000000000000')
  expect(response?.status()).toBe(404)
})
