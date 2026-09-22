import { test, expect } from '@playwright/test'
import { signUpNewAccount, uniqueSignupEmail } from './helpers'

test('the Me tab is the hub: every group, a row opens its screen, Explore is at the bottom', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await page.goto('/guides')
  await page.getByRole('tab', { name: 'Me' }).click()
  await expect(page).toHaveURL(/\/me$/)
  for (const h of ['Add a tutorial', 'Exchange a toy', 'Give us a challenge', 'Account', 'Explore']) await expect(page.getByText(h).first()).toBeVisible()

  await page.getByRole('button', { name: 'My toys' }).click()
  await expect(page).toHaveURL(/\/toys$/)
  // The Me tab stays mounted under the pushed screen, so its row label is
  // still in the DOM; the heading is the proof the screen opened.
  await expect(page.getByRole('heading', { name: 'My toys' })).toBeVisible()

  await page.goto('/me')
  await page.getByRole('button', { name: 'Learn' }).click()
  await expect(page).toHaveURL(/\/explore\/learn$/)
})
