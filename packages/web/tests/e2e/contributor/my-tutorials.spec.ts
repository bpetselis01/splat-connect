import { test, expect } from '@playwright/test'
import { signIn, createContributor, createTutorial, uniqueTitle, acceptTerms } from '../helpers'

test('every status renders with its badge and an edit link', async ({ page }) => {
  const contributor = await createContributor()
  const draft = uniqueTitle('E2E Mine Draft')
  const approved = uniqueTitle('E2E Mine Approved')
  const draftId = await createTutorial(contributor.id, { title: draft, status: 'draft' })
  await createTutorial(contributor.id, { title: approved, status: 'approved' })
  await acceptTerms(contributor.id)

  await signIn(page, contributor.email, contributor.password)
  // Wait for the post-login redirect: signIn only clicks the button, so
  // navigating straight away races the auth cookie being set.
  await page.waitForURL('**/dashboard')
  await page.goto('/my-tutorials')

  await expect(page.getByText(draft)).toBeVisible()
  await expect(page.getByText(approved)).toBeVisible()
  await expect(page.getByText('DRAFT', { exact: true })).toBeVisible()
  await expect(page.getByText('APPROVED', { exact: true })).toBeVisible()

  const row = page.getByTestId('tutorial-row').filter({ hasText: draft })
  await expect(row.getByRole('link', { name: 'Edit' })).toHaveAttribute(
    'href',
    `/tutorials/${draftId}/edit`
  )
})

test('a contributor with no tutorials sees the upload prompt', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  await signIn(page, contributor.email, contributor.password)
  // Wait for the post-login redirect: signIn only clicks the button, so
  // navigating straight away races the auth cookie being set.
  await page.waitForURL('**/dashboard')
  await page.goto('/my-tutorials')

  await expect(page.getByText("You haven't submitted any tutorials yet.")).toBeVisible()
  await expect(page.getByRole('link', { name: 'Upload your first tutorial' })).toHaveAttribute(
    'href',
    '/upload'
  )
})

test('a rejected tutorial shows its rejection note', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Mine Rejected')
  await createTutorial(contributor.id, {
    title,
    status: 'rejected',
    rejection_note: 'The wiring diagram is missing.',
  })
  await acceptTerms(contributor.id)

  await signIn(page, contributor.email, contributor.password)
  // Wait for the post-login redirect: signIn only clicks the button, so
  // navigating straight away races the auth cookie being set.
  await page.waitForURL('**/dashboard')
  await page.goto('/my-tutorials')

  await expect(page.getByText('The wiring diagram is missing.')).toBeVisible()
  await expect(page.getByText('REJECTED', { exact: true })).toBeVisible()
})
