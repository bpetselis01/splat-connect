import { test, expect } from '@playwright/test'
import { signIn, createContributor, acceptTerms, deleteUser } from './helpers'

/**
 * A miss must keep the chrome of wherever it happened, so there is still a way
 * out. Before app/not-found.tsx existed, notFound() fell through to Next's
 * built-in page, which does not use the root layout: /dashboard/child/[id] and
 * /dashboard/exchanges/[id] rendered with no rail AND no header.
 */
const MISSING = '00000000-0000-4000-8000-000000000000'

test('a miss on a public route keeps the header', async ({ page }) => {
  const res = await page.goto('/definitely-not-a-real-page')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: /couldn't find that page/i })).toBeVisible()
  await expect(page.locator('header')).toBeVisible()
})

test('a miss inside the account section keeps the rail', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    // Two routes, because they lost their chrome differently: exchanges called
    // notFound() before anything was flushed, child after.
    for (const url of [`/dashboard/child/${MISSING}`, `/dashboard/exchanges/${MISSING}`]) {
      const res = await page.goto(url)
      expect(res?.status()).toBe(404)
      await expect(page.getByRole('heading', { name: /couldn't find that page/i })).toBeVisible()
      await expect(page.locator('.shell-rail')).toBeVisible()
    }
  } finally {
    await deleteUser(contributor.id)
  }
})
