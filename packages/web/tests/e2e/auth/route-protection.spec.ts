// The redirects asserted here come from packages/web/middleware.ts:
//   signedInRoutes = ['/upload', '/dashboard', '/notifications'] → /login when signed out
// (/my-tutorials reaches /dashboard/tutorials through next.config.ts's redirect,
//  so it is covered by the /dashboard prefix rather than listed itself.)
//   adminRoutes       = ['/admin']                                  → / when not an admin
// app/dashboard/page.tsx no longer has a page-level role guard: every signed-in
// account (parent, contributor, admin) shares one dashboard. A permission hole in
// the signed-out cases above would not throw — it would just serve the page — so
// nothing else in the suite would notice one.
import { test, expect } from '@playwright/test'
import { signIn, createContributor, createAdmin, acceptTerms } from '../helpers'

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

// /notifications was the one account route left out of signedInRoutes: both of
// its fetches swallow failure, so a signed-out visitor landed on an empty
// "Notifications" heading under the public header instead of being asked to
// sign in. It is an account page by every other measure — lib/public-nav.ts
// resolves it to the account section and it renders the rail — so it redirects
// like the rest. That also retires the only route where account chrome had to
// be suppressed for a visitor with no session, which is a stronger guarantee
// than asserting the chrome stayed hidden.
test('an unauthenticated visitor is redirected from /notifications to /login', async ({
  page,
}) => {
  await page.goto('/notifications')
  await expect(page).toHaveURL(/\/login$/)
})

test('a contributor is redirected away from /admin', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  await page.goto('/admin')
  await expect(page).toHaveURL(/localhost:\d+\/$/)
})

test('an admin can also reach the dashboard', async ({ page }) => {
  const admin = await createAdmin()
  await acceptTerms(admin.id)
  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'My SPLAT' })).toBeVisible()
})
