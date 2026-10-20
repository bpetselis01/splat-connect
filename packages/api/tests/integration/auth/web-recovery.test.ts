import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { adminClient } from '../../helpers/auth.js'

/**
 * The web recovery and code sign-in pages (app/login/forgot, reset, code,
 * verify) call Supabase auth straight from the browser. These run the same
 * supabase-js calls against local Supabase and read the code out of Mailpit.
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

async function confirmedUser() {
  const email = `web-${crypto.randomUUID()}@splat-test.local`
  const { data, error } = await adminClient().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  expect(error).toBeNull()
  created.push(data.user!.id)
  return { id: data.user!.id, email }
}

async function mailsTo(email: string) {
  const res = await fetch(`${MAIL}/search?query=${encodeURIComponent(`to:${email}`)}`)
  return ((await res.json()) as { messages: { ID: string; Subject: string; Snippet: string }[] }).messages
}

/** The 6-digit code in the newest mail to `email`, polled until it arrives. */
async function codeFor(email: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const code = (await mailsTo(email))[0]?.Snippet.match(/\b(\d{6})\b/)?.[1]
    if (code) return code
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`no code mailed to ${email}`)
}

describe('web forgot password and reset against local Supabase', () => {
  it('WA31 resetPasswordForEmail mails a six-digit recovery code to an existing member', async () => {
    const { email } = await confirmedUser()
    expect((await anon().auth.resetPasswordForEmail(email)).error).toBeNull()
    expect(await codeFor(email)).toMatch(/^\d{6}$/)
    expect((await mailsTo(email))[0]!.Subject).toMatch(/reset/i)
  })

  it('WA32 an address with no account is answered without an error and gets no mail', async () => {
    const email = `nobody-${crypto.randomUUID()}@splat-test.local`
    expect((await anon().auth.resetPasswordForEmail(email)).error).toBeNull()
    await new Promise((r) => setTimeout(r, 1500))
    expect(await mailsTo(email)).toEqual([])
  })

  it('WA33 the recovery code signs the member in, updateUser sets the password, and the old one stops working', async () => {
    const { email, id } = await confirmedUser()
    const supabase = anon()
    await supabase.auth.resetPasswordForEmail(email)
    const verified = await supabase.auth.verifyOtp({ email, token: await codeFor(email), type: 'recovery' })
    expect(verified.error).toBeNull()
    expect(verified.data.user?.id).toBe(id)
    expect((await supabase.auth.updateUser({ password: 'Changed5678!' })).error).toBeNull()

    expect((await anon().auth.signInWithPassword({ email, password: PASSWORD })).error?.code).toBe('invalid_credentials')
    expect((await anon().auth.signInWithPassword({ email, password: 'Changed5678!' })).error).toBeNull()
  })

  it('WA33 a wrong recovery code is refused as expired-or-invalid and signs nobody in', async () => {
    const { email } = await confirmedUser()
    const supabase = anon()
    await supabase.auth.resetPasswordForEmail(email)
    const real = await codeFor(email)
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: real === '000000' ? '111111' : '000000',
      type: 'recovery',
    })
    expect(error?.code).toBe('otp_expired')
    expect(data.session).toBeNull()
  })

  it('WA34 verifying spends the code, which is why a short password is checked before it', async () => {
    const { email } = await confirmedUser()
    const supabase = anon()
    await supabase.auth.resetPasswordForEmail(email)
    const code = await codeFor(email)
    expect((await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' })).error).toBeNull()
    expect((await supabase.auth.updateUser({ password: 'short' })).error?.code).toBe('weak_password')
    expect((await anon().auth.verifyOtp({ email, token: code, type: 'recovery' })).error?.code).toBe('otp_expired')
  })
})

describe('web code sign-in and verify against local Supabase', () => {
  it('WA35 signInWithOtp mails a six-digit sign-in code to an existing member', async () => {
    const { email } = await confirmedUser()
    expect((await anon().auth.signInWithOtp({ email, options: { shouldCreateUser: false } })).error).toBeNull()
    expect(await codeFor(email)).toMatch(/^\d{6}$/)
    expect((await mailsTo(email))[0]!.Subject).toMatch(/sign-in code/i)
  })

  it('WA36 an address with no account is refused as otp_disabled and no account is made', async () => {
    const email = `nobody-${crypto.randomUUID()}@splat-test.local`
    const { error } = await anon().auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    expect(error?.code).toBe('otp_disabled')
    const users = (await adminClient().auth.admin.listUsers({ perPage: 1000 })).data.users
    expect(users.find((u) => u.email === email)).toBeUndefined()
  })

  it('WA37 the sign-in code verifies as type email and returns the member\'s session; a wrong code does not', async () => {
    const { email, id } = await confirmedUser()
    const supabase = anon()
    await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    const real = await codeFor(email)
    const wrong = await anon().auth.verifyOtp({ email, token: real === '000000' ? '111111' : '000000', type: 'email' })
    expect(wrong.error?.code).toBe('otp_expired')
    expect(wrong.data.session).toBeNull()

    const { data, error } = await supabase.auth.verifyOtp({ email, token: real, type: 'email' })
    expect(error).toBeNull()
    expect(data.user?.id).toBe(id)
    expect(data.session).not.toBeNull()
  })

  it('WA38 a sign-up confirmation code resent from the verify screen confirms the account', async () => {
    const email = `web-${crypto.randomUUID()}@splat-test.local`
    const { data: made } = await adminClient().auth.admin.createUser({ email, password: PASSWORD, email_confirm: false })
    created.push(made.user!.id)
    const supabase = anon()
    expect((await supabase.auth.resend({ type: 'signup', email })).error).toBeNull()
    const { data, error } = await supabase.auth.verifyOtp({ email, token: await codeFor(email), type: 'signup' })
    expect(error).toBeNull()
    expect(data.user?.email_confirmed_at).toBeTruthy()
  })
})
