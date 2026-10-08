/**
 * site-content-learn-legal-editing: the course outline is one site_content
 * row ('learn-course'), checked on the way in and merged over the code
 * default on the way out. A save names the version it loaded; a save over a
 * row someone else changed since is refused (409), never laid over theirs.
 * Writes the real key, so it restores what was there.
 */
// journeys: Q13 Q15
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let admin: TestUser
let other: TestUser
let before: { value: unknown } | null = null

const STALE = 'Someone else saved this course since you opened it. Reload to see their changes.'

const put = (value: unknown, expected_updated_at: string | null, who: TestUser = admin) =>
  app.request('/api/admin/content/learn-course', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${who.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value, expected_updated_at }),
  })
const read = async () => (await (await app.request('/api/public/learn-course')).json()) as Record<string, any>
const version = async (): Promise<string | null> => {
  const { data } = await adminClient().from('site_content').select('updated_at').eq('key', 'learn-course').maybeSingle()
  return (data?.updated_at as string | undefined) ?? null
}
const adminRow = async (who: TestUser) => {
  const res = await app.request('/api/admin/content', { headers: { Authorization: `Bearer ${who.token}` } })
  const rows = (await res.json()) as Array<Record<string, unknown>>
  return rows.find((r) => r.key === 'learn-course')
}

beforeAll(async () => {
  admin = await createTestUser('admin')
  other = await createTestUser('admin')
  const { data } = await adminClient().from('site_content').select('value').eq('key', 'learn-course').maybeSingle()
  before = data
  await adminClient().from('site_content').delete().eq('key', 'learn-course')
})

afterAll(async () => {
  if (before) await adminClient().from('site_content').upsert({ key: 'learn-course', value: before.value })
  else await adminClient().from('site_content').delete().eq('key', 'learn-course')
  await Promise.all([deleteTestUser(admin.id), deleteTestUser(other.id)])
})

describe('GET /api/public/learn-course', () => {
  it("serves the code's course when nothing is saved", async () => {
    const c = await read()
    expect(c.units).toHaveLength(6)
    expect(c).toMatchObject({ title: null, outcome: null, shown_as: 'free' })
  })

  it('serves a saved outline merged over the default', async () => {
    const res = await put(
      {
        title: 'Toy adaptation, start to finish',
        shown_as: 'sign_in',
        units: [{ id: 'handover', title: 'Hand it over', blurb: '', lessons: [{ slug: 'handover', title: 'Checks', minutes: 6, kind: 'read' }] }],
      },
      null
    )
    expect(res.status).toBe(200)
    const c = await read()
    expect(c).toMatchObject({ title: 'Toy adaptation, start to finish', shown_as: 'sign_in' })
    expect(c.units[0]).toMatchObject({ id: 'handover', n: 1 })
    expect(c.units[0].lessons[0]).toMatchObject({ slug: 'handover', title: 'Checks' })
    expect(c.units).toHaveLength(6)
    // The row holds what was checked, not what was sent.
    const { data } = await adminClient().from('site_content').select('value').eq('key', 'learn-course').single()
    expect((data!.value as { title: string }).title).toBe('Toy adaptation, start to finish')
  })

  it('refuses a minutes of 0 or a kind of "video" with a sentence, and keeps the saved value', async () => {
    const v = await version()
    for (const [lesson, error] of [
      [{ slug: 'handover', title: 'Checks', minutes: 0, kind: 'read' }, 'A lesson length must be a whole number of minutes from 1 to 240.'],
      [{ slug: 'handover', title: 'Checks', minutes: 6, kind: 'video' }, 'A lesson is a read, a build or a checkpoint.'],
    ] as const) {
      const res = await put({ units: [{ id: 'handover', title: 'Hand it over', blurb: '', lessons: [lesson] }] }, v)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error })
    }
    expect((await read()).title).toBe('Toy adaptation, start to finish')
  })

  it('serves no outline for a hidden course, while the admin read keeps it for the preview', async () => {
    const v = await version()
    const res = await put({ title: 'Toy adaptation, start to finish', shown_as: 'hidden' }, v)
    expect(res.status).toBe(200)
    expect(await read()).toEqual({ title: null, outcome: null, shown_as: 'hidden', units: [] })
    const row = await adminRow(admin)
    expect(row!.value).toMatchObject({ title: 'Toy adaptation, start to finish', shown_as: 'hidden' })
    // A row a hand edit broke elsewhere stays hidden (fails closed).
    await adminClient().from('site_content').update({ value: { shown_as: 'hidden', units: 'everything' } }).eq('key', 'learn-course')
    expect(await read()).toEqual({ title: null, outcome: null, shown_as: 'hidden', units: [] })
    await adminClient()
      .from('site_content')
      .update({ value: { title: 'Toy adaptation, start to finish', shown_as: 'sign_in' }, updated_at: v })
      .eq('key', 'learn-course')
  })

  it('a hand-edited bad row is the default course, never an error', async () => {
    const v = await version()
    await adminClient().from('site_content').update({ value: { units: 'everything' } }).eq('key', 'learn-course')
    const c = await read()
    expect(c).toMatchObject({ title: null, shown_as: 'free' })
    expect(c.units).toHaveLength(6)
    await adminClient().from('site_content').update({ value: { title: 'Toy adaptation, start to finish', shown_as: 'sign_in' }, updated_at: v }).eq('key', 'learn-course')
  })
})

describe('two admins editing the course', () => {
  it('names who saved last, through the admin client', async () => {
    await adminClient().from('profiles').update({ name: 'Ada Admin' }).eq('id', admin.id)
    const row = await adminRow(admin)
    expect(row).toMatchObject({ updated_by: admin.id, updated_by_name: 'Ada Admin' })
    expect(typeof row!.updated_at).toBe('string')
  })

  it("refuses the second save over a version that changed, keeping the first admin's", async () => {
    const loaded = await version()
    // Both opened the editor at `loaded`. The other admin saves first.
    const first = await put({ title: 'Saved by the other admin' }, loaded, other)
    expect(first.status).toBe(200)
    const saved = (await first.json()) as { updated_at: string }

    const second = await put({ title: 'Saved over the top' }, loaded)
    expect(second.status).toBe(409)
    expect(await second.json()).toEqual({ error: STALE })
    expect((await read()).title).toBe('Saved by the other admin')
    expect(await adminRow(admin)).toMatchObject({ updated_by: other.id })

    // After a reload (the version the first save returned) the save goes through.
    const again = await put({ title: 'Saved after reloading' }, saved.updated_at)
    expect(again.status).toBe(200)
    expect((await read()).title).toBe('Saved after reloading')
  })

  it('refuses a "there was no row" save once a row exists, and a save with no version at all', async () => {
    expect((await put({ title: 'x' }, null)).status).toBe(409)
    const res = await app.request('/api/admin/content/learn-course', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: { title: 'x' } }),
    })
    expect(res.status).toBe(400)
    expect((await read()).title).toBe('Saved after reloading')
  })
})
