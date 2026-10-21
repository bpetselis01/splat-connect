import { test, expect } from '@playwright/test'
import {
  adminClient,
  createContributor,
  createPublishedToy,
  makeOrgLeader,
  renameProfile,
  signInAsNewContributor,
  uniqueTitle,
} from './helpers'
import { partyPage, seedOrgToy } from './org-fixtures'

/**
 * The numbers around a toy that must move the moment its owner acts, without
 * the page being reloaded: the "N families have asked" line, the editor's
 * "N offers" row, the unavailable toggle, and the toy appearing in the library.
 * Every test reads the row it changed back from the database.
 */

async function seedRequest(toyId: string, requesterId: string, owner: { ownerId?: string; orgId?: string }) {
  const { data, error } = await adminClient()
    .from('toy_transactions')
    .insert({
      type: 'donation',
      status: 'requested',
      toy_id: toyId,
      requester_id: requesterId,
      owner_id: owner.ownerId ?? null,
      owner_org_id: owner.orgId ?? null,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedRequest failed: ${error?.message}`)
  return data.id as string
}

async function statusOf(txId: string) {
  const { data } = await adminClient().from('toy_transactions').select('status').eq('id', txId).single()
  return data?.status
}

test('W03: accepting one request inline takes it out of "families have asked" at once', async ({ page }) => {
  const leader = await signInAsNewContributor(page)
  const orgId = await makeOrgLeader(leader.id, uniqueTitle('E2E Offers Org'))
  // An organisation's pickup point is fixed; accepting reads it from the org.
  await adminClient()
    .from('organizations')
    .update({ pickup_line1: '1 Org St', pickup_suburb: 'Testville', pickup_state: 'VIC', pickup_postcode: '3000' })
    .eq('id', orgId)
  const toyId = await seedOrgToy(orgId, { name: uniqueTitle('E2E Asked Bear'), quantity: 2 })
  const familyA = await createContributor()
  const familyB = await createContributor()
  await renameProfile(familyA.id, uniqueTitle('Asker A'))
  await renameProfile(familyB.id, uniqueTitle('Asker B'))
  const txA = await seedRequest(toyId, familyA.id, { orgId })
  const txB = await seedRequest(toyId, familyB.id, { orgId })

  await page.goto(`/toys/${toyId}`)
  await expect(page.getByText('2 families have asked for it.')).toBeVisible()

  await page.getByRole('button', { name: 'Accept', exact: true }).first().click()
  await expect(page.getByText('1 family has asked for it.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(1)

  const statuses = [await statusOf(txA), await statusOf(txB)].sort()
  expect(statuses).toEqual(['accepted', 'requested'])
})

test('W04: Mark unavailable flips the row at once and the toy stops taking requests for everyone else', async ({
  page,
  browser,
  baseURL,
}) => {
  const owner = await signInAsNewContributor(page)
  const toyId = await createPublishedToy(owner.id, { name: uniqueTitle('E2E Paused Toy'), offer_type: 'donation' })
  const other = await createContributor()
  const otherPage = await partyPage(browser, baseURL, other)
  try {
    await page.goto(`/toys/${toyId}`)
    await page.getByRole('button', { name: /^Mark unavailable/ }).click()
    await expect(page.getByRole('button', { name: 'Take requests again' })).toBeVisible()
    const paused = await adminClient().from('toys').select('paused_at').eq('id', toyId).single()
    expect(paused.data?.paused_at).not.toBeNull()

    await otherPage.goto(`/toy-library/${toyId}`)
    await expect(otherPage.getByText('Not taking requests right now')).toBeVisible()

    await page.getByRole('button', { name: 'Take requests again' }).click()
    await expect(page.getByRole('button', { name: /^Mark unavailable/ })).toBeVisible()
    const open = await adminClient().from('toys').select('paused_at').eq('id', toyId).single()
    expect(open.data?.paused_at).toBeNull()
  } finally {
    await otherPage.context().close()
  }
})

test('W09: publishing puts the toy in the library for everyone, and the editor says so without a reload', async ({
  page,
  browser,
  baseURL,
}) => {
  const owner = await signInAsNewContributor(page)
  const name = uniqueTitle('E2E Publish Toy')
  const { data, error } = await adminClient()
    .from('toys')
    .insert({
      owner_id: owner.id,
      name,
      condition: 7,
      status: 'draft',
      offer_type: 'donation',
      photo_urls: ['https://placeholder.invalid/photo.jpg'],
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message)
  const toyId = data.id as string
  const other = await createContributor()
  const otherPage = await partyPage(browser, baseURL, other)
  try {
    await otherPage.goto('/toy-library')
    await otherPage.getByPlaceholder('Search toys').fill(name)
    await expect(otherPage.getByText('No toys here yet')).toBeVisible()

    await page.goto(`/toys/${toyId}/edit`)
    await page.getByRole('tab', { name: 'Review' }).click()
    await page.getByRole('button', { name: 'Publish to the Toy Library', exact: true }).click()
    await expect(page.getByText('✓ Published · in the Toy Library')).toBeVisible()
    const row = await adminClient().from('toys').select('status').eq('id', toyId).single()
    expect(row.data?.status).toBe('published')

    await otherPage.goto('/toy-library')
    await otherPage.getByPlaceholder('Search toys').fill(name)
    await expect(otherPage.getByRole('button', { name, exact: true })).toBeVisible()
  } finally {
    await otherPage.context().close()
  }
})

test('W12: answering an offer on another screen drops the editor\'s "N offers" when you come back', async ({ page }) => {
  const owner = await signInAsNewContributor(page)
  const toyId = await createPublishedToy(owner.id, { name: uniqueTitle('E2E Offers Toy'), offer_type: 'donation' })
  const familyA = await createContributor()
  const familyB = await createContributor()
  const nameA = uniqueTitle('Offerer A')
  await renameProfile(familyA.id, nameA)
  await renameProfile(familyB.id, uniqueTitle('Offerer B'))
  const txA = await seedRequest(toyId, familyA.id, { ownerId: owner.id })
  await seedRequest(toyId, familyB.id, { ownerId: owner.id })

  await page.goto(`/toys/${toyId}/edit`)
  await page.getByRole('tab', { name: 'Review' }).click()
  await expect(page.getByText('2 offers on this toy · Waiting on you')).toBeVisible()

  await page.getByText('2 offers on this toy · Waiting on you').click()
  await page.waitForURL(/\/exchanges\?toy=/)
  await page.getByText(nameA).first().click()
  await page.waitForURL(new RegExp(`/exchanges/${txA}`))
  await page.getByRole('button', { name: 'Decline', exact: true }).click()
  await page.getByLabel('Reason for declining').fill('Already promised')
  await page.getByRole('button', { name: 'Send the decline' }).click()
  await expect.poll(() => statusOf(txA)).toBe('rejected')

  await page.goBack()
  await page.goBack()
  await page.getByRole('tab', { name: 'Review' }).click()
  await expect(page.getByText('1 offer on this toy · Waiting on you')).toBeVisible()
})
