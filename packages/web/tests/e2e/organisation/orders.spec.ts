import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, deleteUser, uniqueTitle } from '../helpers'
import { createLeaderSeat, removeLeaderSeat, signInAs, type LeaderSeat } from './leader'

let leader: LeaderSeat
let idle: LeaderSeat
let family: Awaited<ReturnType<typeof createContributor>>
let maker: Awaited<ReturnType<typeof createContributor>>
let tutorialTitle: string
let printerName: string
let jobId: string

test.beforeAll(async () => {
  leader = await createLeaderSeat(`Orders Org ${Date.now()}`)
  idle = await createLeaderSeat(`Idle Org ${Date.now()}`)
  family = await createContributor()
  maker = await createContributor()
  tutorialTitle = uniqueTitle('Cradle')
  printerName = uniqueTitle('Bench printer')
  const tutorialId = await createTutorial(maker.id, { title: tutorialTitle, status: 'approved' })
  const db = adminClient()
  const { data: printer, error } = await db
    .from('printers')
    .insert({ owner_org_id: leader.orgId, name: printerName, materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 })
    .select('id')
    .single()
  if (error || !printer) throw new Error(`printer seed failed: ${error?.message}`)
  const { data: job, error: jobError } = await db
    .from('toy_transactions')
    .insert({
      type: 'print', status: 'requested', tutorial_id: tutorialId, printer_id: printer.id,
      requester_id: family.id, owner_id: null, owner_org_id: leader.orgId, print_group_id: crypto.randomUUID(),
    })
    .select('id')
    .single()
  if (jobError || !job) throw new Error(`job seed failed: ${jobError?.message}`)
  jobId = job.id
})

test.afterAll(async () => {
  const db = adminClient()
  await db.from('toy_transactions').delete().eq('id', jobId)
  await db.from('printers').delete().eq('name', printerName)
  await db.from('tutorials').delete().eq('title', tutorialTitle)
  await removeLeaderSeat(leader)
  await removeLeaderSeat(idle)
  await deleteUser(family.id)
  await deleteUser(maker.id)
})

test('WB14 print orders shows the acting organisation’s printers and the requests waiting on them', async ({ page }) => {
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/orders')
  await expect(page.getByRole('heading', { name: 'Print orders', exact: true })).toBeVisible()
  await expect(page.getByText('Every leader sees this queue. Pickup is always the organisation’s address.')).toBeVisible()
  const tabs = page.getByRole('tablist', { name: 'Print orders sections' })
  await expect(tabs.getByRole('tab', { name: /My printers/ })).toContainText('1')
  await expect(tabs.getByRole('tab', { name: /Requests/ })).toContainText('1')
  await expect(page.getByText(tutorialTitle)).toBeVisible()
  await tabs.getByRole('tab', { name: /My printers/ }).click()
  await expect(page.getByText(printerName)).toBeVisible()
})

test('WB14 another organisation’s leader sees none of it', async ({ page }) => {
  await signInAs(page, idle)
  await page.goto('/dashboard/organisation/orders')
  await expect(page.getByText('Nothing waiting on you')).toBeVisible()
  await expect(page.getByText(tutorialTitle)).toHaveCount(0)
})
