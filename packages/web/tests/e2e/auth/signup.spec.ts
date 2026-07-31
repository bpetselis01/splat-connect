import { test, expect } from '@playwright/test'
import { uniqueContributorEmail, createContributor } from '../helpers'

async function acceptTermsViaDialog(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /read and accept/i }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /^I accept/i }).click()
}

test('a new contributor signs up and is told to check their email', async ({ page }) => {
  const email = uniqueContributorEmail()
  await page.goto('/signup')
  await page.locator('#name').fill('E2E Contributor')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill('Test1234!')
  await page.locator('#confirm-password').fill('Test1234!')
  await acceptTermsViaDialog(page)
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()
})

test('a mismatched confirm-password blocks submission', async ({ page }) => {
  await page.goto('/signup')
  await page.locator('#name').fill('E2E Contributor')
  await page.locator('#email').fill(uniqueContributorEmail())
  await page.locator('#password').fill('Test1234!')
  await page.locator('#confirm-password').fill('Different1!')
  await acceptTermsViaDialog(page)
  await page.getByRole('button', { name: 'Create account' }).click()

  // Filtered to alerts with content — Next's empty route announcer is also role=alert.
  await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveText(
    /passwords do not match/i
  )
  await expect(page.getByRole('heading', { name: 'Check your email' })).toHaveCount(0)
})

test('the terms dialog preserves already-typed fields on close', async ({ page }) => {
  await page.goto('/signup')
  await page.locator('#name').fill('Keeps Typing')
  await page.locator('#email').fill('keeps-typing@example.com')

  await page.getByRole('button', { name: /read and accept/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: /reject/i }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  await expect(page.locator('#name')).toHaveValue('Keeps Typing')
  await expect(page.locator('#email')).toHaveValue('keeps-typing@example.com')
  await expect(page.getByRole('button', { name: 'Create account' })).toBeDisabled()
})

test('the terms dialog: a backdrop click closes it without accepting', async ({ page }) => {
  await page.goto('/signup')
  await page.getByRole('button', { name: /read and accept/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  // A click on a modal <dialog>'s ::backdrop is attributed to the <dialog>
  // element itself — an absolute corner coordinate lands outside the
  // centered card, on the backdrop.
  await page.mouse.click(5, 5)

  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('button', { name: /read and accept/i })).toBeVisible()
})

test('the terms dialog: Escape closes it without accepting', async ({ page }) => {
  await page.goto('/signup')
  await page.getByRole('button', { name: /read and accept/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.keyboard.press('Escape')

  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('button', { name: /read and accept/i })).toBeVisible()
})

test('an already-registered email shows the error', async ({ page }) => {
  const existing = await createContributor()

  await page.goto('/signup')
  await page.locator('#name').fill('Duplicate Person')
  await page.locator('#email').fill(existing.email)
  await page.locator('#password').fill('Test1234!')
  await page.locator('#confirm-password').fill('Test1234!')
  await acceptTermsViaDialog(page)
  await page.getByRole('button', { name: 'Create account' }).click()

  // Filtered to alerts with content — Next's empty route announcer is also role=alert.
  await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toHaveCount(0)
})

test('a password under six characters is not accepted', async ({ page }) => {
  await page.goto('/signup')
  await page.locator('#name').fill('Short Password')
  await page.locator('#email').fill(uniqueContributorEmail())
  await page.locator('#password').fill('12345')
  await page.locator('#confirm-password').fill('12345')
  await acceptTermsViaDialog(page)
  await page.getByRole('button', { name: 'Create account' }).click()

  // minLength blocks submission client-side, so the confirmation never renders.
  await expect(page.getByRole('heading', { name: 'Check your email' })).toHaveCount(0)
})
