import { test, expect, type Page } from '@playwright/test'
import { adminClient, createContributor, createEvent, createTutorial, deleteUser, uniqueTitle } from '../helpers'
import { createLeaderSeat, removeLeaderSeat, signInAs, type LeaderSeat } from './leader'

let leader: LeaderSeat
let follower: Awaited<ReturnType<typeof createContributor>>
let guest: Awaited<ReturnType<typeof createContributor>>
let maker: Awaited<ReturnType<typeof createContributor>>

test.beforeAll(async () => {
  leader = await createLeaderSeat(`Events Org ${Date.now()}`)
  follower = await createContributor()
  guest = await createContributor()
  maker = await createContributor()
  await adminClient().from('org_follows').insert({ org_id: leader.orgId, profile_id: follower.id })
  // Accepting a part request for an organisation needs its pickup address.
  await adminClient().from('organizations').update({ pickup_line1: '5 Association Way', pickup_suburb: 'Northbridge', pickup_state: 'NSW', pickup_postcode: '2063' }).eq('id', leader.orgId)
})

test.afterAll(async () => {
  await removeLeaderSeat(leader)
  for (const u of [follower, guest, maker]) await deleteUser(u.id)
})

const register = (eventId: string, user: { id: string }, answers: Record<string, unknown> = {}, name = 'Guest') =>
  adminClient().from('org_event_registrations').insert({ event_id: eventId, user_id: user.id, name, email: `${name.toLowerCase().replace(/\W/g, '')}@example.com`, answers })

async function fillEventForm(page: Page, title: string) {
  await page.getByLabel('Event name').fill(title)
  await page.getByLabel('Date', { exact: true }).fill('2027-03-06')
  await page.getByLabel('Starts', { exact: true }).fill('10:00')
  await page.getByLabel('Venue and street').fill('The hall, 1 High St')
  await page.getByLabel('Suburb', { exact: true }).fill('Newtown')
  await page.getByLabel('Who is it for?').fill('Families with a toy to adapt.')
}

test('WB19 publishing a new event with a question lands on its public page and tells a follower', async ({ page }) => {
  const title = uniqueTitle('New build day')
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/events/new')
  await expect(page.getByRole('button', { name: 'Publish to Events' })).toBeDisabled()
  await fillEventForm(page, title)
  await page.getByRole('button', { name: 'Head count' }).click()
  await page.getByRole('button', { name: 'Publish to Events' }).click()
  await expect(page).toHaveURL(/\/get-involved\/events\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  const id = page.url().split('/').pop()!
  await page.goto(`/dashboard/organisation/events/${id}/edit`)
  await expect(page.getByLabel('Ask one thing, plainly')).toHaveValue('How many people are coming, including you?')

  await signInAs(page, follower)
  await page.goto('/notifications')
  await expect(page.getByText(`${leader.orgName} published an event: ${title}`)).toBeVisible()
})

test('WB19 saving an event as a draft needs only a name, a time and a place; it returns to the list with a Draft badge and no public page', async ({ page }) => {
  const title = uniqueTitle('Half done')
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/events/new')
  await page.getByLabel('Event name').fill(title)
  await page.getByLabel('Date', { exact: true }).fill('2027-03-06')
  await page.getByLabel('Starts', { exact: true }).fill('10:00')
  await page.getByLabel('Venue and street').fill('The hall, 1 High St')
  await page.getByLabel('Suburb', { exact: true }).fill('Newtown')
  await page.getByRole('button', { name: 'Save as draft' }).click()
  await expect(page).toHaveURL('/dashboard/organisation/publish')
  await expect(page.locator('article', { hasText: title })).toContainText('Draft')
  await page.goto('/get-involved/events')
  await expect(page.getByText(title)).toHaveCount(0)
})

test('WB20 moving a published event’s start time tells the people registered, and the page shows the new time', async ({ page }) => {
  const title = uniqueTitle('Moving day')
  const id = await createEvent(leader.orgId, leader.id, { title, status: 'published' })
  await register(id, guest)
  await signInAs(page, leader)
  await page.goto(`/dashboard/organisation/events/${id}/edit`)
  await page.getByLabel('Starts', { exact: true }).fill('15:30')
  await page.getByRole('button', { name: /Save changes/ }).click()
  await expect(page).toHaveURL(`/get-involved/events/${id}`)
  await expect(page.getByText(/3:30\s?pm/i).first()).toBeVisible()

  await signInAs(page, guest)
  await page.goto('/notifications')
  await expect(page.getByText(`${leader.orgName} changed the time or place of ${title}`)).toBeVisible()
})

test('WB20 saving a draft from the edit form with "Publish to Events" publishes it and tells a follower', async ({ page }) => {
  const title = uniqueTitle('Draft to live')
  const id = await createEvent(leader.orgId, leader.id, { title, status: 'draft' })
  await signInAs(page, leader)
  await page.goto(`/dashboard/organisation/events/${id}/edit`)
  await page.getByRole('button', { name: 'Publish to Events' }).click()
  await expect(page).toHaveURL(`/get-involved/events/${id}`)

  await signInAs(page, follower)
  await page.goto('/notifications')
  await expect(page.getByText(`${leader.orgName} published an event: ${title}`)).toBeVisible()
})

test('WB21 cancelling asks twice, tells the registered, marks the public page, and Restore undoes it', async ({ page }) => {
  const title = uniqueTitle('Cancel day')
  const id = await createEvent(leader.orgId, leader.id, { title, status: 'published' })
  await register(id, guest)
  await signInAs(page, leader)
  await page.goto(`/dashboard/org/events/${id}`)
  await page.getByRole('button', { name: 'Cancel this event' }).click()
  await expect(page.getByText('Cancelled. The public page says so.')).toHaveCount(0)
  await page.getByRole('button', { name: 'Yes, cancel this event' }).click()
  await expect(page.getByText('Cancelled. The public page says so.')).toBeVisible()
  await page.goto(`/get-involved/events/${id}`)
  await expect(page.getByText('Cancelled by the host')).toBeVisible()

  await signInAs(page, guest)
  await page.goto('/notifications')
  await expect(page.getByText(`${leader.orgName} cancelled ${title}`)).toBeVisible()

  await signInAs(page, leader)
  await page.goto(`/dashboard/org/events/${id}`)
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByRole('button', { name: 'Cancel this event' })).toBeVisible()
  await page.goto(`/get-involved/events/${id}`)
  await expect(page.getByText('Cancelled by the host')).toHaveCount(0)
})

