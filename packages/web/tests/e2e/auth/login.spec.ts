import { test, expect } from '@playwright/test'
import { signIn, createContributor } from '../helpers'

test('an approved contributor signs in and lands on the dashboard', async ({ page }) => {
  await signIn(page, 'contributor@splat-test.local', 'Test1234!')
  await page.waitForURL('**/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

test('an admin signs in and lands on the admin dashboard', async ({ page }) => {
  await signIn(page, 'admin@splat-test.local', 'Test1234!')
  await page.waitForURL('**/admin')
})

test('an unapproved contributor signs in and is redirected to /pending', async ({ page }) => {
  // Throwaway account, not the seeded pending@splat-test.local: Task 8
  // (admin/contributors.spec.ts, which runs first alphabetically) approves
  // that seeded row, so a test asserting "still unapproved" can't rely on it.
  const { email, password } = await createContributor(false)
  await signIn(page, email, password)
  await page.waitForURL('**/pending')
  await expect(page.getByRole('heading', { name: 'Application pending' })).toBeVisible()
})

test('an invalid password shows an error and stays on /login', async ({ page }) => {
  await signIn(page, 'contributor@splat-test.local', 'wrong-password')
  await expect(page.getByText('Invalid login credentials')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})
