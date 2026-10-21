import { test, expect } from '@playwright/test'
import { acceptTerms, createContributor, signIn } from '../helpers'

test('WT40 Start a guide goes to the upload form for a Member and to log in for a visitor; the contributor path opens its page', async ({ page }) => {
  await page.goto('/get-involved/submit-a-tutorial')
  await expect(page.getByRole('heading', { name: 'Submit a guide', level: 1 })).toBeVisible()

  await page.getByRole('link', { name: 'Read the contributor path' }).click()
  await expect(page).toHaveURL(/\/get-involved\/contributors$/)

  // Signed out, /upload sends the visitor to log in.
  await page.goto('/get-involved/submit-a-tutorial')
  await page.getByRole('link', { name: 'Start a guide' }).click()
  await expect(page).toHaveURL(/\/login\?next=%2Fupload$/)

  const member = await createContributor()
  await acceptTerms(member.id)
  await signIn(page, member.email, member.password)
  await page.goto('/get-involved/submit-a-tutorial')
  await page.getByRole('link', { name: 'Start a guide' }).click()
  await expect(page).toHaveURL(/\/upload$/)
  await expect(page.getByRole('heading', { name: 'Add a tutorial' })).toBeVisible()
})
