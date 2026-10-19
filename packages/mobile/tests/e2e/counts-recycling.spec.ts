// journeys: V04 V05 L12 L13
import { test, expect } from '@playwright/test'
import { adminClient, createContributor, makeOrgLeader, renameProfile, signInAsNewContributor, uniqueTitle } from './helpers'
import { partyPage } from './org-fixtures'

/**
 * The recycling numbers that must move without a reload: a family books (with a
 * photo) and the leader's "Recycling intake" count on Me goes 0 -> 1, the leader
 * weighs it and the count goes back to none, and the family's unspent credit on
 * the Recycling screen goes 0 -> 2,400 g. Each screen is reached again by in-app
 * navigation (tabs, rows, back), never by reloading or going to its URL twice.
 */

const DECLARATION = [
  'Clean and dry, no food residue',
  'Labels and adhesive removed',
  'Sorted by polymer — PLA, PETG, ABS or PP',
  'No composites, nothing painted or coated',
  'Nothing smaller than a thumbnail',
  'No unknown plastics — if it is unmarked, leave it out',
  'Photographed before drop-off',
]

test('book with a photo -> intake count 1 -> weigh and credit -> intake count clears and the family credit appears', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000)
  const leader = await signInAsNewContributor(page)
  const orgName = uniqueTitle('E2E Counts Recycling Org')
  const orgId = await makeOrgLeader(leader.id, orgName)
  const { error: orgError } = await adminClient()
    .from('organizations')
    .update({ recycling_materials: ['PLA'], recycling_min_kg: 2, recycling_door: 'Side gate' })
    .eq('id', orgId)
  if (orgError) throw new Error(`org recycling setup failed: ${orgError.message}`)
  const family = await createContributor()
  const familyName = uniqueTitle('Counts Family')
  await renameProfile(family.id, familyName)

  const meRow = (p: typeof page, label: string) => p.getByRole('button', { name: label, exact: true })

  // The leader starts on Me with nothing waiting at intake.
  await page.getByRole('tab', { name: /^Me(,|$)/ }).click()
  await expect(meRow(page, 'Recycling intake')).toHaveText(/Recycling intake$/)

  const familyPage = await partyPage(browser, baseURL, family)
  try {
    // V04: the family opens Recycling; no credit yet.
    await familyPage.getByRole('tab', { name: /^Me(,|$)/ }).click()
    await familyPage.getByRole('button', { name: 'Recycling', exact: true }).click()
    await expect(familyPage.getByText('0 g of print credit unspent')).toBeVisible()

    // V05: book the drop-off, with a photo (the web picker is a file chooser).
    await familyPage.getByRole('button', { name: `Book a drop-off at ${orgName}` }).click()
    await familyPage.getByLabel('How much, roughly, in kilograms', { exact: true }).fill('3')
    await familyPage.getByRole('radio', { name: 'PLA', exact: true }).click()
    for (const line of DECLARATION) await familyPage.getByRole('checkbox', { name: line }).click()
    const chooser = familyPage.waitForEvent('filechooser')
    await familyPage.getByRole('button', { name: 'Photo of the sorted plastic' }).click()
    await (await chooser).setFiles('tests/e2e/fixtures/test.jpg')
    await expect(familyPage.getByText('Photo of the sorted plastic', { exact: true })).toBeHidden() // the prompt gives way to the picture
    await familyPage.getByRole('button', { name: 'Book the drop-off' }).click()
    await expect(familyPage.getByText(`Booked — ${orgName} expects about`, { exact: false })).toBeVisible()
    // The family's own list shows it at once, still with no credit.
    await expect(familyPage.getByText('3.0 kg PLA')).toBeVisible()
    await expect(familyPage.getByText('0 g of print credit unspent')).toBeVisible()

    const { data: booked } = await adminClient()
      .from('recycling_dropoffs')
      .select('id, status, estimated_grams, photo_url, credit_grams')
      .eq('org_id', orgId)
      .eq('contributor_id', family.id)
      .single()
    expect(booked).toMatchObject({ status: 'booked', estimated_grams: 3000, credit_grams: null })
    expect(booked!.photo_url).toContain(family.id)

    // L12: the leader goes Me -> Home -> Me and the intake row now counts one.
    await page.getByRole('tab', { name: 'Home', exact: true }).click()
    await page.getByRole('tab', { name: /^Me(,|$)/ }).click()
    await expect(meRow(page, 'Recycling intake')).toHaveText(/Recycling intake1$/)
    await meRow(page, 'Recycling intake').click()
    await expect(page.getByText('Booked in (1)')).toBeVisible()

    // L13: weigh and credit. The queue empties on screen and the Me count clears.
    await page.getByLabel('Actual, in kilograms', { exact: true }).fill('3.2')
    await page.getByRole('button', { name: `Weigh and credit ${familyName}'s drop-off` }).click()
    await expect(page.getByText('Booked in (0)')).toBeVisible()
    await expect(page.getByText(`Weighed 3.2 kg · credited 2,400 g`)).toBeVisible()
    const { data: weighed } = await adminClient()
      .from('recycling_dropoffs')
      .select('status, weighed_grams, credit_grams')
      .eq('id', booked!.id)
      .single()
    expect(weighed).toEqual({ status: 'received', weighed_grams: 3200, credit_grams: 2400 })
    await page.goBack()
    await expect(meRow(page, 'Recycling intake')).toHaveText(/Recycling intake$/)

    // V04: the family goes Me -> Recycling and the credit is there, no reload.
    await familyPage.goBack()
    await familyPage.getByRole('button', { name: 'Recycling', exact: true }).click()
    await expect(familyPage.getByText('2,400 g of print credit unspent')).toBeVisible()
    await expect(familyPage.getByText('+2400 g')).toBeVisible()
    const { data: balance, error } = await adminClient().rpc('recycling_credit_balance', {
      p_profile: family.id,
      p_org: orgId,
    })
    if (error) throw new Error(`balance rpc failed: ${error.message}`)
    expect(balance).toBe(2400)
  } finally {
    await familyPage.context().close()
  }
})
