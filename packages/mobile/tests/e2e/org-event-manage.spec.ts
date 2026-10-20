import { test, expect } from '@playwright/test'
import { adminClient, createContributor, makeOrgLeader, signInAsNewContributor, uniqueTitle } from './helpers'
import { followOrg, notificationsOf, seedEvent, seedStory } from './org-fixtures'
import { seedPrintableGuide, setOrgPickup } from './counts-helpers-d'

/**
 * The leader's event screens: who is coming with their answers and the parts
 * queue, accepting and declining a part request, editing an event or a story
 * in place, and the Publish tab rows that lead there.
 */

async function setup(page: import('@playwright/test').Page) {
  const leader = await signInAsNewContributor(page)
  const orgName = uniqueTitle('E2E Manage Org')
  const orgId = await makeOrgLeader(leader.id, orgName)
  await setOrgPickup(orgId)
  const title = uniqueTitle('E2E Manage Event')
  const eventId = await seedEvent(orgId, leader.id, {
    title,
    status: 'published',
    prints_parts: true,
    part_sets_max: 4,
    capacity: 10,
    questions: [{ prompt: 'Which toy are you bringing?', answer_type: 'short', required: false }],
  } as never)
  return { leader, orgId, orgName, title, eventId }
}

async function family(name: string) {
  const f = await createContributor()
  await adminClient().from('profiles').update({ name }).eq('id', f.id)
  return f
}

async function registerWithAnswer(eventId: string, userId: string, name: string, answer: string) {
  const { data: q } = await adminClient().from('org_event_questions').select('id').eq('event_id', eventId).single()
  const { error } = await adminClient().from('org_event_registrations').insert({
    event_id: eventId, user_id: userId, name, email: `${userId}@example.com`, answers: { [q!.id]: answer },
  })
  if (error) throw new Error(`register failed: ${error.message}`)
}

async function partRequest(eventId: string, orgId: string, requesterId: string) {
  const guide = await seedPrintableGuide((await createContributor()).id)
  const { data, error } = await adminClient().from('toy_transactions').insert({
    toy_id: null, offered_toy_id: null, tutorial_id: guide.id, printer_id: null, event_id: eventId, part_sets: 2,
    type: 'print', status: 'requested', requester_id: requesterId, owner_id: null, owner_org_id: orgId, print_note: 'Blue please',
  }).select('id').single()
  if (error || !data) throw new Error(`part request seed failed: ${error?.message}`)
  return { id: data.id as string, guideTitle: guide.title }
}

const txStatus = async (id: string) =>
  (await adminClient().from('toy_transactions').select('status, decline_reason').eq('id', id).single()).data

