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
  await page.goto('/dashboard/tutorials')

  await expect(page.getByRole('heading', { name: 'My tutorials' })).toBeVisible()
  // Each card carries a stage pill in the board's words (ac7791e2): pending is
  // Waiting, approved is Live, rejected is Needs you.
  const card = (title: string) => page.getByTestId('tutorial-row').filter({ hasText: title })
  await expect(card('E2E Pending One').getByText('Waiting', { exact: true })).toBeVisible()
  await expect(card('E2E Approved One').getByText('Live', { exact: true })).toBeVisible()
  await expect(card('E2E Rejected One').getByText('Needs you', { exact: true })).toBeVisible()
  await expect(card('E2E Rejected One').getByText('Please add more detail.')).toBeVisible()
})

test('a contributor with no tutorials sees the empty-state prompt', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto('/dashboard/tutorials')

  await expect(page.getByText("You haven't submitted any tutorials yet.")).toBeVisible()
  const prompt = page.getByRole('link', { name: 'Upload your first tutorial' })
  await expect(prompt).toBeVisible()
  // Carried over from the deleted my-tutorials spec: visibility alone would
  // pass with the prompt wired to the wrong route.
  await expect(prompt).toHaveAttribute('href', '/upload')
})

test('a draft tutorial shows its badge, and its whole card links to the editor', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Draft')
  const draftId = await createTutorial(contributor.id, { title, status: 'draft' })
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto('/dashboard/tutorials')

  // The card itself is the link now — there is no separate Edit button.
  const card = page.getByTestId('tutorial-row').filter({ hasText: title })
  await expect(card.getByText('Draft', { exact: true })).toBeVisible()
  await expect(card).toHaveAttribute('href', `/tutorials/${draftId}/edit`)
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
  await page.goto('/dashboard/tutorials')

  // The counts ride on the stage filter's chips since ac7791e2.
  const filter = page.getByRole('group', { name: 'Filter tutorials by stage' })
  await expect(filter.getByRole('link', { name: 'All 4' })).toBeVisible()
  await expect(filter.getByRole('link', { name: 'Waiting 2' })).toBeVisible()
  await expect(filter.getByRole('link', { name: 'Live 1' })).toBeVisible()
  await expect(filter.getByRole('link', { name: 'Needs you 1' })).toBeVisible()
  await expect(filter.getByRole('link', { name: 'Draft 0' })).toBeVisible()
})
