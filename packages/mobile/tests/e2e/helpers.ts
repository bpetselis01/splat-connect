import { type Page, expect } from '@playwright/test'

/** Unique parent email per invocation so runs don't collide (CI does `supabase db reset`). */
export function uniqueParentEmail() {
  return `parent-${Date.now()}-${Math.floor(Math.random() * 1e6)}@mobile-e2e.local`
}

/**
 * Sign up a fresh parent through the Profile-tab UI. Local Supabase has
 * email confirmations disabled, so signUp returns a session immediately and
 * the app lands on the child-profile home.
 */
export async function signUpParent(page: Page, email: string) {
  await page.goto('/profile')
  await page.getByText('Create an account').click()
  await page.getByPlaceholder('Name').fill('E2E Parent')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill('Test1234!')
  await page.getByText('Sign Up').click()
  // Role resolves via GET /api/contributors/me → parent → child-profile home.
  await expect(page.getByText('Customization Metrics')).toBeVisible()
}
