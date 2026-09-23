import { test, expect } from '@playwright/test'
import { signUpNewAccount, uniqueSignupEmail, openChildProfile } from './helpers'

test('a signed-out visitor is sent to sign-in from any tab', async ({ page }) => {
  await page.goto('/guides')
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByTestId('auth-tab-signin')).toBeVisible()
})

test('Account shows the child profiles and the profile detail on one page', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await openChildProfile(page)

  await page.goto('/account')

  // No segments any more: the child list and the account detail sit together.
  await expect(page.getByRole('button', { name: '+ Add a child' })).toBeVisible()
  await expect(page.getByText('Open Web Dashboard')).toBeVisible()
})

test('the tab bar reaches every tab', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())

  for (const [label, path] of [
    ['Guides', '/guides'],
    ['Toys', '/toy-library'],
    ['Inbox', '/inbox'],
    ['Me', '/me'],
  ] as const) {
    await page.getByText(label, { exact: true }).first().click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
  }
})
