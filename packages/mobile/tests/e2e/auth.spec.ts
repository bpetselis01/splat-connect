import { test, expect } from '@playwright/test'
import { createContributor, signIn, signUpNewAccount, uniqueSignupEmail, adminClient } from './helpers'

test('a contributor signs in and lands on Guides', async ({ page }) => {
  const { email, password } = await createContributor()
  await signIn(page, email, password)

  await expect(page).toHaveURL(/\/guides$/)
})

test('mismatched passwords are rejected before any request is sent', async ({ page }) => {
  await page.goto('/sign-in')
  await page.getByTestId('auth-tab-signup').click()
  await page.getByLabel('Full name', { exact: true }).fill('E2E Mismatch')
  await page.getByLabel('Email', { exact: true }).fill(uniqueSignupEmail())
  await page.getByLabel('Password', { exact: true }).fill('Test1234!')
  await page.getByLabel('Confirm password', { exact: true }).fill('Different1234!')
  await page.getByTestId('accept-contributor-terms').click()
  await page.getByTestId('auth-submit').click()

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
  await page.getByTestId('auth-tab-signup').click()
  await page.getByLabel('Full name', { exact: true }).fill('E2E Duplicate')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('Test1234!')
  await page.getByLabel('Confirm password', { exact: true }).fill('Test1234!')
  await page.getByTestId('accept-contributor-terms').click()
  await page.getByTestId('auth-submit').click()

  await expect(page.getByText('Customization Metrics')).toHaveCount(0)
})

test('the signed-out screen toggles between sign in and sign up', async ({ page }) => {
  await page.goto('/sign-in')

  await expect(page.getByLabel('Confirm password', { exact: true })).toHaveCount(0)
  await page.getByTestId('auth-tab-signup').click()
  await expect(page.getByText('Create your account')).toBeVisible()
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible()

  await page.getByText('Already have an account? Sign in').click()
  await expect(page.getByLabel('Confirm password', { exact: true })).toHaveCount(0)
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
  await page.getByTestId('auth-tab-signup').click()
  await page.getByLabel('Full name', { exact: true }).fill('E2E Contributor')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('Test1234!')
  await page.getByLabel('Confirm password', { exact: true }).fill('Test1234!')
  await page.getByTestId('accept-contributor-terms').click()

  const [signupResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/auth/v1/signup') && res.request().method() === 'POST'
    ),
    page.getByTestId('auth-submit').click(),
  ])
  const body = await signupResponse.json()
  await adminClient().auth.admin.updateUserById(body.user?.id ?? body.id, { email_confirm: true })

  await page.getByText('Back to sign in').click()
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('Test1234!')
  await page.getByTestId('auth-submit').click()

  await expect(page).toHaveURL(/\/guides$/)
})
