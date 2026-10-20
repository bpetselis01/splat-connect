import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createEvent, createTutorial, signInAsNewContributor, uniqueTitle } from './helpers'
import { seedPrintableGuide } from './counts-helpers-d'
import { seedPublicOrg } from './family-toys-fixtures'

/**
 * A family's side of an event end to end: the detail page in each state, "I'm
 * going" and "Can't make it", the confirm form, and asking the host to print
 * parts before the day.
 */

async function publishedEvent(overrides: Record<string, unknown> = {}) {
  const org = await seedPublicOrg()
  const host = await createContributor()
  const title = uniqueTitle('E2E Journey Day')
  const id = await createEvent(org.id, host.id, { title, status: 'published', ...overrides })
  return { org, host, title, id }
}

const registration = async (eventId: string, userId: string) =>
  (await adminClient().from('org_event_registrations').select('name, email, answers, cancelled_at').eq('event_id', eventId).eq('user_id', userId).maybeSingle()).data

async function somebodyElseGoing(eventId: string) {
  const other = await createContributor()
  await adminClient().from('org_event_registrations').insert({ event_id: eventId, user_id: other.id, name: 'Other Family', email: 'other@example.com' })
  return other
}

/**
 * Opens the event once the signed-in profile has loaded: before then the page can read as a guest and flip.
 * The screen keeps no ready marker, so wait for every request the capabilities load makes (it commits the
 * profile only when all of them settle) and the event fetch that carries the viewer id, then for two frames so React has rendered the commit.
 */
async function openEventSignedIn(page: import('@playwright/test').Page, path: string) {
  const loaded = ['/api/contributors/me', '/api/organizations/mine', '/api/notifications/me/unread-counts', '/api/toy-transactions/action-count', '?viewer='].map(
    (api) => page.waitForResponse((r) => r.url().includes(api)),
  )
  await page.goto(path)
  await Promise.all(loaded)
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
}

test('V10 the event page shows kind, when, where, cost, seats left and who is going, then full, closed, cancelled and past', async ({ page }) => {
  await signInAsNewContributor(page)
  const open = await publishedEvent({ capacity: 5, cost_cents: 1200, cost_note: 'Filament and morning tea.', kind: 'build_day' })
  await somebodyElseGoing(open.id)

  await page.goto(`/events/${open.id}`)
  await expect(page.getByText(open.title, { exact: true })).toBeVisible()
  await expect(page.getByText('E2E Hall, 1 Test St', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('$12.00 towards materials')).toBeVisible()
  await expect(page.getByText('Filament and morning tea.')).toBeVisible()
  await expect(page.getByText('4 seats left')).toBeVisible()
  await expect(page.getByText('1 going')).toBeVisible()
  await expect(page.getByRole('button', { name: "I'm going", exact: true })).toBeVisible()

  const full = await publishedEvent({ capacity: 1 })
  await somebodyElseGoing(full.id)
  await page.goto(`/events/${full.id}`)
  await expect(page.getByText('This one is full').first()).toBeVisible()
  await expect(page.getByRole('button', { name: "I'm going", exact: true })).toHaveCount(0)

  const closed = await publishedEvent({ registrations_closed_at: new Date().toISOString() })
  await page.goto(`/events/${closed.id}`)
  await expect(page.getByText('The host has closed registrations for this one.')).toBeVisible()
  await expect(page.getByRole('button', { name: "I'm going", exact: true })).toHaveCount(0)

  const cancelled = await publishedEvent({ cancelled_at: new Date().toISOString() })
  await page.goto(`/events/${cancelled.id}`)
  await expect(page.getByText('Cancelled by the host')).toBeVisible()

  const past = await publishedEvent({
    starts_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    ends_at: new Date(Date.now() - 3 * 86_400_000 + 3_600_000).toISOString(),
  })
  await page.goto(`/events/${past.id}`)
  await expect(page.getByText('This one has already happened.')).toBeVisible()
  await expect(page.getByRole('button', { name: "I'm going", exact: true })).toHaveCount(0)
})

test('V11 I\'m going with nothing to ask books the seat, shows You\'re going and counts one more', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const event = await publishedEvent({ capacity: 5 })

  // The one-tap path needs the profile loaded; before that the button sends the family to the form.
  await openEventSignedIn(page, `/events/${event.id}`)
  await expect(page.getByText(/^\d+ going$/)).toHaveCount(0)
  await page.getByRole('button', { name: "I'm going", exact: true }).click()
  await expect(page.getByText("You're going", { exact: true })).toBeVisible()
  await expect(page.getByText('1 going')).toBeVisible()
  await expect(page.getByText('4 seats left')).toBeVisible()
  expect(await registration(event.id, me.id)).toMatchObject({ answers: {}, cancelled_at: null })

  await page.goto('/events')
  await expect(page.getByText(event.title, { exact: true })).toBeVisible()
})

