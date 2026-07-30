import { test, expect } from '@playwright/test'
import { signIn, createContributor, createTutorial, uniqueTitle } from '../helpers'

// No acceptTerms() anywhere in this file, deliberately. Seeding acceptance in setup
// is what kept the contributor-terms 403 invisible to the suite.

test('an account without accepted terms is sent to the catch-up screen', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, contributor.password)
  // signIn() only clicks the button; the login page's own redirect (which
  // sets the session cookie) is async. Racing it with an immediate goto()
  // lands on /login instead of the gate — wait for it to land first.
  await page.waitForURL(/\/onboarding\/contributor-terms/)

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/onboarding\/contributor-terms/)
})

test('browsing stays open without accepted terms', async ({ page }) => {
  const contributor = await createContributor()
  const tutorialId = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Terms Browsing'),
    status: 'approved',
  })
  await signIn(page, contributor.email, contributor.password)

  await page.goto('/library')
  await expect(page).toHaveURL(/\/library/)

  // The public detail page must not be caught by the /tutorials gate.
  await page.goto(`/tutorials/${tutorialId}`)
  await expect(page).toHaveURL(new RegExp(`/tutorials/${tutorialId}$`))
})

test('accepting returns the user to where they were blocked and unblocks editing', async ({ page }) => {
  const contributor = await createContributor()
  const tutorialId = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Terms Unblocks Edit'),
    status: 'approved',
  })
  await signIn(page, contributor.email, contributor.password)
  // See the comment in the first test: wait for the login redirect to land
  // before navigating again, or the goto races the session cookie.
  await page.waitForURL(/\/onboarding\/contributor-terms/)

  await page.goto(`/tutorials/${tutorialId}/edit`)
  await expect(page).toHaveURL(/\/onboarding\/contributor-terms/)

  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /I accept/i }).click()

  await expect(page).toHaveURL(new RegExp(`/tutorials/${tutorialId}/edit`))

  // The original bug: saving an approved tutorial sets status -> pending, which the
  // API refuses without an acceptance row, and the Server Action threw a 500. This is
  // the assertion that would have caught it.
  //
  // #edit-title / "Save details" are the ids the Details panel actually uses; the
  // panel is <details open> so no expansion is needed first.
  await page.locator('#edit-title').fill('Edited after accepting terms')
  await page.getByRole('button', { name: 'Save details' }).click()

  // The <h1> renders tutorial.title, so it changing proves the PATCH was accepted and
  // the page revalidated — a 403 would have produced an error page instead.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Edited after accepting terms'
  )
})

test('a new signup never sees the catch-up screen', async ({ page }) => {
  const email = `terms-${Date.now()}@example.com`

  await page.goto('/signup')
  await page.getByLabel(/full name/i).fill('New Contributor')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill('secret123')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /create account/i }).click()

  await page.getByRole('link', { name: /go to your dashboard/i }).click()
  await expect(page).toHaveURL(/\/dashboard/)
})
