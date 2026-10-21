import { test, expect } from '@playwright/test'
import { adminClient, createContributor, deleteUser, makeLeader, uniqueTitle } from '../helpers'
import { createLeaderSeat, removeLeaderSeat, signInAs, type LeaderSeat } from './leader'

let leader: LeaderSeat
let colleague: Awaited<ReturnType<typeof createContributor>>
let family: Awaited<ReturnType<typeof createContributor>>
let sharedNote: string

test.beforeAll(async () => {
  leader = await createLeaderSeat(`Profile Org ${Date.now()}`)
  colleague = await createContributor()
  family = await createContributor()
  sharedNote = uniqueTitle('Changed our Thursdays')
  await adminClient().from('profiles').update({ name: 'Colleague Casey' }).eq('id', colleague.id)
  await adminClient().from('org_thanks').insert({ org_id: leader.orgId, profile_id: family.id, note: sharedNote, byline: 'Hannah', show_note: true })
  await adminClient().from('organizations').update({ status: 'active' }).eq('id', leader.orgId)
})

test.afterAll(async () => {
  await removeLeaderSeat(leader)
  await deleteUser(colleague.id)
  await deleteUser(family.id)
})

test('WB30 saving the profile with a door and a cost line changes the public page', async ({ page }) => {
  const doorTitle = uniqueTitle('Borrow a toy')
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/profile')
  await page.getByLabel('Organisation name').fill(`${leader.orgName} Renamed`)
  await page.getByLabel('One line, for the badge on a guide').fill('We adapt toys for local families.')
  await page.getByRole('button', { name: 'Add a door' }).click()
  await page.getByLabel('Door 1 title').fill(doorTitle)
  await page.getByRole('button', { name: 'Add a line' }).click()
  await page.getByLabel('Line 1 description').fill('Switch kit')
  await page.getByLabel('Line 1 amount in dollars').fill('12.50')
  await page.locator('textarea[name="rate_note"]').fill('Kits are bought in bulk and passed on at cost.')
  await page.getByRole('button', { name: /Save and publish/ }).click()
  await expect(page.getByText('Saved — your public page has changed.')).toBeVisible()
  await page.goto(`/organizations/${leader.orgId}/public`)
  await expect(page.getByRole('heading', { name: `${leader.orgName} Renamed` }).first()).toBeVisible()
  await expect(page.getByText(doorTitle).first()).toBeVisible()
  await expect(page.getByText('Switch kit').first()).toBeVisible()
  await expect(page.getByText('$12.50').first()).toBeVisible()
})

test('WB30 a cost line without a reason is refused in words and nothing is saved', async ({ page }) => {
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/profile')
  await page.getByLabel('Organisation name').fill('Should not be saved')
  await page.getByRole('button', { name: 'Add a line' }).click()
  await page.getByLabel('Line 1 description').fill('Unexplained fee')
  await page.getByLabel('Line 1 amount in dollars').fill('5')
  await page.locator('textarea[name="rate_note"]').fill('')
  await page.getByRole('button', { name: /Save and publish/ }).click()
  await expect(page.getByText('Say why these costs, in a sentence or two.')).toBeVisible()
  const { data } = await adminClient().from('organizations').select('name').eq('id', leader.orgId).single()
  expect(data!.name).not.toBe('Should not be saved')
})

test('WB31 choosing a logo uploads it at once, it survives a reload, and Remove then Save takes it down', async ({ page }) => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/profile')
  await page.getByLabel('Add a square logo').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('img', { name: 'Current square logo' })).toBeVisible()
  await expect.poll(async () => (await adminClient().from('organizations').select('logo_url').eq('id', leader.orgId).single()).data!.logo_url).toContain(`orgs/${leader.orgId}/logo-`)
  await page.reload()
  await expect(page.getByRole('img', { name: 'Current square logo' })).toBeVisible()

  await page.getByRole('button', { name: 'Remove' }).first().click()
  await page.getByRole('button', { name: /Save and publish/ }).click()
  await expect(page.getByText('Saved — your public page has changed.')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Add a square logo')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Current square logo' })).toHaveCount(0)
})

test('WB32 hiding a family’s thank-you note takes it off the public page, and Show again puts it back', async ({ page }) => {
  await signInAs(page, leader)
  const onPublicPage = async () => {
    await page.goto(`/organizations/${leader.orgId}/public`)
    return page.getByText(sharedNote).count()
  }
  expect(await onPublicPage()).toBeGreaterThan(0)
  await page.goto('/dashboard/organisation/profile')
  const note = page.locator('li', { hasText: sharedNote })
  await expect(note).toContainText('On your page')
  await note.getByRole('button', { name: 'Hide' }).click()
  await expect(note).toContainText('Hidden')
  expect(await onPublicPage()).toBe(0)
  await page.goto('/dashboard/organisation/profile')
  await page.locator('li', { hasText: sharedNote }).getByRole('button', { name: 'Show again' }).click()
  await expect(page.locator('li', { hasText: sharedNote })).toContainText('On your page')
  expect(await onPublicPage()).toBeGreaterThan(0)
})

test('WB33 WB34 inviting a colleague by email lists them as invited, and Cancel invitation takes them off', async ({ page }) => {
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/profile')
  await expect(page.getByRole('button', { name: 'Send invitation' })).toBeDisabled()
  await page.getByLabel('Invite a leader').fill(colleague.email)
  await page.getByRole('button', { name: 'Send invitation' }).click()
  await expect(page.getByText('Invited. They become a leader once they accept on their Account page.')).toBeVisible()
  const invited = page.locator('li', { hasText: 'Colleague Casey' })
  await expect(invited).toContainText('invited')
  await expect(page.locator('li', { hasText: leader.email })).toContainText('(you)')

  await invited.getByRole('button', { name: 'Cancel invitation' }).click()
  await expect(page.locator('li', { hasText: 'Colleague Casey' })).toHaveCount(0)
  const { data } = await adminClient().from('org_leader_invites').select('id').eq('org_id', leader.orgId)
  expect(data).toEqual([])
})

test('WB33 an email no SPLAT account uses is refused in words', async ({ page }) => {
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/profile')
  await page.getByLabel('Invite a leader').fill('nobody-here@web-e2e.local')
  await page.getByRole('button', { name: 'Send invitation' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'No SPLAT account uses that email. Ask them to sign up first.' })).toBeVisible()
})

test('WB35 a leader with a colleague can step down, lands on the dashboard and is sent back there with a note when opening the organisation page', async ({ page }) => {
  const seat = await createLeaderSeat(`Stepdown Org ${Date.now()}`)
  const second = await createContributor()
  await makeLeader(second.id, undefined, seat.orgId)
  try {
    await signInAs(page, seat)
    await page.goto('/dashboard/organisation/profile')
    await page.getByRole('button', { name: 'Step down as leader' }).click()
    await expect(page).toHaveURL('/dashboard')
    await page.goto('/dashboard/organisation/profile')
    await expect(page).toHaveURL('/dashboard?notice=org-leaders-only')
    await expect(page.getByText('That page is for organisation leaders.')).toBeVisible()
    const { data } = await adminClient().from('org_leaders').select('user_id').eq('org_id', seat.orgId)
    expect(data).toEqual([{ user_id: second.id }])
  } finally {
    await removeLeaderSeat(seat)
    await deleteUser(second.id)
  }
})

test('WB35 a sole leader is not offered Step down', async ({ page }) => {
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/profile')
  await expect(page.getByRole('heading', { name: 'Leaders' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Step down as leader' })).toHaveCount(0)
})
