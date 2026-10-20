import { test, expect } from '@playwright/test'
import { signIn, createContributor, createTutorial, uniqueTitle, fillDetail } from '../helpers'

// No acceptTerms() anywhere in this file, deliberately. Seeding acceptance in setup
// is what kept the contributor-terms 403 invisible to the suite.

test('WA27 an account without accepted terms is sent to the catch-up screen', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, contributor.password)
  // signIn() only clicks the button; the login page's own redirect (which
  // sets the session cookie) is async. Racing it with an immediate goto()
  // lands on /login instead of the gate — wait for it to land first.
  await page.waitForURL(/\/onboarding\/contributor-terms/)

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/onboarding\/contributor-terms/)
})

test('WA17 Accept and continue stays disabled until the box is ticked', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL(/\/onboarding\/contributor-terms/)

  const accept = page.getByRole('button', { name: 'Accept and continue' })
  await expect(accept).toBeDisabled()
  await page.getByRole('checkbox').check()
  await expect(accept).toBeEnabled()
})

test('WA18 Sign out on the terms gate returns to the home page, signed out', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL(/\/onboarding\/contributor-terms/)

  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL(/localhost:\d+\/$/)
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
})

test('WA29 browsing stays open without accepted terms', async ({ page }) => {
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

  // An account page that is signed-in only, not terms-gated.
  await page.goto('/notifications')
  await expect(page).toHaveURL(/\/notifications$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('WA17 accepting on first login lands on the dashboard with its real header, not the bare layout', async ({ page }) => {
  const contributor = await createContributor()
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL(/\/onboarding\/contributor-terms/)

  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Accept and continue' }).click()

  await page.waitForURL('**/dashboard')
  // /dashboard has no rail (it keeps the header instead) — the bare
  // onboarding layout has neither, so the header's presence is what proves
  // this landed on the real layout.
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Welcome back,/, level: 1 })).toBeVisible()
})

test('WA17 accepting returns the user to where they were blocked and unblocks editing', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Accept and continue' }).click()

  await expect(page).toHaveURL(new RegExp(`/tutorials/${tutorialId}/edit`))
  // The editor opens on Status (a1535727); the title field is on Details.
  await page.goto(`/tutorials/${tutorialId}/edit?step=details`)

  // The original bug: saving an approved tutorial sets status -> pending, which the
  // API refuses without an acceptance row, and the Server Action threw a 500. This is
  // the assertion that would have caught it.
  //
  const saveDetails = page.getByRole('button', { name: 'Save details' })
  await fillDetail(page, 'title', 'Edited after accepting terms')
  await saveDetails.click()

  // The <h1> renders tutorial.title, so it changing proves the PATCH was accepted and
  // the page revalidated — a 403 would have produced an error page instead.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Edited after accepting terms'
  )
})
