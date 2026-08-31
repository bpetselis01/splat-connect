import { test, expect } from '@playwright/test'
import { signUpNewAccount, uniqueSignupEmail } from './helpers'

test('the centre button opens the popover, and every escape closes it', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await page.goto('/guides')
  const button = page.getByRole('button', { name: 'Open My SPLAT' })

  await button.click()
  await expect(page.getByText('All of My SPLAT')).toBeVisible()
  await button.click()
  await expect(page.getByText('All of My SPLAT')).toBeHidden()

  await button.click()
  await page.getByLabel('Close My SPLAT').click({ position: { x: 10, y: 10 } })
  await expect(page.getByText('All of My SPLAT')).toBeHidden()

  await button.click()
  await page.getByRole('tab', { name: 'Explore' }).click()
  await expect(page.getByText('All of My SPLAT')).toBeHidden()
  await expect(page).toHaveURL(/\/explore$/)
})

test('a tile opens its screen over the current tab, and the hub lists every group', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await page.goto('/guides')
  await page.getByRole('button', { name: 'Open My SPLAT' }).click()
  await page.getByRole('button', { name: 'My toys' }).click()
  await expect(page).toHaveURL(/\/toys$/)
  await expect(page.getByText('My toys').first()).toBeVisible()

  await page.goto('/my-splat')
  for (const h of ['Add a tutorial', 'Exchange a toy', 'Give us a challenge', 'Account']) await expect(page.getByText(h).first()).toBeVisible()
  await page.getByRole('button', { name: 'Account' }).click()
  await expect(page).toHaveURL(/\/account$/)
})
