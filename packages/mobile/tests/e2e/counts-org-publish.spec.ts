// journeys: L18 Q17
import { test, expect, type Page } from '@playwright/test'
import { adminClient, createContributor, makeOrgLeader, signIn, signInAsNewContributor, uniqueTitle } from './helpers'
import { futureDate } from './org-fixtures'

/**
 * Counts that must move on screen after an action, with no reload: the Events
 * and Stories chip counts on the publish screen, and the admin cards on Me.
 */

async function fillEventForm(page: Page, title: string) {
  await page.getByLabel('Event name', { exact: true }).fill(title)
  await page.getByLabel('Date', { exact: true }).fill(futureDate())
  await page.getByLabel('Starts', { exact: true }).fill('10:00')
  await page.getByLabel('Venue and street', { exact: true }).fill('E2E Hall, 1 Test St')
  await page.getByLabel('Suburb', { exact: true }).fill('Testville')
  await page.getByLabel('Who is it for?', { exact: true }).fill('Anyone with a toy to adapt.')
}

async function fillStoryForm(page: Page, title: string) {
  await page.getByLabel('Title', { exact: true }).fill(title)
  await page.getByLabel('One-sentence summary', { exact: true }).fill('What happened, in a line.')
  await page.getByLabel('The story', { exact: true }).fill('One thing that happened, told plainly.')
  await page.getByRole('checkbox', { name: 'Everyone named or pictured has agreed to appear' }).click()
}

test('the Events and Stories chip counts move as items are added and removed', async ({ page }) => {
  const leader = await signInAsNewContributor(page)
  const orgId = await makeOrgLeader(leader.id)
  const rows = async (table: 'org_events' | 'org_stories') =>
    (await adminClient().from(table).select('id').eq('org_id', orgId)).data?.length

  await page.goto('/organisation/publish')
  await expect(page.getByRole('radio', { name: 'Events · 0' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Stories · 0' })).toBeVisible()

  await page.getByRole('button', { name: 'New event' }).click()
  await fillEventForm(page, uniqueTitle('E2E Counted Event'))
  await page.getByRole('button', { name: 'Publish to Events' }).click()
  await expect(page.getByRole('radio', { name: 'Events · 1' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Stories · 0' })).toBeVisible()
  expect(await rows('org_events')).toBe(1)

  await page.getByRole('button', { name: 'New story' }).click()
  await fillStoryForm(page, uniqueTitle('E2E Counted Story'))
  await page.getByRole('button', { name: 'Publish to Stories' }).click()
  await expect(page.getByRole('radio', { name: 'Stories · 1' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Events · 1' })).toBeVisible()
  expect(await rows('org_stories')).toBe(1)

  // Remove the event: its chip drops, the other stays.
  await page.getByRole('radio', { name: /^Events/ }).click()
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: /^Remove / }).click()
  await expect(page.getByRole('radio', { name: 'Events · 0' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Stories · 1' })).toBeVisible()
  await expect.poll(() => rows('org_events')).toBe(0)
})

test('an admin card count rises after a report lands and the admin returns to the screen', async ({ page }) => {
  const admin = await createContributor()
  const { error } = await adminClient().from('profiles').update({ role: 'admin' }).eq('id', admin.id)
  expect(error).toBeNull()
  await signIn(page, admin.email, admin.password)
  await page.waitForURL(/\/home$/)

  const cardCount = async (label: string) => {
    const card = page.getByRole('button', { name: new RegExp(`^${label}, \\d+$`) })
    await expect(card).toBeVisible()
    return Number((await card.getAttribute('aria-label'))!.split(', ').pop())
  }

  await page.getByRole('tab', { name: /^Me/ }).click()
  await page.getByRole('button', { name: /^Admin/ }).click()
  await expect(page.getByText('The review queues and the report inbox.', { exact: false })).toBeVisible()
  const before = await cardCount('Reports from members')

  // A member files a report (service role stands in for them).
  const reporter = await createContributor()
  const { data: report, error: reportError } = await adminClient()
    .from('member_reports')
    .insert({ reporter_id: reporter.id, subject_kind: 'other', subject_label: 'E2E count', category: 'other', body: 'E2E count' })
    .select('id, status')
    .single()
  expect(reportError).toBeNull()
  expect(report?.status).not.toBe('resolved')

  // Back to Me and into Admin again: the card re-reads the server.
  await page.goBack()
  await page.getByRole('button', { name: /^Admin/ }).click()
  await expect.poll(async () => cardCount('Reports from members')).toBeGreaterThan(before)
})
