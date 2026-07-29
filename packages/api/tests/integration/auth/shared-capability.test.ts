import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let parent: TestUser

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
  parent = await createTestUser('parent')
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('tutorials').delete().eq('title', 'Parent authored tutorial')
  await deleteTestUser(parent.id)
})

describe('authoring is not tied to the contributor role', () => {
  //
  // No .select() on the insert: INSERT ... RETURNING also requires a SELECT
  // policy to match the new row, and a fresh draft has no tutorial_contributors
  // link yet, so "Contributors can read own tutorials" (001_schema.sql) does not
  // match it. That gap is pre-existing and unrelated to this change — it is why
  // POST /api/tutorials uses the admin client (tutorials.ts:65). Existence is
  // asserted with the service-role client instead.
  it('lets a parent-role account insert a tutorial', async () => {
    const { error } = await userClient(parent.token)
      .from('tutorials')
      .insert({ title: 'Parent authored tutorial', difficulty: 'easy' })

    expect(error).toBeNull()

    const { data } = await adminClient()
      .from('tutorials')
      .select('title')
      .eq('title', 'Parent authored tutorial')
      .single()
    expect(data?.title).toBe('Parent authored tutorial')
  })

  it('lets a parent-role account link itself as a contributor', async () => {
    // Looked up with the service-role client for the same reason as above: the
    // author cannot SELECT their own draft until this link exists.
    const { data: tutorial } = await adminClient()
      .from('tutorials')
      .select('id')
      .eq('title', 'Parent authored tutorial')
      .single()

    const { error } = await userClient(parent.token)
      .from('tutorial_contributors')
      .insert({ tutorial_id: tutorial!.id, profile_id: parent.id, role: 'primary' })

    expect(error).toBeNull()
  })
})

describe('profile identity is frozen against its owner', () => {
  // Tests: a user cannot promote themselves to admin.
  // Chain: "User can update own profile" has no WITH CHECK, so USING doubles as
  //        the check and role='admin' satisfied it. is_admin() then opens every
  //        admin policy in the schema.
  it('rejects a user setting their own role to admin', async () => {
    const { error } = await userClient(parent.token)
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', parent.id)

    expect(error).not.toBeNull()

    const { data } = await adminClient()
      .from('profiles')
      .select('role')
      .eq('id', parent.id)
      .single()
    expect(data?.role).toBe('parent')
  })

  // Tests: email is not settable directly.
  // Chain: profiles.email mirrors auth.users; a divergent value would make the
  //        admin account list lie about who an account belongs to.
  it('rejects a user setting their own email', async () => {
    const { error } = await userClient(parent.token)
      .from('profiles')
      .update({ email: 'attacker@example.com' })
      .eq('id', parent.id)

    expect(error).not.toBeNull()
  })

  // Tests: the freeze does not block the fields the profile tab will edit.
  it('still allows a user to change their own name', async () => {
    const { error } = await userClient(parent.token)
      .from('profiles')
      .update({ name: 'Renamed Parent' })
      .eq('id', parent.id)

    expect(error).toBeNull()
  })

  // Tests: an admin retains authority over another account's role.
  it('allows an admin to change another profile role', async () => {
    const admin = await createTestUser('admin')
    const target = await createTestUser('contributor')

    const { error } = await userClient(admin.token)
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', target.id)

    expect(error).toBeNull()

    await deleteTestUser(admin.id)
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
      .update({ role: 'contributor' })
      .eq('id', parent.id)

    expect(error).toBeNull()

    // Restore for the remaining tests in this file.
    await adminClient().from('profiles').update({ role: 'parent' }).eq('id', parent.id)
  })
})

describe('the admin account list', () => {
  // Chain: the filter used to mean "everyone who can author". After 009 it means
  //        "signed up on web", so a mobile parent who authors would vanish from
  //        the screen an admin uses to manage accounts.
  it('includes a parent-role account', async () => {
    const admin = await createTestUser('admin')
    const res = await app.request('/api/admin/contributors', authed(admin.token))

    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ id: string }>
    expect(rows.some((r) => r.id === parent.id)).toBe(true)

    await deleteTestUser(admin.id)
  })

  it('excludes admins', async () => {
    const admin = await createTestUser('admin')
    const res = await app.request('/api/admin/contributors', authed(admin.token))
    const rows = (await res.json()) as Array<{ id: string }>

    expect(rows.some((r) => r.id === admin.id)).toBe(false)

    await deleteTestUser(admin.id)
  })
})
