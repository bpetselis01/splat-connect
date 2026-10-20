import { test, expect } from '@playwright/test'
import {
  acceptTerms, adminClient, createContributor, createEvent, createTutorial, deleteOrg, deleteUser, makeLeader, signIn, uniqueTitle,
} from '../helpers'

type Member = Awaited<ReturnType<typeof createContributor>>

/** A host organisation with a leader, plus a family member who will register. */
async function world() {
  const leader = await createContributor()
  const family = await createContributor()
  await adminClient().from('profiles').update({ name: 'Priya Nair' }).eq('id', family.id)
  const orgId = await makeLeader(leader.id, uniqueTitle('Northside Therapy'))
  return { leader, family, orgId }
}

async function cleanup(orgId: string, members: Member[], extra: Promise<unknown> = Promise.resolve()) {
  await extra
  await adminClient().from('org_events').delete().eq('org_id', orgId)
  await deleteOrg(orgId)
  await Promise.all(members.map((m) => deleteUser(m.id)))
}

const registrations = async (eventId: string, userId: string) =>
  (await adminClient().from('org_event_registrations').select('name, answers, cancelled_at').eq('event_id', eventId).eq('user_id', userId)).data ?? []

test('WI29 the format tabs and state chips narrow the events list', async ({ page }) => {
  const { leader, family, orgId } = await world()
  const nsw = await createEvent(orgId, leader.id, { status: 'published', title: uniqueTitle('Sydney build day') })
  const vic = await createEvent(orgId, leader.id, { status: 'published', title: uniqueTitle('Melbourne build day'), suburb: 'Fitzroy', state: 'VIC' })
  const online = await createEvent(orgId, leader.id, {
    status: 'published', title: uniqueTitle('Switch night online'), format: 'online', online_url: 'https://meet.example/switch', location: null, suburb: null, state: null,
  })
  const title = async (id: string) => (await adminClient().from('org_events').select('title').eq('id', id).single()).data!.title as string
  const [tNsw, tVic, tOnline] = await Promise.all([title(nsw), title(vic), title(online)])
  try {
    await page.goto('/get-involved/events')
    for (const t of [tNsw, tVic, tOnline]) await expect(page.getByRole('link', { name: t })).toBeVisible()

    await page.getByRole('group', { name: 'State' }).getByRole('link', { name: 'VIC' }).click()
    await expect(page).toHaveURL(/\/get-involved\/events\?state=VIC$/)
    await expect(page.getByRole('link', { name: tVic })).toBeVisible()
    await expect(page.getByRole('link', { name: tNsw })).toHaveCount(0)
    await expect(page.getByRole('link', { name: tOnline })).toBeVisible()

    await page.getByRole('navigation', { name: 'Format' }).getByRole('link', { name: /online/i }).click()
    await expect(page).toHaveURL(/\/get-involved\/events\?format=online&state=VIC$/)
    await expect(page.getByRole('link', { name: tOnline })).toBeVisible()
    await expect(page.getByRole('link', { name: tVic })).toHaveCount(0)
  } finally {
    await cleanup(orgId, [leader, family])
  }
})

test('WI30 a card opens its event, and Register your organisation or Host an event follows who is signed in', async ({ page }) => {
  const { leader, family, orgId } = await world()
  const id = await createEvent(orgId, leader.id, { status: 'published', title: uniqueTitle('Open day') })
  const { data } = await adminClient().from('org_events').select('title').eq('id', id).single()
  await acceptTerms(family.id)
  await acceptTerms(leader.id)
  try {
    await page.goto('/get-involved/events')
    await page.getByRole('link', { name: data!.title }).click()
    await expect(page).toHaveURL(new RegExp(`/get-involved/events/${id}$`))
    await expect(page.getByRole('heading', { name: data!.title })).toBeVisible()

    await signIn(page, family.email, family.password)
    await page.goto('/get-involved/events')
    await page.getByRole('link', { name: /register your organisation/i }).click()
    await expect(page).toHaveURL(/\/get-involved\/organisations\/request$/)

    await page.context().clearCookies()
    await signIn(page, leader.email, leader.password)
    await page.goto('/get-involved/events')
    await page.getByRole('link', { name: /host an event/i }).last().click()
    await expect(page).toHaveURL(/\/dashboard\/organisation\/events\/new$/)
  } finally {
    await cleanup(orgId, [leader, family])
  }
})

