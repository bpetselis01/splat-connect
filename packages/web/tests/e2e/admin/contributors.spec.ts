import { test, expect } from '@playwright/test'
import { signIn } from '../helpers'

test('an admin approves the seeded pending contributor request', async ({ page }) => {
  // WHY reusing the seeded pending@splat-test.local row instead of a
  // throwaway: this is the only spec that mutates it, and it runs first
  // (admin/ sorts before auth/, contributor/, public/ alphabetically).
  await signIn(page, 'admin@splat-test.local', 'Test1234!')
  await page.waitForURL('**/admin')

  await page.goto('/admin/contributors')
  const emailLocator = page.getByText('pending@splat-test.local')
  await expect(emailLocator).toBeVisible()

  const pendingRow = emailLocator.locator('xpath=ancestor::div[@class and contains(@class, "bg-white")]')
  await pendingRow.getByRole('button', { name: 'Approve' }).first().click()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('No pending requests.')).toBeVisible()
})
