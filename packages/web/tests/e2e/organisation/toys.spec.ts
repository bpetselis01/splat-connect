import { test, expect } from '@playwright/test'
import { adminClient, uniqueTitle } from '../helpers'
import { createLeaderSeat, createOrgToy, removeLeaderSeat, signInAs, type LeaderSeat } from './leader'

let shelf: LeaderSeat
let bare: LeaderSeat
let published: { id: string; name: string }
let retired: { id: string; name: string }

test.beforeAll(async () => {
  shelf = await createLeaderSeat(`Shelf Org ${Date.now()}`)
  bare = await createLeaderSeat(`Bare Org ${Date.now()}`)
  const db = adminClient()
  await db.from('organizations').update({ pickup_line1: '5 Association Way', pickup_suburb: 'Northbridge', pickup_state: 'NSW', pickup_postcode: '2063' }).eq('id', shelf.orgId)
  const name = uniqueTitle('Shelf bear')
  published = { id: await createOrgToy(shelf.orgId, { name, quantity: 3 }), name }
  const retiredName = uniqueTitle('Cracked drum')
  retired = {
    id: await createOrgToy(shelf.orgId, { name: retiredName, retired_at: new Date().toISOString(), retired_note: 'Cracked casing' }),
    name: retiredName,
  }
})

test.afterAll(async () => {
  await removeLeaderSeat(shelf)
  await removeLeaderSeat(bare)
})

test('WB10 an empty shelf offers "Add stock", and "Add to inventory" opens the organisation toy form', async ({ page }) => {
  await signInAs(page, bare)
  await page.goto('/dashboard/organisation/toys')
  await expect(page.getByText('No stock listed yet.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add stock' })).toHaveAttribute('href', '/dashboard/toys/new?for=org')
  await page.getByRole('link', { name: 'Add to inventory' }).click()
  await expect(page).toHaveURL('/dashboard/toys/new?for=org')
})

test('WB11 each card shows its stock, opens its editor and its public listing', async ({ page }) => {
  await signInAs(page, shelf)
  await page.goto('/dashboard/organisation/toys')
  const card = page.locator('article', { hasText: published.name })
  await expect(card).toContainText('3 in stock')
  await expect(card).toContainText('Available')
  await expect(page.locator('.count-chip', { hasText: 'On the shelf' })).toContainText('3')
  await expect(card.getByRole('link', { name: 'Listing' })).toHaveAttribute('href', `/toy-library/${published.id}`)
  await card.getByRole('link', { name: 'Edit' }).click()
  await expect(page).toHaveURL(`/dashboard/toys/${published.id}`)
})

test('WB12 a retired toy with no handover can be deleted after typing the phrase, and leaves the shelf', async ({ page }) => {
  await signInAs(page, shelf)
  await page.goto('/dashboard/organisation/toys')
  const card = page.locator('article', { hasText: retired.name })
  await expect(card).toContainText('Retired')
  await expect(card).toContainText('Cracked casing')
  await card.getByRole('button', { name: /Delete toy/ }).click()
  await page.getByLabel(/to confirm/i).fill('confirm_delete_toy')
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page).toHaveURL('/dashboard/organisation/toys')
  await expect(page.locator('article', { hasText: retired.name })).toHaveCount(0)
  const { data } = await adminClient().from('toys').select('id').eq('id', retired.id)
  expect(data).toEqual([])
})

test('WB13 an organisation with no pickup address is warned, and saving one clears the warning', async ({ page }) => {
  await signInAs(page, bare)
  await page.goto('/dashboard/organisation/toys')
  await expect(page.getByRole('alert').filter({ hasText: `${bare.orgName} has no pickup address yet` })).toBeVisible()
  await page.getByLabel('Street address').fill('9 Dock Rd')
  await page.getByLabel('Suburb').fill('Balmain')
  await page.getByLabel('State').fill('NSW')
  await page.getByLabel('Postcode').fill('2041')
  await page.getByRole('button', { name: 'Save pickup details' }).click()
  await expect(page.getByText('Pickup details saved.')).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'no pickup address yet' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByLabel('Street address')).toHaveValue('9 Dock Rd')
})
