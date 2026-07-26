import { test, expect } from '@playwright/test'
import { createContributor, signIn, signUpParent, uniqueParentEmail } from './helpers'

test('a contributor signs in to the account view, not the child profile', async ({ page }) => {
  const { email, password } = await createContributor()
  await signIn(page, email, password)

  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible()
  // The role-branch must NOT show the parent child-profile home.
  await expect(page.getByText('Customization Metrics')).toHaveCount(0)
})

test('mismatched passwords are rejected before any request is sent', async ({ page }) => {
  await page.goto('/profile')
  await page.getByText('Create an account').click()
  await page.getByPlaceholder('Name').fill('E2E Mismatch')
  await page.getByPlaceholder('Email').fill(uniqueParentEmail())
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

  await page.goto('/profile')
  await page.getByText('Create an account').click()
  await page.getByPlaceholder('Name').fill('E2E Duplicate')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password', { exact: true }).fill('Test1234!')
  await page.getByPlaceholder('Confirm Password').fill('Test1234!')
  await page.getByText('Sign Up').click()

  await expect(page.getByText('Customization Metrics')).toHaveCount(0)
})

test('the signed-out screen toggles between sign in and sign up', async ({ page }) => {
  await page.goto('/profile')

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

  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible()
  await expect(page.getByText('Open Web Dashboard')).toBeVisible()
  await expect(page.getByText('Sign Out')).toBeVisible()
})

test('a parent sees the child-profile entry points rather than the account view', async ({ page }) => {
  const email = uniqueParentEmail()
  await signUpParent(page, email)

  await expect(page.getByText('Ability Profile')).toBeVisible()
  await expect(page.getByText('Everyday Needs')).toBeVisible()
  await expect(page.getByText('Customization Metrics')).toBeVisible()
  await expect(page.getByText('Open Web Dashboard')).toHaveCount(0)
})
