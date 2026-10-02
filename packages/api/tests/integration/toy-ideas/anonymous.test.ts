/**
 * 108: an anonymous idea's author never leaves the API on a public read —
 * not the name, not the id — while admins and the author still see both.
 * Ruling 2: anonymity holds for signed-in readers too, so `authenticated`
 * loses author_id as well, and every policy that tested it reads
 * is_idea_author() instead. The thread must keep working through that.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createUserClient } from '../../../src/supabase/client.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let admin: TestUser
let maker: TestUser
let ideaId: string
const NAME = `Anon Author ${Date.now()}`
const URL = process.env.SUPABASE_URL ?? 'http://localhost:54321'
const anon = () => createClient(URL, process.env.SUPABASE_ANON_KEY ?? '')
const as = (u: TestUser, path: string, init: { method?: string; body?: unknown } = {}) =>
  app.request(path, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })

beforeAll(async () => {
  author = await createTestUser('contributor')
  admin = await createTestUser('admin')
  maker = await createTestUser('contributor')
  await adminClient().from('profiles').update({ name: NAME }).eq('id', author.id)
  const res = await as(author, '/api/ideas', { method: 'POST', body: { title: 'Quiet', summary: 'S', anonymous: true } })
  ideaId = ((await res.json()) as { id: string }).id
  await adminClient().from('toy_ideas').update({ status: 'challenge' }).eq('id', ideaId)
})

afterAll(async () => {
  await adminClient().from('toy_ideas').delete().eq('id', ideaId)
  await deleteTestUser(author.id)
  await deleteTestUser(admin.id)
  await deleteTestUser(maker.id)
})

describe('108 idea anonymous', () => {
  it('stores the choice', async () => {
    const { data } = await adminClient().from('toy_ideas').select('anonymous').eq('id', ideaId).single()
    expect(data!.anonymous).toBe(true)
  })

  it('refuses an anonymous flag that is not true or false', async () => {
    const res = await as(author, '/api/ideas', { method: 'POST', body: { title: 'T', summary: 'S', anonymous: 'yes' } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Post anonymously must be on or off.' })
  })

  it('never puts the author on the public brief or the public list', async () => {
    const detail = await (await app.request(`/api/public/challenges/${ideaId}`)).text()
    expect(JSON.parse(detail)).toMatchObject({ author_name: null, author_id: null, anonymous: true })
    const list = await (await app.request('/api/public/challenges')).text()
    for (const body of [detail, list]) {
      expect(body).not.toContain(author.id)
      expect(body).not.toContain(NAME)
    }
  })

  it('lets anon read the flag but not the author id, straight from the table', async () => {
    expect((await anon().from('toy_ideas').select('anonymous').eq('id', ideaId).single()).error).toBeNull()
    expect((await anon().from('toy_ideas').select('author_id').eq('id', ideaId).single()).error).not.toBeNull()
  })

  it('does not hand a signed-in non-author the author id either (ruling 2)', async () => {
    const client = createUserClient(maker.token)
    expect((await client.from('toy_ideas').select('author_id').eq('id', ideaId).maybeSingle()).error).not.toBeNull()
    expect((await client.from('toy_ideas').select('*').eq('id', ideaId).maybeSingle()).error).not.toBeNull()
    expect((await client.from('toy_ideas').select('id, anonymous').eq('id', ideaId).single()).data).toEqual({ id: ideaId, anonymous: true })
    const detail = await (await as(maker, `/api/public/challenges/${ideaId}`)).text()
    expect(detail).not.toContain(author.id)
    expect(detail).not.toContain(NAME)
  })

  it('still names the author to an admin and to the author', async () => {
    const queue = (await (await as(admin, '/api/admin/ideas')).json()) as { id: string; author_id: string }[]
    expect(queue.find((i) => i.id === ideaId)?.author_id).toBe(author.id)
    const own = await as(author, `/api/ideas/mine/${ideaId}`)
    expect(own.status).toBe(200)
    const mine = (await (await as(author, '/api/ideas/mine')).json()) as { id: string; author_id: string }[]
    expect(mine.find((i) => i.id === ideaId)?.author_id).toBe(author.id)
  })

  it('answers the author’s own submission with the author id', async () => {
    const res = await as(author, '/api/ideas', { method: 'POST', body: { title: 'Mine', summary: 'S' } })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string; author_id: string; anonymous: boolean }
    await adminClient().from('toy_ideas').delete().eq('id', body.id)
    expect(body).toMatchObject({ author_id: author.id, anonymous: false })
  })
})

describe('108 the thread still works without author_id (is_idea_author)', () => {
  it('lets a maker join, both post and read, and the author remove them', async () => {
    expect((await as(maker, `/api/ideas/${ideaId}/join`, { method: 'POST', body: {} })).status).toBe(201)
    // The join notification still reaches the hidden author.
    const { data: note } = await adminClient()
      .from('notifications').select('recipient_id').eq('idea_id', ideaId).eq('type', 'challenge_joined').single()
    expect(note!.recipient_id).toBe(author.id)
    // An author cannot join their own challenge (participants insert policy).
    expect((await as(author, `/api/ideas/${ideaId}/join`, { method: 'POST', body: {} })).status).toBe(403)

    expect((await as(author, `/api/ideas/${ideaId}/messages`, { method: 'POST', body: { body: 'From the author' } })).status).toBe(201)
    expect((await as(maker, `/api/ideas/${ideaId}/messages`, { method: 'POST', body: { body: 'From the maker' } })).status).toBe(201)
    for (const u of [author, maker]) {
      const thread = (await (await as(u, `/api/ideas/${ideaId}/messages`)).json()) as { body: string }[]
      expect(thread.map((m) => m.body)).toEqual(expect.arrayContaining(['From the author', 'From the maker']))
    }
    // A stranger still reads nothing and posts nothing.
    const stranger = await createTestUser('contributor')
    try {
      expect(await (await as(stranger, `/api/ideas/${ideaId}/messages`)).json()).toEqual([])
      expect((await as(stranger, `/api/ideas/${ideaId}/messages`, { method: 'POST', body: { body: 'x' } })).status).toBe(403)
    } finally {
      await deleteTestUser(stranger.id)
    }

    expect((await as(author, `/api/ideas/${ideaId}/participants/${maker.id}`, { method: 'DELETE' })).status).toBe(200)
  })

  it('delivers a new message to the author over realtime', async () => {
    const client = createClient(URL, process.env.SUPABASE_ANON_KEY ?? '', {
      global: { headers: { Authorization: `Bearer ${author.token}` } },
    })
    await client.realtime.setAuth(author.token)
    const got = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no realtime event')), 10000)
      const channel = client
        .channel(`toy-idea:${ideaId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'toy_idea_messages', filter: `idea_id=eq.${ideaId}` }, (p) => {
          // An earlier test's system message can still be on its way.
          if ((p.new as { body: string }).body !== 'Live') return
          clearTimeout(timer)
          resolve('Live')
        })
        // Not on SUBSCRIBED: on a cold realtime (after `supabase db reset`) the
        // temporary replication slot is created after SUBSCRIBED, so an insert
        // sent then is never streamed. The postgres_changes ack comes later.
        .on('system', {}, async (p: { extension?: string; status?: string }) => {
          if (p.extension !== 'postgres_changes' || p.status !== 'ok') return
          await adminClient().from('toy_idea_messages').insert({ idea_id: ideaId, sender_id: author.id, kind: 'system', body: 'Live' })
        })
        .subscribe()
      void channel
    })
    try {
      expect(await got).toBe('Live')
    } finally {
      await client.removeAllChannels()
    }
  })
})