test('WB21 closing registrations says so, and Reopen takes it back', async ({ page }) => {
  const id = await createEvent(leader.orgId, leader.id, { title: uniqueTitle('Close day'), status: 'published' })
  await signInAs(page, leader)
  await page.goto(`/dashboard/org/events/${id}`)
  await page.getByRole('button', { name: 'Close registrations' }).click()
  await expect(page.getByText(/Registrations are closed\./)).toBeVisible()
  await page.getByRole('button', { name: 'Reopen registrations' }).click()
  await expect(page.getByRole('button', { name: 'Close registrations' })).toBeVisible()
  await expect(page.getByText(/Registrations are closed\./)).toHaveCount(0)
})

test('WB22 saving the cost shows it on the public page, and clearing it makes the event free again', async ({ page }) => {
  const id = await createEvent(leader.orgId, leader.id, { title: uniqueTitle('Cost day'), status: 'published' })
  await signInAs(page, leader)
  await page.goto(`/dashboard/org/events/${id}`)
  await expect(page.getByRole('button', { name: 'Save cost' })).toBeDisabled()
  await page.getByLabel('Amount, in dollars').fill('12.50')
  await page.getByLabel('Breakdown, in your words').fill('Kits bought in bulk and passed on at cost.')
  await page.getByRole('button', { name: 'Save cost' }).click()
  await expect(page.getByRole('button', { name: 'Save cost' })).toBeDisabled()
  await page.goto(`/get-involved/events/${id}`)
  await expect(page.getByText('$12.50 towards materials').first()).toBeVisible()
  await expect(page.getByText('Kits bought in bulk and passed on at cost.')).toBeVisible()

  await page.goto(`/dashboard/org/events/${id}`)
  await expect(page.getByLabel('Amount, in dollars')).toHaveValue('12.50')
  await page.getByLabel('Amount, in dollars').fill('')
  await page.getByLabel('Breakdown, in your words').fill('')
  await page.getByRole('button', { name: 'Save cost' }).click()
  await expect(page.getByRole('button', { name: 'Save cost' })).toBeDisabled()
  await page.goto(`/get-involved/events/${id}`)
  await expect(page.getByText('Free to attend').first()).toBeVisible()
})

