import { test, expect } from '@playwright/test'
import {
  adminClient,
  createContributor,
  createTutorial,
  makeOrgLeader,
  renameProfile,
  signInAsNewContributor,
  uniqueTitle,
} from './helpers'
import { seedOrgToy } from './org-fixtures'

/**
 * Requests to your organisation: one queue in three tabs (lend a toy, print
 * parts, build a guide), the tab opens on whatever is waiting, finished records
 * are left out, and a row opens the thread that belongs to its type.
 */

async function seedRequest(
  orgId: string,
  requesterId: string,
  fields: Record<string, unknown>,
  status: 'requested' | 'accepted' | 'completed' = 'requested'
): Promise<string> {
  const { data, error } = await adminClient()
    .from('toy_transactions')
    .insert({ owner_org_id: orgId, requester_id: requesterId, status, ...fields })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedRequest failed: ${error?.message}`)
  return data.id
}

test('L16 L17 three tabs, the waiting count on each, finished requests left out, and each row opens its own thread', async ({ page }) => {
  const leader = await signInAsNewContributor(page)
  const orgId = await makeOrgLeader(leader.id, uniqueTitle('E2E Requests Org'))
  const family = await createContributor()
  const familyName = uniqueTitle('Asking Family')
  await renameProfile(family.id, familyName)
  const author = await createContributor()

  const toyName = uniqueTitle('E2E Requested Bear')
  const doneToyName = uniqueTitle('E2E Finished Bear')
  const toyId = await seedOrgToy(orgId, { name: toyName })
  const doneToyId = await seedOrgToy(orgId, { name: doneToyName })
  const guideTitle = uniqueTitle('E2E Requested Guide')
  const tutorialId = await createTutorial(author.id, { title: guideTitle })

  const { data: printer, error } = await adminClient()
    .from('printers')
    .insert({ owner_org_id: orgId, name: 'E2E Org Printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 })
    .select('id')
    .single()
  if (error || !printer) throw new Error(error?.message)

  const donationId = await seedRequest(orgId, family.id, { type: 'donation', toy_id: toyId })
  await seedRequest(orgId, family.id, { type: 'donation', toy_id: doneToyId }, 'completed')
  const printId = await seedRequest(orgId, family.id, { type: 'print', tutorial_id: tutorialId, printer_id: printer.id })
  const buildId = await seedRequest(orgId, family.id, { type: 'build', tutorial_id: tutorialId })

  await page.goto('/organisation/requests')

  // L16: opens on a tab with something waiting; each tab carries its own count.
  await expect(page.getByRole('radio', { name: 'Lend a toy · 1' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Print parts · 1' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Build a guide · 1' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Lend a toy · 1' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: `${familyName}, ${toyName}` })).toBeVisible()
  // The completed one is not in the queue.
  await expect(page.getByText(doneToyName)).toHaveCount(0)

  // L17: the toy row opens the exchange thread.
  await page.getByRole('button', { name: `${familyName}, ${toyName}` }).click()
  await expect(page).toHaveURL(new RegExp(`/exchanges/${donationId}$`))
  await page.goBack()

  await page.getByRole('radio', { name: 'Print parts · 1' }).click()
  await page.getByRole('button', { name: `${familyName}, ${guideTitle} — parts` }).click()
  await expect(page).toHaveURL(new RegExp(`/printing/jobs/${printId}$`))
  await page.goBack()

  await page.getByRole('radio', { name: 'Build a guide · 1' }).click()
  await page.getByRole('button', { name: `${familyName}, ${guideTitle}` }).click()
  await expect(page).toHaveURL(new RegExp(`/exchanges/build/${buildId}$`))
})

test('an accepted request stays in the queue without counting as waiting; with none, the tab says so', async ({ page }) => {
  const leader = await signInAsNewContributor(page)
  const orgId = await makeOrgLeader(leader.id, uniqueTitle('E2E Accepted Requests Org'))
  const family = await createContributor()
  await renameProfile(family.id, uniqueTitle('Waiting Family'))
  const toyName = uniqueTitle('E2E Accepted Bear')
  await seedRequest(orgId, family.id, { type: 'donation', toy_id: await seedOrgToy(orgId, { name: toyName }) }, 'accepted')

  await page.goto('/organisation/requests')
  await expect(page.getByRole('radio', { name: 'Lend a toy', exact: true })).toBeVisible()
  await expect(page.getByText(toyName)).toBeVisible()
  await page.getByRole('radio', { name: 'Print parts', exact: true }).click()
  await expect(page.getByText('No part requests yet.')).toBeVisible()
})
