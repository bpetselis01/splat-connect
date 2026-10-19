import { test, expect } from '@playwright/test'
import { acceptTerms, createContributor, deleteUser, signIn } from '../helpers'

test('WX03 a member with no exchanges sees the empty state and is sent on to the toy library', async ({ page }) => {
  const member = await createContributor()
  await acceptTerms(member.id)
  try {
    await signIn(page, member.email, member.password)
    await page.goto('/dashboard/exchanges')
    await expect(page.getByText('No donation or exchange requests yet.')).toBeVisible()
    await expect(page.getByText('waiting on you')).toHaveCount(0)
    await page.getByRole('link', { name: 'Browse the toy library' }).click()
    await expect(page).toHaveURL(/\/toy-library$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  } finally {
    await deleteUser(member.id)
  }
})
