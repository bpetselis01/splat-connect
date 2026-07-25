import { test, expect } from '@playwright/test'
import { signIn } from '../helpers'

test('an admin deletes a contributor account', async ({ page }) => {
  // WHY reusing the seeded pending@splat-test.local row instead of a
  // throwaway: this is the only spec that mutates it, and it runs first
  // (admin/ sorts before auth/, contributor/, public/ alphabetically).
  await signIn(page, 'admin@splat-test.local', 'Test1234!')
  await page.waitForURL('**/admin')

  await page.goto('/admin/contributors')
  await expect(page.getByText('pending@splat-test.local')).toBeVisible()

  const row = page.locator('div.card', { hasText: 'pending@splat-test.local' })
  await row.getByRole('button', { name: 'Delete' }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('pending@splat-test.local')).not.toBeVisible()
})
