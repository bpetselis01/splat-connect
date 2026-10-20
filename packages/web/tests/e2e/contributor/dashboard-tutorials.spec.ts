import { test, expect } from '@playwright/test'
import { signIn, createContributor, createTutorial, createNotification, adminClient, uniqueTitle, acceptTerms } from '../helpers'

test('WT36 a contributor sees their own tutorials and status badges on the dashboard', async ({ page }) => {
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

test('WT38 a contributor with no tutorials sees the empty-state prompt, which leads to /upload', async ({ page }) => {
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
  await prompt.click()
  await expect(page).toHaveURL(/\/upload$/)
  await expect(page.getByRole('heading', { name: 'Add a tutorial' })).toBeVisible()
})

test('WT39 a draft tutorial shows its badge, and opening its card lands in the editor', async ({ page }) => {
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
  await card.click()
  await expect(page).toHaveURL(new RegExp(`/tutorials/${draftId}/edit$`))
  await expect(page.getByRole('tab', { name: /^Status/ })).toBeVisible()
})

test('WT36 the status counts match the fixture set, and a chip narrows the list to that stage', async ({ page }) => {
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

  await filter.getByRole('link', { name: 'Waiting 2' }).click()
  await expect(page).toHaveURL(/stage=waiting/)
  await expect(page.getByTestId('tutorial-row')).toHaveCount(2)
  await expect(page.getByTestId('tutorial-row').filter({ hasText: 'Count A1' })).toHaveCount(0)
})

test('WT37 opening My tutorials clears the unread tutorials notifications', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Unread Thanks'), status: 'approved' })
  await createNotification(contributor.id, { type: 'tutorial_thanked', tutorial_id: id, tutorial_title: 'E2E Unread Thanks' })
  const unread = async () =>
    (await adminClient().from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', contributor.id).is('read_at', null)).count

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await expect(page.getByRole('link', { name: /Notifications/ })).toContainText('1')
  expect(await unread()).toBe(1)

  await page.goto('/dashboard/tutorials')
  await expect.poll(unread).toBe(0)
  await page.goto('/dashboard')
  await expect(page.getByRole('link', { name: /Notifications/ })).not.toContainText('1')
})
