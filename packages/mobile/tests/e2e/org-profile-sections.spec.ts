import { test, expect } from '@playwright/test'
import { adminClient, createContributor, makeOrgLeader, signInAsNewContributor, uniqueTitle } from './helpers'
import { partyPage } from './org-fixtures'

/**
 * The profile editor's sections: pictures (uploaded at once, removed on save),
 * doors, rates and payment methods, what you do, and the recycling you take.
 * Each is checked in the organisation row and on the page a family reads.
 */

async function leaderWithOrg(page: import('@playwright/test').Page, columns: Record<string, unknown> = {}) {
  const leader = await signInAsNewContributor(page)
  const name = uniqueTitle('E2E Sections Org')
  const orgId = await makeOrgLeader(leader.id, name)
  if (Object.keys(columns).length) await adminClient().from('organizations').update(columns).eq('id', orgId)
  return { leader, name, orgId }
}

const orgRow = async (orgId: string, columns: string) =>
  (await adminClient().from('organizations').select(columns).eq('id', orgId).single()).data as unknown as Record<string, unknown>

const save = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Save and publish' }).click()

test('L38 Add a logo and a cover photo upload at once, the editor shows them and the public page carries the pictures', async ({ page, browser, baseURL }) => {
  const { orgId, name } = await leaderWithOrg(page)
  await page.goto('/organisation/profile')

  for (const [button, column, folder] of [
    ['Add a logo', 'logo_url', 'logo'],
    ['Add a cover photo', 'cover_url', 'cover'],
  ] as const) {
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: button, exact: true }).click()
    await (await chooser).setFiles('tests/e2e/fixtures/test.jpg')
    await expect.poll(async () => (await orgRow(orgId, column))[column]).toContain(`/orgs/${orgId}/${folder}-`)
  }
  await expect(page.getByRole('button', { name: 'Replace the logo', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Replace the cover photo', exact: true })).toBeVisible()
  await expect(page.getByLabel('Current logo')).toBeVisible()

  const urls = await orgRow(orgId, 'logo_url, cover_url')
  const family = await createContributor()
  const familyPage = await partyPage(browser, baseURL, family)
  try {
    await familyPage.goto(`/toy-library/organisation/${orgId}`)
    await expect(familyPage.getByRole('heading', { name })).toBeVisible()
    await expect(familyPage.locator(`img[src="${urls.logo_url}"]`).first()).toBeAttached()
    await expect(familyPage.locator(`img[src="${urls.cover_url}"]`).first()).toBeAttached()
  } finally {
    await familyPage.context().close()
  }
})

test('L39 Remove the logo changes nothing until Save and publish, which clears only the removed picture', async ({ page }) => {
  const logo = 'https://example.invalid/logo.png'
  const cover = 'https://example.invalid/cover.png'
  const { orgId } = await leaderWithOrg(page, { logo_url: logo, cover_url: cover })
  await page.goto('/organisation/profile')

  await page.getByRole('button', { name: 'Remove the logo', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Add a logo', exact: true })).toBeVisible()
  expect(await orgRow(orgId, 'logo_url, cover_url')).toEqual({ logo_url: logo, cover_url: cover })

  await save(page)
  await expect(page.getByText('Saved. It is on your public page now.')).toBeVisible()
  expect(await orgRow(orgId, 'logo_url, cover_url')).toEqual({ logo_url: null, cover_url: cover })
})

test('L40 doors: add one, edit its title, line and target, remove another; Save and publish shows them on the public page', async ({ page, browser, baseURL }) => {
  const { orgId } = await leaderWithOrg(page)
  await adminClient().from('org_doors').insert([
    { org_id: orgId, position: 1, title: 'Old door', body: 'Old line', target: 'message' },
    { org_id: orgId, position: 2, title: 'Doomed door', body: null, target: 'message' },
  ])
  await page.goto('/organisation/profile')

  await page.getByLabel('Door 1 title').fill('Borrow a toy')
  await page.getByLabel('Door 1 line').fill('Pick one from the shelf.')
  await page.getByRole('radio', { name: 'Toy library', exact: true }).first().click()
  await page.getByRole('button', { name: 'Remove door 2' }).click()
  await page.getByRole('button', { name: 'Add a door' }).click()
  await page.getByLabel('Door 2 title').fill('Ask us to print')
  await page.getByRole('radio', { name: 'Ask them to print', exact: true }).nth(1).click()
  await save(page)
  await expect(page.getByText('Saved. It is on your public page now.')).toBeVisible()

  const { data: doors } = await adminClient().from('org_doors').select('position, title, body, target').eq('org_id', orgId).order('position')
  expect(doors).toEqual([
    { position: 1, title: 'Borrow a toy', body: 'Pick one from the shelf.', target: 'toy_library' },
    { position: 2, title: 'Ask us to print', body: null, target: 'print' },
  ])

  const family = await createContributor()
  const familyPage = await partyPage(browser, baseURL, family)
  try {
    await familyPage.goto(`/toy-library/organisation/${orgId}`)
    await expect(familyPage.getByRole('button', { name: 'Borrow a toy', exact: true })).toBeVisible()
    await expect(familyPage.getByRole('button', { name: 'Ask us to print', exact: true })).toBeVisible()
    await expect(familyPage.getByText('Doomed door')).toHaveCount(0)
  } finally {
    await familyPage.context().close()
  }
})

test('L41 rates: a cost line, Covering it or Claiming back, why these costs and a payment method reach the row and the public page', async ({ page, browser, baseURL }) => {
  const { orgId } = await leaderWithOrg(page)
  await page.goto('/organisation/profile')

  await page.getByRole('button', { name: 'Add a line', exact: true }).click()
  await page.getByLabel('Line 1 description').fill('PLA filament, per small part')
  await page.getByLabel('Line 1 amount in dollars').fill('4.50')
  await page.getByRole('button', { name: 'Claiming back', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Covering it', exact: true })).toBeVisible()
  await page.getByLabel(/^Why these costs/).fill('Filament at cost, no margin.')
  await page.getByRole('button', { name: 'PayID', exact: true }).click()
  await save(page)
  await expect(page.getByText('Saved. It is on your public page now.')).toBeVisible()

  const { data: lines } = await adminClient().from('org_rate_lines').select('position, description, amount_cents, claiming').eq('org_id', orgId)
  expect(lines).toEqual([{ position: 1, description: 'PLA filament, per small part', amount_cents: 450, claiming: false }])
  expect(await orgRow(orgId, 'rate_note, payment_methods')).toEqual({ rate_note: 'Filament at cost, no margin.', payment_methods: ['payid'] })

  const family = await createContributor()
  const familyPage = await partyPage(browser, baseURL, family)
  try {
    await familyPage.goto(`/toy-library/organisation/${orgId}`)
    await expect(familyPage.getByText('Filament at cost, no margin.')).toBeVisible()
    await expect(familyPage.getByText('PLA filament, per small part')).toBeVisible()
  } finally {
    await familyPage.context().close()
  }

  await page.getByRole('button', { name: 'Remove line 1' }).click()
  await page.getByLabel(/^Why these costs/).fill('')
  await save(page)
  await expect(page.getByText('Saved. It is on your public page now.')).toBeVisible()
  expect((await adminClient().from('org_rate_lines').select('id').eq('org_id', orgId)).data).toEqual([])
})

test('L42 the What you do chips are saved as capabilities and the public page lists them', async ({ page, browser, baseURL }) => {
  const { orgId } = await leaderWithOrg(page, { capabilities: ['Holds toys'] })
  await page.goto('/organisation/profile')

  await page.getByRole('button', { name: 'Has a printer', exact: true }).click()
  await page.getByRole('button', { name: 'Holds toys', exact: true }).click()
  await save(page)
  await expect(page.getByText('Saved. It is on your public page now.')).toBeVisible()
  expect((await orgRow(orgId, 'capabilities')).capabilities).toEqual(['Has a printer'])

  const family = await createContributor()
  const familyPage = await partyPage(browser, baseURL, family)
  try {
    await familyPage.goto(`/toy-library/organisation/${orgId}`)
    await expect(familyPage.getByText('Has a printer', { exact: true })).toBeVisible()
    await expect(familyPage.getByText('Holds toys', { exact: true })).toHaveCount(0)
  } finally {
    await familyPage.context().close()
  }
})

test('L43 the recycling you take: a material chip and how you want it brought are saved, and a family can book a drop-off with you', async ({ page, browser, baseURL }) => {
  const { orgId, name } = await leaderWithOrg(page)
  await page.goto('/organisation/profile')

  await page.getByRole('button', { name: 'PLA', exact: true }).click()
  await page.getByLabel('How you want it brought', { exact: true }).fill('Ring the side door.')
  await save(page)
  await expect(page.getByText('Saved. It is on your public page now.')).toBeVisible()
  expect(await orgRow(orgId, 'recycling_materials, recycling_note')).toEqual({ recycling_materials: ['PLA'], recycling_note: 'Ring the side door.' })

  const family = await createContributor()
  const familyPage = await partyPage(browser, baseURL, family)
  try {
    await familyPage.goto('/explore/recycling')
    await expect(familyPage.getByText(name, { exact: false }).first()).toBeVisible()
  } finally {
    await familyPage.context().close()
  }
})
