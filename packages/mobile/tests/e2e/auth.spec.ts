import { test, expect } from '@playwright/test'
import {
  adminClient,
  createContributor,
  enterEmailedCode,
  latestCode,
  signIn,
  signUpNewAccount,
  uniqueSignupEmail,
} from './helpers'

// The sign-in flow of docs/superpowers/specs/2026-09-30-mobile-sign-in-design.md,
// against local Supabase. Codes are read out of Mailpit, not faked.

test('A05 a contributor signs in with a password and lands on Guides', async ({ page }) => {
  const { email, password } = await createContributor()
  await signIn(page, email, password)
  await expect(page).toHaveURL(/\/home$/)
})

test('A01 A02 Welcome opens both doors', async ({ page }) => {
  await page.goto('/welcome')
  await page.getByTestId('welcome-get-started').click()
  await expect(page.getByText('Create your account')).toBeVisible()
  await page.getByText('Sign in', { exact: true }).click()
  await expect(page.getByText('Welcome back')).toBeVisible()
})

test('a wrong password keeps the email and says so', async ({ page }) => {
  const { email } = await createContributor()
  await signIn(page, email, 'wrong-password')
  await expect(page.getByText("That email and password don't match.")).toBeVisible()
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email)
})

test('A04 A07 a new email + password account is confirmed by its code and lands on Guides', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
})

test('signing up with a registered email offers to sign in instead', async ({ page }) => {
  const { email } = await createContributor()
  await page.goto('/create-account')
  await page.getByLabel('Your name', { exact: true }).fill('E2E Duplicate')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('Test1234!')
  await page.getByTestId('accept-contributor-terms').click()
  await page.getByTestId('auth-submit').click()

  await expect(page.getByText('That email already has an account.')).toBeVisible()
  await page.getByText(`Sign in as ${email}`).click()
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email)
})

test('A06 A07 an emailed code signs an existing account in, from the code screen with the keyboard up', async ({ page }) => {
  const { email } = await createContributor()
  await page.goto('/sign-in')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByTestId('email-code').click()
  await expect(page.getByText('Sign in with a code')).toBeVisible()
  await expect(page.getByLabel('Email', { exact: true }).last()).toHaveValue(email)
  await expect(page.getByLabel('Email', { exact: true }).last()).toBeFocused()
  const sent = Date.now() - 1000
  await page.getByRole('button', { name: 'Send code' }).click()
  await enterEmailedCode(page, email, sent)
  await expect(page).toHaveURL(/\/home$/)
})

test('the code screen names an empty or malformed email before sending anything', async ({ page }) => {
  await page.goto('/code-sign-in')
  await page.getByRole('button', { name: 'Send code' }).click()
  await expect(page.getByText('Add your email.')).toBeVisible()
  await page.getByLabel('Email', { exact: true }).fill('not-an-email')
  await page.getByRole('button', { name: 'Send code' }).click()
  await expect(page.getByText("That email address doesn't look right.")).toBeVisible()
})

test('an emailed code never creates an account', async ({ page }) => {
  await page.goto('/code-sign-in')
  await page.getByLabel('Email', { exact: true }).fill(uniqueSignupEmail())
  await page.getByRole('button', { name: 'Send code' }).click()
  await expect(page.getByText('No account uses that email.')).toBeVisible()
})

test('A08 Wrong email? Change it returns to the code screen with the email', async ({ page }) => {
  const { email } = await createContributor()
  await page.goto('/code-sign-in')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Send code' }).click()
  await expect(page.getByText('Check your email')).toBeVisible()
  await page.getByText('Wrong email? Change it').click()
  await expect(page.getByLabel('Email', { exact: true }).last()).toHaveValue(email)
})

test('A09 A10 forgot password resets it in the app, and the new one works', async ({ page }) => {
  const { email } = await createContributor()
  await page.goto('/sign-in')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByTestId('forgot-password').click()
  const sent = Date.now() - 1000
  // By name, not testID: on web the stack keeps Sign in mounted underneath,
  // so its auth-submit is still in the DOM.
  await page.getByRole('button', { name: 'Send code' }).click()

  await expect(page.getByText('Choose a new password')).toBeVisible()
  await page.getByTestId('code-input').last().fill(await latestCode(email, sent))
  await page.getByLabel('New password', { exact: true }).fill('Brand-new-9')
  await page.getByRole('button', { name: 'Save and sign in' }).click()
  await expect(page).toHaveURL(/\/home$/)

  const { error } = await adminClient().auth.signInWithPassword({ email, password: 'Brand-new-9' })
  expect(error).toBeNull()
})

test('A11 an account that never accepted the terms meets the gate first', async ({ page }) => {
  const email = uniqueSignupEmail()
  const { error } = await adminClient().auth.admin.createUser({ email, password: 'Test1234!', email_confirm: true })
  expect(error).toBeNull()
  await signIn(page, email, 'Test1234!')

  await expect(page).toHaveURL(/\/terms$/)
  await page.getByLabel('Your name', { exact: true }).fill('Gate Tester')
  await page.getByTestId('accept-contributor-terms').click()
  await page.getByTestId('accept-terms').click()
  await expect(page).toHaveURL(/\/home$/)
})

test('Z04 the account view says how you sign in, and signs out to Welcome', async ({ page }) => {
  const { email, password } = await createContributor()
  await signIn(page, email, password)
  await expect(page).toHaveURL(/\/home$/)
  await page.goto('/account')

  await expect(page.getByText(email, { exact: true })).toBeVisible()
  await expect(page.getByText('Signed in with email')).toBeVisible()
  await page.getByText('Sign Out').click()
  await expect(page).toHaveURL(/\/welcome$/)
})

test('A03 A13 a sign-in provider that is not switched on opens Not built yet', async ({ page }) => {
  await page.goto('/sign-in')
  await page.getByTestId('google-sign-in').click()
  await expect(page.getByText('Not built yet')).toBeVisible()
  await expect(page.getByText('Continue with Google').last()).toBeVisible()
  await page.getByTestId('not-built-back').click()
  await expect(page.getByText('Welcome back')).toBeVisible()
})
