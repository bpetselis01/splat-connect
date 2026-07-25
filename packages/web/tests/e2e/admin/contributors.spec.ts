import { test, expect } from '@playwright/test'
import { signIn, createAdmin, createContributor } from '../helpers'

test('an admin deletes a contributor account', async ({ page }) => {
  const admin = await createAdmin()
  const victim = await createContributor()

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')

  await page.goto('/admin/contributors')
  await expect(page.getByText(victim.email)).toBeVisible()

  const row = page.locator('div.card', { hasText: victim.email })
  await row.getByRole('button', { name: 'Delete' }).click()
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(victim.email)).toHaveCount(0)
})
