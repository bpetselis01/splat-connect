import { test, expect } from '@playwright/test'
import { adminClient, createContributor, makeOrgLeader, signInAsNewContributor, uniqueTitle } from './helpers'
import { futureDate, followOrg, notificationsOf, partyPage, seedEvent, seedStory } from './org-fixtures'

/**
 * Events and stories from the leader's side: write one, publish and unpublish
 * it, remove it, and what a follower and a visitor see of each. A follower is
 * told on the draft-to-published edge only.
 */

async function fillEventForm(page: import('@playwright/test').Page, title: string) {
  await page.getByLabel('Event name', { exact: true }).fill(title)
  await page.getByLabel('Date', { exact: true }).fill(futureDate())
  await page.getByLabel('Starts', { exact: true }).fill('10:00')
  await page.getByLabel('Venue and street', { exact: true }).fill('E2E Hall, 1 Test St')
  await page.getByLabel('Suburb', { exact: true }).fill('Testville')
  await page.getByLabel('Who is it for?', { exact: true }).fill('Anyone with a toy to adapt.')
}

async function fillStoryForm(page: import('@playwright/test').Page, title: string, consent: boolean) {
  await page.getByLabel('Title', { exact: true }).fill(title)
  await page.getByLabel('One-sentence summary', { exact: true }).fill('What happened, in a line.')
  await page.getByLabel('The story', { exact: true }).fill('One thing that happened, told plainly.')
  if (consent) await page.getByRole('checkbox', { name: 'Everyone named or pictured has agreed to appear' }).click()
}

test('L19 publishing an event puts it live, tells a follower, and a draft tells nobody', async ({ page, browser, baseURL }) => {
  const leader = await signInAsNewContributor(page)
  const orgName = uniqueTitle('E2E Publishing Org')
  const orgId = await makeOrgLeader(leader.id, orgName)
  const follower = await createContributor()
  await followOrg(orgId, follower.id)

  // Save as draft first: a row, no notification.
  const draftTitle = uniqueTitle('E2E Draft Event')
  await page.goto('/organisation/publish')
  await page.getByRole('button', { name: 'New event' }).click()
  await fillEventForm(page, draftTitle)
  await page.getByRole('button', { name: 'Save as draft' }).click()
  await expect(page.getByText(draftTitle)).toBeVisible()
  await expect(page.getByText('Draft', { exact: true })).toBeVisible()
  const { data: draft } = await adminClient()
    .from('org_events')
    .select('status, org_id, created_by')
    .eq('org_id', orgId)
    .eq('title', draftTitle)
    .single()
  expect(draft).toEqual({ status: 'draft', org_id: orgId, created_by: leader.id })
  expect(await notificationsOf(follower.id, 'org_event_published')).toHaveLength(0)

  // Publish: live, and the follower is told.
  const title = uniqueTitle('E2E Live Event')
  await page.getByRole('button', { name: 'New event' }).click()
  await fillEventForm(page, title)
  await page.getByRole('button', { name: 'Publish to Events' }).click()
  await expect(page.getByText(title)).toBeVisible()
  await expect(page.getByText('Published', { exact: true })).toBeVisible()
  const { data: live } = await adminClient()
    .from('org_events')
    .select('id, status')
    .eq('org_id', orgId)
    .eq('title', title)
    .single()
  expect(live?.status).toBe('published')

  const notes = await notificationsOf(follower.id, 'org_event_published')
  expect(notes).toEqual([
    expect.objectContaining({ org_event_id: live!.id, tutorial_title: title, actor_name: orgName }),
  ])

  const followerPage = await partyPage(browser, baseURL, follower)
  try {
    await followerPage.goto('/inbox')
    await expect(followerPage.getByText(`${orgName} published an event: ${title}`)).toBeVisible()
  } finally {
    await followerPage.context().close()
  }
})

test('L20 publishing a story tells a follower; an unconsented story cannot go live, a draft can be saved', async ({
  page,
  browser,
  baseURL,
}) => {
  const leader = await signInAsNewContributor(page)
  const orgName = uniqueTitle('E2E Storytelling Org')
  const orgId = await makeOrgLeader(leader.id, orgName)
  const follower = await createContributor()
  await followOrg(orgId, follower.id)

  await page.goto('/organisation/publish')
  await page.getByRole('button', { name: 'New story' }).click()
  const draftTitle = uniqueTitle('E2E Draft Story')
  await fillStoryForm(page, draftTitle, false)
  // Consent is the gate: Publish waits for the tick, a draft does not.
  await expect(page.getByRole('button', { name: 'Publish to Stories' })).toBeDisabled()
  await page.getByRole('button', { name: 'Save as draft' }).click()
  await page.getByRole('radio', { name: /^Stories/ }).click()
  await expect(page.getByText(draftTitle)).toBeVisible()
  const { data: draft } = await adminClient()
    .from('org_stories')
    .select('status, consent_confirmed')
    .eq('org_id', orgId)
    .eq('title', draftTitle)
    .single()
  expect(draft).toEqual({ status: 'draft', consent_confirmed: false })
  expect(await notificationsOf(follower.id, 'org_story_published')).toHaveLength(0)

  const title = uniqueTitle('E2E Live Story')
  await page.getByRole('button', { name: 'New story' }).click()
  await fillStoryForm(page, title, true)
  await page.getByRole('button', { name: 'Publish to Stories' }).click()
  await page.getByRole('radio', { name: /^Stories/ }).click()
  await expect(page.getByText(title)).toBeVisible()
  const { data: live } = await adminClient()
    .from('org_stories')
    .select('id, status, consent_confirmed, published_at')
    .eq('org_id', orgId)
    .eq('title', title)
    .single()
  expect(live).toEqual(expect.objectContaining({ status: 'published', consent_confirmed: true }))
  expect(live?.published_at).not.toBeNull()

  expect(await notificationsOf(follower.id, 'org_story_published')).toEqual([
    expect.objectContaining({ org_story_id: live!.id, tutorial_title: title, actor_name: orgName }),
  ])
  const followerPage = await partyPage(browser, baseURL, follower)
  try {
    await followerPage.goto('/inbox')
    await expect(followerPage.getByText(`${orgName} published a story: ${title}`)).toBeVisible()
  } finally {
    await followerPage.context().close()
  }
})

