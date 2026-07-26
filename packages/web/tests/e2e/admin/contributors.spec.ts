import { test, expect } from '@playwright/test'
import { signIn, createAdmin, createContributor } from '../helpers'

test('an admin deletes a contributor account', async ({ page }) => {
  const admin = await createAdmin()
  const victim = await createContributor()

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')

  await page.goto('/admin/contributors')
  await expect(page.getByText(victim.email)).toBeVisible()

  const row = page.getByTestId('contributor-row').filter({ hasText: victim.email })
  await row.getByRole('button', { name: 'Delete' }).click()
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(victim.email)).toHaveCount(0)
})

test('the contributors list renders name, email and joined date', async ({ page }) => {
  const admin = await createAdmin()
  const contributor = await createContributor()

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')
  await page.goto('/admin/contributors')

  const row = page.getByTestId('contributor-row').filter({ hasText: contributor.email })
  await expect(row).toContainText(contributor.name)
  await expect(row).toContainText(contributor.email)
  await expect(row).toContainText('Joined')
})
