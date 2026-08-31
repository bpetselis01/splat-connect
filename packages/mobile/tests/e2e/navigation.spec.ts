import { test, expect } from '@playwright/test'
import { signUpNewAccount, uniqueSignupEmail, openChildProfile } from './helpers'

test('a signed-out visitor is sent to sign-in from any tab', async ({ page }) => {
  await page.goto('/guides')
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByText('Welcome Back')).toBeVisible()
})

test('the selected profile segment persists across a re-visit', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await openChildProfile(page)
  // Re-opening Account should not silently reset the segment back to Account.

  await page.goto('/account')

  await expect(page.getByText('Customization Metrics')).toBeVisible()
  await expect(page.getByText('Ability Profile')).toBeVisible()
})

test('the tab bar reaches every tab', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())

  for (const [label, path] of [
    ['Guides', '/guides'],
    ['Toy Library', '/toy-library'],
    ['Explore', '/explore'],
    ['Inbox', '/inbox'],
  ] as const) {
    await page.getByText(label, { exact: true }).first().click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
  }
})