test('WB23 the host accepts one part request and declines another with a reason', async ({ page }) => {
  const tutorialTitle = uniqueTitle('Cradle')
  const tutorialId = await createTutorial(maker.id, { title: tutorialTitle, status: 'approved' })
  const id = await createEvent(leader.orgId, leader.id, { title: uniqueTitle('Print day'), status: 'published', prints_parts: true, part_sets_max: 4 })
  const db = adminClient()
  const asker = async (name: string) => {
    const family = await createContributor()
    await db.from('profiles').update({ name }).eq('id', family.id)
    const { data, error } = await db
      .from('toy_transactions')
      .insert({ type: 'print', status: 'requested', tutorial_id: tutorialId, event_id: id, requester_id: family.id, owner_id: null, owner_org_id: leader.orgId, part_sets: 2 })
      .select('id')
      .single()
    if (error || !data) throw new Error(`seed failed: ${error?.message}`)
    return { family, txId: data.id as string }
  }
  const first = await asker('Ada Printer')
  const second = await asker('Ben Printer')
  try {
    await signInAs(page, leader)
    await page.goto(`/dashboard/org/events/${id}`)
    await expect(page.locator('dt', { hasText: 'To answer' }).locator('xpath=following-sibling::dd')).toHaveText('2')
    const adaRow = page.locator('div.card-flat', { hasText: 'Ada Printer' })
    await adaRow.getByRole('button', { name: /We.ll print these/ }).click()
    await expect(adaRow).toContainText('Printing')
    await expect(page.locator('dt', { hasText: 'To answer' }).locator('xpath=following-sibling::dd')).toHaveText('1')

    page.once('dialog', (d) => d.accept('Bed is booked that week.'))
    const benRow = page.locator('div.card-flat', { hasText: 'Ben Printer' })
    await benRow.getByRole('button', { name: /Can.t print these/ }).click()
    await expect(benRow).toContainText('Declined')
    await expect(benRow).toContainText('Bed is booked that week.')
    expect((await db.from('toy_transactions').select('status').eq('id', first.txId).single()).data!.status).toBe('accepted')
    expect((await db.from('toy_transactions').select('status, decline_reason').eq('id', second.txId).single()).data).toEqual({ status: 'rejected', decline_reason: 'Bed is booked that week.' })
  } finally {
    await db.from('toy_transactions').delete().in('id', [first.txId, second.txId])
    await db.from('tutorials').delete().eq('id', tutorialId)
    await deleteUser(first.family.id)
    await deleteUser(second.family.id)
  }
})

test('WB24 the manage page lists who is coming with their answers, and Export CSV downloads them', async ({ page }) => {
  const title = uniqueTitle('Roll call')
  const id = await createEvent(leader.orgId, leader.id, { title, status: 'published', capacity: 20, questions: [{ prompt: 'Any allergies?', answer_type: 'short' }] })
  const { data: q } = await adminClient().from('org_event_questions').select('id').eq('event_id', id).single()
  const other = await createContributor()
  await register(id, guest, { [q!.id]: 'Peanuts' }, 'Gale Guest')
  await register(id, other, {}, 'Olly Other')
  try {
    await signInAs(page, leader)
    await page.goto(`/dashboard/org/events/${id}`)
    const gale = page.locator('article', { hasText: 'Gale Guest' })
    await expect(gale).toContainText('Any allergies?')
    await expect(gale).toContainText('Peanuts')
    await expect(page.locator('article', { hasText: 'Olly Other' })).toContainText('—')
    await expect(page.locator('dt', { hasText: 'Going' }).locator('xpath=following-sibling::dd')).toHaveText('2')
    await expect(page.locator('dt', { hasText: 'Seats' }).locator('xpath=following-sibling::dd')).toHaveText('20')
    const download = page.waitForEvent('download')
    await page.getByRole('link', { name: /Export CSV/ }).click()
    const file = await download
    expect(file.suggestedFilename()).toBe(`${title} registrations.csv`)
    const lines = (await (await import('node:fs/promises')).readFile((await file.path())!, 'utf8')).split('\n')
    expect(lines[0]).toBe('"Name","Email","Registered","Any allergies?"')
    expect(lines.filter((l) => l.startsWith('"Gale Guest","galeguest@example.com",')).map((l) => l.split(',').at(-1))).toEqual(['"Peanuts"'])
    expect(lines).toHaveLength(3)
  } finally {
    await deleteUser(other.id)
  }
})
