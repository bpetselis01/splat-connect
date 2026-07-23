import { test, expect } from '@playwright/test'
import { signIn } from '../helpers'

test('a contributor signs in and lands on the dashboard', async ({ page }) => {
  await signIn(page, 'contributor@splat-test.local', 'Test1234!')
  await page.waitForURL('**/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

test('an admin signs in and lands on the admin dashboard', async ({ page }) => {
  await signIn(page, 'admin@splat-test.local', 'Test1234!')
  await page.waitForURL('**/admin')
})

test('an invalid password shows an error and stays on /login', async ({ page }) => {
  await signIn(page, 'contributor@splat-test.local', 'wrong-password')
  await expect(page.getByText('Invalid login credentials')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})
