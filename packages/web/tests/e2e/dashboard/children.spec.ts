import { test, expect } from '@playwright/test'
import { acceptTerms, createContributor, deleteUser, signIn } from '../helpers'

test('WD12 a Member with no children is offered "Add your first child", which opens the new-child form', async ({ page }) => {
  const m = await createContributor()
  await acceptTerms(m.id)
  try {
    await signIn(page, m.email, m.password)
    await page.goto('/dashboard/profile')
    await expect(page.getByText("You haven't added any child profiles yet.")).toBeVisible()

    await page.getByRole('link', { name: 'Add your first child' }).click()
    await expect(page).toHaveURL('/dashboard/child/new')
    await expect(page.getByRole('heading', { name: 'Add a child' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create profile' })).toBeVisible()

    await page.getByLabel('Age').fill('5')
    await page.getByRole('button', { name: 'Create profile' }).click()
    await expect(page).toHaveURL(/\/dashboard\/child\/[0-9a-f-]{36}$/)

    await page.goto('/dashboard/profile')
    await expect(page.getByRole('link', { name: 'Add another' })).toHaveAttribute('href', '/dashboard/child/new')
    await expect(page.getByRole('link', { name: 'Add your first child' })).toHaveCount(0)
  } finally {
    await deleteUser(m.id)
  }
})
