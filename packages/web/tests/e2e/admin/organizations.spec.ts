import { test, expect, type Page } from '@playwright/test'
import { addLeader, adminClient, createContributor, createOrg, deleteOrg, signIn, uniqueTitle } from '../helpers'
import { expectCardMoved, signInAdmin } from './support'

const orgIds: string[] = []
const trackedOrg = async (name: string) => {
  const id = await createOrg(name)
  orgIds.push(id)
  return id
}

test.afterAll(async () => {
  for (const id of orgIds) await deleteOrg(id)
})

const rowOf = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name })

test('WM18 creating an organisation lists it Active with its first leader, and the Organisations card rises', async ({ page }) => {
  const leader = await createContributor()
  const name = uniqueTitle('E2E Created Org')
  await signInAdmin(page)

  await page.goto('/admin/organizations')
  await page.getByRole('link', { name: 'New organisation' }).click()
  await page.waitForURL('**/admin/organizations?new=1')
  await page.waitForLoadState('networkidle')
  const drawer = page.getByRole('dialog', { name: 'New organisation' })
  await drawer.getByLabel('Name').fill(name)
  await drawer.getByLabel('Description').fill('Prints switch toys for local families.')
  await drawer.getByLabel('First leader').selectOption({ value: leader.id })
  await drawer.getByRole('button', { name: 'Create organisation' }).click()

  await page.waitForURL((url) => url.pathname === '/admin/organizations' && !url.search)
  await expect(rowOf(page, name)).toContainText('Active')
  await expect(rowOf(page, name)).toContainText(leader.name)
  const { data } = await adminClient().from('organizations').select('id').eq('name', name).single()
  orgIds.push(data!.id)
  await expectCardMoved(page, 'organisations', 0, 0)
})

test('WM19 appointing a leader moves an organisation from No leader to Active and lists the leader in its drawer', async ({ page }) => {
  const leader = await createContributor()
  const name = uniqueTitle('E2E Appoint Org')
  const orgId = await trackedOrg(name)
  await signInAdmin(page)

  await page.goto(`/admin/organizations?manage=${orgId}`)
  await page.waitForLoadState('networkidle')
  const drawer = page.getByRole('dialog', { name })
  await expect(drawer.getByText(/None\. This organisation cannot answer any request/)).toBeVisible()
  await drawer.getByLabel('New leader').selectOption({ value: leader.id })
  await drawer.getByRole('button', { name: 'Appoint' }).click()

  await expect(drawer.getByRole('heading', { name: 'Leaders (1)' })).toBeVisible()
  await expect(drawer.getByRole('listitem').filter({ hasText: leader.name })).toBeVisible()
  await page.goto('/admin/organizations')
  await expect(rowOf(page, name)).toContainText('Active')

  // leader_added: the appointed person is told in their inbox.
  await page.context().clearCookies()
  await signIn(page, leader.email, leader.password)
  await page.goto('/notifications')
  await expect(page.getByText(`You now lead ${name}`)).toBeVisible()
})

test('WM20 removing the only leader leaves the organisation with No leader', async ({ page }) => {
  const leader = await createContributor()
  const name = uniqueTitle('E2E Remove Leader Org')
  const orgId = await trackedOrg(name)
  await addLeader(orgId, leader.id)
  await signInAdmin(page)

  await page.goto(`/admin/organizations?manage=${orgId}`)
  await page.waitForLoadState('networkidle')
  const drawer = page.getByRole('dialog', { name })
  await expect(drawer.getByRole('heading', { name: 'Leaders (1)' })).toBeVisible()
  await drawer.getByRole('button', { name: 'Remove' }).click()

  await expect(drawer.getByRole('heading', { name: 'Leaders (0)' })).toBeVisible()
  await page.goto('/admin/organizations')
  await expect(rowOf(page, name)).toContainText('No leader')

  // leader_removed: the removed person is told in their inbox.
  await page.context().clearCookies()
  await signIn(page, leader.email, leader.password)
  await page.goto('/notifications')
  await expect(page.getByText(`You no longer lead ${name}`)).toBeVisible()
})

test('WM21 Verify shows the seal and the verified date, and Unverify takes both away', async ({ page }) => {
  const leader = await createContributor()
  const name = uniqueTitle('E2E Verify Org')
  const orgId = await trackedOrg(name)
  await addLeader(orgId, leader.id)
  await signInAdmin(page)

  await page.goto(`/admin/organizations?manage=${orgId}`)
  await page.waitForLoadState('networkidle')
  const drawer = page.getByRole('dialog', { name })
  await expect(drawer.getByText(/Not verified\./)).toBeVisible()
  await drawer.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(drawer.getByText(/Verified \d{1,2} \w{3} \d{4}\. The seal shows on their public page\./)).toBeVisible()
  await page.goto('/admin/organizations')
  await expect(rowOf(page, name).getByLabel('Verified by SPLAT')).toBeVisible()

  await page.goto(`/admin/organizations?manage=${orgId}`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('dialog', { name }).getByRole('button', { name: 'Unverify' }).click()
  await expect(page.getByRole('dialog', { name }).getByText(/Not verified\./)).toBeVisible()
  await page.goto('/admin/organizations')
  await expect(rowOf(page, name).getByLabel('Verified by SPLAT')).toHaveCount(0)
})

test('WM22 Suspend marks the organisation Suspended and Reactivate makes it Active again', async ({ page }) => {
  const leader = await createContributor()
  const name = uniqueTitle('E2E Suspend Org')
  const orgId = await trackedOrg(name)
  await addLeader(orgId, leader.id)
  await signInAdmin(page)

  await page.goto(`/admin/organizations?manage=${orgId}`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('dialog', { name }).getByRole('button', { name: 'Suspend organisation' }).click()
  await expect(page.getByRole('dialog', { name }).getByRole('button', { name: 'Reactivate organisation' })).toBeVisible()
  await page.goto('/admin/organizations')
  await expect(rowOf(page, name)).toContainText('Suspended')

  await page.goto(`/admin/organizations?manage=${orgId}`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('dialog', { name }).getByRole('button', { name: 'Reactivate organisation' }).click()
  await expect(page.getByRole('dialog', { name }).getByRole('button', { name: 'Suspend organisation' })).toBeVisible()
  await page.goto('/admin/organizations')
  await expect(rowOf(page, name)).toContainText('Active')
})
