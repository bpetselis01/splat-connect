import { test, expect } from '@playwright/test'
import { signUpNewAccount, uniqueSignupEmail, openChildProfile } from './helpers'

test('the age field autosaves and survives a reload', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await openChildProfile(page)
  await page.getByPlaceholder('Age').fill('6')
  await page.waitForTimeout(1000) // debounced autosave → PUT
  await page.reload()
  // The selected segment persists across the reload (resolveAuthStorage()),
  // so the age field is still the one visible after it.
  await expect(page.getByPlaceholder('Age')).toHaveValue('6')
})

test('signing out returns to the login form', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  // Sign Out lives on the Account segment, which is the one a fresh account opens on.
  await page.goto('/account')
  await page.getByText('Sign Out').click()
  await expect(page.getByText('Welcome Back')).toBeVisible()
  await expect(page.getByText('Create an account')).toBeVisible()
})