test('V12 I\'m going goes to the confirm form when there are questions or a cost, and to sign-in when signed out', async ({ page, browser, baseURL }) => {
  await signInAsNewContributor(page)
  const asking = await publishedEvent({ questions: [{ prompt: 'Which toy are you bringing?', answer_type: 'short', required: true }] })
  await page.goto(`/events/${asking.id}`)
  await page.getByRole('button', { name: "I'm going", exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/events/${asking.id}/register$`))
  await expect(page.getByLabel('Which toy are you bringing?')).toBeVisible()

  const costed = await publishedEvent({ cost_cents: 800 })
  await page.goto(`/events/${costed.id}`)
  await page.getByRole('button', { name: "I'm going", exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/events/${costed.id}/register$`))

  const guest = await (await browser.newContext({ baseURL })).newPage()
  try {
    await guest.goto(`/events/${asking.id}`)
    await guest.getByRole('button', { name: "I'm going", exact: true }).click()
    await expect(guest).toHaveURL(/\/sign-in/)
  } finally {
    await guest.context().close()
  }
})

test('V13 Can\'t make it cancels the seat: the page goes back to I\'m going and the count drops', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const event = await publishedEvent({ capacity: 5 })
  await adminClient().from('org_event_registrations').insert({ event_id: event.id, user_id: me.id, name: 'E2E Contributor', email: 'me@example.com' })

  await openEventSignedIn(page, `/events/${event.id}`)
  await expect(page.getByText("You're going", { exact: true })).toBeVisible()
  await expect(page.getByText('1 going')).toBeVisible()
  await page.getByRole('button', { name: "Can't make it", exact: true }).click()
  await expect(page.getByRole('button', { name: "I'm going", exact: true })).toBeVisible()
  await expect(page.getByText(/^\d+ going$/)).toHaveCount(0)
  expect((await registration(event.id, me.id))?.cancelled_at).not.toBeNull()

  await page.goto('/events')
  await expect(page.getByText(event.title, { exact: true })).toHaveCount(0)
})

test('V14 the Hosted by chip opens the organisation page', async ({ page }) => {
  await signInAsNewContributor(page)
  const event = await publishedEvent()
  await page.goto(`/events/${event.id}`)
  await page.getByRole('button', { name: new RegExp(`Hosted by ${event.org.name}`) }).click()
  await expect(page).toHaveURL(new RegExp(`/toy-library/organisation/${event.org.id}$`))
  await expect(page.getByRole('heading', { name: event.org.name })).toBeVisible()
})

