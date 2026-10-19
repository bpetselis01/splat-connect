import { test, expect, type Page } from '@playwright/test'
import { adminClient, createContributor } from './helpers'
import { partyPage } from './org-fixtures'
import { cardCount, expectCard, seedIdeaReport, seedMemberReport, signInAdmin } from './admin-fixtures'

const REPORTS_CARD = 'Reports from members'
const stage = (page: Page, label: string) => page.getByRole('button', { name: new RegExp(`^${label}, \\d+$`) })
const row = (page: Page, title: string) => page.getByRole('button', { name: new RegExp(title) })
const reportDb = async (id: string) =>
  (await adminClient().from('member_reports').select('status, note_to_reporter').eq('id', id).single()).data
const resolvedNotices = async (recipientId: string, reportId: string) =>
  (await adminClient().from('notifications').select('type, actor_name').eq('recipient_id', recipientId).eq('member_report_id', reportId)).data

test('Q40 the Reports card opens the member reports by status, and the Idea reports tab lists reports against a person', async ({ page }) => {
  const reporter = await createContributor()
  const fresh = await seedMemberReport(reporter.id)
  const looking = await seedMemberReport(reporter.id, { status: 'looking' })
  const done = await seedMemberReport(reporter.id, { status: 'resolved' })
  const ideaReport = await seedIdeaReport()
  await signInAdmin(page)
  await expect(async () => {
    const card = await cardCount(page, REPORTS_CARD)
    await page.getByRole('button', { name: new RegExp(`^${REPORTS_CARD}, ${card}$`) }).click()
    await expect(page).toHaveURL(/\/admin\/reports$/)
    expect((await stageCount(page, 'New')) + (await stageCount(page, 'Looking'))).toBe(card)
  }).toPass()

  await expect(row(page, fresh.label)).toBeVisible()
  await expect(row(page, looking.label)).toHaveCount(0)
  await stage(page, 'Looking').click()
  await expect(row(page, looking.label)).toBeVisible()
  await stage(page, 'Resolved').click()
  await expect(row(page, done.label)).toBeVisible()

  await page.getByRole('tab', { name: 'Idea reports', exact: true }).click()
  await expect(row(page, ideaReport.rowTitle)).toBeVisible()
  await expect(row(page, ideaReport.rowTitle)).toContainText('Open')
})

async function stageCount(page: Page, label: string) {
  return Number((await stage(page, label).getAttribute('aria-label'))!.split(', ').pop())
}

test('Q41 a member report row opens /admin/reports/:id and an idea report row opens /admin/reports/idea/:id', async ({ page }) => {
  const reporter = await createContributor()
  const report = await seedMemberReport(reporter.id)
  const ideaReport = await seedIdeaReport()
  await signInAdmin(page)

  await page.goto('/admin/reports')
  await row(page, report.label).click()
  await expect(page).toHaveURL(new RegExp(`/admin/reports/${report.id}$`))
  await expect(page.getByText('The skin is loose.')).toBeVisible()

  await page.goto('/admin/reports')
  await page.getByRole('tab', { name: 'Idea reports', exact: true }).click()
  await row(page, ideaReport.rowTitle).click()
  await expect(page).toHaveURL(new RegExp(`/admin/reports/idea/${ideaReport.id}$`))
  await expect(page.getByText('Rude in the thread')).toBeVisible()
})

test('Q42 Looking into it keeps the report open and sends the reporter the note, and Save note on a resolved report changes only the note', async ({ page }) => {
  const reporter = await createContributor()
  const open = await seedMemberReport(reporter.id)
  const closed = await seedMemberReport(reporter.id, { status: 'resolved', note: 'First answer' })
  await signInAdmin(page)
  const before = await cardCount(page, REPORTS_CARD)

  await page.goto('/admin/reports')
  await row(page, open.label).click()
  await page.getByLabel('Note to the reporter').fill('We are looking at it.')
  await page.getByRole('button', { name: 'Looking into it' }).click()
  await expect(page).toHaveURL(/\/admin\/reports$/)
  await stage(page, 'Looking').click()
  await expect(row(page, open.label)).toBeVisible()
  expect(await reportDb(open.id)).toEqual({ status: 'looking', note_to_reporter: 'We are looking at it.' })
  expect(await resolvedNotices(reporter.id, open.id)).toEqual([])
  await expectCard(page, REPORTS_CARD, before)

  await page.goto('/admin/reports')
  await stage(page, 'Resolved').click()
  await row(page, closed.label).click()
  await page.getByLabel('Note to the reporter').fill('Second answer')
  await page.getByRole('button', { name: 'Save note' }).click()
  await expect(page).toHaveURL(/\/admin\/reports$/)
  await expect.poll(() => reportDb(closed.id)).toEqual({ status: 'resolved', note_to_reporter: 'Second answer' })
  expect(await resolvedNotices(reporter.id, closed.id)).toEqual([])
})

test('Q43 Resolve closes the report, drops the card by one, and the reporter sees Resolved with the reply', async ({ page, browser, baseURL }) => {
  const reporter = await createContributor()
  const report = await seedMemberReport(reporter.id)
  await signInAdmin(page)
  const before = await cardCount(page, REPORTS_CARD)

  await page.goto('/admin/reports')
  await row(page, report.label).click()
  await page.getByLabel('Note to the reporter').fill('Fixed, thank you for telling us.')
  await page.getByRole('button', { name: 'Resolve', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/reports$/)
  await expect(row(page, report.label)).toHaveCount(0)
  await stage(page, 'Resolved').click()
  await expect(row(page, report.label)).toBeVisible()

  expect(await reportDb(report.id)).toEqual({ status: 'resolved', note_to_reporter: 'Fixed, thank you for telling us.' })
  expect(await resolvedNotices(reporter.id, report.id)).toEqual([{ type: 'report_resolved', actor_name: 'SPLAT' }])
  await expectCard(page, REPORTS_CARD, before - 1)

  const reporterPage = await partyPage(browser, baseURL, reporter)
  await reporterPage.goto('/reports')
  await expect(reporterPage.getByText(report.label, { exact: true })).toBeVisible()
  await expect(reporterPage.getByText('Resolved', { exact: true })).toBeVisible()
  await expect(reporterPage.getByText('Fixed, thank you for telling us.')).toBeVisible()
})
