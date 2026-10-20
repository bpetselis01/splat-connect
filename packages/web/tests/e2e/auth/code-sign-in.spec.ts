import { test, expect } from '@playwright/test'
import { acceptTerms, createContributor, deleteUser, latestCode, uniqueEmail } from '../helpers'

// Sign in with an emailed code, with the real code read out of local
// Supabase's mail catcher. Run with --workers=1: Supabase throttles mail per
// address and the specs share one stack.

test('WA35 "Email me a sign-in code" carries the email to a page that sends a code and opens the verify screen', async ({ page }) => {
  const { id, email } = await createContributor()
  try {
    await page.goto('/login')
    await page.locator('#email').fill(email)
    await page.getByRole('link', { name: 'Email me a sign-in code' }).click()
    await expect(page).toHaveURL(`/login/code?email=${encodeURIComponent(email)}`)

    const sent = Date.now() - 1000
    await page.getByRole('button', { name: 'Send code' }).click()
    await expect(page).toHaveURL(`/login/verify?email=${encodeURIComponent(email)}&type=email`)
    await expect(page.getByText(`We sent a 6-digit code to ${email}`)).toBeVisible()
    expect(await latestCode(email, sent)).toMatch(/^\d{6}$/)
  } finally {
    await deleteUser(id)
  }
})

test('WA36 an email with no account is told so and offered Create an account', async ({ page }) => {
  await page.goto('/login/code?next=%2Ftoy-library')
  await page.getByLabel('Email').fill(uniqueEmail('nobody'))
  await page.getByRole('button', { name: 'Send code' }).click()
  await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toContainText('No account uses that email.')
  await expect(page.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/signup?next=%2Ftoy-library')
  await expect(page).toHaveURL(/\/login\/code/)
})

test('WA37 the sixth digit signs the member in and honours ?next=; a wrong code is cleared and the next one works', async ({ page }) => {
  const { id, email } = await createContributor()
  try {
    await acceptTerms(id)
    const sent = Date.now() - 1000
    await page.goto(`/login/code?email=${encodeURIComponent(email)}&next=%2Ftoy-library`)
    await page.getByRole('button', { name: 'Send code' }).click()
    await page.waitForURL(/\/login\/verify/)
    const real = await latestCode(email, sent)

    await page.getByLabel('6-digit code').fill(real === '000000' ? '111111' : '000000')
    await expect(page.getByText("That code didn't work. Check the latest email, or send a new one.")).toBeVisible()
    await expect(page.getByLabel('6-digit code')).toHaveValue('')
    await expect(page.getByLabel('6-digit code')).toBeEnabled()

    await page.getByLabel('6-digit code').fill(real)
    await page.waitForURL('**/toy-library')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  } finally {
    await deleteUser(id)
  }
})

test('WA38 the resend waits 60 seconds, then sends a fresh code and restarts the wait; Wrong email? goes back to the code page', async ({ page }) => {
  const { id, email } = await createContributor()
  try {
    await page.clock.install()
    await page.goto(`/login/code?email=${encodeURIComponent(email)}`)
    await page.getByRole('button', { name: 'Send code' }).click()
    await page.waitForURL(/\/login\/verify/)
    await expect(page.getByText(/Resend code in 0:\d\d/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send a new code' })).toHaveCount(0)

    await page.clock.runFor(60_000)
    await expect(page.getByRole('button', { name: 'Send a new code' })).toBeVisible()

    // Supabase refuses a second mail to one address inside a second.
    await new Promise((r) => setTimeout(r, 1500))
    const resentAt = Date.now()
    await page.getByRole('button', { name: 'Send a new code' }).click()
    await expect(page.getByText(/Resend code in 0:60/)).toBeVisible()
    expect(await latestCode(email, resentAt - 500)).toMatch(/^\d{6}$/)

    await page.getByRole('link', { name: 'Wrong email? Change it' }).click()
    await expect(page).toHaveURL(`/login/code?email=${encodeURIComponent(email)}`)
  } finally {
    await deleteUser(id)
  }
})
