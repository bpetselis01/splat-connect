import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let subject: TestUser

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(init.headers ?? {}),
  },
})

const userClient = (token: string) =>
  createClient(
    process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.SUPABASE_ANON_KEY ?? '',
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    }
  )

beforeAll(async () => {
  subject = await createTestUser('contributor')
})

afterAll(async () => {
  await deleteTestUser(subject.id)
})

describe('storage upload is gated by the same function as tutorial authoring', () => {
  // Tests: is_approved_contributor() also gates the storage upload/update
  // policies (001_schema.sql, 002_storage_update_policies.sql), not just the
  // tutorial ones exercised above — 009 widened both from the same function.
  it('lets a contributor upload to storage', async () => {
    const tutorialId = crypto.randomUUID()
    await adminClient()
      .from('tutorials')
      .insert({ id: tutorialId, title: 'Storage upload test', difficulty: 'easy', status: 'draft' })
    await adminClient().from('tutorial_contributors').insert({ tutorial_id: tutorialId, profile_id: subject.id })

    const fd = new FormData()
    fd.append('file', new File(['%PDF-1.4 test'], 'tutorial.pdf', { type: 'application/pdf' }))
    fd.append('tutorialId', tutorialId)

    const res = await app.request('/api/upload/pdf', {
      method: 'POST',
      headers: { Authorization: `Bearer ${subject.token}` },
      body: fd,
    })

    expect(res.status).toBe(200)

    await adminClient().storage.from('tutorial-pdfs').remove([`${tutorialId}/tutorial.pdf`])
    await adminClient().from('tutorials').delete().eq('id', tutorialId)
  })
})

describe('profile identity is frozen against its owner', () => {
  // Tests: a user cannot promote themselves to admin.
  // Chain: "User can update own profile" has no WITH CHECK, so USING doubles as
  //        the check and role='admin' satisfied it. is_admin() then opens every
  //        admin policy in the schema.
  it('rejects a user setting their own role to admin', async () => {
    const { error } = await userClient(subject.token)
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', subject.id)

    expect(error).not.toBeNull()

    const { data } = await adminClient()
      .from('profiles')
      .select('role')
      .eq('id', subject.id)
      .single()
    expect(data?.role).toBe('contributor')
  })

  // Tests: email is not settable directly.
  // Chain: profiles.email mirrors auth.users; a divergent value would make the
  //        admin account list lie about who an account belongs to.
  it('rejects a user setting their own email', async () => {
    const { error } = await userClient(subject.token)
      .from('profiles')
      .update({ email: 'attacker@example.com' })
      .eq('id', subject.id)

    expect(error).not.toBeNull()
  })

  // Tests: the freeze does not block the fields the profile tab will edit.
  it('still allows a user to change their own name', async () => {
    const { error } = await userClient(subject.token)
      .from('profiles')
      .update({ name: 'Renamed Parent' })
      .eq('id', subject.id)

    expect(error).toBeNull()
  })

  // Tests: role is unwritable over PostgREST by ANY holder of the anon key,
  //        including an admin.
  // Chain: this asserted the opposite until 045. The trigger alone could tell an
  //        admin from anyone else, and when it turned out to be missing from the
  //        cloud project on 2026-08-28 there was nothing behind it — one PATCH
  //        with the browser's anon key produced an admin. 045 removes the column
  //        grant so the escalation cannot reopen if the trigger is ever dropped
  //        again, and a GRANT cannot make that exception: admin and contributor
  //        are both the Postgres role `authenticated`.
  //        The capability is not lost, only moved off the anon key — role
  //        changes now need the service-role client (no route writes
  //        profiles.role today; adding one means createAdminClient).
  it('refuses an admin changing another profile role over PostgREST', async () => {
    const admin = await createTestUser('admin')
    const target = await createTestUser('contributor')

    const { error } = await userClient(admin.token)
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', target.id)

    expect(error?.code).toBe('42501') // permission denied for table profiles

    const { data } = await adminClient()
      .from('profiles')
      .select('role')
      .eq('id', target.id)
      .single()
    expect(data?.role).toBe('contributor')

    await deleteTestUser(admin.id)
    await deleteTestUser(target.id)
  })

  // Tests: the service-role path an admin must now use still works.
  it('allows a service-role client to change a profile role', async () => {
    const target = await createTestUser('contributor')

    const { error } = await adminClient()
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', target.id)

    expect(error).toBeNull()

    await deleteTestUser(target.id)
  })

  // Tests: a service-role write is not caught by the guard.
  // Chain: triggers fire for service_role even though RLS does not, and
  //        is_admin() reads auth.uid(), which service_role lacks. Without the
  //        early return this raises 42501 while the route reports success
  //        having changed nothing (see the 007 header).
  it('does not block a service-role write', async () => {
    const { error } = await adminClient()
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', subject.id)

    expect(error).toBeNull()

    // Restore for the remaining tests in this file.
    await adminClient().from('profiles').update({ role: 'contributor' }).eq('id', subject.id)
  })
})

describe('the profiles column grant', () => {
  // Tests: 029 revoked table-level select and re-granted only
  //        id/name/role/created_at — email is visible to no one holding just
  //        the anon/authenticated key, even on their own row, since RLS is
  //        row-level and can't narrow columns on a row it does make visible.
  it('denies selecting email directly via PostgREST', async () => {
    const { error } = await userClient(subject.token)
      .from('profiles')
      .select('email')
      .eq('id', subject.id)
      .single()

    expect(error).not.toBeNull()
  })

  it('still allows selecting name, the column app routes actually read', async () => {
    const { data, error } = await userClient(subject.token)
      .from('profiles')
      .select('name')
      .eq('id', subject.id)
      .single()

    expect(error).toBeNull()
    expect(data?.name).toBeDefined()
  })
})

describe('the admin account list', () => {
  // Chain: the filter means "every non-admin account" — any account that can
  //        author must still show up on the screen an admin uses to manage them.
  it('includes a contributor account', async () => {
    const admin = await createTestUser('admin')
    const res = await app.request('/api/admin/contributors', authed(admin.token))

    expect(res.status).toBe(200)
    const { accounts } = (await res.json()) as { accounts: Array<{ id: string }>; total: number }
    expect(accounts.some((r) => r.id === subject.id)).toBe(true)

    await deleteTestUser(admin.id)
  })

  it('excludes admins', async () => {
    const admin = await createTestUser('admin')
    const res = await app.request('/api/admin/contributors', authed(admin.token))
    const { accounts } = (await res.json()) as { accounts: Array<{ id: string }>; total: number }

    expect(accounts.some((r) => r.id === admin.id)).toBe(false)

    await deleteTestUser(admin.id)
  })
})
