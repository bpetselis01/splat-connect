import { test, expect } from '@playwright/test'
import {
  createContributor,
  createTutorial,
  makeOrgLeader,
  requestBacking,
  signInAsNewContributor,
  uniqueTitle,
} from './helpers'

/**
 * The leader surfaces end to end: the queue fills from a backing request, the
 * detail backs the guide, and a submitted guide is approved with the org's
 * authority — or sent back with a note, which the API refuses to take blank.
 */

test('a backing request walks the queue: back it, then approve the submission', async ({ page }) => {
  const leader = await signInAsNewContributor(page)
  const orgId = await makeOrgLeader(leader.id)
  const author = await createContributor()
  const title = uniqueTitle('E2E Backable Guide')
  // status pending = already submitted, so approving becomes available the
  // moment the backing is accepted.
  const tutorialId = await createTutorial(author.id, { title, status: 'pending' })
  await requestBacking(tutorialId, orgId)

  await page.goto('/organisation')
  await expect(page.getByText('Waiting on you')).toBeVisible()
  await page.getByRole('button', { name: title }).click()

  // The pending backing offers Back/Decline.
  await page.getByRole('button', { name: 'Back this guide' }).click()

  // Accepted backing + pending tutorial = the review pair, on the same screen.
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible()
  await page.getByRole('button', { name: 'Approve' }).click()

  // Nothing left to do: the action pair goes away.
  await expect(page.getByRole('button', { name: 'Approve' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Back this guide' })).toBeHidden()

  // And the guide is now public.
  await page.goto('/guides')
  await page.getByPlaceholder('Search by toy name').fill(title)
  await expect(page.getByRole('button', { name: title })).toBeVisible()
})

test('requesting changes will not travel without a note', async ({ page }) => {
  const leader = await signInAsNewContributor(page)
  const orgId = await makeOrgLeader(leader.id)
  const author = await createContributor()
  const title = uniqueTitle('E2E Reviewable Guide')
  const tutorialId = await createTutorial(author.id, { title, status: 'pending' })
  await requestBacking(tutorialId, orgId, 'accepted')

  await page.goto(`/organisation/${tutorialId}`)

  await page.getByRole('button', { name: 'Request changes' }).click()
  await expect(
    page.getByText('Say what needs to change — the note goes to the contributor.')
  ).toBeVisible()

  await page.getByLabel('Note to the contributor').fill('The parts list is missing quantities.')
  await page.getByRole('button', { name: 'Request changes' }).click()

  // Rejected: the pair goes away, and the queue no longer waits on it.
  await expect(page.getByRole('button', { name: 'Approve' })).toBeHidden()
  await page.goto('/organisation')
  await expect(page.getByRole('button', { name: title })).toBeHidden()
})

test('the inventory shows org stock with its quantity', async ({ page }) => {
  const leader = await signInAsNewContributor(page)
  const orgId = await makeOrgLeader(leader.id)
  const name = uniqueTitle('E2E Org Bear')
  const { adminClient } = await import('./helpers')
  const { error } = await adminClient()
    .from('toys')
    .insert({ owner_org_id: orgId, name, condition: 8, quantity: 5, status: 'published', offer_type: 'donation' })
  if (error) throw new Error(error.message)

  await page.goto('/organisation/toys')
  await expect(page.getByText(name)).toBeVisible()
  await expect(page.getByText('5', { exact: true })).toBeVisible()
})

test('a non-leader is told whose screen this is', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.goto('/organisation')
  await expect(page.getByText('This screen belongs to organisation leaders.')).toBeVisible()
})
