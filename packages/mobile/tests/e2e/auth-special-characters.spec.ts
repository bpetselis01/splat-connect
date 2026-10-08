// journeys: A04
import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { adminClient, uniqueSignupEmail } from './helpers'
import { EMAILS, NAMES, PASSWORDS } from '../special-strings'
import { LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY } from '../../../../supabase/local-dev-keys'

// Every special string, typed into Create account against local Supabase,
// either reaches the code screen and is stored exactly (trimmed where the
// screen trims) or shows a sentence naming the field to fix.

async function createAccount(page: Page, name: string, email: string, password: string) {
  await page.goto('/create-account')
  await page.getByLabel('Your name', { exact: true }).fill(name)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByTestId('accept-contributor-terms').click()
  await page.getByTestId('auth-submit').click()
}

async function userByEmail(email: string) {
  const { data } = await adminClient().from('profiles').select('id, name, email').eq('email', email.toLowerCase()).maybeSingle()
  return data as { id: string; name: string } | null
}

for (const c of NAMES) {
  test(`sign-up name: ${c.label}`, async ({ page }) => {
    const email = uniqueSignupEmail()
    await createAccount(page, c.value, email, 'Test1234!')
    await expect(page.getByText('Check your email')).toBeVisible()
    await expect.poll(async () => (await userByEmail(email))?.name).toBe(c.value.trim())
  })
}

for (const c of EMAILS) {
  test(`sign-up email: ${c.label}`, async ({ page }) => {
    // Unique per run: the accepted ones would otherwise be "already registered" next time.
    const email = c.server ? c.value : c.value.replace('@', `-${Date.now()}${Math.floor(Math.random() * 1e6)}@`)
    await createAccount(page, 'E2E Special', email, 'Test1234!')
    if (c.server) {
      await expect(page.getByText("That email address doesn't look right. Check it for typos and try again.")).toBeVisible()
    } else {
      await expect(page.getByText('Check your email')).toBeVisible()
      await expect.poll(async () => Boolean(await userByEmail(email.trim()))).toBe(true)
    }
  })
}

for (const c of PASSWORDS) {
  test(`sign-up password: ${c.label}`, async ({ page }) => {
    const email = uniqueSignupEmail()
    await createAccount(page, 'E2E Special', email, c.value)
    if (c.server) {
      await expect(page.getByText('Use 72 characters or fewer for the password.')).toBeVisible()
      return
    }
    await expect(page.getByText('Check your email')).toBeVisible()
    // The stored password is the typed one, untrimmed: confirm, then sign in with it.
    let user: { id: string } | null = null
    await expect.poll(async () => (user = await userByEmail(email))).not.toBeNull()
    await adminClient().auth.admin.updateUserById(user!.id, { email_confirm: true })
    const anon = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const { error } = await anon.auth.signInWithPassword({ email, password: c.value })
    expect(error).toBeNull()
  })
}
