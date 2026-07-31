import { test, expect } from '@playwright/test'
import { signIn, createContributor, createTutorial, uniqueTitle, acceptTerms } from '../helpers'

test('a contributor sees their own tutorials and status badges on the dashboard', async ({ page }) => {
  const contributor = await createContributor()
  await createTutorial(contributor.id, { title: 'E2E Pending One', status: 'pending' })
  await createTutorial(contributor.id, { title: 'E2E Approved One', status: 'approved' })
  await createTutorial(contributor.id, {
    title: 'E2E Rejected One',
    status: 'rejected',
    rejection_note: 'Please add more detail.',
  })

  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  await expect(page.getByRole('heading', { name: 'My tutorials' })).toBeVisible()
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
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  await expect(page.getByText("You haven't submitted any tutorials yet.")).toBeVisible()
  const prompt = page.getByRole('link', { name: 'Upload your first tutorial' })
  await expect(prompt).toBeVisible()
  // Carried over from the deleted my-tutorials spec: visibility alone would
  // pass with the prompt wired to the wrong route.
  await expect(prompt).toHaveAttribute('href', '/upload')
})

test('a draft tutorial shows its badge and an edit link', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Draft')
  const draftId = await createTutorial(contributor.id, { title, status: 'draft' })
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  await expect(page.getByText('DRAFT', { exact: true })).toBeVisible()
  const row = page.getByTestId('tutorial-row').filter({ hasText: title })
  await expect(row.getByRole('link', { name: 'Edit' })).toHaveAttribute(
    'href',
    `/tutorials/${draftId}/edit`
  )
})

test('the status counts match the fixture set', async ({ page }) => {
  const contributor = await createContributor()
  await createTutorial(contributor.id, { title: uniqueTitle('E2E Count P1'), status: 'pending' })
  await createTutorial(contributor.id, { title: uniqueTitle('E2E Count P2'), status: 'pending' })
  await createTutorial(contributor.id, { title: uniqueTitle('E2E Count A1'), status: 'approved' })
  await createTutorial(contributor.id, { title: uniqueTitle('E2E Count R1'), status: 'rejected' })

  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  await expect(page.getByTestId('stat-pending')).toContainText('2')
  await expect(page.getByTestId('stat-approved')).toContainText('1')
  await expect(page.getByTestId('stat-rejected')).toContainText('1')
})
