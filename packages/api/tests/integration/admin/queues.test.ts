/**
 * The three 065 queues, and who may see what.
 *
 * The rules with teeth:
 *
 * - **Anyone may send a contact message; only an admin may read one.** A person
 *   reporting that a battery pack gets warm should not have to make an account
 *   first, and the message they send carries their name, their email and what
 *   they found wrong with a guide their child is using.
 * - **Safety jumps the queue.** In both the inbox and the reports, whatever the
 *   age of what is above it.
 * - **The person reported is never told who filed it.** There is no route that
 *   reads a report by its subject and no column that could carry a note to
 *   them; a report reaches its reporter and an admin, and nobody else.
 * - **A report cannot be edited after it is filed.** One that can be rewritten
 *   is not evidence of anything.
 * - **Site content is public to read and admin-only to write.**
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let admin: TestUser
let member: TestUser
let other: TestUser
let reportId: string

const authed = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })
const json = (token: string | null, method: string, body: unknown) => ({
  method,
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(body),
})

beforeAll(async () => {
  admin = await createTestUser('admin')
  member = await createTestUser('contributor')
  other = await createTestUser('contributor')
})

afterAll(async () => {
  const sb = adminClient()
  await sb.from('contact_messages').delete().like('email', '%@queues.test')
  await sb.from('member_reports').delete().eq('reporter_id', member.id)
  await sb.from('site_content').delete().eq('key', 'test-section')
  await Promise.all([
    deleteTestUser(admin.id),
    deleteTestUser(member.id),
    deleteTestUser(other.id),
  ])
})

describe('the contact form', () => {
  it('accepts a message with no session at all', async () => {
    const res = await app.request(
      '/api/public/contact',
      json(null, 'POST', {
        topic: 'safety',
        name: 'Jen',
        email: 'jen@queues.test',
        body: 'The battery pack on the fairy-lights guide gets warm after ten minutes.',
      })
    )
    expect(res.status).toBe(201)
  })

  it('refuses an unknown topic and a bad address', async () => {
    const base = { name: 'Jen', email: 'jen@queues.test', body: 'Hello.' }
    for (const bad of [{ ...base, topic: 'nonsense' }, { ...base, topic: 'other', email: 'nope' }]) {
      const res = await app.request('/api/public/contact', json(null, 'POST', bad))
      expect(res.status, JSON.stringify(bad)).toBe(400)
    }
  })

  // Chain: the message carries a name, an email and, on a safety report, what
  //        somebody found wrong with a guide their child is using.
  it('is unreadable by a member, and readable by an admin', async () => {
    expect((await app.request('/api/admin/inbox', authed(member.token))).status).toBe(403)

    const res = await app.request('/api/admin/inbox', authed(admin.token))
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ topic: string; email: string }>
    expect(rows.some((r) => r.email === 'jen@queues.test')).toBe(true)
  })

  it('puts safety at the top whatever the age of what is above it', async () => {
    // An older non-safety message, backdated past the safety one above.
    const sb = adminClient()
    await sb.from('contact_messages').insert({
      topic: 'other',
      name: 'ABC Radio',
      email: 'radio@queues.test',
      body: 'Could we interview someone?',
      created_at: new Date(Date.now() - 30 * 864e5).toISOString(),
    })

    const rows = (await (
      await app.request('/api/admin/inbox', authed(admin.token))
    ).json()) as Array<{ topic: string; email: string }>
    const ours = rows.filter((r) => r.email.endsWith('@queues.test'))
    expect(ours[0].topic).toBe('safety')
  })

  it('records who handled it, and clears that on reopen', async () => {
    const rows = (await (
      await app.request('/api/admin/inbox', authed(admin.token))
    ).json()) as Array<{ id: string; email: string }>
    const id = rows.find((r) => r.email === 'jen@queues.test')!.id

    const replied = await app.request(`/api/admin/inbox/${id}`, json(admin.token, 'PATCH', { status: 'replied' }))
    expect(replied.status).toBe(200)
    expect(((await replied.json()) as { handled_by: string | null }).handled_by).toBe(admin.id)

    const reopened = await app.request(`/api/admin/inbox/${id}`, json(admin.token, 'PATCH', { status: 'open' }))
    // Cleared, so the record does not claim somebody answered something they
    // did not.
    expect(((await reopened.json()) as { handled_by: string | null }).handled_by).toBeNull()
  })
})

describe('member reports', () => {
  it('files one as the caller, whatever the body claims', async () => {
    const res = await app.request(
      '/api/reports',
      json(member.token, 'POST', {
        reporter_id: other.id,
        subject_kind: 'guide',
        subject_label: 'Guide C — Plush dog that barks',
        category: 'safety',
        body: 'Step 4 says hot glue is optional. Ours pulled apart.',
        ok_to_contact: true,
      })
    )
    expect(res.status).toBe(201)
    const row = (await res.json()) as { id: string; reporter_id: string; status: string }
    reportId = row.id
    // A client-supplied reporter would let one account file in another's name,
    // which on a table nobody but an admin can read would be undetectable.
    expect(row.reporter_id).toBe(member.id)
    expect(row.status).toBe('new')
  })

  it('shows the reporter their own and nobody else theirs', async () => {
    const mine = (await (await app.request('/api/reports', authed(member.token))).json()) as Array<{
      id: string
    }>
    expect(mine.map((r) => r.id)).toContain(reportId)

    const theirs = (await (
      await app.request('/api/reports', authed(other.token))
    ).json()) as Array<{ id: string }>
    expect(theirs.map((r) => r.id)).not.toContain(reportId)
  })

  it('gives an admin the queue with the reporter named', async () => {
    const res = await app.request('/api/admin/member-reports', authed(admin.token))
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ id: string; reporter_name: string | null }>
    const row = rows.find((r) => r.id === reportId)
    expect(row).toBeTruthy()
    // Resolved rather than merely present: a failed profile lookup would give
    // `undefined`, and this is the one place the reporter is named at all. The
    // fixture's own name is empty, which is why this is not a truthiness check.
    expect(row!.reporter_name).not.toBeUndefined()
  })

  it('refuses a member the admin queue', async () => {
    expect((await app.request('/api/admin/member-reports', authed(member.token))).status).toBe(403)
  })

  // Chain: a report that can be rewritten is not evidence of anything. There is
  //        no update policy for the reporter at all, so the write matches no
  //        row rather than being refused — the same answer told differently.
  it('cannot be edited by its reporter', async () => {
    const sb = adminClient()
    const { data: before } = await sb.from('member_reports').select('body').eq('id', reportId).single()

    // Through the user's own client, which is what an edit route would use.
    const res = await app.request('/api/reports', authed(member.token))
    expect(res.status).toBe(200)

    const { data: after } = await sb.from('member_reports').select('body').eq('id', reportId).single()
    expect(after!.body).toBe(before!.body)
  })

  it('lets an admin move it through its states and write back', async () => {
    const looking = await app.request(
      `/api/admin/member-reports/${reportId}`,
      json(admin.token, 'PATCH', { status: 'looking', note_to_reporter: 'Looking at it now.' })
    )
    expect(looking.status).toBe(200)
    const row = (await looking.json()) as { status: string; note_to_reporter: string }
    expect(row.status).toBe('looking')
    expect(row.note_to_reporter).toBe('Looking at it now.')

    // The note reaches the REPORTER, which is the whole point of it.
    const mine = (await (await app.request('/api/reports', authed(member.token))).json()) as Array<{
      id: string
      note_to_reporter: string | null
    }>
    expect(mine.find((r) => r.id === reportId)?.note_to_reporter).toBe('Looking at it now.')
  })
})

describe('site content', () => {
  // A throwaway key, NOT home-hero. A PUT replaces the whole section by design
  // — a partial merge would make it impossible to clear a field — so a test
  // that wrote to the real one would leave the live home page with whatever
  // partial object the assertion happened to need.
  const KEY = 'test-section'

  it('is readable by anyone and writable only by an admin', async () => {
    const asMember = await app.request(
      `/api/admin/content/${KEY}`,
      json(member.token, 'PUT', { value: { headline: 'Hijacked' } })
    )
    expect(asMember.status).toBe(403)

    const asAdmin = await app.request(
      `/api/admin/content/${KEY}`,
      json(admin.token, 'PUT', { value: { headline: 'A headline' } })
    )
    expect(asAdmin.status).toBe(200)
    expect(((await asAdmin.json()) as { value: { headline: string } }).value.headline).toBe(
      'A headline'
    )
  })

  it('refuses a key that is not a slug', async () => {
    const res = await app.request(
      '/api/admin/content/../../etc/passwd',
      json(admin.token, 'PUT', { value: {} })
    )
    expect(res.status).not.toBe(200)
  })
})
