import { test, expect } from '@playwright/test'
import { DECLARATION_VERSION } from '@splat-connect/types'
import { adminClient, createContributor, deleteUser, uniqueTitle } from '../helpers'
import { createLeaderSeat, removeLeaderSeat, signInAs, type LeaderSeat } from './leader'

let leader: LeaderSeat
let family: Awaited<ReturnType<typeof createContributor>>
let weighNote: string
let turnAwayNote: string
const dropIds: Record<'weigh' | 'turnAway', string> = { weigh: '', turnAway: '' }

test.beforeAll(async () => {
  leader = await createLeaderSeat(`Recycling Org ${Date.now()}`)
  family = await createContributor()
  weighNote = uniqueTitle('Clean PLA')
  turnAwayNote = uniqueTitle('Mixed bag')
  const db = adminClient()
  const drop = async (note: string, estimated_grams: number) => {
    const { data, error } = await db
      .from('recycling_dropoffs')
      .insert({
        org_id: leader.orgId, contributor_id: family.id, material: 'PLA', estimated_grams, condition_declared: true,
        declaration_version: DECLARATION_VERSION, note,
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(`dropoff seed failed: ${error?.message}`)
    return data.id as string
  }
  dropIds.weigh = await drop(weighNote, 2600)
  dropIds.turnAway = await drop(turnAwayNote, 3100)
})

test.afterAll(async () => {
  await adminClient().from('recycling_dropoffs').delete().eq('org_id', leader.orgId)
  await removeLeaderSeat(leader)
  await deleteUser(family.id)
})

const stored = async (id: string) =>
  (await adminClient().from('recycling_dropoffs').select('status, weighed_grams, credit_grams').eq('id', id).single()).data

test('WB27 weighing a drop-off in credits the contributor and moves it to "Weighed in"', async ({ page }) => {
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/recycling')
  await expect(page.getByRole('heading', { name: /Booked in/ })).toContainText('(2)')
  const row = page.locator('li', { hasText: weighNote })
  const weigh = row.getByRole('button', { name: /Weigh and credit/ })
  await expect(weigh).toBeDisabled()
  await row.getByLabel('Actual, in kilograms').fill('2.6')
  await expect(row.getByLabel('Credit, in grams')).toHaveValue('1950')
  await weigh.click()
  await expect(page.getByText(/Weighed at 2\.6 kg — 1950 g credit issued to/)).toBeVisible()
  await expect(page.getByRole('heading', { name: /Booked in/ })).toContainText('(1)')
  const settled = page.locator('li', { hasText: '2.6 kg declared · PLA · weighed 2.6 kg, credited 1.9 kg' })
  await expect(settled).toContainText('RECEIVED')
  expect(await stored(dropIds.weigh)).toEqual({ status: 'received', weighed_grams: 2600, credit_grams: 1950 })

  // recycling_received: the contributor is told in their inbox.
  await signInAs(page, family)
  await page.goto('/notifications')
  await expect(page.getByText(`${leader.orgName} received your drop-off`)).toBeVisible()
})

test('WB28 "Contaminated" turns a drop-off away with no credit', async ({ page }) => {
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/recycling')
  await page.locator('li', { hasText: turnAwayNote }).getByRole('button', { name: 'Contaminated' }).click()
  await expect(page.locator('li', { hasText: '3.1 kg declared · PLA' })).toContainText('TURNED AWAY')
  await expect(page.locator('li', { hasText: turnAwayNote })).toHaveCount(0)
  expect(await stored(dropIds.turnAway)).toEqual({ status: 'declined', weighed_grams: null, credit_grams: null })
})

test('WB29 "What you can take" saves the machines and turnaround, and they are still there after a reload', async ({ page }) => {
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/recycling')
  await page.getByRole('button', { name: 'Shredder' }).click()
  await page.getByLabel('Turnaround').fill('About 3 weeks')
  await page.getByLabel('Maximum per drop').fill('8')
  await page.getByRole('button', { name: /Save what you take/ }).click()
  await expect(page.getByText('Saved — contributors see this now.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Shredder' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Turnaround')).toHaveValue('About 3 weeks')
  await expect(page.getByLabel('Maximum per drop')).toHaveValue('8')
})
