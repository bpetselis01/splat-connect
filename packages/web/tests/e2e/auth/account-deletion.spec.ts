import { test, expect } from '@playwright/test'
import { acceptTerms, adminClient, createContributor, latestCode, signIn } from '../helpers'

// Spec B on the web: the public page Play links to, and deleting an account
// with the real code from local Supabase's mail catcher.
test('WA22 the public page explains deletion; Sign in to delete leads to sign-in and Contact us to /contact', async ({ page }) => {
  await page.goto('/delete-account')
  await expect(page.getByRole('heading', { name: 'Delete your SPLAT Connect account' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact')

  await page.getByRole('link', { name: 'Sign in to delete' }).click()
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fprofile%2Fdelete$/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('WD14 WD18 WD19 WD20 a member deletes their account from Account with the emailed code', async ({ page }) => {
  const { id, email, password } = await createContributor()
  await acceptTerms(id)
  await signIn(page, email, password)

  await page.goto('/dashboard/profile')
  await page.getByRole('link', { name: 'Delete account' }).click()
  await expect(page.getByText('Deleted now')).toBeVisible()
  await page.getByLabel('Type DELETE to continue').fill('DELETE')
  const sent = Date.now() - 1000
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await page.getByLabel('6-digit code').fill(await latestCode(email, sent))
  await page.getByRole('button', { name: 'Delete my account' }).click()
  await expect(page.getByText('Your account is deleted')).toBeVisible()

  const { data } = await adminClient().auth.admin.getUserById(id)
  expect(data.user).toBeNull()

  await page.getByTestId('deleted-done').click()
  await expect(page).toHaveURL('/')
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('WD18 WD19 a wrong code says so and the account stays, and Email me a code waits for the word DELETE', async ({ page }) => {
  const { id, email, password } = await createContributor()
  await acceptTerms(id)
  await signIn(page, email, password)

  await page.goto('/dashboard/profile/delete')
  const send = page.getByRole('button', { name: 'Email me a code' })
  await expect(send).toBeDisabled()
  await page.getByLabel('Type DELETE to continue').fill('delete')
  await expect(send).toBeDisabled()
  await page.getByLabel('Type DELETE to continue').fill('DELETE')
  await expect(send).toBeEnabled()
  const sent = Date.now() - 1000
  await send.click()
  const real = await latestCode(email, sent)
  const wrong = real === '000000' ? '111111' : '000000'
  await page.getByLabel('6-digit code').fill(wrong)
  await page.getByRole('button', { name: 'Delete my account' }).click()

  await expect(page.locator('p[role="alert"]')).toHaveText("That code didn't work. Check the latest email, or send a new one.")
  await expect(page.getByLabel('6-digit code')).toHaveValue('')
  await expect(page.getByText('Your account is deleted')).toHaveCount(0)
  const { data } = await adminClient().auth.admin.getUserById(id)
  expect(data.user?.email).toBe(email)
  const { data: profile } = await adminClient().from('profiles').select('id').eq('id', id).single()
  expect(profile!.id).toBe(id)

  await page.getByRole('link', { name: 'Keep my account' }).click()
  await expect(page).toHaveURL('/dashboard/profile')
  await adminClient().auth.admin.deleteUser(id)
})
