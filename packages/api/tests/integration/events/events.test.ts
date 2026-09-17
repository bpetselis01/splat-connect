/**
 * Events: who may read a registration, and what the form actually enforces.
 *
 * The rules with teeth, each with a test that fails if it is dropped:
 *
 * - **Answers are shown to leaders only.** A registration carries a name, an
 *   email and free text about a child's access and sensory needs. There are
 *   exactly two ways to read one — you wrote it, or you lead the organisation
 *   running the event — and the public detail route returns initials and a
 *   count and nothing else.
 * - **An online event's joining link is never public.** Not on the list, not on
 *   the detail, not in the .ics. It reaches a registrant after they confirm.
 * - **Required questions are required on the server.** The register page is
 *   public and its confirm button is not the only way to reach the route.
 * - **Capacity is counted at the moment of writing**, not read off a list the
 *   page rendered with, which on a popular build day can be minutes old.
 * - **A closed or cancelled event refuses, with a different sentence for each.**
 *   "You cannot register" with no reason is what makes somebody email the host.
 * - **A print request is a printer OR an event, never both.** 061 widened the
 *   subject constraint rather than forking the type, which is what lets accept
 *   and reject work on an event's part request unchanged.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let leader: TestUser
let family: TestUser
let outsider: TestUser
let orgId: string
let eventId: string
let onlineEventId: string
let questionIds: string[] = []

const authed = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })
const json = (token: string, method: string, body: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const soon = () => new Date(Date.now() + 14 * 864e5).toISOString()

beforeAll(async () => {
  leader = await createTestUser('contributor')
  family = await createTestUser('contributor')
  outsider = await createTestUser('contributor')
  const admin = adminClient()

  const { data: org } = await admin
    .from('organizations')
    .insert({ name: `Events Org ${Date.now()}`, status: 'active', suburb: 'Crows Nest', state: 'NSW' })
    .select('id')
    .single()
  orgId = org!.id
  await admin.from('org_leaders').insert({ org_id: orgId, user_id: leader.id })

  const { data: event } = await admin
    .from('org_events')
    .insert({
      org_id: orgId,
      kind: 'build_day',
      title: 'Integration build day',
      starts_at: soon(),
      format: 'in_person',
      location: 'A hall, 1 Test St',
      suburb: 'Crows Nest',
      state: 'NSW',
      capacity: 1,
      status: 'published',
      created_by: leader.id,
    })
    .select('id')
    .single()
  eventId = event!.id

  const { data: questions } = await admin
    .from('org_event_questions')
    .insert([
      { event_id: eventId, position: 1, prompt: 'How many are coming?', answer_type: 'number', required: true },
      { event_id: eventId, position: 2, prompt: 'Anything else?', answer_type: 'paragraph', required: false },
    ])
    .select('id')
  questionIds = (questions ?? []).map((q: { id: string }) => q.id)

  const { data: online } = await admin
    .from('org_events')
    .insert({
      org_id: orgId,
      kind: 'workshop',
      title: 'Integration workshop',
      starts_at: soon(),
      format: 'online',
      online_url: 'https://secret.invalid/join',
      status: 'published',
      created_by: leader.id,
    })
    .select('id')
    .single()
  onlineEventId = online!.id
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('org_event_registrations').delete().in('event_id', [eventId, onlineEventId])
  await admin.from('org_event_questions').delete().eq('event_id', eventId)
  await admin.from('org_events').delete().eq('org_id', orgId)
  await admin.from('org_leaders').delete().eq('org_id', orgId)
  await admin.from('organizations').delete().eq('id', orgId)
  await Promise.all([
    deleteTestUser(leader.id),
    deleteTestUser(family.id),
    deleteTestUser(outsider.id),
  ])
})

describe('the public event surface', () => {
  it('lists a published event with its counts', async () => {
    const res = await app.request('/api/public/events')
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ id: string; has_questions: boolean; org_name: string }>
    const mine = rows.find((r) => r.id === eventId)
    expect(mine).toBeTruthy()
    // What decides whether "I'm going" can be one tap or has to open the form.
    expect(mine!.has_questions).toBe(true)
    expect(mine!.org_name).toBeTruthy()
  })

  // Chain: a joining link on a public page is a link in a search index, and
  //        .ics files get forwarded. Checked on both routes because they build
  //        their responses separately.
  it('never returns an online event\'s joining link', async () => {
    const list = (await (await app.request('/api/public/events')).json()) as Array<
      Record<string, unknown>
    >
    const online = list.find((r) => r.id === onlineEventId)!
    expect(online.online_url).toBeUndefined()

    const detail = (await (
      await app.request(`/api/public/events/${onlineEventId}`)
    ).json()) as Record<string, unknown>
    expect(detail.online_url).toBeNull()
  })

  it('filters by format, and shows an online event under every state', async () => {
    const inPerson = (await (
      await app.request('/api/public/events?format=in_person')
    ).json()) as Array<{ id: string }>
    expect(inPerson.map((r) => r.id)).toContain(eventId)
    expect(inPerson.map((r) => r.id)).not.toContain(onlineEventId)

    // VIC, deliberately: the in-person event is in NSW, so anything returned
    // here is returned because it is online rather than because it is nearby.
    const vic = (await (await app.request('/api/public/events?state=VIC')).json()) as Array<{
      id: string
    }>
    expect(vic.map((r) => r.id)).toContain(onlineEventId)
    expect(vic.map((r) => r.id)).not.toContain(eventId)
  })
})

describe('registering', () => {
  it('refuses a missing required answer', async () => {
    const res = await app.request(
      `/api/events/${eventId}/registrations`,
      json(family.token, 'POST', {
        name: 'A Family',
        email: 'family@example.com',
        answers: { [questionIds[1]]: 'Just the optional one' },
      })
    )
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toMatch(/How many are coming/)
  })

  it('refuses an email that is not one', async () => {
    const res = await app.request(
      `/api/events/${eventId}/registrations`,
      json(family.token, 'POST', { name: 'A Family', email: 'nope', answers: {} })
    )
    expect(res.status).toBe(400)
  })

  it('registers with the required answer, and coerces a number', async () => {
    const res = await app.request(
      `/api/events/${eventId}/registrations`,
      json(family.token, 'POST', {
        name: 'A Family',
        email: 'family@example.com',
        // Sent as a string, the way an <input type="number"> gives it up.
        answers: { [questionIds[0]]: '3' },
      })
    )
    expect(res.status).toBe(201)
    const row = (await res.json()) as { answers: Record<string, unknown> }
    expect(row.answers[questionIds[0]]).toBe(3)
  })

  // Chain: capacity is 1 and the family above took it. Counted at the moment of
  //        writing rather than read off the page's own list, which on a popular
  //        build day is minutes old by the time somebody presses the button.
  it('refuses when the event is full', async () => {
    const res = await app.request(
      `/api/events/${eventId}/registrations`,
      json(outsider.token, 'POST', {
        name: 'Too Late',
        email: 'late@example.com',
        answers: { [questionIds[0]]: '1' },
      })
    )
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toMatch(/full/i)
  })

  it('lets somebody cancel and come back without a duplicate', async () => {
    const admin = adminClient()
    const cancel = await app.request(`/api/events/${eventId}/registrations`, {
      method: 'DELETE',
      ...authed(family.token),
    })
    expect(cancel.status).toBe(200)

    const again = await app.request(
      `/api/events/${eventId}/registrations`,
      json(family.token, 'POST', {
        name: 'A Family',
        email: 'family@example.com',
        answers: { [questionIds[0]]: '2' },
      })
    )
    expect(again.status).toBe(201)

    // One row, not two: the unique key is (event_id, user_id) and the route
    // upserts, so changing your mind is the same row rather than a
    // duplicate-key error a family cannot act on.
    const { data } = await admin
      .from('org_event_registrations')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', family.id)
    expect(data).toHaveLength(1)
  })
})

describe('who may read an answer', () => {
  // Chain: "Answers are shown to leaders only." This is the whole reason
  //        061's policies are narrow and the guard script asserts no anon
  //        policy exists on the table.
  it('gives the public a count and initials, never a name or an answer', async () => {
    const detail = (await (await app.request(`/api/public/events/${eventId}`)).json()) as {
      going_count: number
      attendee_initials: string[]
      seats_left: number | null
    }
    expect(detail.going_count).toBe(1)
    expect(detail.attendee_initials).toEqual(['AF'])
    expect(detail.seats_left).toBe(0)
    expect(JSON.stringify(detail)).not.toContain('family@example.com')
  })

  it('gives the leader the answers', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/events/${eventId}/registrations`,
      authed(leader.token)
    )
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ name: string; answers: Record<string, unknown> }>
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('A Family')
    expect(rows[0].answers[questionIds[0]]).toBe(2)
  })

  it('gives an outsider nothing, even with a session', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/events/${eventId}/registrations`,
      authed(outsider.token)
    )
    // RLS returns no rows rather than refusing, which is the same answer told
    // differently — the point is that the answers do not come back.
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

describe('closing and cancelling', () => {
  it('refuses a registration once registrations are closed, and says which', async () => {
    const closed = await app.request(
      `/api/organizations/${orgId}/events/${onlineEventId}`,
      json(leader.token, 'PATCH', { registrations_closed: true })
    )
    expect(closed.status).toBe(200)

    const res = await app.request(
      `/api/events/${onlineEventId}/registrations`,
      json(outsider.token, 'POST', { name: 'Nope', email: 'nope@example.com', answers: {} })
    )
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toMatch(/closed/i)

    await app.request(
      `/api/organizations/${orgId}/events/${onlineEventId}`,
      json(leader.token, 'PATCH', { registrations_closed: false })
    )
  })

  // Chain: closing and cancelling are separate promises. Closing leaves the
  //        event on the public list with its date and address, for the people
  //        already coming; cancelling takes it off.
  it('takes a cancelled event off the public list but not a closed one', async () => {
    await app.request(
      `/api/organizations/${orgId}/events/${onlineEventId}`,
      json(leader.token, 'PATCH', { registrations_closed: true })
    )
    let list = (await (await app.request('/api/public/events')).json()) as Array<{ id: string }>
    expect(list.map((r) => r.id)).toContain(onlineEventId)

    await app.request(
      `/api/organizations/${orgId}/events/${onlineEventId}`,
      json(leader.token, 'PATCH', { cancelled: true })
    )
    list = (await (await app.request('/api/public/events')).json()) as Array<{ id: string }>
    expect(list.map((r) => r.id)).not.toContain(onlineEventId)

    const res = await app.request(
      `/api/events/${onlineEventId}/registrations`,
      json(outsider.token, 'POST', { name: 'Nope', email: 'nope@example.com', answers: {} })
    )
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toMatch(/cancelled/i)
  })
})

describe('the question form', () => {
  it('replaces the whole list, keeping ids for the questions that survive', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/events/${eventId}/questions`,
      json(leader.token, 'PUT', {
        questions: [
          { id: questionIds[0], prompt: 'How many are coming?', answer_type: 'number', required: true },
          { prompt: 'Which switch do you have?', answer_type: 'choice', required: false, options: ['Jelly Bean', 'Big Red'] },
        ],
      })
    )
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ id: string; position: number }>
    expect(rows).toHaveLength(2)
    // The surviving question keeps its id, so an answer already stored against
    // it still resolves to it.
    expect(rows.map((r) => r.id)).toContain(questionIds[0])
    expect(rows.map((r) => r.position)).toEqual([1, 2])
  })

  // Chain: 061's constraint refuses this too. The route refuses it in a
  //        sentence, before the database refuses it in Latin.
  it('refuses a "choose one" with nothing to choose', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/events/${eventId}/questions`,
      json(leader.token, 'PUT', {
        questions: [{ prompt: 'Pick', answer_type: 'choice', required: false, options: [] }],
      })
    )
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toMatch(/options/i)
  })

  it('refuses an outsider entirely', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/events/${eventId}/questions`,
      json(outsider.token, 'PUT', { questions: [] })
    )
    expect(res.status).toBe(404)
  })
})
