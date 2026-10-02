import { test, expect } from '@playwright/test'
import { adminClient, createContributor, latestCode, signIn } from './helpers'

// Spec B end to end: the delete screen, the real emailed code, DELETE /api/me,
// and an account that no longer exists afterwards.
test('a member deletes their own account with the emailed code', async ({ page }) => {
  const { id, email, password } = await createContributor()
  await signIn(page, email, password)
  await expect(page).toHaveURL(/\/home$/)

  await page.goto('/account')
  await page.getByText('Delete account').click()
  await expect(page.getByText('Deleted now')).toBeVisible()
  await page.getByLabel('Type DELETE to continue', { exact: true }).fill('DELETE')
  const sent = Date.now() - 1000
  await page.getByTestId('delete-send-code').click()
  await expect(page.getByText('Enter the code to delete')).toBeVisible()
  await page.getByTestId('code-input').last().fill(await latestCode(email, sent))
  await expect(page.getByText('Your account is deleted')).toBeVisible()
  await page.getByTestId('deleted-done').click()
  await expect(page).toHaveURL(/\/welcome$/)

  const { data } = await adminClient().auth.admin.getUserById(id)
  expect(data.user).toBeNull()
})