test('WI31 WI32 a member says they are going to an event with nothing to ask, then cancels', async ({ page }) => {
  const { leader, family, orgId } = await world()
  const id = await createEvent(orgId, leader.id, { status: 'published', capacity: 5 })
  try {
    await signIn(page, family.email, family.password)
    await page.goto(`/get-involved/events/${id}`)
    await expect(page.getByText('5 seats left', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: "I'm going" }).click()
    await expect(page.getByRole('button', { name: "You're going" })).toBeVisible()
    await expect(page.getByText('4 seats left', { exact: true })).toBeVisible()
    expect(await registrations(id, family.id)).toEqual([{ name: 'Priya Nair', answers: {}, cancelled_at: null }])

    await page.getByRole('button', { name: "You're going" }).click()
    await expect(page.getByRole('button', { name: "I'm going" })).toBeVisible()
    await expect(page.getByText('5 seats left', { exact: true })).toBeVisible()
    const [row] = await registrations(id, family.id)
    expect(row.cancelled_at).not.toBeNull()

    // event_rsvp_received: the RSVP was acknowledged in the member's inbox.
    await page.goto('/notifications')
    await expect(page.getByText(/^You're registered for /)).toBeVisible()
  } finally {
    await cleanup(orgId, [leader, family])
  }
})

test('WI33 a signed-out visitor is sent to sign in, and a member goes to the form when the event asks questions', async ({ page }) => {
  const { leader, family, orgId } = await world()
  const id = await createEvent(orgId, leader.id, {
    status: 'published', questions: [{ prompt: 'Which toy are you bringing?', answer_type: 'short', required: true }],
  })
  try {
    await page.goto(`/get-involved/events/${id}`)
    await page.getByRole('link', { name: "I'm going" }).click()
    await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Fget-involved%2Fevents%2F${id}$`))

    await signIn(page, family.email, family.password)
    await page.goto(`/get-involved/events/${id}`)
    await page.getByRole('link', { name: "I'm going" }).click()
    await expect(page).toHaveURL(new RegExp(`/get-involved/events/${id}/register$`))
    await expect(page.getByLabel('Which toy are you bringing?')).toBeVisible()
  } finally {
    await cleanup(orgId, [leader, family])
  }
})

test('WI35 a member confirms a costed event with an answer, lands on the event, and a full event shows the 409 copy', async ({ page }) => {
  const { leader, family, orgId } = await world()
  const costed = await createEvent(orgId, leader.id, {
    status: 'published', cost_cents: 1500, cost_note: 'Filament.',
    questions: [{ prompt: 'Which toy are you bringing?', answer_type: 'short', required: true }],
  })
  const tight = await createEvent(orgId, leader.id, { status: 'published', capacity: 1 })
  const other = await createContributor()
  try {
    await signIn(page, family.email, family.password)
    await page.goto(`/get-involved/events/${costed}/register`)
    const confirm = page.getByRole('button', { name: /Confirm my spot/ })
    await expect(confirm).toBeDisabled()
    await page.getByLabel('Which toy are you bringing?').fill('Light-up penguin')
    await page.getByRole('checkbox', { name: /SPLAT\s+does not take the payment/ }).check()
    await confirm.click()
    await expect(page).toHaveURL(new RegExp(`/get-involved/events/${costed}$`))
    await expect(page.getByText('1 going')).toBeVisible()
    const [row] = await registrations(costed, family.id)
    expect(Object.values(row.answers as Record<string, unknown>)).toEqual(['Light-up penguin'])

    await page.goto(`/get-involved/events/${tight}/register`)
    await expect(page.getByRole('button', { name: 'Confirm my spot' })).toBeVisible()
    await adminClient().from('org_event_registrations').insert({ event_id: tight, user_id: other.id, name: 'Sam Lee', email: 'sam@example.com' })
    await page.getByRole('button', { name: 'Confirm my spot' }).click()
    // Current behaviour: the form prints the client's raw error, so the sentence sits
    // inside "API POST … failed with status 409: {"error":"…"}" (the phone shows only the sentence).
    const alert = page.locator('p[role="alert"]')
    await expect(alert).toContainText('This one is full. The host may open more seats.')
    await expect(alert).toContainText('status 409')
    expect(await registrations(tight, family.id)).toEqual([])
  } finally {
    await cleanup(orgId, [leader, family, other])
  }
})

test('WI34 a member asks the host to print a saved guide\'s parts before the day', async ({ page }) => {
  const { leader, family, orgId } = await world()
  const id = await createEvent(orgId, leader.id, { status: 'published', prints_parts: true, part_sets_max: 3 })
  const guide = uniqueTitle('Light-up penguin')
  const tutorialId = await createTutorial(leader.id, { title: guide, status: 'approved' })
  await adminClient().from('saves').insert({ profile_id: family.id, entity_type: 'tutorial', entity_id: tutorialId })
  try {
    await signIn(page, family.email, family.password)
    await page.goto(`/get-involved/events/${id}`)
    await page.getByRole('button', { name: /Print parts here/ }).click()
    await page.getByLabel('Guide').selectOption({ label: guide })
    await expect(page.getByRole('checkbox', { name: 'e2e-mount.stl' })).toBeChecked()
    await page.getByLabel(/Note to the host/).fill('Blue if you can')
    await page.getByRole('button', { name: 'Send request' }).click()
    await expect(page.getByRole('link', { name: 'My events' })).toBeVisible()

    const db = adminClient()
    const { data: tx } = await db
      .from('toy_transactions')
      .select('id, type, status, event_id, owner_org_id, requester_id, part_sets, print_note')
      .eq('event_id', id)
      .single()
    expect(tx).toMatchObject({ type: 'print', status: 'requested', event_id: id, owner_org_id: orgId, requester_id: family.id, part_sets: 1, print_note: 'Blue if you can' })
    const { data: notes } = await db.from('notifications').select('recipient_id, type').eq('toy_transaction_id', tx!.id)
    expect(notes).toEqual([{ recipient_id: leader.id, type: 'toy_request' }])
  } finally {
    await cleanup(orgId, [leader, family], (async () => {
      await adminClient().from('toy_transactions').delete().eq('event_id', id)
      await adminClient().from('saves').delete().eq('entity_id', tutorialId)
      await adminClient().from('tutorials').delete().eq('id', tutorialId)
    })())
  }
})
