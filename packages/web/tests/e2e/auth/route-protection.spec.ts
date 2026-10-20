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
import { signIn, createContributor, createAdmin, acceptTerms, deleteUser } from '../helpers'

test('WA23 an unauthenticated visitor is redirected from /dashboard to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
})

test('WA23 an unauthenticated visitor is redirected from /upload to /login', async ({ page }) => {
  await page.goto('/upload')
  await expect(page).toHaveURL(/\/login$/)
})

test('WA23 an unauthenticated visitor is redirected from /my-tutorials to /login', async ({ page }) => {
  await page.goto('/my-tutorials')
  await expect(page).toHaveURL(/\/login$/)
})

test('WA24 an unauthenticated visitor is redirected from /admin to /login', async ({ page }) => {
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
test('WA23 an unauthenticated visitor is redirected from /notifications to /login', async ({
  page,
}) => {
  await page.goto('/notifications')
  await expect(page).toHaveURL(/\/login$/)
})

test('WA25 a contributor is redirected away from /admin', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  await page.goto('/admin')
  await expect(page).toHaveURL(/localhost:\d+\/$/)
})

test('WA26 an admin can also reach the dashboard', async ({ page }) => {
  const admin = await createAdmin()
  await acceptTerms(admin.id)
  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: /^Welcome back,/ })).toBeVisible()
})

// The gate lists /dashboard, /upload, /organizations and /tutorials/:id/edit; the tests
// below cover the ones the contributor-terms spec does not. No acceptTerms() on purpose.
test('WA27 a member without the terms is sent from /upload to the terms gate, with the path to return to', async ({ page }) => {
  const contributor = await createContributor()
  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL(/\/onboarding\/contributor-terms/)

    await page.goto('/upload?draft=1')
    await expect(page).toHaveURL(/\/onboarding\/contributor-terms\?next=%2Fupload$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Contributor terms' })).toBeVisible()
  } finally {
    await deleteUser(contributor.id)
  }
})

// Q4, recorded as it is: the public directory is behind the terms gate for a signed-in
// member who has not accepted, and open to everyone else.
test('WA28 /organizations sends a member without the terms to the terms gate', async ({ page }) => {
  const contributor = await createContributor()
  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL(/\/onboarding\/contributor-terms/)

    await page.goto('/organizations')
    await expect(page).toHaveURL(/\/onboarding\/contributor-terms\?next=%2Forganizations$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Contributor terms' })).toBeVisible()
  } finally {
    await deleteUser(contributor.id)
  }
})

test('WA28 /organizations stays open to a signed-out visitor', async ({ page }) => {
  await page.goto('/organizations')
  await expect(page).toHaveURL(/\/organizations$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})
