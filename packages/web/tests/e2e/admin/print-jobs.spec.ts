import { test, expect } from '@playwright/test'
import { acceptTerms, adminClient, createContributor, createTutorial, uniqueTitle } from '../helpers'
import { cardCount, signInAdmin } from './support'

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString()
const tutorialIds: string[] = []
const printerIds: string[] = []

test.afterAll(async () => {
  const db = adminClient()
  await db.from('toy_transactions').delete().in('tutorial_id', tutorialIds)
  await db.from('printers').delete().in('id', printerIds)
})

test('WM33 the filter links split print jobs, Stalled keeps the stalled one, and a row opens its print request', async ({ page }) => {
  const owner = await createContributor()
  const family = await createContributor()
  const stalled = uniqueTitle('E2E Stalled Print Guide')
  const requested = uniqueTitle('E2E Requested Print Guide')
  const stalledGuide = await createTutorial(owner.id, { title: stalled, status: 'approved' })
  const requestedGuide = await createTutorial(owner.id, { title: requested, status: 'approved' })
  tutorialIds.push(stalledGuide, requestedGuide)
  const db = adminClient()
  const { data: printer, error: printerError } = await db
    .from('printers')
    .insert({ owner_id: owner.id, name: 'E2E Queue printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 })
    .select('id')
    .single()
  if (printerError) throw new Error(printerError.message)
  printerIds.push(printer.id)
  const job = { type: 'print', printer_id: printer.id, requester_id: family.id, owner_id: owner.id }
  const { data: stalledJob, error } = await db
    .from('toy_transactions')
    .insert({ ...job, tutorial_id: stalledGuide, print_group_id: crypto.randomUUID(), status: 'accepted', created_at: daysAgo(20), updated_at: daysAgo(12) })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  await db.from('toy_transactions').insert({ ...job, tutorial_id: requestedGuide, print_group_id: crypto.randomUUID(), status: 'requested', created_at: daysAgo(1) })

  const admin = await signInAdmin(page)
  await acceptTerms(admin.id)
  expect(await cardCount(page, /Print jobs stalled/)).toBeGreaterThanOrEqual(1)

  await page.goto('/admin/print-jobs')
  const nav = page.getByRole('navigation', { name: 'Filter print jobs' })
  await expect(nav.getByRole('link', { name: /^All · \d+$/ })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('row').filter({ hasText: requested })).toContainText('Requested')

  await nav.getByRole('link', { name: /^Stalled · \d+$/ }).click()
  await expect(page).toHaveURL(/\/admin\/print-jobs\?show=stalled$/)
  const row = page.getByRole('row').filter({ hasText: stalled })
  await expect(row).toContainText('Accepted · stalled')
  await expect(row).toContainText('E2E Queue printer')
  await expect(page.getByRole('row').filter({ hasText: requested })).toHaveCount(0)

  await row.getByRole('link', { name: 'Open' }).click()
  await page.waitForURL(`**/dashboard/print-requests/${stalledJob.id}`)
})
