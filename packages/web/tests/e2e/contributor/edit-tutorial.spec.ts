import { test, expect } from '@playwright/test'
import { signIn, createContributor, createTutorial } from '../helpers'

test('editing an approved tutorial resets its status to pending', async ({ page }) => {
  const contributor = await createContributor()
  const tutorialId = await createTutorial(contributor.id, {
    title: 'E2E Approved Edit Target',
    status: 'approved',
  })

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto(`/tutorials/${tutorialId}/edit`)
  await expect(page.locator('input[name="title"]')).toHaveValue('E2E Approved Edit Target')

  await page.locator('input[name="title"]').fill('E2E Approved Edit Target (updated)')
  await page.getByRole('button', { name: 'Save details' }).click()
  await page.waitForLoadState('networkidle')

  // The edit page's own field can lag a save (a known re-render quirk for
  // everything except the difficulty <select>) — re-check on the dashboard,
  // which is server-rendered fresh from the database on every request.
  await page.goto('/dashboard')
  await expect(page.getByText('E2E Approved Edit Target (updated)')).toBeVisible()
  await expect(page.getByText('PENDING', { exact: true })).toBeVisible()
})

test('a contributor cannot edit another contributor\'s tutorial', async ({ page }) => {
  const owner = await createContributor()
  const outsider = await createContributor()
  const tutorialId = await createTutorial(owner.id, { title: 'E2E Not Yours', status: 'draft' })

  await signIn(page, outsider.email, outsider.password)
  await page.waitForURL('**/dashboard')
  await page.goto(`/tutorials/${tutorialId}/edit`)

  await page.waitForURL('**/dashboard')
})
