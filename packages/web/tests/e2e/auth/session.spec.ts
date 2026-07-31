import { test, expect } from '@playwright/test'
import { signIn, createContributor, acceptTerms } from '../helpers'

test('signing out returns to the home page and restores the Sign in link', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL(/localhost:\d+\/$/)

  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0)
})

test('the email-confirmed page renders its confirmation', async ({ page }) => {
  await page.goto('/auth/confirmed')

  await expect(page.getByRole('heading', { name: 'Email confirmed' })).toBeVisible()
  await expect(
    page.getByText('Your email has been confirmed. Sign in to your account to continue.')
  ).toBeVisible()
})
