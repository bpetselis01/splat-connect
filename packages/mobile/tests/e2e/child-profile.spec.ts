import { test, expect } from '@playwright/test'
import { signUpNewAccount, uniqueSignupEmail, openChildProfile, selectPill } from './helpers'

// The child profile is one page (components/profile/child-editor-home.tsx):
// the four switch questions and the everyday needs, autosaved. Replaces the
// ability / everyday-needs / customisation specs, whose screens are gone.

test('switch answers and everyday needs persist across a reload', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await openChildProfile(page)

  await selectPill(page, 'Right')
  await selectPill(page, 'Light')
  await selectPill(page, 'Yes, large')
  await selectPill(page, 'Quiet toys only')
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()

  await page.reload()
  for (const name of ['Right', 'Light', 'Yes, large', 'Quiet toys only']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-selected', 'true')
  }
})

test('pressing a chosen answer again clears it', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await openChildProfile(page)

  await selectPill(page, 'A second')
  await page.getByRole('button', { name: 'A second', exact: true }).click()
  await expect(page.getByRole('button', { name: 'A second', exact: true })).toHaveAttribute('aria-selected', 'false')
  await page.waitForTimeout(1000)

  await page.reload()
  await expect(page.getByRole('button', { name: 'A second', exact: true })).toHaveAttribute('aria-selected', 'false')
})

test('the wizard skips to the guides without creating a profile', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await page.goto('/child')
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await expect(page).toHaveURL(/\/guides/)

  await page.goto('/account')
  await expect(page.getByText(/No child profiles yet/)).toBeVisible()
})
