import { test, expect } from '@playwright/test'
import { signUpParent, uniqueParentEmail } from './helpers'

test('the age field autosaves and survives a reload', async ({ page }) => {
  await signUpParent(page, uniqueParentEmail())
  await page.getByPlaceholder('Age').fill('6')
  await page.waitForTimeout(1000) // debounced autosave → PUT
  await page.reload()
  await expect(page.getByPlaceholder('Age')).toHaveValue('6')
})

test('signing out returns to the login form', async ({ page }) => {
  await signUpParent(page, uniqueParentEmail())
  await page.getByText('Sign Out').click()
  await expect(page.getByText('Welcome Back')).toBeVisible()
  await expect(page.getByText('Create an account')).toBeVisible()
})
