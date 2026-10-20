import { test, expect } from '@playwright/test'
import { adminClient, createContributor, makeOrgLeader, signInAsNewContributor, uniqueTitle } from './helpers'
import { partyPage } from './org-fixtures'

/**
 * The profile editor's Save and publish: the words half of the page goes live
 * at once, and what only the web form edits (capabilities, rate note) is left
 * as it was, because PATCH /profile writes only the fields it is sent.
 */

test('L23 Save and publish writes the org row, the public page shows it, and the web-only fields survive', async ({
  page,
  browser,
  baseURL,
}) => {
  const leader = await signInAsNewContributor(page)
  const orgName = uniqueTitle('E2E Profile Org')
  const orgId = await makeOrgLeader(leader.id, orgName)
  await adminClient()
    .from('organizations')
    .update({ capabilities: ['Printing'], rate_note: 'Filament at cost.' })
    .eq('id', orgId)

  const renamed = `${orgName} Renamed`
  const about = uniqueTitle('About us, written on a phone')
  await page.goto('/organisation/profile')
  await page.getByLabel('Organisation name', { exact: true }).fill(`  ${renamed}  `)
  await page.getByLabel('What you are', { exact: true }).fill('Therapy centre')
  await page.getByLabel('The paragraph at the top of your page', { exact: true }).fill(about)
  await page.getByLabel('Suburb', { exact: true }).fill('Crows Nest')
  await page.getByRole('radio', { name: 'VIC', exact: true }).click()
  await page.getByLabel('When to visit', { exact: true }).fill('Tuesdays 10 to 2')
  await page.getByLabel('Public email', { exact: true }).fill('hello@e2e-org.example')
  await page.getByRole('button', { name: 'Save and publish' }).click()
  await expect(page.getByText('Saved. It is on your public page now.')).toBeVisible()

  const { data: row } = await adminClient()
    .from('organizations')
    .select('name, kind, about, suburb, state, visit_hours, contact_email, capabilities, rate_note')
    .eq('id', orgId)
    .single()
  expect(row).toEqual({
    name: renamed,
    kind: 'Therapy centre',
    about,
    suburb: 'Crows Nest',
    state: 'VIC',
    visit_hours: 'Tuesdays 10 to 2',
    contact_email: 'hello@e2e-org.example',
    capabilities: ['Printing'],
    rate_note: 'Filament at cost.',
  })

  // A family reading the public page sees the new words.
  const family = await createContributor()
  const familyPage = await partyPage(browser, baseURL, family)
  try {
    await familyPage.goto(`/toy-library/organisation/${orgId}`)
    await expect(familyPage.getByRole('heading', { name: renamed })).toBeVisible()
    await expect(familyPage.getByText(about)).toBeVisible()
    await expect(familyPage.getByText('Tuesdays 10 to 2')).toBeVisible()
    await expect(familyPage.getByText('Crows Nest, VIC', { exact: true })).toBeVisible()
  } finally {
    await familyPage.context().close()
  }
})

test('a blank organisation name is refused and nothing is written', async ({ page }) => {
  const leader = await signInAsNewContributor(page)
  const orgName = uniqueTitle('E2E Nameless Org')
  const orgId = await makeOrgLeader(leader.id, orgName)

  await page.goto('/organisation/profile')
  await page.getByLabel('Organisation name', { exact: true }).fill('   ')
  await page.getByLabel('Suburb', { exact: true }).fill('Nowhere')
  await page.getByRole('button', { name: 'Save and publish' }).click()
  await expect(page.getByText('Saved. It is on your public page now.')).toBeHidden()

  const { data: row } = await adminClient().from('organizations').select('name, suburb').eq('id', orgId).single()
  expect(row?.name).toBe(orgName)
  expect(row?.suburb).toBeNull()
})
