import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { adminClient } from '../../helpers/auth.js'

/**
 * The mobile app talks to Supabase auth directly, never to our API, so these
 * run the same supabase-js calls auth-context.tsx makes against local Supabase
 * and read the code out of the local mail catcher (Mailpit, :54324).
 */
const MAIL = 'http://127.0.0.1:54324/api/v1'
const anon = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

/** The 6-digit code in the newest mail to `email` whose subject matches. */
async function codeFor(email: string, subject: RegExp, skip: string[] = []): Promise<{ id: string; code: string }> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAIL}/search?query=${encodeURIComponent(`to:${email}`)}`)
    const { messages } = (await res.json()) as {
      messages: { ID: string; Subject: string; Snippet: string }[]
    }
    const hit = messages.find((m) => subject.test(m.Subject) && !skip.includes(m.ID))
    const code = hit?.Snippet.match(/\b(\d{6})\b/)?.[1]
    if (hit && code) return { id: hit.ID, code }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`no mail for ${email}`)
}

// Supabase throttles mail to one address to one per second.
const throttle = () => new Promise((r) => setTimeout(r, 1200))

describe('mobile auth flows against local Supabase', () => {
  const email = `auth-${crypto.randomUUID()}@splat-test.local`
  const password = 'Test1234!'
  let userId: string | undefined

  afterAll(async () => {
    if (userId) await adminClient().auth.admin.deleteUser(userId)
  })

  it('A04/A05/A07/A08: sign-up mails a code, unconfirmed sign-in is refused, the code confirms', async () => {
    const supabase = anon()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: 'Auth Test' } },
    })
    expect(error).toBeNull()
    const first = await codeFor(email, /code/i)

    const unconfirmed = await supabase.auth.signInWithPassword({ email, password })
    expect(unconfirmed.error?.code).toBe('email_not_confirmed')

    // "Send a new code" and the unconfirmed sign-in's own resend: a second mail.
    await throttle()
    const resent = await supabase.auth.resend({ type: 'signup', email })
    expect(resent.error).toBeNull()
    const second = await codeFor(email, /code/i, [first.id])

    const verified = await supabase.auth.verifyOtp({ email, token: second.code, type: 'signup' })
    expect(verified.error).toBeNull()
    expect(verified.data.session).not.toBeNull()
    userId = verified.data.user?.id
    expect(userId).toBeDefined()

    const { data: profile } = await adminClient()
      .from('profiles')
      .select('id')
      .eq('id', userId!)
      .maybeSingle()
    expect(profile?.id).toBe(userId)

    expect((await anon().auth.signInWithPassword({ email, password })).error).toBeNull()
  })

  it('A06/A07: a sign-in code is mailed to an existing email and refused for an unknown one', async () => {
    const supabase = anon()
    const unknown = await supabase.auth.signInWithOtp({
      email: `nobody-${crypto.randomUUID()}@splat-test.local`,
      options: { shouldCreateUser: false },
    })
    expect(unknown.error).not.toBeNull()

    await throttle()
    const sent = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    expect(sent.error).toBeNull()
    const { code } = await codeFor(email, /sign-in code/i)
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    expect(error).toBeNull()
    expect(data.user?.id).toBe(userId)

    const wrong = await anon().auth.verifyOtp({ email, token: '000000', type: 'email' })
    expect(wrong.error).not.toBeNull()
  })

  it('A09/A10: a recovery code resets the password; the old one stops working', async () => {
    const supabase = anon()
    await throttle()
    const sent = await supabase.auth.resetPasswordForEmail(email)
    expect(sent.error).toBeNull()
    const { code } = await codeFor(email, /reset/i)
    const verified = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' })
    expect(verified.error).toBeNull()
    const updated = await supabase.auth.updateUser({ password: 'Changed5678!' })
    expect(updated.error).toBeNull()

    expect((await anon().auth.signInWithPassword({ email, password })).error).not.toBeNull()
    expect(
      (await anon().auth.signInWithPassword({ email, password: 'Changed5678!' })).error
    ).toBeNull()
  })

  it('A12/Z04: sign-out ends the session', async () => {
    const supabase = anon()
    const { data } = await supabase.auth.signInWithPassword({ email, password: 'Changed5678!' })
    const jwt = data.session!.access_token
    expect((await supabase.auth.getUser(jwt)).error).toBeNull()
    expect((await supabase.auth.signOut()).error).toBeNull()
    expect((await supabase.auth.getSession()).data.session).toBeNull()
  })
})