test('L21 L22 the toggle publishes a draft event (telling followers once) and takes it down again; Remove deletes it', async ({ page }) => {
  const leader = await signInAsNewContributor(page)
  const orgId = await makeOrgLeader(leader.id, uniqueTitle('E2E Toggle Org'))
  const follower = await createContributor()
  await followOrg(orgId, follower.id)
  const title = uniqueTitle('E2E Toggled Event')
  const eventId = await seedEvent(orgId, leader.id, { title })
  const status = async () =>
    (await adminClient().from('org_events').select('status').eq('id', eventId).single()).data?.status

  await page.goto('/organisation/publish')
  await expect(page.getByText(title)).toBeVisible()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible()
  expect(await status()).toBe('published')
  expect(await notificationsOf(follower.id, 'org_event_published')).toEqual([
    expect.objectContaining({ org_event_id: eventId, tutorial_title: title }),
  ])

  await page.getByRole('button', { name: 'Unpublish' }).click()
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible()
  expect(await status()).toBe('draft')
  // Taking it down tells no one anything.
  expect(await notificationsOf(follower.id, 'org_event_published')).toHaveLength(1)

  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: `Remove ${title}` }).click()
  await expect(page.getByText(title)).toBeHidden()
  const { data: gone } = await adminClient().from('org_events').select('id').eq('id', eventId)
  expect(gone).toEqual([])
})

test('L21 L22 the toggle publishes and unpublishes a story, and Remove keeps it when the leader says keep it', async ({ page }) => {
  const leader = await signInAsNewContributor(page)
  const orgId = await makeOrgLeader(leader.id, uniqueTitle('E2E Story Toggle Org'))
  const follower = await createContributor()
  await followOrg(orgId, follower.id)
  const title = uniqueTitle('E2E Toggled Story')
  const storyId = await seedStory(orgId, leader.id, { title })
  const status = async () =>
    (await adminClient().from('org_stories').select('status').eq('id', storyId).single()).data?.status

  await page.goto('/organisation/publish')
  await page.getByRole('radio', { name: /^Stories/ }).click()
  await expect(page.getByText(title)).toBeVisible()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible()
  expect(await status()).toBe('published')
  expect(await notificationsOf(follower.id, 'org_story_published')).toEqual([
    expect.objectContaining({ org_story_id: storyId, tutorial_title: title }),
  ])

  await page.getByRole('button', { name: 'Unpublish' }).click()
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible()
  expect(await status()).toBe('draft')

  // Declining the confirm leaves the row alone.
  page.once('dialog', (d) => void d.dismiss())
  await page.getByRole('button', { name: `Remove ${title}` }).click()
  await expect(page.getByText(title)).toBeVisible()
  expect(await status()).toBe('draft')

  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: `Remove ${title}` }).click()
  await expect(page.getByText(title)).toBeHidden()
  const { data: gone } = await adminClient().from('org_stories').select('id').eq('id', storyId)
  expect(gone).toEqual([])
})

test('L30 a published story opens its organisation page and an event its own page; an unpublished one is gone', async ({ page }) => {
  await signInAsNewContributor(page)
  const owner = await createContributor()
  const orgName = uniqueTitle('E2E News Org')
  const orgId = await makeOrgLeader(owner.id, orgName)
  const eventTitle = uniqueTitle('E2E News Event')
  const storyTitle = uniqueTitle('E2E News Story')
  const eventId = await seedEvent(orgId, owner.id, { title: eventTitle, status: 'published' })
  const storyId = await seedStory(orgId, owner.id, { title: storyTitle, status: 'published' })

  await page.goto(`/news/event/${eventId}`)
  await expect(page).toHaveURL(new RegExp(`/events/${eventId}$`))
  await expect(page.getByText(eventTitle)).toBeVisible()

  await page.goto(`/news/story/${storyId}`)
  await expect(page).toHaveURL(new RegExp(`/toy-library/organisation/${orgId}$`))
  await expect(page.getByText(`Published a story — ${storyTitle}`)).toBeVisible()

  await adminClient().from('org_events').update({ status: 'draft' }).eq('id', eventId)
  await page.goto(`/events/${eventId}`)
  await expect(page.getByText('No such event.')).toBeVisible()
})
