import { test, expect } from '@playwright/test'
import { uniqueContributorEmail } from '../helpers'

test('a new contributor signs up and sees the pending-approval confirmation', async ({ page }) => {
  const email = uniqueContributorEmail()
  await page.goto('/signup')
  await page.locator('#name').fill('E2E Contributor')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill('Test1234!')
  await page.getByRole('button', { name: 'Request access' }).click()

  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible()
})

test('a newly signed-up (unapproved) contributor hitting a protected route is redirected to /pending', async ({ page }) => {
  const email = uniqueContributorEmail()
  await page.goto('/signup')
  await page.locator('#name').fill('E2E Contributor')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill('Test1234!')
  await page.getByRole('button', { name: 'Request access' }).click()
  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible()

  // Local Supabase has email confirmations disabled (supabase/config.toml
  // auth.email.enable_confirmations = false), so signUp() already left a
  // session cookie in this browser context — no separate sign-in needed.
  await page.goto('/upload')
  await page.waitForURL('**/pending')
  await expect(page.getByRole('heading', { name: 'Application pending' })).toBeVisible()
})
