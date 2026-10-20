import { test, expect, type Page } from '@playwright/test'
import { addLeader, adminClient, createContributor, createOrg, renameProfile, uniqueTitle } from './helpers'
import { cardCount, expectCard, signInAdmin } from './admin-fixtures'
import { partyPage } from './org-fixtures'

const ORGS_CARD = 'Organisations'
// GET /api/organizations merges its extra columns with one .in(ids) read that stops working
// at a couple of hundred organisations, so a spec that leaves its rows behind eventually
// turns the Verified pill off for everyone.
const madeOrgs: string[] = []
test.afterEach(async () => {
  await adminClient().from('organizations').delete().in('id', madeOrgs.splice(0))
})
const orgRow = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(name) })

/** A contributor whose name this spec alone answers to, so the account picker and the leader rows can be found. */
async function namedPerson(label: string) {
  const person = await createContributor()
  const name = uniqueTitle(label)
  await renameProfile(person.id, name)
  return { ...person, name }
}

/** An organisation, optionally led and optionally already standing in a state. */
async function seedOrg(over: { leader?: string; verified?: boolean; suspended?: boolean } = {}) {
  const name = uniqueTitle('E2E Admin Org')
  const id = await createOrg(name)
  madeOrgs.push(id)
  if (over.leader) await addLeader(id, over.leader)
  const patch = {
    ...(over.verified ? { verified_at: new Date().toISOString() } : {}),
    ...(over.suspended ? { status: 'suspended' } : {}),
  }
  if (Object.keys(patch).length) await adminClient().from('organizations').update(patch).eq('id', id)
  return { id, name }
}

const orgDb = async (id: string) =>
  (await adminClient().from('organizations').select('name, description, status, verified_at').eq('id', id).single()).data!
const leadersDb = async (id: string) =>
  ((await adminClient().from('org_leaders').select('user_id').eq('org_id', id)).data ?? []).map((l) => l.user_id).sort()

test('Q32 the Organisations list shows each organisation with its leaders, standing and Verified', async ({ page }) => {
  const lead = await namedPerson('Lead Person')
  const live = await seedOrg({ leader: lead.id, verified: true })
  const off = await seedOrg({ suspended: true })
  await signInAdmin(page)
  await page.goto('/admin')
  await page.getByRole('button', { name: /^Organisations, \d+$/ }).click()
  await expect(page).toHaveURL(/\/admin\/organisations$/)

  await expect(orgRow(page, live.name)).toContainText(new RegExp(`${lead.name}.*Active.*Verified`))
  await expect(orgRow(page, off.name)).toContainText(/No leaders yet.*Suspended/)
  await expect(orgRow(page, off.name)).not.toContainText('Verified')
})

test('Q33 New organisation opens the create form, and a row opens that organisation', async ({ page }) => {
  const org = await seedOrg()
  await signInAdmin(page)
  await page.goto('/admin/organisations')

  await page.getByRole('button', { name: 'New organisation' }).click()
  await expect(page).toHaveURL(/\/admin\/organisations\/new$/)
  await expect(page.getByRole('button', { name: 'Create organisation' })).toBeVisible()

  await page.goto('/admin/organisations')
  await orgRow(page, org.name).click()
  await expect(page).toHaveURL(new RegExp(`/admin/organisations/${org.id}$`))
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue(org.name)
})

test('Q34 Create organisation needs a name and a first leader, then adds it with that leader and raises the card by one', async ({ page }) => {
  const lead = await namedPerson('First Leader')
  const name = uniqueTitle('E2E Created Org')
  await signInAdmin(page)

  await page.goto('/admin/organisations')
  await page.getByRole('button', { name: 'New organisation' }).click()
  await page.getByRole('button', { name: 'Create organisation' }).click()
  await expect(page.getByText('Give it a name and pick a first leader.')).toBeVisible()

  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Description').fill('Made from the phone')
  await page.getByLabel('Search accounts').fill(lead.email)
  await page.getByRole('button', { name: `Pick ${lead.name}` }).click()
  await page.getByRole('button', { name: 'Create organisation' }).click()
  await expect(page).toHaveURL(/\/admin\/organisations$/)
  await expect(orgRow(page, name)).toContainText(new RegExp(`${lead.name}.*Active`))

  const { data } = await adminClient().from('organizations').select('id, description, status').eq('name', name).single()
  madeOrgs.push(data!.id)
  expect(data).toMatchObject({ description: 'Made from the phone', status: 'active' })
  expect(await leadersDb(data!.id)).toEqual([lead.id])
  await expectCard(page, ORGS_CARD)
})

