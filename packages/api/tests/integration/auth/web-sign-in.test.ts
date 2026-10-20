import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { AGREEMENT_VERSIONS, pendingIntent } from '@splat-connect/types'
import { adminClient } from '../../helpers/auth.js'

/**
 * The web sign-in and sign-up pages call Supabase auth straight from the browser
 * (app/login/page.tsx, app/signup/page.tsx), never our API. These run the same
 * supabase-js calls against local Supabase and read what the pages' next steps
 * depend on: the session, the profile role, the metadata and the trigger's rows.
 */
const MAIL = 'http://127.0.0.1:54324/api/v1'
const anon = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
const PASSWORD = 'Test1234!'
const created: string[] = []

afterAll(async () => {
  await Promise.all(created.map((id) => adminClient().auth.admin.deleteUser(id)))
})

async function confirmedUser(opts: { role?: 'contributor' | 'admin'; metadata?: Record<string, unknown>; confirmed?: boolean } = {}) {
  const email = `web-${crypto.randomUUID()}@splat-test.local`
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: opts.confirmed ?? true,
    user_metadata: opts.metadata,
  })
  expect(error).toBeNull()
  created.push(data.user!.id)
  if (opts.role) await adminClient().from('profiles').upsert({ id: data.user!.id, role: opts.role })
  return { id: data.user!.id, email }
}

/** What the login page does after signInWithPassword: reads its own profile role as that user. */
async function signInAndReadRole(email: string) {
  const supabase = anon()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD })
  expect(error).toBeNull()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user!.id).single()
  return { supabase, session: data.session, role: profile?.role }
}

describe('web sign-in against local Supabase', () => {
  it('WA01 a confirmed member gets a session and reads their own role as contributor', async () => {
    const { email, id } = await confirmedUser({ role: 'contributor' })
    const { session, role } = await signInAndReadRole(email)
    expect(session?.user.id).toBe(id)
    expect(role).toBe('contributor')
  })

  it('WA02 an admin reads their own role as admin, which sends them to /admin', async () => {
    const { email } = await confirmedUser({ role: 'admin' })
    expect((await signInAndReadRole(email)).role).toBe('admin')
  })

  it('WA03 a wrong password is refused with "Invalid login credentials" and no session', async () => {
    const { email } = await confirmedUser()
    const { data, error } = await anon().auth.signInWithPassword({ email, password: 'not-the-password' })
    expect(error?.code).toBe('invalid_credentials')
    expect(error?.message).toBe('Invalid login credentials')
    expect(data.session).toBeNull()
  })

  it('WA08 an unconfirmed email is refused with email_not_confirmed, and the resend the page then makes mails a code', async () => {
    const { email } = await confirmedUser({ confirmed: false })
    const { data, error } = await anon().auth.signInWithPassword({ email, password: PASSWORD })
    expect(error?.code).toBe('email_not_confirmed')
    expect(data.session).toBeNull()

    expect((await anon().auth.resend({ type: 'signup', email })).error).toBeNull()
    let snippet = ''
    for (let i = 0; i < 40 && !snippet; i++) {
      const res = await fetch(`${MAIL}/search?query=${encodeURIComponent(`to:${email}`)}`)
      snippet = ((await res.json()) as { messages: { Snippet: string }[] }).messages[0]?.Snippet ?? ''
      if (!snippet) await new Promise((r) => setTimeout(r, 250))
    }
    expect(snippet).toMatch(/\b\d{6}\b/)
  })

  it('WA05 the sign-up intent is pending until the first sign-in spends it, and stays recorded', async () => {
    const { email } = await confirmedUser({ metadata: { intent: 'family' } })
    const { supabase } = await signInAndReadRole(email)
    expect(pendingIntent((await supabase.auth.getUser()).data.user!.user_metadata)).toBe('family')

    expect((await supabase.auth.updateUser({ data: { intent_landed: true } })).error).toBeNull()
    const meta = (await supabase.auth.getUser()).data.user!.user_metadata
    expect(pendingIntent(meta)).toBeNull()
    expect(meta.intent).toBe('family')
  })
})

describe('web sign-up against local Supabase', () => {
  it('WA09 signUp makes an unconfirmed account with a profile and the accepted terms, and mails the confirmation', async () => {
    const email = `web-${crypto.randomUUID()}@splat-test.local`
    const { data, error } = await anon().auth.signUp({
      email,
      password: PASSWORD,
      options: {
        data: { name: 'Web Signup', contributor_terms_version: AGREEMENT_VERSIONS.contributor_terms, intent: 'maker' },
      },
    })
    expect(error).toBeNull()
    expect(data.session).toBeNull()
    // With code confirmation on, signUp hands back no user; the account is found by email.
    const admin = adminClient()
    const account = (await admin.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === email)
    const id = account!.id
    created.push(id)
    expect(account!.user_metadata.intent).toBe('maker')
    expect(account!.email_confirmed_at).toBeFalsy()

    expect((await admin.from('profiles').select('name').eq('id', id).single()).data).toEqual({ name: 'Web Signup' })
    expect((await admin.from('user_agreements').select('agreement_type, version').eq('user_id', id)).data).toEqual([
      { agreement_type: 'contributor_terms', version: AGREEMENT_VERSIONS.contributor_terms },
    ])

    let mails = 0
    for (let i = 0; i < 40 && !mails; i++) {
      const res = await fetch(`${MAIL}/search?query=${encodeURIComponent(`to:${email}`)}`)
      mails = ((await res.json()) as { messages: unknown[] }).messages.length
      if (!mails) await new Promise((r) => setTimeout(r, 250))
    }
    expect(mails).toBe(1)
  })

  it('WA12 signing up with an email that already has an account is refused', async () => {
    const { email } = await confirmedUser()
    const { data, error } = await anon().auth.signUp({ email, password: PASSWORD })
    expect(error?.message).toBe('User already registered')
    expect(data.user).toBeNull()
  })
})
