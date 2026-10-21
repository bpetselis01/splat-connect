/**
 * An online event's joining link: never public, handed to a registrant by an
 * authenticated route and in the confirmation email.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader } from '../../helpers/orgs.js'

const sendEmail = vi.hoisted(() => vi.fn(async () => true))
vi.mock('../../../src/mailer.js', () => ({ sendEmail }))

let leader: TestUser
let family: TestUser
let stranger: TestUser
let orgId: string
let onlineId: string
let hallId: string
let event: (over: Record<string, unknown>) => Promise<string>

const LINK = 'https://meet.invalid/room-4417'
const authed = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })
const register = (id: string, token: string, email = 'priya@example.com') =>
  app.request(`/api/events/${id}/registrations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Priya Nair', email, answers: {} }),
  })
const link = (id: string, token?: string) => app.request(`/api/events/${id}/joining-link`, token ? authed(token) : {})

beforeAll(async () => {
  leader = await createTestUser('contributor')
  family = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
  orgId = await createOrg({ createdBy: leader.id, name: `Joining link ${Date.now()}` })
  await addLeader(orgId, leader.id)
  event = async (over: Record<string, unknown>) =>
    (await adminClient().from('org_events').insert({
      org_id: orgId, kind: 'workshop', format: 'in_person', location: 'A hall', suburb: 'Newtown', state: 'NSW',
      status: 'published', created_by: leader.id, starts_at: new Date(Date.now() + 7 * 864e5).toISOString(), ...over,
    }).select('id').single()).data!.id as string
  onlineId = await event({ title: 'Online clinic', format: 'online', online_url: LINK, location: null, suburb: null, state: null })
  hallId = await event({ title: 'Hall day' })
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('notifications').delete().in('recipient_id', [family.id, stranger.id])
  await admin.from('org_event_registrations').delete().in('event_id', [onlineId, hallId])
  await admin.from('org_events').delete().eq('org_id', orgId)
  await admin.from('org_leaders').delete().eq('org_id', orgId)
  await admin.from('organizations').delete().eq('id', orgId)
  await Promise.all([leader, family, stranger].map((u) => deleteTestUser(u.id)))
})

describe('the joining link', () => {
  it('WI39 emails the link when someone registers for an online event, and not again on a re-save', async () => {
    sendEmail.mockClear()
    expect((await register(onlineId, family.token)).status).toBe(201)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const [to, subject, text] = sendEmail.mock.calls[0] as unknown as [string, string, string]
    expect(to).toBe(family.email)
    expect(subject).toBe("You're going to Online clinic")
    expect(text).toContain(LINK)

    expect((await register(onlineId, family.token)).status).toBe(201)
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('WI39 emails only the account address, never the one typed into the form, and not again after cancel and re-register', async () => {
    sendEmail.mockClear()
    await app.request(`/api/events/${onlineId}/registrations`, { method: 'DELETE', ...authed(family.token) })
    expect((await register(onlineId, family.token, 'someone-else@example.com')).status).toBe(201)
    expect(sendEmail).not.toHaveBeenCalled()

    await adminClient().from('org_event_registrations').delete().eq('event_id', onlineId)
    expect((await register(onlineId, family.token, 'someone-else@example.com')).status).toBe(201)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect((sendEmail.mock.calls[0] as unknown as string[])[0]).toBe(family.email)
  })

  it('WI39 sends no email for an in-person event', async () => {
    sendEmail.mockClear()
    expect((await register(hallId, family.token)).status).toBe(201)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('WI39 gives a registrant the link and nobody else', async () => {
    const ok = await link(onlineId, family.token)
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ online_url: LINK })

    const no = await link(onlineId, stranger.token)
    expect(no.status).toBe(403)
    expect(await no.json()).toEqual({ error: 'Register for this event to get the joining link.' })

    expect((await link(onlineId)).status).toBe(401)
  })

  it('WI39 stops giving the link once the registration is cancelled', async () => {
    await app.request(`/api/events/${onlineId}/registrations`, { method: 'DELETE', ...authed(family.token) })
    expect((await link(onlineId, family.token)).status).toBe(403)
  })

  it('WI39 gives no link for a cancelled event, even to a registrant', async () => {
    const id = await event({ title: 'Cancelled clinic', format: 'online', online_url: LINK, location: null, suburb: null, state: null, cancelled_at: new Date().toISOString() })
    await adminClient().from('org_event_registrations').insert({ event_id: id, user_id: family.id, name: 'Priya Nair', email: 'priya@example.com', answers: {} })
    const res = await link(id, family.token)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'This event was cancelled.' })
  })

  it('WI39 has no link for an in-person event', async () => {
    const res = await link(hallId, family.token)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'This event has no joining link.' })
  })
})
