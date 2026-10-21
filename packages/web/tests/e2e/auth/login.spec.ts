import { test, expect, type Page } from '@playwright/test'
import { signIn, submitLogin, createContributor, createAdmin, acceptTerms, adminClient, deleteUser, uniqueEmail, latestMail, PASSWORD } from '../helpers'

/** The sign-in form on whatever /login URL the page is already on. */
async function submitHere(page: Page, email: string, password: string) {
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('WA01 a contributor signs in and lands on the dashboard', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  // F2 made the h1 the greeting; 'My SPLAT' is the eyebrow above it now.
  await expect(page.getByRole('heading', { name: /^Welcome back,/ })).toBeVisible()
  await expect(page.locator('header').getByRole('link', { name: /My SPLAT/ })).toBeVisible()
  await expect(page.locator('header').getByRole('link', { name: 'Sign in' })).toHaveCount(0)
})

test('WA02 an admin signs in and lands on the admin dashboard', async ({ page }) => {
  const admin = await createAdmin()
  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')
  await expect(page).toHaveURL(/\/admin$/)
})

test('WA03 an invalid password shows an error and stays on /login', async ({ page }) => {
  const contributor = await createContributor()
  // submitLogin, not signIn: signIn waits to leave /login, which is exactly
  // what must not happen here.
  await submitLogin(page, contributor.email, 'wrong-password')
  await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toContainText("That email and password don't match.")
  await expect(page).toHaveURL(/\/login$/)
})

test('WA04 ?next= takes a signed-in member back to a same-origin page', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await page.goto('/login?next=%2Ftoy-library')
  await submitHere(page, contributor.email, contributor.password)
  await page.waitForURL('**/toy-library')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('WA04 an off-site ?next= is ignored and the member lands on the dashboard', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await page.goto('/login?next=https%3A%2F%2Fevil.example%2Fphish')
  await submitHere(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  expect(new URL(page.url()).hostname).toBe('localhost')
})

test('WA05 the first sign-in after choosing the family tile lands on the child questions, the second on the dashboard', async ({ page, context }) => {
  const email = uniqueEmail('contrib')
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'Family Tile', intent: 'family' },
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  try {
    await acceptTerms(data.user.id)

    await signIn(page, email, PASSWORD)
    await page.waitForURL('**/onboarding/child')
    await expect(page.getByRole('heading', { level: 1, name: 'How old is your child?' })).toBeVisible()

    await context.clearCookies()
    await signIn(page, email, PASSWORD)
    await page.waitForURL('**/dashboard')
  } finally {
    await deleteUser(data.user.id)
  }
})

test('WA06 the eye button shows and hides the typed password', async ({ page }) => {
  await page.goto('/login')
  const password = page.locator('#password')
  await password.fill('hunter2hunter2')
  await expect(password).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(password).toHaveValue('hunter2hunter2')
  await page.getByRole('button', { name: 'Hide password' }).click()
  await expect(password).toHaveAttribute('type', 'password')
})

test('WA07 Create one opens /signup with the same query string', async ({ page }) => {
  await page.goto('/login?next=%2Flibrary&reason=save')
  await page.getByRole('link', { name: 'Create one' }).click()
  await expect(page).toHaveURL(/\/signup\?next=%2Flibrary&reason=save$/)
})

test('WA08 an unconfirmed email gets a new code and a link to enter it', async ({ page }) => {
  const email = uniqueEmail('contrib')
  const { data, error } = await adminClient().auth.admin.createUser({ email, password: PASSWORD, email_confirm: false })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  try {
    const before = Date.now()
    await submitLogin(page, email, PASSWORD)
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toContainText('That email is not confirmed yet. We sent you a new code.')
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).not.toContainText('Email not confirmed')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('link', { name: 'Enter the code' })).toHaveAttribute('href', /^\/login\/verify\?email=.+&type=signup$/)
    const mail = await latestMail(email, before)
    expect(mail).toMatch(/\b\d{6}\b/)
    expect(mail).toContain('in the SPLAT Connect app or on the website')
  } finally {
    await deleteUser(data.user.id)
  }
})
