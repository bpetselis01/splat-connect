import { test, expect, type Page } from '@playwright/test'
import { adminClient } from './helpers'
import { seedIdeaReport, signInAdmin } from './admin-fixtures'

const stage = (page: Page, label: string) => page.getByRole('button', { name: new RegExp(`^${label}, \\d+$`) })
const row = (page: Page, title: string) => page.getByRole('button', { name: new RegExp(title) })

async function openIdeaReports(page: Page) {
  await page.goto('/admin/reports')
  await page.getByRole('tab', { name: 'Idea reports', exact: true }).click()
}
const reportDb = async (id: string) =>
  (await adminClient().from('toy_idea_reports').select('resolved_at, resolution_note').eq('id', id).single()).data!
const participantDb = async (ideaId: string, profileId: string) =>
  (await adminClient().from('toy_idea_participants').select('removed_at').eq('idea_id', ideaId).eq('profile_id', profileId).single()).data!
const removalNotices = async (profileId: string, ideaId: string) =>
  (await adminClient().from('notifications').select('type, actor_name').eq('recipient_id', profileId).eq('idea_id', ideaId)).data

test('Q44 Dismiss resolves the report with the note and leaves the person in the challenge', async ({ page }) => {
  const report = await seedIdeaReport()
  await signInAdmin(page)
  await openIdeaReports(page)

  await row(page, report.rowTitle).click()
  await page.getByLabel('Note for the record').fill('Nothing found in the thread')
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/reports$/)
  await expect(row(page, report.rowTitle)).toHaveCount(0)
  await stage(page, 'Resolved').click()
  await expect(row(page, report.rowTitle)).toBeVisible()
  await expect(row(page, report.rowTitle)).not.toContainText('Removed')

  expect(await reportDb(report.id)).toMatchObject({ resolution_note: 'Nothing found in the thread', resolved_at: expect.any(String) })
  expect((await participantDb(report.ideaId, report.targetId)).removed_at).toBeNull()
  expect(await removalNotices(report.targetId, report.ideaId)).toEqual([])
})

test('Q45 Remove resolves the report, takes the person out of the challenge and tells them', async ({ page }) => {
  const report = await seedIdeaReport()
  await signInAdmin(page)
  await openIdeaReports(page)

  await row(page, report.rowTitle).click()
  await page.getByLabel('Note for the record').fill('Removed after a warning')
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/reports$/)
  await expect(row(page, report.rowTitle)).toHaveCount(0)
  await stage(page, 'Resolved').click()
  await expect(row(page, report.rowTitle)).toContainText('Removed')

  expect(await reportDb(report.id)).toMatchObject({ resolution_note: 'Removed after a warning', resolved_at: expect.any(String) })
  expect((await participantDb(report.ideaId, report.targetId)).removed_at).not.toBeNull()
  expect(await removalNotices(report.targetId, report.ideaId)).toEqual([{ type: 'challenge_removed', actor_name: 'SPLAT' }])
})

test('Q46 Reinstate on a removed person restores them to the challenge', async ({ page }) => {
  const report = await seedIdeaReport({ resolved: true, removed: true })
  await signInAdmin(page)
  await openIdeaReports(page)

  await stage(page, 'Resolved').click()
  await expect(row(page, report.rowTitle)).toContainText('Removed')
  await row(page, report.rowTitle).click()
  await page.getByRole('button', { name: 'Reinstate', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/reports$/)
  await expect(row(page, report.rowTitle)).toBeVisible()
  await expect(row(page, report.rowTitle)).not.toContainText('Removed')
  expect((await participantDb(report.ideaId, report.targetId)).removed_at).toBeNull()
})
