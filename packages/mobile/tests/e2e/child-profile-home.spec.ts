import { test, expect } from '@playwright/test'
import { signUpNewAccount, uniqueSignupEmail, openChildProfile } from './helpers'

test('Z07 the age field autosaves and survives a reload', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  // Lands inside the new child's editor home, where age now lives.
  await openChildProfile(page)
  await page.getByLabel("Child's age").fill('6')
  await page.waitForTimeout(1000) // debounced autosave → PATCH
  await page.reload()
  // The editor route carries the child id, so a reload rebuilds this child.
  await expect(page.getByLabel("Child's age")).toHaveValue('6')
})

test('Z06 a child appears on the family list with its summary line', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await openChildProfile(page)
  await page.getByLabel("Child's age").fill('5')
  await page.waitForTimeout(1000)

  // Back on Account, the list numbers the child and shows its summary.
  await page.goto('/account')
  await expect(page.getByRole('button', { name: /Child 1/ })).toBeVisible()
  await expect(page.getByText('Age 5')).toBeVisible()
})

test('Z04 signing out returns to Welcome', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  // Sign Out lives on the Account segment, which is the one a fresh account opens on.
  await page.goto('/account')
  await page.getByText('Sign Out').click()
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByTestId('welcome-sign-in')).toBeVisible()
})
