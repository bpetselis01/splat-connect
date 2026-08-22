import { test, expect } from '@playwright/test'

test('the listing is a real page, not a placeholder', async ({ page }) => {
  await page.goto('/get-involved/design-challenges')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('Not built yet')).toHaveCount(0)
})

test('submitting requires signing in', async ({ page }) => {
  await page.goto('/get-involved/submit-an-idea')
  // Scoped to <main>: the header also carries its own sitewide "Sign in" link
  // on every signed-out page, so an unscoped /sign in/i match hits both and
  // trips Playwright's strict mode — this page's own CTA is what the test
  // means to assert on.
  await expect(page.getByRole('main').getByRole('link', { name: /sign in/i })).toBeVisible()
  await expect(page.getByLabel(/idea name/i)).toHaveCount(0)
})
