import { test, expect } from '@playwright/test'
import { createTutorial, signInAsNewContributor, uniqueTitle } from './helpers'

// Option B (2026-10-06): every screen without the tab bar has Home at the top
// right, so a trail through guides, creators and organisations ends in one tap.

test('from an organisation reached through a guide, Home is one tap', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const author = uniqueTitle('E2E Nav Author')
  const org = uniqueTitle('E2E Nav Org')
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Nav Guide'), status: 'approved', contributorName: author, backedByOrg: org })

  await page.goto('/home')
  await page.goto(`/guides/${id}`)
  await page.getByText(`Backed by ${org}`).first().click()
  await expect(page).toHaveURL(/\/guides\/organisation\//)

  await page.getByRole('button', { name: 'Home', exact: true }).click()
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByText('Pick up where you left off').or(page.getByRole('button', { name: 'Edit' })).first()).toBeVisible()
})

test('Learn, which has no tab bar, carries one Home in its header and it goes Home', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.goto('/explore/learn')
  await expect(page.getByRole('button', { name: 'Home', exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: 'Home', exact: true }).click()
  await expect(page).toHaveURL(/\/home$/)
})
