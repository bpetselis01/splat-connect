/**
 * Tests: an ordinary account cannot promote itself, going straight at the
 *        database and ignoring the API entirely.
 *
 * Chain: patch-me.test.ts already covers the API's column allowlist, but the
 *        2026-08-28 pentest never called the API. It used the public anon key
 *        and the user's own JWT to PATCH profiles over PostgREST — the same
 *        request any browser can make — and got role='admin' back with a 204.
 *        Authorization here lives in the database (RLS + column grants +
 *        freeze triggers), so a test that only exercises Hono proves nothing
 *        about the control that actually failed.
 *
 *        Two independent controls now stop this, so the assertions deliberately
 *        check the OUTCOME (the row did not change) rather than a specific
 *        status code, and hold whichever one fires first:
 *          - 045 revokes UPDATE on profiles from anon/authenticated, so
 *            PostgREST rejects the write before any row is touched;
 *          - 009's profiles_freeze_identity trigger raises on a non-admin
 *            role/email change, and is what catches it if the grant is ever
 *            widened again.
 *        Their presence on the deployed database is a separate question from
 *        their correctness, and is asserted by scripts/check-schema-guards.sh.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let user: TestUser

/**
 * The exploit's client: the public anon key plus the caller's own access token.
 * This is exactly what ships to the browser — no service-role key involved.
 */
const asUser = (token: string) =>
  createClient(
    process.env.SUPABASE_URL ?? 'http://localhost:54321',
    process.env.SUPABASE_ANON_KEY ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

const roleOf = async (id: string) => {
  const { data } = await adminClient().from('profiles').select('role, email').eq('id', id).single()
  return data
}

beforeAll(async () => {
  user = await createTestUser('contributor')
})

afterAll(async () => {
  await deleteTestUser(user.id)
})

describe('profiles privilege escalation over PostgREST', () => {
  it('refuses a self-service promotion to admin', async () => {
    const { error } = await asUser(user.token)
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', user.id)

    expect(error).not.toBeNull()
    expect((await roleOf(user.id))?.role).toBe('contributor')
  })

  it('refuses a direct email rewrite', async () => {
    const { error } = await asUser(user.token)
      .from('profiles')
      .update({ email: 'attacker@example.com' })
      .eq('id', user.id)

    expect(error).not.toBeNull()
    expect((await roleOf(user.id))?.email).not.toBe('attacker@example.com')
  })

  // A silent no-op would be as dangerous as a success if the row did change, so
  // pin the case where the write is scoped to somebody else's row too.
  it('refuses to promote a different account', async () => {
    const victim = await createTestUser('contributor')
    try {
      await asUser(user.token).from('profiles').update({ role: 'admin' }).eq('id', victim.id)
      expect((await roleOf(victim.id))?.role).toBe('contributor')
    } finally {
      await deleteTestUser(victim.id)
    }
  })
})