test('Q35 Save details rewrites the name and description', async ({ page }) => {
  const org = await seedOrg()
  const renamed = uniqueTitle('E2E Renamed Org')
  await signInAdmin(page)
  await page.goto(`/admin/organisations/${org.id}`)

  await page.getByLabel('Name', { exact: true }).fill(renamed)
  await page.getByLabel('Description').fill('Now with a description')
  await page.getByRole('button', { name: 'Save details' }).click()
  await expect.poll(() => orgDb(org.id)).toMatchObject({ name: renamed, description: 'Now with a description' })

  await page.goto('/admin/organisations')
  await expect(orgRow(page, renamed)).toBeVisible()
})

test('Q36 Add a leader picks an account and lists it under Leaders, and tells them in their inbox', async ({ page, browser, baseURL }) => {
  const first = await namedPerson('Existing Leader')
  const second = await namedPerson('Added Leader')
  const org = await seedOrg({ leader: first.id })
  await signInAdmin(page)
  await page.goto(`/admin/organisations/${org.id}`)
  await expect(page.getByText('Leaders (1)')).toBeVisible()

  await page.getByLabel('Search accounts').fill(second.email)
  await page.getByRole('button', { name: `Pick ${second.name}` }).click()
  await expect(page.getByText('Leaders (2)')).toBeVisible()
  await expect(page.getByRole('button', { name: `Remove ${second.name}` })).toBeVisible()
  expect(await leadersDb(org.id)).toEqual([first.id, second.id].sort())

  // leader_added
  const secondPage = await partyPage(browser, baseURL, second)
  try {
    await secondPage.goto('/inbox')
    await expect(secondPage.getByText(`You now lead ${org.name}`)).toBeVisible()
  } finally {
    await secondPage.context().close()
  }
})

test('Q37 Remove on a leader drops them from the organisation', async ({ page }) => {
  const staying = await namedPerson('Staying Leader')
  const leaving = await namedPerson('Leaving Leader')
  const org = await seedOrg({ leader: staying.id })
  await addLeader(org.id, leaving.id)
  await signInAdmin(page)
  await page.goto(`/admin/organisations/${org.id}`)
  await expect(page.getByText('Leaders (2)')).toBeVisible()

  await page.getByRole('button', { name: `Remove ${leaving.name}` }).click()
  await expect(page.getByText('Leaders (1)')).toBeVisible()
  await expect(page.getByRole('button', { name: `Remove ${leaving.name}` })).toHaveCount(0)
  expect(await leadersDb(org.id)).toEqual([staying.id])
})

test('Q38 Suspend sets the standing and Reactivate restores it', async ({ page }) => {
  const lead = await namedPerson('Standing Leader')
  const org = await seedOrg({ leader: lead.id })
  await signInAdmin(page)
  await page.goto(`/admin/organisations/${org.id}`)

  await page.getByRole('button', { name: 'Suspend', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Reactivate', exact: true })).toBeVisible()
  expect((await orgDb(org.id)).status).toBe('suspended')
  await page.goto('/admin/organisations')
  await expect(orgRow(page, org.name)).toContainText('Suspended')

  await orgRow(page, org.name).click()
  await page.getByRole('button', { name: 'Reactivate', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Suspend', exact: true })).toBeVisible()
  expect((await orgDb(org.id)).status).toBe('active')
})

test('Q39 Mark verified stamps the organisation and shows the Verified pill, and Remove verified clears both', async ({ page }) => {
  const lead = await namedPerson('Stamp Leader')
  const org = await seedOrg({ leader: lead.id })
  await signInAdmin(page)
  await page.goto(`/admin/organisations/${org.id}`)

  await page.getByRole('button', { name: 'Mark verified', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Remove verified', exact: true })).toBeVisible()
  await expect.poll(async () => (await orgDb(org.id)).verified_at).not.toBeNull()
  await page.goto('/admin/organisations')
  await expect(orgRow(page, org.name)).toContainText('Verified')

  await orgRow(page, org.name).click()
  await page.getByRole('button', { name: 'Remove verified', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Mark verified', exact: true })).toBeVisible()
  await expect.poll(async () => (await orgDb(org.id)).verified_at).toBeNull()
  await page.goto('/admin/organisations')
  await expect(orgRow(page, org.name)).not.toContainText('Verified')
})
