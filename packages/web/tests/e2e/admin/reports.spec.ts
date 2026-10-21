import { test, expect, type Page } from '@playwright/test'
import { adminClient, uniqueTitle } from '../helpers'
import { createMember, expectCardMoved, expectInboxLine, liveCount, pollRow, seedIdea, signInAdmin } from './support'

const reportIds: string[] = []
const ideaIds: string[] = []

async function seedMemberReport(reporterId: string, body: string) {
  const { data, error } = await adminClient()
    .from('member_reports')
    .insert({ reporter_id: reporterId, subject_kind: 'toy', subject_label: 'Drum switch toy', category: 'other', body })
    .select('id')
    .single()
  if (error) throw new Error(`seedMemberReport failed: ${error.message}`)
  reportIds.push(data.id)
  return data.id as string
}

test.afterAll(async () => {
  const db = adminClient()
  await db.from('member_reports').delete().in('id', reportIds)
  await db.from('toy_ideas').delete().in('id', ideaIds)
})

const rowWith = (page: Page, text: string) => page.getByRole('listitem').filter({ hasText: text })

test('WM27 Start looking marks a report Looking into it and it stays counted', async ({ page }) => {
  const reporter = await createMember()
  const body = uniqueTitle('The drum skin is loose')
  const id = await seedMemberReport(reporter.id, body)
  await signInAdmin(page)

  await page.goto('/admin/reports')
  await page.waitForLoadState('networkidle')
  await expect(rowWith(page, body)).toContainText('New')
  await rowWith(page, body).getByRole('button', { name: 'Start looking' }).click()

  await expect(rowWith(page, body)).toContainText('Looking into it')
  await pollRow('member_reports', id, 'status', 'looking')
  await expectCardMoved(page, 'reports', 0, 0)
  expect((await adminClient().from('member_reports').select('status').eq('id', id).single()).data?.status).not.toBe('resolved')
})

test('WM28 Resolve closes the report, tells the reporter and drops the Reports card', async ({ page }) => {
  const reporter = await createMember()
  const body = uniqueTitle('The clip snapped on first use')
  const id = await seedMemberReport(reporter.id, body)
  await adminClient().from('member_reports').update({ status: 'looking' }).eq('id', id)
  await signInAdmin(page)
  const before = await liveCount('reports')

  await page.goto('/admin/reports')
  await page.waitForLoadState('networkidle')
  await rowWith(page, body).getByRole('button', { name: 'Resolve' }).click()

  await expect(rowWith(page, body)).toContainText('Resolved')
  await expect(rowWith(page, body).getByRole('button', { name: 'Resolve' })).toHaveCount(0)
  await pollRow('member_reports', id, 'status', 'resolved')
  await expectCardMoved(page, 'reports', before, -1)

  await expectInboxLine(page, reporter, 'Your report was looked at')
})

test('WM29 a note to the reporter is saved and shown on the report as Sent back', async ({ page }) => {
  const reporter = await createMember()
  const body = uniqueTitle('The label peeled off')
  const id = await seedMemberReport(reporter.id, body)
  await signInAdmin(page)

  await page.goto('/admin/reports')
  await page.waitForLoadState('networkidle')
  await rowWith(page, body).getByRole('button', { name: 'Note to reporter' }).click()
  await expect(rowWith(page, body).getByRole('button', { name: 'Send it' })).toBeDisabled()
  await rowWith(page, body).getByLabel('Note to the reporter').fill('Thanks, we are checking the batch.')
  await rowWith(page, body).getByRole('button', { name: 'Send it' }).click()

  await expect(rowWith(page, body)).toContainText('Sent back: Thanks, we are checking the batch.')
  await pollRow('member_reports', id, 'note_to_reporter', 'Thanks, we are checking the batch.')
})

async function seedIdeaReport(reason: string) {
  const author = await createMember()
  const target = await createMember()
  const ideaId = await seedIdea(author.id, 'challenge', uniqueTitle('E2E Reported Challenge'))
  ideaIds.push(ideaId)
  const db = adminClient()
  await db.from('toy_idea_participants').insert([{ idea_id: ideaId, profile_id: author.id }, { idea_id: ideaId, profile_id: target.id }])
  const { data, error } = await db
    .from('toy_idea_reports')
    .insert({ idea_id: ideaId, reported_profile_id: target.id, reported_by: author.id, reason })
    .select('id')
    .single()
  if (error) throw new Error(`seedIdeaReport failed: ${error.message}`)
  return { reportId: data.id as string, ideaId, target }
}

test('WM26 the Idea reports tab swaps the member reports for reports against people in challenges and back', async ({ page }) => {
  const reason = uniqueTitle('Kept interrupting the thread')
  await seedIdeaReport(reason)
  await signInAdmin(page)

  await page.goto('/admin/reports')
  await expect(page.getByRole('link', { name: 'Member reports' })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('link', { name: 'Idea reports' }).click()
  await expect(page).toHaveURL(/\/admin\/reports\?tab=ideas$/)
  await expect(page.getByRole('link', { name: 'Idea reports' })).toHaveAttribute('aria-current', 'page')
  await expect(rowWith(page, reason)).toBeVisible()
  await page.getByRole('link', { name: 'Member reports' }).click()
  await expect(page).toHaveURL(/\/admin\/reports$/)
  await expect(rowWith(page, reason)).toHaveCount(0)
})

test('WM30 WM31 Remove takes the person out of the challenge and tells them, and Reinstate puts them back', async ({ page }) => {
  const reason = uniqueTitle('Made another participant uncomfortable')
  const { ideaId, target } = await seedIdeaReport(reason)
  await signInAdmin(page)

  await page.goto('/admin/reports?tab=ideas')
  await page.waitForLoadState('networkidle')
  await rowWith(page, reason).getByLabel('Note for the record').fill('Warned twice already.')
  await rowWith(page, reason).getByRole('button', { name: 'Remove' }).click()

  await expect(rowWith(page, reason)).toContainText('Decision note: Warned twice already.')
  await expect(rowWith(page, reason).getByText('Removed', { exact: true })).toBeVisible()
  const removedAt = async () =>
    (await adminClient().from('toy_idea_participants').select('removed_at').eq('idea_id', ideaId).eq('profile_id', target.id).single()).data?.removed_at
  expect(await removedAt()).not.toBeNull()

  await rowWith(page, reason).getByRole('button', { name: 'Reinstate' }).click()
  await expect(rowWith(page, reason).getByRole('button', { name: 'Reinstate' })).toHaveCount(0)
  await expect.poll(removedAt, { timeout: 30_000 }).toBeNull()

  await expectInboxLine(page, target, /removed you from a design challenge/)
})

test('WM30 Dismiss closes the report with the note and leaves the person in the challenge', async ({ page }) => {
  const reason = uniqueTitle('Said something unkind once')
  const { ideaId, target } = await seedIdeaReport(reason)
  await signInAdmin(page)

  await page.goto('/admin/reports?tab=ideas')
  await page.waitForLoadState('networkidle')
  await rowWith(page, reason).getByLabel('Note for the record').fill('One-off, apologised.')
  await rowWith(page, reason).getByRole('button', { name: 'Dismiss' }).click()

  await expect(rowWith(page, reason)).toContainText('Resolved')
  await expect(rowWith(page, reason)).toContainText('Decision note: One-off, apologised.')
  await expect(rowWith(page, reason).getByRole('button', { name: 'Reinstate' })).toHaveCount(0)
  const { data } = await adminClient().from('toy_idea_participants').select('removed_at').eq('idea_id', ideaId).eq('profile_id', target.id).single()
  expect(data?.removed_at).toBeNull()
})