test('V15 Print parts here shows when the host prints parts and opens the print screen', async ({ page }) => {
  await signInAsNewContributor(page)
  const printing = await publishedEvent({ prints_parts: true, part_sets_max: 3 })
  const plain = await publishedEvent()

  await page.goto(`/events/${plain.id}`)
  await expect(page.getByRole('button', { name: "I'm going", exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Print parts here', exact: true })).toHaveCount(0)

  await page.goto(`/events/${printing.id}`)
  await page.getByRole('button', { name: 'Print parts here', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/events/${printing.id}/print$`))
})

test('V16 Confirm my spot with the answers and the cost box books the seat and lands on My events; a full event shows the server sentence', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const event = await publishedEvent({
    cost_cents: 1500,
    cost_note: 'Filament.',
    questions: [{ prompt: 'Which toy are you bringing?', answer_type: 'short', required: true }],
  })

  await page.goto(`/events/${event.id}/register`)
  const confirm = page.getByRole('button', { name: 'Confirm my spot', exact: true })
  await expect(confirm).toBeDisabled()
  await page.getByLabel('Which toy are you bringing?').fill('Light-up penguin')
  await page.getByRole('checkbox', { name: /I know this costs/ }).click()
  await confirm.click()

  await expect(page).toHaveURL(/\/events$/)
  await expect(page.getByText(event.title, { exact: true })).toBeVisible()
  const row = await registration(event.id, me.id)
  expect(Object.values(row!.answers as Record<string, unknown>)).toEqual(['Light-up penguin'])
  expect(row!.cancelled_at).toBeNull()

  const tight = await publishedEvent({ capacity: 1 })
  await page.goto(`/events/${tight.id}/register`)
  await expect(page.getByRole('button', { name: 'Confirm my spot', exact: true })).toBeVisible()
  await somebodyElseGoing(tight.id)
  await page.getByRole('button', { name: 'Confirm my spot', exact: true }).click()
  await expect(page.getByText('This one is full. The host may open more seats.')).toBeVisible()
  expect(await registration(tight.id, me.id)).toBeNull()
})

test('V17 Send request sends the saved guide\'s parts to the host, lands on My events and tells the host', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const event = await publishedEvent({ prints_parts: true, part_sets_max: 3 })
  const leader = await createContributor()
  await adminClient().from('org_leaders').insert({ org_id: event.org.id, user_id: leader.id })
  const author = await createContributor()
  const guide = await seedPrintableGuide(author.id)
  await adminClient().from('saves').insert({ profile_id: me.id, entity_type: 'tutorial', entity_id: guide.id })

  await page.goto(`/events/${event.id}/print`)
  await page.getByRole('radio', { name: guide.title }).click()
  await expect(page.getByRole('checkbox', { name: 'Include mount.stl' })).toBeVisible()
  await page.getByRole('button', { name: 'More sets' }).click()
  await page.getByLabel('Note to the host').fill('Blue if you can')
  await page.getByRole('button', { name: 'Send request', exact: true }).click()

  await expect(page).toHaveURL(/\/events$/)
  const { data: tx } = await adminClient().from('toy_transactions')
    .select('id, type, status, part_sets, print_note, tutorial_id, owner_org_id').eq('event_id', event.id).eq('requester_id', me.id).single()
  expect(tx).toMatchObject({ type: 'print', status: 'requested', part_sets: 2, print_note: 'Blue if you can', tutorial_id: guide.id, owner_org_id: event.org.id })
  const { data: files } = await adminClient().from('print_job_files').select('stl_file_id').eq('transaction_id', tx!.id)
  expect(files).toEqual([{ stl_file_id: guide.stlId }])
  const { data: notes } = await adminClient().from('notifications').select('type, toy_name').eq('recipient_id', leader.id).eq('toy_transaction_id', tx!.id)
  expect(notes).toEqual([{ type: 'toy_request', toy_name: guide.title }])
})

test('V18 with no saved guides the print screen says so and Browse guides opens the library', async ({ page }) => {
  await signInAsNewContributor(page)
  const event = await publishedEvent({ prints_parts: true, part_sets_max: 3 })
  await page.goto(`/events/${event.id}/print`)
  await expect(page.getByText('Save a guide first.')).toBeVisible()
  await page.getByRole('button', { name: 'Browse guides', exact: true }).click()
  await expect(page).toHaveURL(/\/guides$/)
})

test('V09 a saved row opens what it names: a guide and an organisation', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const author = await createContributor()
  const title = uniqueTitle('E2E Saved Row Guide')
  const guideId = await createTutorial(author.id, { title })
  const org = await seedPublicOrg()
  await adminClient().from('saves').insert([
    { profile_id: me.id, entity_type: 'tutorial', entity_id: guideId },
    { profile_id: me.id, entity_type: 'organisation', entity_id: org.id },
  ])

  await page.goto('/saved/tutorials')
  await page.getByRole('button', { name: title }).click()
  await expect(page).toHaveURL(new RegExp(`/guides/${guideId}$`))

  await page.goto('/saved/organisations')
  await page.getByRole('button', { name: new RegExp(org.name) }).click()
  await expect(page).toHaveURL(new RegExp(`/toy-library/organisation/${org.id}$`))
  await expect(page.getByRole('heading', { name: org.name })).toBeVisible()
})
