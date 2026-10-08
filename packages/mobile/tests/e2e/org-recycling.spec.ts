// journeys: L12 L13 L14 L15
import { test, expect } from '@playwright/test'
import { adminClient, createContributor, makeOrgLeader, renameProfile, signInAsNewContributor, uniqueTitle } from './helpers'
import { partyPage, seedDropoff } from './org-fixtures'

/**
 * Recycling intake from the organisation's side: publish what the machines
 * take, a family books against that, the leader weighs it in (credit is minted
 * only here) or turns it away as contaminated, and the family's screen follows.
 */

test('what you take -> a family books -> the leader weighs and credits -> the family holds the credit', async ({
  page,
  browser,
  baseURL,
}) => {
  const leader = await signInAsNewContributor(page)
  const orgName = uniqueTitle('E2E Recycling Org')
  const orgId = await makeOrgLeader(leader.id, orgName)
  const family = await createContributor()
  const familyName = uniqueTitle('Recycling Family')
  await renameProfile(family.id, familyName)

  // L15: the leader publishes what they take. Nobody can book until a polymer is listed.
  await page.goto('/organisation/recycling')
  await expect(page.getByText('Nothing booked in right now.')).toBeVisible()
  await page.getByRole('button', { name: 'PLA', exact: true }).click()
  await page.getByLabel('Minimum', { exact: true }).fill('2')
  await page.getByLabel('Which door', { exact: true }).fill('Side gate')
  await page.getByRole('button', { name: 'Save what you take' }).click()
  await expect(page.getByText('Saved — contributors see this now.')).toBeVisible()
  const { data: org } = await adminClient()
    .from('organizations')
    .select('recycling_materials, recycling_min_kg, recycling_door')
    .eq('id', orgId)
    .single()
  expect(org).toEqual({ recycling_materials: ['PLA'], recycling_min_kg: 2, recycling_door: 'Side gate' })

  const familyPage = await partyPage(browser, baseURL, family)
  try {
    // The family books against it.
    await familyPage.goto('/explore/recycling')
    await familyPage.getByRole('button', { name: `Book a drop-off at ${orgName}` }).click()
    await familyPage.getByLabel('How much, roughly, in kilograms', { exact: true }).fill('3')
    await familyPage.getByRole('radio', { name: 'PLA', exact: true }).click()
    for (const line of [
      'Clean and dry, no food residue',
      'Labels and adhesive removed',
      'Sorted by polymer — PLA, PETG, ABS or PP',
      'No composites, nothing painted or coated',
      'Nothing smaller than a thumbnail',
      'No unknown plastics — if it is unmarked, leave it out',
      'Photographed before drop-off',
    ]) {
      await familyPage.getByRole('checkbox', { name: line }).click()
    }
    await familyPage.getByRole('button', { name: 'Book the drop-off' }).click()
    await expect(familyPage.getByText(`Booked — ${orgName} expects about`, { exact: false })).toBeVisible()

    const { data: booked } = await adminClient()
      .from('recycling_dropoffs')
      .select('id, status, material, estimated_grams, weighed_grams, credit_grams')
      .eq('org_id', orgId)
      .eq('contributor_id', family.id)
      .single()
    expect(booked).toEqual(
      expect.objectContaining({ status: 'booked', material: 'PLA', estimated_grams: 3000, weighed_grams: null, credit_grams: null })
    )

    // L12: it is in the leader's queue by the family's name, with no credit yet.
    await page.goto('/organisation/recycling')
    await expect(page.getByText('Booked in (1)')).toBeVisible()
    await expect(page.getByText(familyName, { exact: true }).first()).toBeVisible()
    await expect(familyPage.getByText('0 g of print credit unspent')).toBeVisible()

    // L13: weigh it. The credit box follows the weight (three quarters) until typed over.
    await page.getByLabel('Actual, in kilograms', { exact: true }).fill('3.2')
    await expect(page.getByLabel('Credit, in grams', { exact: true })).toHaveValue('2400')
    await page.getByRole('button', { name: `Weigh and credit ${familyName}'s drop-off` }).click()
    await expect(page.getByText(`Weighed at 3.2 kg — 2400 g credit issued to ${familyName}`)).toBeVisible()
    await expect(page.getByText('Nothing booked in right now.')).toBeVisible()

    const { data: weighed } = await adminClient()
      .from('recycling_dropoffs')
      .select('status, weighed_grams, credit_grams, decided_by')
      .eq('id', booked!.id)
      .single()
    expect(weighed).toEqual({ status: 'received', weighed_grams: 3200, credit_grams: 2400, decided_by: leader.id })

    // The family's balance and its drop-off row follow.
    await familyPage.reload()
    await expect(familyPage.getByText('2,400 g of print credit unspent')).toBeVisible()
    await expect(familyPage.getByText('+2400 g')).toBeVisible()
    await expect(familyPage.getByText('Credited', { exact: true })).toBeVisible()
  } finally {
    await familyPage.context().close()
  }
})

test('Contaminated turns the drop-off away: nothing is credited and it cannot be decided twice', async ({
  page,
  browser,
  baseURL,
}) => {
  const leader = await signInAsNewContributor(page)
  const orgId = await makeOrgLeader(leader.id, uniqueTitle('E2E Turning Away Org'))
  const family = await createContributor()
  const familyName = uniqueTitle('Contaminating Family')
  await renameProfile(family.id, familyName)
  const dropId = await seedDropoff(orgId, family.id, { estimated_grams: 4000 })

  await page.goto('/organisation/recycling')
  await expect(page.getByText('Booked in (1)')).toBeVisible()

  // Under the two-kilo floor the weigh button stays off.
  await page.getByLabel('Actual, in kilograms', { exact: true }).fill('1.5')
  await expect(page.getByRole('button', { name: `Weigh and credit ${familyName}'s drop-off` })).toBeDisabled()
  await expect(page.getByText('Under the 2 kg minimum', { exact: false })).toBeVisible()

  await page.getByRole('button', { name: `Turn away ${familyName}'s drop-off as contaminated` }).click()
  await expect(page.getByText('Nothing booked in right now.')).toBeVisible()
  await expect(page.getByText('Turned away', { exact: true })).toBeVisible()

  const { data: row } = await adminClient()
    .from('recycling_dropoffs')
    .select('status, weighed_grams, credit_grams, decided_by')
    .eq('id', dropId)
    .single()
  expect(row).toEqual({ status: 'declined', weighed_grams: null, credit_grams: null, decided_by: leader.id })

  const familyPage = await partyPage(browser, baseURL, family)
  try {
    await familyPage.goto('/explore/recycling')
    await expect(familyPage.getByText('Turned away', { exact: true })).toBeVisible()
    await expect(familyPage.getByText('0 g of print credit unspent')).toBeVisible()
  } finally {
    await familyPage.context().close()
  }
})
