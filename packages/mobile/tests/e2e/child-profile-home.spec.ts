import { test, expect } from '@playwright/test'
import { signUpNewAccount, uniqueSignupEmail, openChildProfile } from './helpers'

test('the age field autosaves and survives a reload', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  // Lands inside the new child's editor home, where age now lives.
  await openChildProfile(page)
  await page.getByLabel("Child's age").fill('6')
  await page.waitForTimeout(1000) // debounced autosave → PATCH
  await page.reload()
  // The editor route carries the child id, so a reload rebuilds this child.
  await expect(page.getByLabel("Child's age")).toHaveValue('6')
})

test('a child appears on the family list with its summary line', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await openChildProfile(page)
  await page.getByLabel("Child's name").fill('Maya')
  await page.getByLabel("Child's age").fill('5')
  await page.waitForTimeout(1000)

  // Back on the segment, the list names the child and its summary.
  await page.goto('/account')
  await page.getByText('Child Profile').click()
  await expect(page.getByRole('button', { name: 'Maya' })).toBeVisible()
  await expect(page.getByText('Age 5')).toBeVisible()
})

test('signing out returns to the login form', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  // Sign Out lives on the Account segment, which is the one a fresh account opens on.
  await page.goto('/account')
  await page.getByText('Sign Out').click()
  await expect(page.getByTestId('auth-tab-signin')).toBeVisible()
  await expect(page.getByTestId('auth-tab-signup')).toBeVisible()
})
