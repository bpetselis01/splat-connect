import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createEvent, deleteUser, uniqueTitle } from '../helpers'
import { createLeaderSeat, removeLeaderSeat, signInAs, type LeaderSeat } from './leader'

let leader: LeaderSeat
let empty: LeaderSeat
let follower: Awaited<ReturnType<typeof createContributor>>
let registrant: Awaited<ReturnType<typeof createContributor>>
let live: { id: string; title: string }
let draft: { id: string; title: string }
let draftStory: { id: string; title: string }
let liveStory: { id: string; title: string }

async function story(over: Record<string, unknown>) {
  const title = uniqueTitle('Story')
  const { data, error } = await adminClient()
    .from('org_stories')
    .insert({
      org_id: leader.orgId, kind: 'family', title, summary: 'One sentence.', body: 'A paragraph.', byline: 'The club',
      consent_confirmed: true, created_by: leader.id, ...over,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`story seed failed: ${error?.message}`)
  return { id: data.id as string, title }
}

test.beforeAll(async () => {
  leader = await createLeaderSeat(`Publish Org ${Date.now()}`)
  empty = await createLeaderSeat(`Empty Org ${Date.now()}`)
  follower = await createContributor()
  registrant = await createContributor()
  await adminClient().from('org_follows').insert({ org_id: leader.orgId, profile_id: follower.id })
  const liveTitle = uniqueTitle('Live build day')
  const draftTitle = uniqueTitle('Draft build day')
  live = { id: await createEvent(leader.orgId, leader.id, { title: liveTitle, status: 'published' }), title: liveTitle }
  draft = { id: await createEvent(leader.orgId, leader.id, { title: draftTitle, status: 'draft' }), title: draftTitle }
  await adminClient().from('org_event_registrations').insert([
    { event_id: live.id, user_id: registrant.id, name: 'Reg One', email: 'one@example.com', answers: {} },
    { event_id: live.id, user_id: follower.id, name: 'Reg Two', email: 'two@example.com', answers: {} },
  ])
  liveStory = await story({ status: 'published', published_at: new Date().toISOString() })
  draftStory = await story({ status: 'draft' })
})

test.afterAll(async () => {
  await removeLeaderSeat(leader)
  await removeLeaderSeat(empty)
  await deleteUser(follower.id)
  await deleteUser(registrant.id)
})

const rowOf = (page: import('@playwright/test').Page, title: string) => page.locator('article', { hasText: title })

test('WB15 the publish page counts events, people going, live stories and drafts, and badges each row', async ({ page }) => {
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/publish')
  await expect(page.locator('.count-chip', { hasText: 'Upcoming events' })).toContainText('1')
  await expect(page.locator('.count-chip', { hasText: 'People going' })).toContainText('2')
  await expect(page.locator('.count-chip', { hasText: 'Stories live' })).toContainText('1')
  await expect(page.locator('.count-chip', { hasText: 'Drafts' })).toContainText('2')
  await expect(rowOf(page, live.title)).toContainText('Published')
  await expect(rowOf(page, live.title)).toContainText('2 going')
  await expect(rowOf(page, draft.title)).toContainText('Draft')
  await page.getByRole('tab', { name: /Stories/ }).click()
  await expect(rowOf(page, liveStory.title)).toContainText('Published')
  await expect(rowOf(page, draftStory.title)).toContainText('Draft')
})

test('WB15 an organisation with nothing published is invited to publish an event, then a story', async ({ page }) => {
  await signInAs(page, empty)
  await page.goto('/dashboard/organisation/publish')
  await expect(page.getByText('No events yet')).toBeVisible()
  await page.getByRole('tab', { name: /Stories/ }).click()
  await expect(page.getByText('No stories yet')).toBeVisible()
  await page.getByRole('link', { name: 'Write a story' }).click()
  await expect(page).toHaveURL('/dashboard/organisation/stories/new')
})

test('WB16 publishing a draft event puts it on the public list and tells a follower; unpublishing takes it off', async ({ page }) => {
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/publish')
  await rowOf(page, draft.title).getByRole('button', { name: 'Publish' }).click()
  await expect(rowOf(page, draft.title)).toContainText('Published')
  await page.goto('/get-involved/events')
  await expect(page.getByText(draft.title)).toBeVisible()

  await signInAs(page, follower)
  await page.goto('/notifications')
  await expect(page.getByText(`${leader.orgName} published an event: ${draft.title}`)).toBeVisible()

  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/publish')
  await rowOf(page, draft.title).getByRole('button', { name: 'Unpublish' }).click()
  await expect(rowOf(page, draft.title)).toContainText('Draft')
  await page.goto('/get-involved/events')
  await expect(page.getByText(draft.title)).toHaveCount(0)
})

test('WB16 publishing a draft story puts it on its public page and tells a follower', async ({ page }) => {
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/publish')
  await page.getByRole('tab', { name: /Stories/ }).click()
  await rowOf(page, draftStory.title).getByRole('button', { name: 'Publish' }).click()
  await expect(rowOf(page, draftStory.title)).toContainText('Published')
  await page.goto(`/about/stories/${draftStory.id}`)
  await expect(page.getByRole('heading', { name: draftStory.title })).toBeVisible()

  await signInAs(page, follower)
  await page.goto('/notifications')
  await expect(page.getByText(`${leader.orgName} published a story: ${draftStory.title}`)).toBeVisible()
})

test('WB17 removing an event takes it off the page and tells its registrants nothing', async ({ page }) => {
  const title = uniqueTitle('Gone day')
  const id = await createEvent(leader.orgId, leader.id, { title, status: 'published' })
  await adminClient().from('org_event_registrations').insert({ event_id: id, user_id: registrant.id, name: 'Reg One', email: 'one@example.com', answers: {} })
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/publish')
  await page.getByRole('button', { name: `Remove ${title}` }).click()
  await expect(page.getByRole('heading', { name: title })).toHaveCount(0)
  await page.goto(`/get-involved/events/${id}`)
  await expect(page.getByRole('heading', { name: title })).toHaveCount(0)

  await signInAs(page, registrant)
  await page.goto('/notifications')
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  await expect(page.getByText('Nothing yet.')).toBeVisible()
})

test('WB17 removing a story takes it off the page', async ({ page }) => {
  const gone = await story({ status: 'published', published_at: new Date().toISOString() })
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/publish')
  await page.getByRole('tab', { name: /Stories/ }).click()
  await page.getByRole('button', { name: `Remove ${gone.title}` }).click()
  await expect(page.getByRole('heading', { name: gone.title })).toHaveCount(0)
  await page.goto(`/about/stories/${gone.id}`)
  await expect(page.getByRole('heading', { name: gone.title })).toHaveCount(0)
})

test('WB18 the page links to new event and story, and a live row to Manage, View and Edit', async ({ page }) => {
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/publish')
  await expect(page.getByRole('link', { name: 'New event' })).toHaveAttribute('href', '/dashboard/organisation/events/new')
  await expect(page.getByRole('link', { name: 'New story' })).toHaveAttribute('href', '/dashboard/organisation/stories/new')
  const liveRow = rowOf(page, live.title)
  await expect(liveRow.getByRole('link', { name: 'View' })).toHaveAttribute('href', `/get-involved/events/${live.id}`)
  await expect(liveRow.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', `/dashboard/organisation/events/${live.id}/edit`)
  await expect(rowOf(page, draft.title).getByRole('link', { name: /Manage/ })).toHaveCount(0)
  await liveRow.getByRole('link', { name: /Manage/ }).click()
  await expect(page).toHaveURL(`/dashboard/org/events/${live.id}`)
  await expect(page.getByRole('heading', { name: live.title })).toBeVisible()
})
