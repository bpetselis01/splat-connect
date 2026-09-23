import { test, expect } from '@playwright/test'
import { signIn, createContributor, createAdmin, createTutorial, uniqueTitle, acceptTerms, adminClient } from '../helpers'

/**
 * Wait for the review action to land in the database, not for the network to
 * go quiet. The Approve/Reject buttons submit a server action; if the click
 * comes before hydration the browser posts the form natively, networkidle
 * resolves against the still-current document, and the next page.goto()
 * cancels that navigation — the tutorial stays pending and the contributor's
 * dashboard never shows the note. Polling the row is the same wait
 * edit-tutorial.spec.ts uses for uploads.
 */
async function expectStatus(tutorialId: string, status: string) {
  await expect
    .poll(async () => {
      const { data } = await adminClient().from('tutorials').select('status').eq('id', tutorialId).single()
      return data?.status
    }, { timeout: 30_000 })
    .toBe(status)
}

test('an admin approves a pending tutorial and it appears in the public library', async ({ page }) => {
  const contributor = await createContributor()
  const admin = await createAdmin()
  const title = uniqueTitle('E2E Review Target Approve')
  const tutorialId = await createTutorial(contributor.id, { title, status: 'pending' })

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')

  await page.goto('/admin/review')
  // A plain click opens the side pane on the queue (39672abf); the row is still
  // a link to the full page, which is what a click before hydration follows —
  // so let the page settle first.
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: new RegExp(title) }).click()
  await page.waitForURL(`**/admin/review?selected=${tutorialId}`)

  const pane = page.getByRole('complementary', { name: `Reviewing ${title}` })
  await pane.getByRole('button', { name: 'Approve', exact: true }).click()
  await expectStatus(tutorialId, 'approved')

  await page.goto('/library')
  await expect(page.getByText(title)).toBeVisible()
})

test('an admin rejects a pending tutorial with a note visible to the contributor', async ({ page }) => {
  const contributor = await createContributor()
  const admin = await createAdmin()
  const title = uniqueTitle('E2E Review Target Reject')
  const tutorialId = await createTutorial(contributor.id, { title, status: 'pending' })
  await acceptTerms(contributor.id)

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')
  await page.goto(`/admin/review/${tutorialId}`)
  await page.waitForLoadState('networkidle')

  await page.locator('textarea[name="note"]').fill('Needs clearer photos.')
  await page.getByRole('button', { name: 'Send back to the author' }).click()
  await expectStatus(tutorialId, 'rejected')

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto('/dashboard/tutorials')
  // The card's stage pill says what the contributor must do, not the raw status
  // (ac7791e2): a rejected guide is "Needs you".
  const card = page.getByTestId('tutorial-row').filter({ hasText: title })
  await expect(card.getByText('Needs clearer photos.')).toBeVisible()
  await expect(card.getByText('Needs you', { exact: true })).toBeVisible()
})

test('the review queue lists a pending tutorial with how long it has waited', async ({ page }) => {
  const contributor = await createContributor()
  const admin = await createAdmin()
  const title = uniqueTitle('E2E Queue Listed')
  await createTutorial(contributor.id, { title, status: 'pending' })

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')
  await page.goto('/admin/review')

  // The queue is the board's table since ac0e9ff7: the submitted date became
  // its WAITING cell, an age ("0 hours", "3 days") rather than a date.
  const row = page.getByRole('row', { name: new RegExp(title) })
  await expect(row.getByRole('link', { name: title })).toBeVisible()
  await expect(row.getByRole('cell', { name: /^\d+ (hour|day)s?$/ })).toBeVisible()
})

test('the review detail page renders parts, tools, STL files and the PDF link', async ({ page }) => {
  const contributor = await createContributor()
  const admin = await createAdmin()
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Queue Detail'),
    status: 'pending',
  })

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')
  await page.goto(`/admin/review/${id}`)

  // The board's review sheet since a1535727 — one card per section, each with
  // its own state — rather than the public TutorialView. File links still go
  // through /files.
  const section = (name: string) =>
    page.locator('section').filter({ has: page.getByRole('heading', { name, exact: true }) })
  await expect(section('Parts')).toContainText('E2E part × 2')
  await expect(section('Tools')).toContainText('E2E tool')
  await expect(page.getByRole('link', { name: 'The guide (PDF)' })).toHaveAttribute(
    'href',
    `/files/tutorial-pdfs/${id}/tutorial.pdf`
  )
  await expect(page.getByRole('link', { name: 'e2e-mount.stl' })).toHaveAttribute(
    'href',
    `/files/stl-files/${id}/e2e-mount.stl`
  )
})

/**
 * This test used to assert the opposite — that an approved tutorial 404s here. That
 * was the second of the two functional holes: an admin who found bad published work
 * had no route in the UI to take it down, though the API allowed it and an
 * integration test covered it. The page now follows the tutorial's state.
 */
test('an approved tutorial opens read-only with an unpublish control', async ({ page }) => {
  const contributor = await createContributor()
  const admin = await createAdmin()
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Already Approved'),
    status: 'approved',
  })

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')

  const response = await page.goto(`/admin/review/${id}`)
  expect(response?.status()).toBe(200)
  // Unpublish, not Reject: the tutorial was live and a parent may have used it.
  await expect(page.getByRole('button', { name: /^Unpublish$/ })).toBeVisible()
  // And the submission controls are gone — approving what is already approved is
  // not an action, and Reject would be the wrong word for taking down live work.
  await expect(page.getByRole('button', { name: /Approve/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Reject/ })).toHaveCount(0)
})

test('rejecting without a note shows the contributor the fallback text', async ({ page }) => {
  const contributor = await createContributor()
  const admin = await createAdmin()
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Reject No Note'),
    status: 'pending',
  })
  await acceptTerms(contributor.id)

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')
  await page.goto(`/admin/review/${id}`)
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Send back to the author' }).click()
  await expectStatus(id, 'rejected')

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto('/dashboard/tutorials')
  await expect(page.getByText('No feedback was provided.')).toBeVisible()
})
