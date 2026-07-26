import { test, expect } from '@playwright/test'
import { signIn, createAdmin } from '../helpers'

test('the admin dashboard links to both management pages', async ({ page }) => {
  const admin = await createAdmin()
  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')

  await expect(page.getByRole('heading', { name: 'Admin dashboard' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Contributors/ })).toHaveAttribute(
    'href',
    '/admin/contributors'
  )
  await expect(page.getByRole('link', { name: /Tutorials awaiting review/ })).toHaveAttribute(
    'href',
    '/admin/review'
  )
})
