import { test, expect } from '@playwright/test'
import { signUpNewAccount, uniqueSignupEmail, openChildProfile } from './helpers'

test('a signed-out visitor is sent to sign-in from any tab', async ({ page }) => {
  await page.goto('/guides')
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByTestId('auth-tab-signin')).toBeVisible()
})

test('the selected profile segment persists across a re-visit', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await openChildProfile(page)
  // Re-opening Account should not silently reset the segment back to Account.

  await page.goto('/account')

  // The child segment's own furniture is the proof the segment persisted.
  await expect(page.getByRole('button', { name: '+ Add child' })).toBeVisible()
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
