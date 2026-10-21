import { test, expect } from '@playwright/test'
import { signUpNewAccount, uniqueSignupEmail, openChildProfile, selectPill } from './helpers'

// The child profile is one page (components/profile/child-editor-home.tsx):
// the four child questions (128) and the Good to know notes, autosaved. Replaces the
// ability / everyday-needs / customisation specs, whose screens are gone.

test('Z07 the four questions and the notes persist across a reload', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await openChildProfile(page)

  await selectPill(page, 'Seeing')
  await selectPill(page, 'One hand is enough')
  await selectPill(page, 'Light')
  await selectPill(page, 'Pretend play')
  await selectPill(page, 'Quiet toys only')
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()

  await page.reload()
  for (const name of ['Seeing', 'One hand is enough', 'Light', 'Pretend play', 'Quiet toys only']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-selected', 'true')
  }
})

test('Z07 pressing a chosen answer again clears it', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await openChildProfile(page)

  await selectPill(page, 'Eyes')
  await page.getByRole('button', { name: 'Eyes', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Eyes', exact: true })).toHaveAttribute('aria-selected', 'false')
  await page.waitForTimeout(1000)

  await page.reload()
  await expect(page.getByRole('button', { name: 'Eyes', exact: true })).toHaveAttribute('aria-selected', 'false')
})

test('Z09 the wizard skips to the guides without creating a profile', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await page.goto('/child')
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await page.getByRole('button', { name: 'See the matches' }).click()
  await expect(page).toHaveURL(/\/guides/)

  await page.goto('/account')
  await expect(page.getByText(/No child profiles yet/)).toBeVisible()
})
