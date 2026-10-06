/** 118: exchanges and builds can be reported; a reporter writes only their own columns. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let member: TestUser

beforeAll(async () => {
  member = await createTestUser()
})

afterAll(async () => {
  await adminClient().from('member_reports').delete().eq('reporter_id', member.id)
  await deleteTestUser(member.id)
})

const file = (kind: string, category = 'no_show', extra: Record<string, unknown> = {}) =>
  app.request('/api/reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${member.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject_kind: kind, subject_label: 'Drum — exchange with Sam', category, body: 'Nobody came.', ok_to_contact: false, ...extra }),
  })

const asMember = () =>
  createClient(process.env.SUPABASE_URL ?? 'http://localhost:54321', process.env.SUPABASE_ANON_KEY ?? '', {
    global: { headers: { Authorization: `Bearer ${member.token}` } },
    auth: { persistSession: false },
  })

describe('118 member report kinds', () => {
  it.each(['guide', 'toy', 'exchange', 'build', 'note', 'print_job', 'person', 'organisation', 'other'])('files a report about a %s', async (kind) => {
    expect((await file(kind)).status).toBe(201)
  })

  it('files a report about one note, keeping the note id (132)', async () => {
    const subject_id = crypto.randomUUID()
    const res = await file('note', 'wrong_info', { subject_id, subject_label: "Sam R's note on Switch toy guide" })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ subject_kind: 'note', subject_id, category: 'wrong_info' })
    const { data } = await adminClient().from('member_reports').select('subject_kind').eq('subject_id', subject_id).single()
    expect(data?.subject_kind).toBe('note')
  })

  it.each(['safety', 'wrong_info', 'other'])('files a guide report under %s, keeping the guide id and label', async (category) => {
    const subject_id = crypto.randomUUID()
    const res = await file('guide', category, { subject_id, subject_label: 'Switch toy guide' })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ subject_kind: 'guide', subject_id, subject_label: 'Switch toy guide', category, reporter_id: member.id })
  })

  it('refuses a category the sheet never offers', async () => {
    expect((await file('guide', 'rude')).status).toBe(400)
  })

  it('stores the new kinds, read back through the admin client', async () => {
    const { data, error } = await adminClient()
      .from('member_reports')
      .select('subject_kind')
      .eq('reporter_id', member.id)
      .in('subject_kind', ['exchange', 'build'])
    expect(error).toBeNull()
    expect(new Set((data ?? []).map((r) => r.subject_kind))).toEqual(new Set(['exchange', 'build']))
  })

  it('still refuses a kind nobody can report', async () => {
    expect((await file('thread')).status).toBe(400)
  })

  it('stores what the reporter said about being contacted', async () => {
    const res = await file('exchange')
    expect(((await res.json()) as { ok_to_contact: boolean }).ok_to_contact).toBe(false)
  })

  it('will not let a member file a report already marked resolved, below the API', async () => {
    const { error } = await asMember().from('member_reports').insert({
      reporter_id: member.id, subject_kind: 'toy', subject_label: 'x', category: 'other', body: 'x',
      status: 'resolved', note_to_reporter: 'Handled.',
    })
    expect(error?.code).toBe('42501')
  })

  it('will not let a member name who handled it, below the API', async () => {
    const { error } = await asMember().from('member_reports').insert({
      reporter_id: member.id, subject_kind: 'toy', subject_label: 'x', category: 'other', body: 'x',
      handled_by: member.id, handled_at: new Date().toISOString(),
    })
    expect(error?.code).toBe('42501')
  })

  it('still lets a member file with only their own columns, below the API', async () => {
    const { error } = await asMember().from('member_reports').insert({
      reporter_id: member.id, subject_kind: 'build', subject_label: 'x', category: 'other', body: 'x', ok_to_contact: true,
    })
    expect(error).toBeNull()
  })
})
