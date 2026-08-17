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
  // signIn() only clicks the button; the login page's own redirect (which sets
  // the session cookie) is async. Racing it with an immediate goto() can land
  // signed out — and since /library and /tutorials/[id] are public anyway, the
  // test would then assert nothing about the gate. Wait for the redirect first,
  // same as the other tests in this file.
  await page.waitForURL(/\/onboarding\/contributor-terms/)

  await page.goto('/library')
  await expect(page).toHaveURL(/\/library/)

  // The public detail page must not be caught by the /tutorials gate.
  await page.goto(`/tutorials/${tutorialId}`)
  await expect(page).toHaveURL(new RegExp(`/tutorials/${tutorialId}$`))
})

test('accepting on first login lands on the dashboard with the sidebar shell, not the bare layout', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL(/\/onboarding\/contributor-terms/)

  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /I accept/i }).click()

  await page.waitForURL('**/dashboard')
  await expect(page.locator('.shell-rail')).toBeVisible()
  await expect(page.getByRole('link', { name: 'My tutorials', exact: true })).toBeVisible()
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
  // Typed in a retry loop because "Save details" is gated on a `dirty` flag the
  // form sets from React's onChange. Arriving here straight off the acceptance
  // redirect, the markup can still be the server-rendered HTML: a fill that
  // lands before hydration changes the DOM but no handler observes it, so dirty
  // stays false and the button stays disabled for the rest of the test. Filling
  // again once React is attached is what makes this deterministic.
  const editTitle = page.locator('#edit-title')
  const saveDetails = page.getByRole('button', { name: 'Save details' })
  // Cleared first on every attempt, which is load-bearing: React only raises
  // onChange when the value actually differs from the one it last tracked, so
  // re-filling the same string after a pre-hydration fill is a no-op and the
  // retry would spin until it timed out.
  await expect(async () => {
    await editTitle.fill('')
    await editTitle.fill('Edited after accepting terms')
    await expect(saveDetails).toBeEnabled({ timeout: 1_000 })
  }).toPass({ timeout: 30_000 })
  await saveDetails.click()

  // The <h1> renders tutorial.title, so it changing proves the PATCH was accepted and
  // the page revalidated — a 403 would have produced an error page instead.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Edited after accepting terms'
  )
})
