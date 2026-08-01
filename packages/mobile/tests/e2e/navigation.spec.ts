import { test, expect } from '@playwright/test'
import { signUpNewAccount, uniqueSignupEmail } from './helpers'

test('a signed-out visitor lands on the profile auth screen', async ({ page }) => {
  await page.goto('/profile')

  await expect(page.getByText('Sign In', { exact: true }).first()).toBeVisible()
  await expect(
    page.getByText("Sign in to save your child's profile and get tutorials matched to them.")
  ).toBeVisible()
})

test('the selected profile segment persists across a re-visit', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  // signUpNewAccount leaves Child Profile selected — re-navigating to the
  // tab should not silently reset it back to Account.

  await page.goto('/profile')

  await expect(page.getByText('Customization Metrics')).toBeVisible()
  await expect(page.getByText('Ability Profile')).toBeVisible()
})

test('the tab bar reaches every tab', async ({ page }) => {
  await page.goto('/home')

  for (const [label, path] of [
    ['Profile', '/profile'],
    ['Scanner', '/scanner'],
    ['Toy Library', '/toy-library'],
    ['3D Print', '/print'],
    ['Home', '/home'],
  ] as const) {
    await page.getByText(label, { exact: true }).first().click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
  }
})

test('the three placeholder tabs render their coming-soon content', async ({ page }) => {
  for (const [path, label] of [
    // The ComingSoon `label` differs from the tab title on two of the three.
    ['/scanner', 'Toy Scanner'],
    ['/toy-library', 'Toy Library'],
    ['/print', '3D Print Requests'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByText(`${label} is coming soon.`)).toBeVisible()
  }
})
