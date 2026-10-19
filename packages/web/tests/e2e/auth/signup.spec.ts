import { test, expect } from '@playwright/test'
import { uniqueContributorEmail, createContributor, adminClient, deleteUser } from '../helpers'
import { AGREEMENT_VERSIONS } from '@splat-connect/types'

async function acceptTermsViaDialog(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /contributor terms/i }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /^I accept/i }).click()
}

async function fillSignup(page: import('@playwright/test').Page, email: string, name = 'E2E Contributor') {
  await page.locator('#name').fill(name)
  await page.locator('#email').fill(email)
  await page.locator('#password').fill('Test1234!')
  await page.locator('#confirm-password').fill('Test1234!')
}

test('WA09 a new contributor signs up and is told to check their email', async ({ page }) => {
  const email = uniqueContributorEmail()
  await page.goto('/signup')
  await page.getByLabel('Make and share guides').check()
  await fillSignup(page, email)
  await acceptTermsViaDialog(page)
  await page.getByRole('button', { name: 'Create my account' }).click()

  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()

  // The account exists, unconfirmed, with the chosen tile and the accepted terms recorded.
  const admin = adminClient()
  const account = (await admin.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === email)!
  try {
    expect(account.email_confirmed_at).toBeFalsy()
    expect(account.user_metadata.intent).toBe('maker')
    const { data: agreements } = await admin.from('user_agreements').select('agreement_type, version').eq('user_id', account.id)
    expect(agreements).toEqual([{ agreement_type: 'contributor_terms', version: AGREEMENT_VERSIONS.contributor_terms }])
  } finally {
    await deleteUser(account.id)
  }
})

test('WA14 Back to sign in on the confirmation goes to /login', async ({ page }) => {
  const email = uniqueContributorEmail()
  await page.goto('/signup')
  await fillSignup(page, email)
  await acceptTermsViaDialog(page)
  await page.getByRole('button', { name: 'Create my account' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

  await page.getByRole('link', { name: 'Back to sign in' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  const account = (await adminClient().auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === email)
  if (account) await deleteUser(account.id)
})

test('WA10 the terms dialog preserves already-typed fields on close', async ({ page }) => {
  await page.goto('/signup')
  await page.locator('#name').fill('Keeps Typing')
  await page.locator('#email').fill('keeps-typing@example.com')

  await page.getByRole('button', { name: /contributor terms/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: /reject/i }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  await expect(page.locator('#name')).toHaveValue('Keeps Typing')
  await expect(page.locator('#email')).toHaveValue('keeps-typing@example.com')
  await expect(page.getByRole('button', { name: 'Create my account' })).toBeDisabled()
})

test('WA10 the terms dialog: a backdrop click closes it without accepting', async ({ page }) => {
  await page.goto('/signup')
  await page.getByRole('button', { name: /contributor terms/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  // A click on a modal <dialog>'s ::backdrop is attributed to the <dialog>
  // element itself — an absolute corner coordinate lands outside the
  // centered card, on the backdrop.
  await page.mouse.click(5, 5)

  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('button', { name: /contributor terms/i })).toBeVisible()
})

test('WA10 the terms dialog: Escape closes it without accepting', async ({ page }) => {
  await page.goto('/signup')
  await page.getByRole('button', { name: /contributor terms/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.keyboard.press('Escape')

  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('button', { name: /contributor terms/i })).toBeVisible()
})

test('WA12 an already-registered email shows the error', async ({ page }) => {
  const existing = await createContributor()

  await page.goto('/signup')
  await page.locator('#name').fill('Duplicate Person')
  await page.locator('#email').fill(existing.email)
  await page.locator('#password').fill('Test1234!')
  await page.locator('#confirm-password').fill('Test1234!')
  await acceptTermsViaDialog(page)
  await page.getByRole('button', { name: 'Create my account' }).click()

  // Filtered to alerts with content — Next's empty route announcer is also role=alert.
  await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveText('User already registered')
  await expect(page.getByRole('heading', { name: 'Check your email' })).toHaveCount(0)
})

test('WA11 a password under six characters is not accepted', async ({ page }) => {
  await page.goto('/signup')
  await page.locator('#name').fill('Short Password')
  await page.locator('#email').fill(uniqueContributorEmail())
  await page.locator('#password').fill('12345')
  await page.locator('#confirm-password').fill('12345')
  await acceptTermsViaDialog(page)
  await page.getByRole('button', { name: 'Create my account' }).click()

  // minLength blocks submission client-side, so the confirmation never renders.
  await expect(page.getByRole('heading', { name: 'Check your email' })).toHaveCount(0)
})

test('WA11 mismatched passwords are refused with a message and no account is made', async ({ page }) => {
  const email = uniqueContributorEmail()
  await page.goto('/signup')
  await fillSignup(page, email)
  await page.locator('#confirm-password').fill('Different1!')
  await acceptTermsViaDialog(page)
  await page.getByRole('button', { name: 'Create my account' }).click()

  await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveText("Passwords don't match.")
  await expect(page.getByRole('heading', { name: 'Check your email' })).toHaveCount(0)
  const { data } = await adminClient().auth.admin.listUsers({ perPage: 1000 })
  expect(data.users.some((u) => u.email === email)).toBe(false)
})

// follow and message are sent by org-actions.tsx but have no banner copy yet.
test('WA13 ?reason= save, thanks, child and download each explain why the visitor was sent here', async ({ page }) => {
  for (const [reason, copy] of [
    ['save', 'You need an account to save things.'],
    ['thanks', 'You need an account to say thanks.'],
    ['child', "A free account keeps your child's profile."],
    ['download', 'You need an account to download tutorial files.'],
  ]) {
    await page.goto(`/signup?reason=${reason}`)
    await expect(page.getByText(copy), reason).toBeVisible()
  }
})

test('WA13 ?reason=follow shows no banner', async ({ page }) => {
  await page.goto('/signup?reason=follow')
  await expect(page.getByRole('button', { name: 'Create my account' })).toBeVisible()
  await expect(page.locator('.alert')).toHaveCount(0)
})

test('WA15 the Sign in and Create account tabs switch screens and keep the query', async ({ page }) => {
  await page.goto('/signup?next=%2Flibrary')
  await page.locator('a[href="/login?next=%2Flibrary"]').click()
  await expect(page).toHaveURL(/\/login\?next=%2Flibrary$/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

  await page.getByRole('link', { name: 'Create one' }).click()
  await expect(page).toHaveURL(/\/signup\?next=%2Flibrary$/)
  await expect(page.getByRole('button', { name: 'Create my account' })).toBeVisible()
})
