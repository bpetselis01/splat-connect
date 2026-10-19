import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, deleteUser, uniqueTitle } from '../helpers'
import { createLeaderSeat, createOrgToy, removeLeaderSeat, signInAs, type LeaderSeat } from './leader'

let leader: LeaderSeat
let family: Awaited<ReturnType<typeof createContributor>>
let maker: Awaited<ReturnType<typeof createContributor>>
let toyName: string
let tutorialTitle: string
const ids: Record<'toy' | 'accepted' | 'build', string> = { toy: '', accepted: '', build: '' }

test.beforeAll(async () => {
  leader = await createLeaderSeat(`Requests Org ${Date.now()}`)
  family = await createContributor()
  maker = await createContributor()
  toyName = uniqueTitle('Bear')
  tutorialTitle = uniqueTitle('Switch mount')
  const toyId = await createOrgToy(leader.orgId, { name: toyName })
  const tutorialId = await createTutorial(maker.id, { title: tutorialTitle, status: 'approved' })
  const db = adminClient()
  const insert = async (row: Record<string, unknown>) => {
    const { data, error } = await db
      .from('toy_transactions')
      .insert({ requester_id: family.id, owner_id: null, owner_org_id: leader.orgId, ...row })
      .select('id')
      .single()
    if (error || !data) throw new Error(`seed failed: ${error?.message}`)
    return data.id as string
  }
  ids.toy = await insert({ type: 'donation', status: 'requested', toy_id: toyId })
  ids.accepted = await insert({ type: 'donation', status: 'accepted', toy_id: toyId })
  ids.build = await insert({
    type: 'build', status: 'requested', tutorial_id: tutorialId, travel_km: 10, requester_suburb: 'Newtown',
  })
})

test.afterAll(async () => {
  await adminClient().from('toy_transactions').delete().in('id', Object.values(ids))
  await adminClient().from('tutorials').delete().eq('title', tutorialTitle)
  await removeLeaderSeat(leader)
  await deleteUser(family.id)
  await deleteUser(maker.id)
})

test('WB08 the requests page opens on what is waiting and counts it per tab', async ({ page }) => {
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/requests')
  const tabs = page.getByRole('navigation', { name: 'Kind of request' })
  await expect(tabs.getByRole('link', { name: /Lend a toy/ })).toHaveAttribute('aria-current', 'page')
  await expect(tabs.getByRole('link', { name: 'Lend a toy 1' })).toBeVisible()
  await expect(tabs.getByRole('link', { name: 'Build a guide 1' })).toBeVisible()
  await expect(tabs.getByRole('link', { name: 'Print parts', exact: true })).toBeVisible()
  await expect(page.getByText(toyName).first()).toBeVisible()

  await tabs.getByRole('link', { name: /Print parts/ }).click()
  await expect(page).toHaveURL(/\?tab=parts$/)
  await expect(page.getByText('No part requests yet.')).toBeVisible()

  await tabs.getByRole('link', { name: /Build a guide/ }).click()
  await expect(page.getByText(tutorialTitle)).toBeVisible()
})

test('WB09 a request opens its thread: an open one as "Open the request", one under way as "Open the thread"', async ({ page }) => {
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/requests?tab=toys')
  await expect(page.getByRole('link', { name: 'Open the request' })).toHaveAttribute('href', `/dashboard/exchanges/${ids.toy}`)
  await expect(page.getByRole('link', { name: 'Open the thread' })).toHaveAttribute('href', `/dashboard/exchanges/${ids.accepted}`)
  await page.getByRole('link', { name: 'Open the request' }).click()
  await expect(page).toHaveURL(`/dashboard/exchanges/${ids.toy}`)
  await expect(page.getByText(toyName).first()).toBeVisible()

  await page.goto('/dashboard/organisation/requests?tab=builds')
  await expect(page.getByRole('link', { name: 'Open the request' })).toHaveAttribute('href', `/dashboard/exchanges/build/${ids.build}`)
})
