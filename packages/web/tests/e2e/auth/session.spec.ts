import { test, expect } from '@playwright/test'
import { signIn, createContributor, acceptTerms } from '../helpers'

test('signing out returns to the home page and restores the Sign in link', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  // The board's header has no sign-out; the Account page carries it.
  await page.goto('/dashboard/profile')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL(/localhost:\d+\/$/)

  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0)
})

test('WA16 Continue on the confirmed page goes to /login, keeping ?next=', async ({ page }) => {
  await page.goto('/auth/confirmed?next=%2Flibrary')

  await expect(page.getByRole('heading', { name: 'Email confirmed' })).toBeVisible()
  await expect(page.locator('header').getByRole('link', { name: 'Sign in' })).toBeVisible()
  await expect(
    page.getByText('Your email has been confirmed. Sign in to your account to continue.')
  ).toBeVisible()
  await page.getByRole('link', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/\/login\?next=%2Flibrary$/)
})

// Confirming the email does not sign the user in: after the countdown they are on the sign-in
// form and, on a full load, see the signed-out header and have to type the password again.
test('WA16 the confirmed page redirects to /login after its countdown and the visitor is still signed out', async ({ page }) => {
  await page.goto('/auth/confirmed')
  await expect(page.getByText(/Redirecting you to sign in in \d/)).toBeVisible()

  await page.waitForURL(/\/login$/, { timeout: 10_000 })
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  // No reload: the header must already be there after the in-app redirect.
  await expect(page.locator('header').getByRole('link', { name: 'Sign in' })).toBeVisible()
})
