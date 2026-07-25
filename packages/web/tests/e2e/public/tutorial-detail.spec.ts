import { test, expect } from '@playwright/test'
import { createContributor, createTutorial, uniqueTitle } from '../helpers'

test('the detail page renders a tutorial in full', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Detail')
  const tutorialId = await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto(`/tutorials/${tutorialId}`)

  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByText('Created by a Playwright E2E test.')).toBeVisible()
  await expect(page.getByText(new RegExp(`By\\s+${contributor.name}`))).toBeVisible()

  await expect(page.getByRole('link', { name: '📄 Download Tutorial PDF' })).toHaveAttribute(
    'href',
    'https://placeholder.invalid/tutorial.pdf'
  )
  await expect(page.getByRole('link', { name: '↓ e2e-mount.stl' })).toBeVisible()

  await expect(page.getByRole('heading', { name: '🔩 Parts needed' })).toBeVisible()
  await expect(page.getByText(/E2E part\s*×\s*2/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Buy E2E part from Jaycar' })).toBeVisible()

  await expect(page.getByRole('heading', { name: '🔧 Tools needed' })).toBeVisible()
  await expect(page.getByText('E2E tool')).toBeVisible()
})

test('an unknown tutorial id renders a 404', async ({ page }) => {
  const response = await page.goto('/tutorials/00000000-0000-0000-0000-000000000000')
  expect(response?.status()).toBe(404)
})
