import { test, expect } from '@playwright/test'
import { PENDING } from '@splat-connect/types'

// Every item in the pending registry (packages/types/src/pending.ts) that a
// PendingButton links to has a page; an unknown id gets a generic one.
// Read from the registry rather than named here: a named id broke the day it
// shipped and left the registry, and the fallback page then matched instead.
const [id, item] = Object.entries(PENDING).find(([, p]) => !('shipped' in p && p.shipped))!

test('a registry item has a Not built yet page', async ({ page }) => {
  await page.goto(`/not-built/${id}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(item.title)
  await expect(page.getByText(item.blurb)).toBeVisible()
})

test('an unknown id falls back rather than failing', async ({ page }) => {
  await page.goto('/not-built/nope')
  await expect(page.getByText("This part of SPLAT Connect isn't ready yet.")).toBeVisible()
})
