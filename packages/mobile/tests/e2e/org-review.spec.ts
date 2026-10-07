// journeys: L03 L05
import { test, expect } from '@playwright/test'
import {
  adminClient,
  createContributor,
  createTutorial,
  makeOrgLeader,
  requestBacking,
  signInAsNewContributor,
  uniqueTitle,
} from './helpers'

/**
 * The review detail's two smaller buttons: the leader opens the guide's PDF to
 * check it, and declines a backing request.
 */

test('Open the tutorial PDF opens the guide preview with a signed link to the file', async ({ page }) => {
  const leader = await signInAsNewContributor(page)
  const orgId = await makeOrgLeader(leader.id)
  const author = await createContributor()
  const tutorialId = await createTutorial(author.id, { title: uniqueTitle('E2E Reviewable PDF Guide'), status: 'pending' })
  await requestBacking(tutorialId, orgId)

  await page.goto(`/organisation/${tutorialId}`)
  await page.getByRole('button', { name: 'Open the tutorial PDF' }).click()

  await expect(page).toHaveURL(new RegExp(`/guides/${tutorialId}/preview`))
  const pdfUrl = new URL(page.url()).searchParams.get('pdfUrl')
  expect(pdfUrl).toContain('/storage/v1/object/sign/tutorial-pdfs/')
  expect(pdfUrl).toContain(tutorialId)
  await expect(page.getByText('No PDF is available for this tutorial yet.')).toHaveCount(0)
})

test('Decline turns the backing down: the row says declined and the guide leaves the queue', async ({ page }) => {
  const leader = await signInAsNewContributor(page)
  const orgId = await makeOrgLeader(leader.id)
  const author = await createContributor()
  const title = uniqueTitle('E2E Declinable Guide')
  const tutorialId = await createTutorial(author.id, { title, status: 'pending' })
  await requestBacking(tutorialId, orgId)

  await page.goto('/organisation')
  await page.getByRole('button', { name: title }).click()
  await page.getByRole('button', { name: 'Decline' }).click()

  // A declined project is no longer the leader's to read, so the screen leaves
  // it for the queue rather than keeping a stale Back/Decline pair up.
  await expect(page).toHaveURL(/\/organisation$/)
  await expect(page.getByRole('button', { name: 'Decline' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Back this guide' })).toBeHidden()
  const { data: backing } = await adminClient()
    .from('tutorial_orgs')
    .select('status')
    .eq('tutorial_id', tutorialId)
    .eq('org_id', orgId)
    .single()
  expect(backing?.status).toBe('declined')
  // Declining is not rejecting the guide: it is still pending for someone else.
  const { data: tutorial } = await adminClient().from('tutorials').select('status').eq('id', tutorialId).single()
  expect(tutorial?.status).toBe('pending')

  await page.goto('/organisation')
  await expect(page.getByRole('button', { name: title })).toBeHidden()
})