test('L32 the registrations list shows who is coming with each answer, the going and to-answer counts, and the parts queue', async ({ page }) => {
  const { orgId, eventId } = await setup(page)
  const priya = await family('Priya Nair')
  const sam = await family('Sam Lee')
  await registerWithAnswer(eventId, priya.id, 'Priya Nair', 'Light-up penguin')
  await registerWithAnswer(eventId, sam.id, 'Sam Lee', 'Switch-adapted drum')
  const request = await partRequest(eventId, orgId, priya.id)

  await page.goto(`/organisation/events/${eventId}`)
  await expect(page.getByText('2 going', { exact: true })).toBeVisible()
  await expect(page.getByText('1 to answer', { exact: true })).toBeVisible()
  await expect(page.getByText('Seats 10', { exact: true })).toBeVisible()
  await expect(page.getByText('Priya Nair', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(`${request.guideTitle} · 2 sets · “Blue please”`)).toBeVisible()

  await page.getByRole('button', { name: 'Priya Nair, show answers' }).click()
  await expect(page.getByText('Which toy are you bringing?')).toBeVisible()
  await expect(page.getByText('Light-up penguin', { exact: true })).toBeVisible()
  await expect(page.getByText('Switch-adapted drum', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Sam Lee, show answers' }).click()
  await expect(page.getByText('Switch-adapted drum', { exact: true })).toBeVisible()
})

test('L33 We\'ll print these accepts the part request: the pill says Printing, the to-answer count drops and the family is told', async ({ page }) => {
  const { orgId, eventId } = await setup(page)
  const priya = await family('Priya Nair')
  const request = await partRequest(eventId, orgId, priya.id)

  await page.goto(`/organisation/events/${eventId}`)
  await expect(page.getByText('1 to answer', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: "We'll print these for Priya Nair" }).click()
  await expect(page.getByText('Printing', { exact: true })).toBeVisible()
  await expect(page.getByText('0 to answer', { exact: true })).toBeVisible()
  await expect(page.getByText('2 accepted so far', { exact: false })).toBeVisible()
  expect((await txStatus(request.id))?.status).toBe('accepted')
  const { data: notes } = await adminClient().from('notifications').select('type, toy_name').eq('recipient_id', priya.id).eq('toy_transaction_id', request.id)
  expect(notes).toEqual([{ type: 'toy_accepted', toy_name: request.guideTitle }])
})

test('L34 Can\'t print these asks for a reason, Send decline rejects the request with it and tells the family', async ({ page }) => {
  const { orgId, eventId } = await setup(page)
  const priya = await family('Priya Nair')
  const request = await partRequest(eventId, orgId, priya.id)

  await page.goto(`/organisation/events/${eventId}`)
  await page.getByRole('button', { name: "Can't print these for Priya Nair" }).click()
  await expect(page.getByRole('button', { name: 'Send decline to Priya Nair' })).toBeDisabled()
  await page.getByLabel('Why can you not print these?').fill('Our machine is down')
  await page.getByRole('button', { name: 'Send decline to Priya Nair' }).click()

  await expect(page.getByText('Declined', { exact: true })).toBeVisible()
  await expect(page.getByText('0 to answer', { exact: true })).toBeVisible()
  await expect(page.getByText('Our machine is down', { exact: false })).toBeVisible()
  expect(await txStatus(request.id)).toEqual({ status: 'rejected', decline_reason: 'Our machine is down' })
  const { data: notes } = await adminClient().from('notifications').select('type, body').eq('recipient_id', priya.id).eq('toy_transaction_id', request.id)
  expect(notes).toEqual([{ type: 'toy_rejected', body: 'Our machine is down' }])
})

test('L35 editing an event: Save as draft keeps it a draft, Publish to Events tells a follower, Save changes edits it live and keeps its question', async ({ page }) => {
  const leader = await signInAsNewContributor(page)
  const orgName = uniqueTitle('E2E Edit Org')
  const orgId = await makeOrgLeader(leader.id, orgName)
  const follower = await createContributor()
  await followOrg(orgId, follower.id)
  const title = uniqueTitle('E2E Edited Event')
  const eventId = await seedEvent(orgId, leader.id, {
    title,
    questions: [{ prompt: 'Which toy are you bringing?', answer_type: 'short', required: false }],
  } as never)
  const row = async () => (await adminClient().from('org_events').select('title, status').eq('id', eventId).single()).data
  const questions = async () => (await adminClient().from('org_event_questions').select('prompt, required').eq('event_id', eventId)).data

  await page.goto(`/organisation/events/${eventId}/edit`)
  await expect(page.getByLabel('Event name', { exact: true })).toHaveValue(title)
  await page.getByLabel('Event name', { exact: true }).fill(`${title} v2`)
  await page.getByRole('button', { name: 'Save as draft' }).click()
  await expect.poll(row).toEqual({ title: `${title} v2`, status: 'draft' })
  expect(await notificationsOf(follower.id, 'org_event_published')).toHaveLength(0)

  await page.goto(`/organisation/events/${eventId}/edit`)
  await page.getByLabel('Question 1').fill('Which switch are you bringing?')
  await page.getByRole('button', { name: 'Publish to Events' }).click()
  await expect.poll(row).toEqual({ title: `${title} v2`, status: 'published' })
  await expect.poll(questions).toEqual([{ prompt: 'Which switch are you bringing?', required: false }])
  await expect.poll(() => notificationsOf(follower.id, 'org_event_published')).toEqual([
    expect.objectContaining({ org_event_id: eventId, tutorial_title: `${title} v2`, actor_name: orgName }),
  ])

  await page.goto(`/organisation/events/${eventId}/edit`)
  await expect(page.getByRole('button', { name: 'Save as draft' })).toHaveCount(0)
  await page.getByLabel('Event name', { exact: true }).fill(`${title} v3`)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect.poll(row).toEqual({ title: `${title} v3`, status: 'published' })
  expect(await notificationsOf(follower.id, 'org_event_published')).toHaveLength(1)
})

test('L36 editing a story: Publish to Stories tells a follower and needs consent, Save changes edits it live', async ({ page }) => {
  const leader = await signInAsNewContributor(page)
  const orgName = uniqueTitle('E2E Story Edit Org')
  const orgId = await makeOrgLeader(leader.id, orgName)
  const follower = await createContributor()
  await followOrg(orgId, follower.id)
  const title = uniqueTitle('E2E Edited Story')
  const storyId = await seedStory(orgId, leader.id, { title })
  const row = async () => (await adminClient().from('org_stories').select('title, status').eq('id', storyId).single()).data

  await page.goto(`/organisation/stories/${storyId}/edit`)
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(title)
  await page.getByLabel('Title', { exact: true }).fill(`${title} v2`)
  await page.getByRole('button', { name: 'Save as draft' }).click()
  await expect.poll(row).toEqual({ title: `${title} v2`, status: 'draft' })
  expect(await notificationsOf(follower.id, 'org_story_published')).toHaveLength(0)

  await page.goto(`/organisation/stories/${storyId}/edit`)
  await page.getByRole('checkbox', { name: 'Everyone named or pictured has agreed to appear' }).click()
  await page.getByRole('button', { name: 'Publish to Stories' }).click()
  await expect.poll(row).toEqual({ title: `${title} v2`, status: 'published' })
  await expect.poll(() => notificationsOf(follower.id, 'org_story_published')).toEqual([
    expect.objectContaining({ org_story_id: storyId, tutorial_title: `${title} v2`, actor_name: orgName }),
  ])

  await page.goto(`/organisation/stories/${storyId}/edit`)
  await page.getByLabel('Title', { exact: true }).fill(`${title} v3`)
  await page.getByRole('checkbox', { name: 'Everyone named or pictured has agreed to appear' }).click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect.poll(row).toEqual({ title: `${title} v3`, status: 'published' })
  expect(await notificationsOf(follower.id, 'org_story_published')).toHaveLength(1)
})

test('L37 an event row opens its registrations or its edit form, and a story row opens its edit form', async ({ page }) => {
  const leader = await signInAsNewContributor(page)
  const orgId = await makeOrgLeader(leader.id, uniqueTitle('E2E Rows Org'))
  const eventTitle = uniqueTitle('E2E Row Event')
  const storyTitle = uniqueTitle('E2E Row Story')
  const eventId = await seedEvent(orgId, leader.id, { title: eventTitle, status: 'published' })
  const storyId = await seedStory(orgId, leader.id, { title: storyTitle })

  await page.goto('/organisation/publish')
  await page.getByRole('button', { name: `Registrations for ${eventTitle}` }).click()
  await expect(page).toHaveURL(new RegExp(`/organisation/events/${eventId}$`))
  await expect(page.getByRole('heading', { name: eventTitle })).toBeVisible()

  await page.goto('/organisation/publish')
  await page.getByRole('button', { name: `Edit ${eventTitle}` }).click()
  await expect(page).toHaveURL(new RegExp(`/organisation/events/${eventId}/edit$`))
  await expect(page.getByLabel('Event name', { exact: true })).toHaveValue(eventTitle)

  await page.goto('/organisation/publish')
  await page.getByRole('radio', { name: /^Stories/ }).click()
  await page.getByRole('button', { name: `Edit ${storyTitle}` }).click()
  await expect(page).toHaveURL(new RegExp(`/organisation/stories/${storyId}/edit$`))
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(storyTitle)
})
