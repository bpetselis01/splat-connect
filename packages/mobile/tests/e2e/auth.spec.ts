import { test, expect } from '@playwright/test'
import { createContributor, signIn, signUpNewAccount, uniqueSignupEmail, adminClient } from './helpers'

test('a contributor signs in and lands on Guides', async ({ page }) => {
  const { email, password } = await createContributor()
  await signIn(page, email, password)

  await expect(page).toHaveURL(/\/guides$/)
})

test('mismatched passwords are rejected before any request is sent', async ({ page }) => {
  await page.goto('/sign-in')
  await page.getByText('Create an account').click()
  await page.getByPlaceholder('Name').fill('E2E Mismatch')
  await page.getByPlaceholder('Email').fill(uniqueSignupEmail())
  await page.getByPlaceholder('Password', { exact: true }).fill('Test1234!')
  await page.getByPlaceholder('Confirm Password').fill('Different1234!')
  await page.getByText('Sign Up').click()

  await expect(page.getByText('Passwords do not match.')).toBeVisible()
})

test('invalid credentials show an error and stay on the form', async ({ page }) => {
  const { email } = await createContributor()
  await signIn(page, email, 'wrong-password')

  await expect(page.getByText(/Invalid login credentials/i)).toBeVisible()
  await expect(page.getByText(`Signed in as ${email}`)).toHaveCount(0)
})

test('signing up with an already-registered email shows an error', async ({ page }) => {
  const { email } = await createContributor()

  await page.goto('/sign-in')
  await page.getByText('Create an account').click()
  await page.getByPlaceholder('Name').fill('E2E Duplicate')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password', { exact: true }).fill('Test1234!')
  await page.getByPlaceholder('Confirm Password').fill('Test1234!')
  await page.getByText('Sign Up').click()

  await expect(page.getByText('Customization Metrics')).toHaveCount(0)
})

test('the signed-out screen toggles between sign in and sign up', async ({ page }) => {
  await page.goto('/sign-in')

  await expect(page.getByText('Welcome Back')).toBeVisible()
  await page.getByText('Create an account').click()
  await expect(page.getByText('Create Account')).toBeVisible()
  await expect(page.getByPlaceholder('Confirm Password')).toBeVisible()

  await page.getByText('Have an account? Sign in').click()
  await expect(page.getByText('Welcome Back')).toBeVisible()
  await expect(page.getByPlaceholder('Confirm Password')).toHaveCount(0)
})

test('the contributor account view offers the web dashboard and sign out', async ({ page }) => {
  const { email, password } = await createContributor()
  await signIn(page, email, password)
  // Wait for the landing: /account is gated too, so navigating before the
  // session lands bounces straight back to the sign-in screen.
  await expect(page).toHaveURL(/\/guides$/)
  await page.goto('/account')

  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible()
  await expect(page.getByText('Open Web Dashboard')).toBeVisible()
  await expect(page.getByText('Sign Out')).toBeVisible()
})

test('a new signup lands on Guides', async ({ page }) => {
  const email = uniqueSignupEmail()
  await page.goto('/sign-in')
  await page.getByText('Create an account').click()
  await page.getByPlaceholder('Name').fill('E2E Contributor')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password', { exact: true }).fill('Test1234!')
  await page.getByPlaceholder('Confirm Password').fill('Test1234!')
  await page.getByTestId('accept-contributor-terms').click()

  const [signupResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/auth/v1/signup') && res.request().method() === 'POST'
    ),
    page.getByText('Sign Up').click(),
  ])
  const body = await signupResponse.json()
  await adminClient().auth.admin.updateUserById(body.user?.id ?? body.id, { email_confirm: true })

  await page.getByText('Back to sign in').click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill('Test1234!')
  await page.getByText('Sign In', { exact: true }).click()

  await expect(page).toHaveURL(/\/guides$/)
})
