// The redirects asserted here come from packages/web/middleware.ts:
//   contributorRoutes = ['/upload', '/my-tutorials', '/dashboard']  → /login when signed out
//   adminRoutes       = ['/admin']                                  → / when not an admin
// app/dashboard/page.tsx no longer has a page-level role guard: every signed-in
// account (parent, contributor, admin) shares one dashboard. A permission hole in
// the signed-out cases above would not throw — it would just serve the page — so
// nothing else in the suite would notice one.
import { test, expect } from '@playwright/test'
import { signIn, createContributor, createAdmin } from '../helpers'

test('an unauthenticated visitor is redirected from /dashboard to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
})

test('an unauthenticated visitor is redirected from /upload to /login', async ({ page }) => {
  await page.goto('/upload')
  await expect(page).toHaveURL(/\/login$/)
})

test('an unauthenticated visitor is redirected from /my-tutorials to /login', async ({ page }) => {
  await page.goto('/my-tutorials')
  await expect(page).toHaveURL(/\/login$/)
})

test('an unauthenticated visitor is redirected from /admin to /login', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login$/)
})

test('a contributor is redirected away from /admin', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  await page.goto('/admin')
  await expect(page).toHaveURL(/localhost:\d+\/$/)
})

test('an admin can also reach the dashboard', async ({ page }) => {
  const admin = await createAdmin()
  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/dashboard$/)
})
