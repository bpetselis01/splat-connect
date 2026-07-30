import { test, expect } from '@playwright/test'
import { signIn, createContributor, createAdmin, createParent, acceptTerms } from '../helpers'

test('a contributor signs in and lands on the dashboard', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

test('an admin signs in and lands on the admin dashboard', async ({ page }) => {
  const admin = await createAdmin()
  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')
})

test('an invalid password shows an error and stays on /login', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, 'wrong-password')
  await expect(page.getByText('Invalid login credentials')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test('a parent-role account lands on the dashboard', async ({ page }) => {
  const parent = await createParent()
  await acceptTerms(parent.id)
  await signIn(page, parent.email, parent.password)

  await page.waitForURL('**/dashboard')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})
