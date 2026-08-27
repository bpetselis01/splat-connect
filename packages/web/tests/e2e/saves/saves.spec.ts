import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import {
  signIn,
  createContributor,
  createTutorial,
  acceptTerms,
  deleteUser,
  uniqueTitle,
} from '../helpers'

/**
 * The save round trip, signed in and signed out.
 *
 * The signed-out half is the one that matters most and is easiest to lose: the
 * island renders for everyone, and clicking it routes to /signup with a notice
 * rather than silently doing nothing or hiding itself. Most of /library's
 * traffic is signed out, which is exactly when browse-and-triage happens.
 *
 * Screenshots land in docs/superpowers/plans/artifacts/saves/ and are the
 * visual check against the design doc — a deliberate side effect of this spec
 * rather than a separate script, so they cannot drift from what the app
 * actually renders.
 *
 * They are OPT-IN, behind SAVE_SHOTS=1. Fixture titles carry a unique id, so
 * every run produces different pixels; writing them unconditionally left the
 * committed record dirty after any e2e run, which trains you to `git checkout`
 * the very thing you meant to inspect. Refresh them deliberately:
 *
 *   SAVE_SHOTS=1 npx playwright test tests/e2e/saves
 */
// Absolute, from this file rather than the process CWD: Playwright runs from
// packages/web, so a relative path lands outside the repo entirely.
const SHOTS = path.join(__dirname, '../../../../..', 'docs/superpowers/plans/artifacts/saves')

async function shot(page: Page, name: string) {
  if (!process.env.SAVE_SHOTS) return
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true })
}

test.describe('saving things', () => {
  test('a signed-out visitor is offered the island and sent to sign up', async ({ page }) => {
    const contributor = await createContributor()
    const title = uniqueTitle('Saveable guide')
    await createTutorial(contributor.id, { title, status: 'approved' })

    try {
      await page.goto('/library')
      const card = page.locator('.save-host', { hasText: title })
      await expect(card.getByRole('button', { name: 'Save' })).toBeVisible()
      await shot(page, 'library-signed-out')

      await card.getByRole('button', { name: 'Save' }).click()

      // The detour, not a dead end: it says why, and carries where you were.
      await expect(page).toHaveURL(/\/signup\?next=%2Flibrary&reason=save/)
      await expect(page.getByText('You need an account to save things')).toBeVisible()
      await shot(page, 'signup-save-notice')
    } finally {
      await deleteUser(contributor.id)
    }
  })

  test('a signed-in visitor saves from the library and finds it under Saved', async ({ page }) => {
    const contributor = await createContributor()
    await acceptTerms(contributor.id)
    const title = uniqueTitle('Kept guide')
    await createTutorial(contributor.id, { title, status: 'approved' })

    try {
      await signIn(page, contributor.email, contributor.password)
      await page.waitForURL(/\/dashboard/)

      // My SPLAT now carries eight cards, two complete rows of four.
      await shot(page, 'my-splat')
      await expect(page.getByRole('link', { name: /^Saved/ })).toBeVisible()

      await page.goto('/library')
      const card = page.locator('.save-host', { hasText: title })
      const button = card.getByRole('button', { name: 'Save' })
      await button.click()
      await expect(card.getByRole('button', { name: 'Saved' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      await shot(page, 'library-signed-in-saved')

      // It survives a reload, which is the difference between optimistic UI
      // and a save that actually happened.
      await page.reload()
      await expect(
        page.locator('.save-host', { hasText: title }).getByRole('button', { name: 'Saved' })
      ).toBeVisible()

      await page.goto('/dashboard/saved')
      await expect(page.getByRole('heading', { name: 'Ready now' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Coming soon' })).toBeVisible()
      await shot(page, 'saved-hub')

      await page.getByRole('link', { name: /Tutorials/ }).first().click()
      await expect(page).toHaveURL(/\/dashboard\/saved\/tutorials/)
      await expect(page.getByText(title)).toBeVisible()
      await shot(page, 'saved-tutorials')

      // The filled island IS the unsave affordance — there is no other control.
      await page.getByRole('button', { name: 'Saved' }).click()
      await expect(page.getByText(/Nothing saved yet/)).toBeVisible()
      await shot(page, 'saved-tutorials-empty')
    } finally {
      await deleteUser(contributor.id)
    }
  })

  test('the destination button skips the hub and lands on its own list', async ({ page }) => {
    const contributor = await createContributor()
    await acceptTerms(contributor.id)

    try {
      await signIn(page, contributor.email, contributor.password)
      await page.waitForURL(/\/dashboard/)

      await page.goto('/dashboard/tutorials')
      await page.getByRole('link', { name: 'Saved tutorials' }).click()
      // Straight there, no menu in between: the label names a destination.
      await expect(page).toHaveURL(/\/dashboard\/saved\/tutorials$/)
      await expect(page.getByRole('heading', { name: 'Saved tutorials' })).toBeVisible()
    } finally {
      await deleteUser(contributor.id)
    }
  })

  test('a type in the enum but not live is not a page', async ({ page }) => {
    const contributor = await createContributor()
    await acceptTerms(contributor.id)

    try {
      await signIn(page, contributor.email, contributor.password)
      await page.waitForURL(/\/dashboard/)

      // A static placeholder route wins the match over [type], so this is a
      // "not built yet" page rather than a 404 or an empty list.
      await page.goto('/dashboard/saved/organisations')
      await expect(page.getByRole('heading', { name: 'Saved organisations' })).toBeVisible()
      await shot(page, 'saved-organisations-placeholder')

      const res = await page.goto('/dashboard/saved/bananas')
      expect(res?.status()).toBe(404)
    } finally {
      await deleteUser(contributor.id)
    }
  })

  test('@responsive the saved hub and My SPLAT hold at phone width', async ({ page }) => {
    const contributor = await createContributor()
    await acceptTerms(contributor.id)

    try {
      await signIn(page, contributor.email, contributor.password)
      await page.waitForURL(/\/dashboard/)
      await shot(page, 'my-splat-mobile')

      await page.goto('/dashboard/saved')
      await expect(page.getByRole('heading', { name: 'Ready now' })).toBeVisible()
      await shot(page, 'saved-hub-mobile')

      // The page body must never scroll sideways.
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      )
      expect(overflows).toBe(false)
    } finally {
      await deleteUser(contributor.id)
    }
  })
})
