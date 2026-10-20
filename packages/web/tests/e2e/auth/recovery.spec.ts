import { test, expect } from '@playwright/test'
import { acceptTerms, createContributor, deleteUser, latestCode, signIn, uniqueEmail } from '../helpers'

// Forgot password and reset, with the real recovery code read out of local
// Supabase's mail catcher. Run with --workers=1: Supabase throttles mail per
// address and the specs share one stack.

async function requestCode(page: import('@playwright/test').Page, email: string) {
  const sent = Date.now() - 1000
  await page.goto(`/login/forgot?email=${encodeURIComponent(email)}`)
  await page.getByRole('button', { name: 'Send code' }).click()
  await page.waitForURL(/\/login\/reset\?email=/)
  return latestCode(email, sent)
}

test('WA31 Forgot password? on sign-in carries the email to a page that sends a code, then asks for it', async ({ page }) => {
  const { id, email } = await createContributor()
  try {
    await page.goto('/login')
    await page.locator('#email').fill(email)
    await page.getByRole('link', { name: 'Forgot password?' }).click()
    await expect(page).toHaveURL(`/login/forgot?email=${encodeURIComponent(email)}`)
    await expect(page.getByLabel('Email')).toHaveValue(email)

    const sent = Date.now() - 1000
    await page.getByRole('button', { name: 'Send code' }).click()
    await expect(page).toHaveURL(`/login/reset?email=${encodeURIComponent(email)}`)
    await expect(page.getByLabel('6-digit code')).toHaveAttribute('autocomplete', 'one-time-code')
    expect(await latestCode(email, sent)).toMatch(/^\d{6}$/)
  } finally {
    await deleteUser(id)
  }
})

test('WA32 an email with no account gets the same "code is on its way" screen', async ({ page }) => {
  const email = uniqueEmail('nobody')
  await page.goto(`/login/forgot?email=${encodeURIComponent(email)}`)
  await page.getByRole('button', { name: 'Send code' }).click()
  await expect(page).toHaveURL(`/login/reset?email=${encodeURIComponent(email)}`)
  await expect(page.getByText(`If an account uses ${email}, a 6-digit code is on its way.`)).toBeVisible()
})

test('WA33 the emailed code and a new password sign the member in at the dashboard, and the new password works', async ({ page, context }) => {
  const { id, email } = await createContributor()
  try {
    await acceptTerms(id)
    const code = await requestCode(page, email)
    await page.getByLabel('6-digit code').fill(code)
    await page.getByLabel('New password').fill('Brand-new-pw-1')
    await page.getByRole('button', { name: 'Save and sign in' }).click()
    await page.waitForURL('**/dashboard')

    await context.clearCookies()
    await signIn(page, email, 'Brand-new-pw-1')
    await page.waitForURL('**/dashboard')
  } finally {
    await deleteUser(id)
  }
})

test('WA33 a wrong code says so and the password field keeps its value', async ({ page }) => {
  const { id, email } = await createContributor()
  try {
    const real = await requestCode(page, email)
    await page.getByLabel('6-digit code').fill(real === '000000' ? '111111' : '000000')
    await page.getByLabel('New password').fill('Brand-new-pw-1')
    await page.getByRole('button', { name: 'Save and sign in' }).click()
    await expect(page.getByText("That code didn't work. Check the latest email, or send a new one.")).toBeVisible()
    await expect(page.getByLabel('New password')).toHaveValue('Brand-new-pw-1')
    await expect(page).toHaveURL(/\/login\/reset/)
  } finally {
    await deleteUser(id)
  }
})

test('WA34 a short password is refused without spending the code, which then still works', async ({ page }) => {
  const { id, email } = await createContributor()
  try {
    await acceptTerms(id)
    const code = await requestCode(page, email)
    await page.getByLabel('6-digit code').fill(code)
    await page.getByLabel('New password').fill('short')
    await page.getByRole('button', { name: 'Save and sign in' }).click()
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveText('Use at least 6 characters for the password.')
    await expect(page).toHaveURL(/\/login\/reset/)

    await page.getByLabel('New password').fill('Brand-new-pw-1')
    await page.getByRole('button', { name: 'Save and sign in' }).click()
    await page.waitForURL('**/dashboard')
  } finally {
    await deleteUser(id)
  }
})
