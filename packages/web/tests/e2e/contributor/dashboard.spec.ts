import { test, expect } from '@playwright/test'
import { signIn, createContributor, createTutorial } from '../helpers'

test('a contributor sees their own tutorials and status badges on the dashboard', async ({ page }) => {
  const contributor = await createContributor()
  await createTutorial(contributor.id, { title: 'E2E Pending One', status: 'pending' })
  await createTutorial(contributor.id, { title: 'E2E Approved One', status: 'approved' })
  await createTutorial(contributor.id, {
    title: 'E2E Rejected One',
    status: 'rejected',
    rejection_note: 'Please add more detail.',
  })

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText('E2E Pending One')).toBeVisible()
  await expect(page.getByText('E2E Approved One')).toBeVisible()
  await expect(page.getByText('E2E Rejected One')).toBeVisible()
  await expect(page.getByText('Please add more detail.')).toBeVisible()
  await expect(page.getByText('PENDING', { exact: true })).toBeVisible()
  await expect(page.getByText('APPROVED', { exact: true })).toBeVisible()
  await expect(page.getByText('REJECTED', { exact: true })).toBeVisible()
})

test('a contributor with no tutorials sees the empty-state prompt', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  await expect(page.getByText("You haven't submitted any tutorials yet.")).toBeVisible()
  await expect(page.getByRole('link', { name: 'Upload your first tutorial' })).toBeVisible()
})
