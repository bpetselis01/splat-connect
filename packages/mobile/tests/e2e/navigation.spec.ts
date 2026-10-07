// journeys: A14 H03 H07
import { test, expect } from '@playwright/test'
import { signUpNewAccount, uniqueSignupEmail, openChildProfile } from './helpers'

test('a signed-out visitor is sent to Welcome from any tab', async ({ page }) => {
  await page.goto('/guides')
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByTestId('welcome-sign-in')).toBeVisible()
})

test('Account shows the child profiles and the profile detail on one page', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await openChildProfile(page)

  await page.goto('/account')

  // No segments any more: the child list and the account detail sit together.
  await expect(page.getByRole('button', { name: '+ Add a child' })).toBeVisible()
  await expect(page.getByText('Open Web Dashboard')).toBeVisible()
})

test('the tab bar reaches every tab', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())

  for (const [label, path] of [
    ['Home', '/home'],
    ['Map', '/map'],
    ['Inbox', '/inbox'],
    ['Me', '/me'],
  ] as const) {
    await page.getByRole('tab', { name: new RegExp(`^${label}`) }).click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
  }
  await expect(page.getByRole('tab')).toHaveCount(4)
})

test('Guides and Toys are default shortcuts on Home, and the bar stays to take you back', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await page.getByRole('tab', { name: 'Home' }).click()

  for (const [shortcut, path] of [
    ['Guides', '/guides'],
    ['Toys', '/toy-library'],
  ] as const) {
    await page.getByRole('button', { name: shortcut, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    // react-native-web does not render aria-selected on the tab; the lit state is unit-tested.
    await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible()
    await page.getByRole('tab', { name: 'Home' }).click()
    await expect(page).toHaveURL(/\/home$/)
  }
})
