/**
 * The board's organisation profile (076) and its three buttons (077).
 *
 * The rules with teeth:
 *
 * - **Only a leader writes the profile, and no leader writes verified_at.**
 *   "Verified by SPLAT" is SPLAT's claim, so the admin route is its only writer.
 * - **One thanks per person per organisation**, and a note a leader hid, or its
 *   author never ticked to show, is not on the public page.
 * - **A conversation is its two parties' business.** The family and the
 *   organisation's leaders read it; a third account gets a 404.
 * - **Following means hearing when the org publishes** — once, on the publish
 *   edge, not on every later save.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, cleanupOrg } from '../../helpers/orgs.js'

let leader: TestUser
let family: TestUser
let stranger: TestUser
let siteAdmin: TestUser
let orgId: string

const json = (token: string, method: string, body?: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
const get = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })

async function notificationsFor(userId: string, type: string) {
  const { data } = await adminClient()
    .from('notifications')
    .select('*')
    .eq('recipient_id', userId)
    .eq('type', type)
  return data ?? []
}

beforeAll(async () => {
  ;[leader, family, stranger, siteAdmin] = await Promise.all([
    createTestUser('contributor'),
    createTestUser('contributor'),
    createTestUser('contributor'),
    createTestUser('admin'),
  ])
  orgId = await createOrg({ createdBy: leader.id, name: `Northside ${Date.now()}` })
  await addLeader(orgId, leader.id)
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('notifications').delete().in('recipient_id', [leader.id, family.id, stranger.id])
  const { data: files } = await admin.storage.from('toy-photos').list(`orgs/${orgId}`)
  if (files?.length) await admin.storage.from('toy-photos').remove(files.map((f) => `orgs/${orgId}/${f.name}`))
  await admin.from('org_stories').delete().eq('org_id', orgId)
  await admin.from('org_events').delete().eq('org_id', orgId)
  await cleanupOrg(orgId)
  await admin.from('organizations').delete().eq('id', orgId)
  await Promise.all([leader, family, stranger, siteAdmin].map((u) => deleteTestUser(u.id)))
})

describe('the profile, doors and breakdown', () => {
  it('lets a leader write the 076 fields and shows them publicly', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/profile`,
      json(leader.token, 'PATCH', {
        kind: 'Paediatric OT service',
        visit_hours: 'Switch clinic Thursdays, 1–5 pm',
        service_area: 'Hunter region',
        payment_methods: ['cash', 'payid'],
      })
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { kind: string; payment_methods: string[] }
    expect(body.kind).toBe('Paediatric OT service')
    expect(body.payment_methods).toEqual(['cash', 'payid'])

    const bad = await app.request(
      `/api/organizations/${orgId}/profile`,
      json(leader.token, 'PATCH', { payment_methods: ['bitcoin'] })
    )
    expect(bad.status).toBe(400)
  })

  it('never lets a leader set verified_at — only the admin route does', async () => {
    // Through the API: the field is not on the allowlist, so it is ignored.
    await app.request(
      `/api/organizations/${orgId}/profile`,
      json(leader.token, 'PATCH', { verified_at: new Date().toISOString(), about: 'Still us.' })
    )
    // Straight at PostgREST with the leader's own JWT: no policy admits it.
    const { createClient } = await import('@supabase/supabase-js')
    const direct = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${leader.token}` } },
    })
    await direct.from('organizations').update({ verified_at: new Date().toISOString() }).eq('id', orgId)

    const admin = adminClient()
    const { data: before } = await admin.from('organizations').select('verified_at').eq('id', orgId).single()
    expect(before!.verified_at).toBeNull()

    const byLeader = await app.request(`/api/admin/organizations/${orgId}`, json(leader.token, 'PATCH', { verified: true }))
    expect(byLeader.status).toBe(403)

    const byAdmin = await app.request(`/api/admin/organizations/${orgId}`, json(siteAdmin.token, 'PATCH', { verified: true }))
    expect(byAdmin.status).toBe(200)
    const { data: after } = await admin.from('organizations').select('verified_at').eq('id', orgId).single()
    expect(after!.verified_at).not.toBeNull()
  })

  it('replaces doors and rate lines for a leader only, at most six doors', async () => {
    const doors = [
      { title: 'Borrow a toy', body: 'From the shelf.', target: 'toy_library' },
      { title: 'Have a part printed', target: 'print' },
    ]
    expect((await app.request(`/api/organizations/${orgId}/doors`, json(stranger.token, 'PUT', { doors }))).status).toBe(404)
    const ok = await app.request(`/api/organizations/${orgId}/doors`, json(leader.token, 'PUT', { doors }))
    expect(ok.status).toBe(200)
    expect(((await ok.json()) as Array<{ position: number }>).map((d) => d.position)).toEqual([1, 2])

    const seven = Array.from({ length: 7 }, (_, i) => ({ title: `Door ${i}`, target: 'message' }))
    expect((await app.request(`/api/organizations/${orgId}/doors`, json(leader.token, 'PUT', { doors: seven }))).status).toBe(400)

    const lines = [
      { description: 'PLA filament, per small part', amount_cents: 200, claiming: true },
      { description: 'Machine time', amount_cents: 800, claiming: false },
    ]
    expect((await app.request(`/api/organizations/${orgId}/rate-lines`, json(stranger.token, 'PUT', { lines }))).status).toBe(404)
    expect((await app.request(`/api/organizations/${orgId}/rate-lines`, json(leader.token, 'PUT', { lines }))).status).toBe(200)

    const pub = (await (await app.request(`/api/public/organizations/${orgId}`)).json()) as {
      doors: unknown[]
      rate_lines: Array<{ claiming: boolean }>
      verified_at: string | null
      kind: string
    }
    expect(pub.doors).toHaveLength(2)
    expect(pub.rate_lines.map((l) => l.claiming)).toEqual([true, false])
    expect(pub.verified_at).not.toBeNull()
    expect(pub.kind).toBe('Paediatric OT service')
  })

  it('uploads a logo for a leader only, and only an image', async () => {
    const send = (token: string, type = 'image/png') => {
      const fd = new FormData()
      fd.append('file', new File(['png-bytes'], 'logo.png', { type }))
      fd.append('orgId', orgId)
      fd.append('slot', 'logo')
      return app.request('/api/upload/org-image', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
    }
    expect((await send(stranger.token)).status).toBe(404)
    expect((await send(leader.token, 'application/pdf')).status).toBe(400)
    const ok = await send(leader.token)
    expect(ok.status).toBe(200)
    const { url } = (await ok.json()) as { url: string }
    expect(url).toContain(`orgs/${orgId}/logo-`)
    const { data } = await adminClient().from('organizations').select('logo_url').eq('id', orgId).single()
    expect(data!.logo_url).toBe(url)
  })
})

describe('say thanks', () => {
  it('takes one thanks per person, and tells the leaders', async () => {
    const first = await app.request(
      `/api/organizations/${orgId}/thanks`,
      json(family.token, 'POST', { note: 'The switch clinic changed our Thursdays.', byline: 'Sam', show_note: true })
    )
    expect(first.status).toBe(201)
    expect(((await first.json()) as { thanks_count: number }).thanks_count).toBe(1)

    const again = await app.request(`/api/organizations/${orgId}/thanks`, json(family.token, 'POST', {}))
    expect(again.status).toBe(409)

    const own = await app.request(`/api/organizations/${orgId}/thanks`, json(leader.token, 'POST', {}))
    expect(own.status).toBe(403)

    const [n] = await notificationsFor(leader.id, 'org_thanked')
    expect(n.org_id).toBe(orgId)
    expect(n.actor_name).toBe('Sam')
  })

  it('keeps an unticked note off the public page', async () => {
    await app.request(
      `/api/organizations/${orgId}/thanks`,
      json(stranger.token, 'POST', { note: 'Private word for the team.', byline: 'Lee', show_note: false })
    )
    const raw = await (await app.request(`/api/public/organizations/${orgId}`)).text()
    expect(raw).toContain('changed our Thursdays')
    expect(raw).not.toContain('Private word')
  })

  it('lets a leader hide a note, and nobody else', async () => {
    const byOther = await app.request(
      `/api/organizations/${orgId}/thanks/${family.id}`,
      json(stranger.token, 'PATCH', { hidden: true })
    )
    expect(byOther.status).toBe(404)

    const list = await app.request(`/api/organizations/${orgId}/thanks`, get(leader.token))
    expect(((await list.json()) as unknown[]).length).toBe(2)
    expect((await app.request(`/api/organizations/${orgId}/thanks`, get(family.token))).status).toBe(404)

    const hide = await app.request(`/api/organizations/${orgId}/thanks/${family.id}`, json(leader.token, 'PATCH', { hidden: true }))
    expect(hide.status).toBe(200)
    const pub = (await (await app.request(`/api/public/organizations/${orgId}`)).json()) as {
      fromFamilies: unknown[]
      thanks_count: number
    }
    expect(pub.fromFamilies).toEqual([])
    // Hidden, not deleted: the count keeps it.
    expect(pub.thanks_count).toBe(2)
  })
})

describe('message', () => {
  let conversationId: string

  it('opens one conversation per person and tells every leader', async () => {
    const first = await app.request(
      `/api/organizations/${orgId}/conversations/mine/messages`,
      json(family.token, 'POST', { body: 'Can we come on Thursday?' })
    )
    expect(first.status).toBe(201)
    conversationId = ((await first.json()) as { conversation_id: string }).conversation_id
    const second = await app.request(
      `/api/organizations/${orgId}/conversations/mine/messages`,
      json(family.token, 'POST', { body: 'With our own switch?' })
    )
    expect(((await second.json()) as { conversation_id: string }).conversation_id).toBe(conversationId)

    const notes = await notificationsFor(leader.id, 'org_message')
    expect(notes).toHaveLength(2)
    expect(notes[0].org_conversation_id).toBe(conversationId)
  })

  it('lets the leader read and reply, and tells the family', async () => {
    const list = await app.request(`/api/organizations/${orgId}/conversations`, get(leader.token))
    const rows = (await list.json()) as Array<{ id: string; last_message: { body: string } }>
    expect(rows[0].id).toBe(conversationId)
    expect(rows[0].last_message.body).toBe('With our own switch?')

    const reply = await app.request(
      `/api/organizations/conversations/${conversationId}/messages`,
      json(leader.token, 'POST', { body: 'Yes — bring it.' })
    )
    expect(reply.status).toBe(201)
    const [n] = await notificationsFor(family.id, 'org_message')
    expect(n.org_conversation_id).toBe(conversationId)

    const mine = await app.request(`/api/organizations/${orgId}/conversations/mine`, get(family.token))
    const thread = (await mine.json()) as { messages: Array<{ from_org: boolean }> }
    expect(thread.messages.map((m) => m.from_org)).toEqual([false, false, true])
  })

  it('keeps a third account out of it', async () => {
    const read = await app.request(`/api/organizations/conversations/${conversationId}`, get(stranger.token))
    expect(read.status).toBe(404)
    const write = await app.request(
      `/api/organizations/conversations/${conversationId}/messages`,
      json(stranger.token, 'POST', { body: 'Hello?' })
    )
    expect(write.status).toBe(404)
    expect((await app.request(`/api/organizations/${orgId}/conversations`, get(stranger.token))).status).toBe(404)
  })
})

describe('follow', () => {
  it('tells followers once when the org publishes an event or a story', async () => {
    expect((await app.request(`/api/organizations/${orgId}/follow`, json(family.token, 'POST'))).status).toBe(200)
    const me = (await (await app.request(`/api/organizations/${orgId}/me`, get(family.token))).json()) as {
      following: boolean
      conversation_id: string | null
    }
    expect(me.following).toBe(true)
    expect(me.conversation_id).not.toBeNull()

    const event = await app.request(
      `/api/organizations/${orgId}/events`,
      json(leader.token, 'POST', {
        title: 'Term 4 build day',
        starts_at: new Date(Date.now() + 86400000).toISOString(),
        // Online: a published in-person event also needs a suburb, which the
        // create route does not take.
        format: 'online',
        online_url: 'https://meet.example.invalid/term4',
        status: 'published',
      })
    )
    expect(event.status).toBe(201)
    const eventId = ((await event.json()) as { id: string }).id
    // Saving it again, still published, is not news.
    await app.request(`/api/organizations/${orgId}/events/${eventId}`, json(leader.token, 'PATCH', { status: 'published' }))

    const eventNotes = await notificationsFor(family.id, 'org_event_published')
    expect(eventNotes).toHaveLength(1)
    expect(eventNotes[0].org_event_id).toBe(eventId)
    expect(eventNotes[0].tutorial_title).toBe('Term 4 build day')
    // The stranger does not follow.
    expect(await notificationsFor(stranger.id, 'org_event_published')).toHaveLength(0)

    const story = await app.request(
      `/api/organizations/${orgId}/stories`,
      json(leader.token, 'POST', {
        kind: 'family',
        title: 'Arlo’s first switch',
        summary: 'One press.',
        body: 'The long version.',
        byline: 'Sam, volunteer',
        consent_confirmed: true,
        pull_quote: 'He laughed the whole time.',
        pull_quote_by: 'Arlo’s mum',
      })
    )
    const storyId = ((await story.json()) as { id: string }).id
    expect(await notificationsFor(family.id, 'org_story_published')).toHaveLength(0)
    await app.request(`/api/organizations/${orgId}/stories/${storyId}`, json(leader.token, 'PATCH', { status: 'published' }))
    const storyNotes = await notificationsFor(family.id, 'org_story_published')
    expect(storyNotes).toHaveLength(1)
    expect(storyNotes[0].org_story_id).toBe(storyId)

    // The family story's pull quote joins "From families".
    const pub = (await (await app.request(`/api/public/organizations/${orgId}`)).json()) as {
      fromFamilies: Array<{ quote: string; source: string }>
      follower_count: number
    }
    expect(pub.fromFamilies).toEqual([expect.objectContaining({ quote: 'He laughed the whole time.', source: 'story' })])
    expect(pub.follower_count).toBe(1)

    expect((await app.request(`/api/organizations/${orgId}/follow`, json(family.token, 'DELETE'))).status).toBe(200)
  })
})
