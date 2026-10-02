import { test, expect } from '@playwright/test'

// Every item in the pending registry (packages/types/src/pending.ts) that a
// PendingButton links to has a page; an unknown id gets a generic one.
test('a registry item has a Not built yet page', async ({ page }) => {
  await page.goto('/not-built/impact-map')
  await expect(page.getByText('Not built yet')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Deliveries map')
})

test('an unknown id falls back rather than failing', async ({ page }) => {
  await page.goto('/not-built/nope')
  await expect(page.getByText("This part of SPLAT Connect isn't ready yet.")).toBeVisible()
})
