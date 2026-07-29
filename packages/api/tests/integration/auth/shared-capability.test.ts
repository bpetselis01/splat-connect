import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let parent: TestUser

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
