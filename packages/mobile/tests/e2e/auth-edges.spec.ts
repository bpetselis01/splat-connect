import { test, expect } from '@playwright/test'
import { createContributor, latestCode, signIn, uniqueSignupEmail } from './helpers'

// Edge input and session behaviour around the sign-in flow, against local
// Supabase. Imports helpers only, never components (the e2e suite must load).

async function openCodeScreen(page: import('@playwright/test').Page, email: string) {
  await page.goto('/code-sign-in')
  await page.getByLabel('Email', { exact: true }).fill(email)
  const sent = Date.now() - 1000
  await page.getByRole('button', { name: 'Send code' }).click()
  await expect(page.getByText('Check your email')).toBeVisible()
  return sent
}

test('a pasted code with spaces between its digits signs in', async ({ page }) => {
  const { email } = await createContributor()
  const sent = await openCodeScreen(page, email)
  const code = await latestCode(email, sent)
  await page.getByTestId('code-input').fill(`${code.slice(0, 3)} ${code.slice(3)}`)
  await expect(page).toHaveURL(/\/home$/)
})

test('letters in the code box are dropped, and the digits around them still sign in', async ({ page }) => {
  const { email } = await createContributor()
  const sent = await openCodeScreen(page, email)
  const code = await latestCode(email, sent)
  await page.getByTestId('code-input').fill(`ab${code}`)
  await expect(page).toHaveURL(/\/home$/)
})

test('a wrong code says so and empties the boxes for another try', async ({ page }) => {
  const { email } = await createContributor()
  await openCodeScreen(page, email)
  await page.getByTestId('code-input').fill('000000')
  await expect(page.getByText(/That code didn't work/)).toBeVisible()
  await expect(page.getByTestId('code-input')).toHaveValue('')
})

test('five digits is not enough to be checked', async ({ page }) => {
  const { email } = await createContributor()
  await openCodeScreen(page, email)
  await page.getByTestId('code-input').fill('12345')
  await page.waitForTimeout(500)
  await expect(page.getByText(/That code didn't work/)).toHaveCount(0)
  await expect(page.getByText('Check your email')).toBeVisible()
})

test('the resend link waits out a minute behind a countdown', async ({ page }) => {
  const { email } = await createContributor()
  await openCodeScreen(page, email)
  await expect(page.getByText(/Resend code in 0:\d\d/)).toBeVisible()
  await expect(page.getByTestId('resend-code')).toHaveCount(0)
})

test('the Create button stays off until the terms are ticked, and the return key cannot get round it', async ({ page }) => {
  await page.goto('/create-account')
  await page.getByLabel('Your name', { exact: true }).fill('Return Key')
  await page.getByLabel('Email', { exact: true }).fill(uniqueSignupEmail())
  await page.getByLabel('Password', { exact: true }).fill('Test1234!')
  await expect(page.getByTestId('auth-submit')).toBeDisabled()
  await page.getByLabel('Password', { exact: true }).press('Enter')
  await page.waitForTimeout(500)
  await expect(page.getByText('Check your email')).toHaveCount(0)
})

test('a five-character password is refused on the screen before any request', async ({ page }) => {
  await page.goto('/create-account')
  await page.getByLabel('Your name', { exact: true }).fill('Short Pass')
  await page.getByLabel('Email', { exact: true }).fill(uniqueSignupEmail())
  await page.getByLabel('Password', { exact: true }).fill('12345')
  await page.getByTestId('accept-contributor-terms').click()
  await page.getByTestId('auth-submit').click()
  await expect(page.getByText('Use at least 6 characters for the password.')).toBeVisible()
})

test('signing in with an email nobody registered gets the same sentence as a wrong password', async ({ page }) => {
  await signIn(page, uniqueSignupEmail(), 'Test1234!')
  await expect(page.getByText("That email and password don't match.")).toBeVisible()
})

test('a reset with a too-short new password is refused before the code is spent', async ({ page }) => {
  const { email } = await createContributor()
  await page.goto('/sign-in')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByTestId('forgot-password').click()
  const sent = Date.now() - 1000
  await page.getByRole('button', { name: 'Send code' }).click()
  await expect(page.getByText('Choose a new password')).toBeVisible()
  await page.getByTestId('code-input').last().fill(await latestCode(email, sent))
  await page.getByLabel('New password', { exact: true }).fill('123')
  await page.getByRole('button', { name: 'Save and sign in' }).click()
  await expect(page.getByText('Use at least 6 characters for the password.')).toBeVisible()
  await expect(page).not.toHaveURL(/\/home$/)
})

test('a signed-out visitor following a deep link to a signed-in screen lands on Welcome', async ({ page }) => {
  for (const path of ['/account', '/home', '/child']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/welcome$/)
  }
})

test('a session that disappears from storage sends the next load to Welcome', async ({ page }) => {
  const { email, password } = await createContributor()
  await signIn(page, email, password)
  await expect(page).toHaveURL(/\/home$/)
  await page.evaluate(() => localStorage.clear())
  await page.goto('/account')
  await expect(page).toHaveURL(/\/welcome$/)
})

test('after signing out, going to a signed-in screen lands on Welcome, not the screen', async ({ page }) => {
  const { email, password } = await createContributor()
  await signIn(page, email, password)
  await expect(page).toHaveURL(/\/home$/)
  await page.goto('/account')
  await page.getByText('Sign Out').click()
  await expect(page).toHaveURL(/\/welcome$/)
  await page.goto('/account')
  await expect(page).toHaveURL(/\/welcome$/)
})

test('a postcode that is not four digits is refused inline on the account page', async ({ page }) => {
  const { email, password } = await createContributor()
  await signIn(page, email, password)
  await expect(page).toHaveURL(/\/home$/)
  await page.goto('/account')
  await page.getByLabel('Postcode', { exact: true }).fill('12')
  await page.getByLabel('Postcode', { exact: true }).blur()
  await expect(page.getByText('A postcode is four digits.')).toBeVisible()
})

test('the child wizard keeps letters out of the age and walks to its done screen on Skip', async ({ page }) => {
  const { email, password } = await createContributor()
  await signIn(page, email, password)
  await expect(page).toHaveURL(/\/home$/)
  await page.goto('/child')
  await expect(page.getByText('STEP 1 OF 8')).toBeVisible()
  await page.getByLabel('Age in years', { exact: true }).fill('abc')
  await expect(page.getByLabel('Age in years', { exact: true })).toHaveValue('')
  for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByText("Your child's profile is ready")).toBeVisible()
})
