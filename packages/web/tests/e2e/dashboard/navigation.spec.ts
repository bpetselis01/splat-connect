import { test, expect } from '@playwright/test'
import { signIn, createContributor, createAdmin, acceptTerms, createTutorial } from '../helpers'

// The board's NAV5 (859eee42): five tabs, and Learn and Impact behind More.
const TAB_LABELS = ['Guides', 'Toy Library', '3D Printing', 'Get Involved', 'About']
const MORE_LABELS = ['Learn', 'Impact']

/**
 * The reported defect: signing in deleted the whole public navigation, so
 * reaching /get-involved/submit-an-idea required signing out, navigating
 * signed-out, and signing back in.
 *
 * The rail that used to replace the header inside the account section was
 * retired on 2026-09-17 — the artboard's note on the My SPLAT hub is "replaces
 * the old sidebar entirely" — so the property is now simpler and stronger: the
 * same header renders on every page in the app, and the way back up the
 * account section is the breadcrumb trail (lib/trail.ts).
 */
test.describe('signed-in navigation', () => {
  test('reaches the idea form from the dashboard without signing out', async ({ page }) => {
    const contributor = await createContributor()
    await acceptTerms(contributor.id)
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    // The nav pill and the footer's section heading both render "Get
    // Involved" (components/nav.tsx, components/public-footer.tsx); .first()
    // takes the pill, which appears first in document order.
    await page.getByRole('link', { name: /Get Involved/ }).first().click()
    await expect(page).toHaveURL(/\/get-involved$/)

    // Same story: the hub card and the footer's child link both say
    // "Submit an idea". .first() takes the card.
    await page.getByRole('link', { name: /Submit an idea/ }).first().click()
    await expect(page).toHaveURL(/\/get-involved\/submit-an-idea$/)

    // Signed in, so the form renders rather than the sign-in call to action.
    await expect(page.getByRole('button', { name: /submit/i })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveCount(0)
  })

  // Admin, not contributor: middleware.ts gates /admin on role === 'admin', so
  // a contributor session would just bounce off it to "/".
  test('keeps every public section reachable from every signed-in page', async ({ page }) => {
    const admin = await createAdmin()
    await acceptTerms(admin.id)
    await signIn(page, admin.email, admin.password)
    await page.waitForURL('**/admin')

    // The point of retiring the rail: the header is now unconditional, so this
    // holds on the hub, on a page under it, deep in /admin, and out on the
    // public site — with no "go back to My SPLAT first" step in between.
    for (const path of ['/dashboard', '/dashboard/challenges', '/admin', '/admin/review', '/library']) {
      await page.goto(path)
      const banner = page.getByRole('banner')
      await expect(banner).toBeVisible()
      for (const label of TAB_LABELS) {
        await expect(banner.getByRole('link', { name: label, exact: true })).toBeVisible()
      }
      await banner.getByRole('button', { name: 'More' }).click()
      for (const label of MORE_LABELS) {
        await expect(banner.getByRole('link', { name: new RegExp(`^${label}\\b`) })).toBeVisible()
      }
    }
  })

  // Tests: the header renders on every page, account or public, and no rail
  //        survives anywhere
  // How:   the hub, a page under it, and a public page
  // Chain: the two used to be mutually exclusive by construction. Asserting
  //        .shell-rail is gone is what catches a revert that reinstates the
  //        old branch in app/layout.tsx
  test('renders the header everywhere and the rail nowhere', async ({ page }) => {
    const contributor = await createContributor()
    await acceptTerms(contributor.id)
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    for (const path of ['/dashboard', '/dashboard/toys', '/library']) {
      await page.goto(path)
      await expect(page.getByRole('banner')).toBeVisible()
      await expect(page.locator('.shell-rail')).toHaveCount(0)
    }
  })

  // Tests: the breadcrumb trail is the way back up, and it is a real trail —
  //        the parent chain, not the URL
  // How:   the tutorial editor, whose trail is My SPLAT / My tutorials /
  //        Tutorial editor even though its pathname is /tutorials/[id]/edit
  // Chain: this replaced the rail's "Back to My SPLAT" pill and the per-page
  //        BackLink together. If trailFor stops matching a route the page
  //        silently loses every way back, which nothing else would notice
  test('the breadcrumb trail walks back up the account section', async ({ page }) => {
    const contributor = await createContributor()
    await acceptTerms(contributor.id)
    const tutorialId = await createTutorial(contributor.id, { status: 'draft' })
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    await page.goto(`/tutorials/${tutorialId}/edit`)
    const trail = page.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(trail).toBeVisible()
    await expect(trail.getByRole('link', { name: 'My SPLAT' })).toBeVisible()

    await trail.getByRole('link', { name: 'My tutorials' }).click()
    await expect(page).toHaveURL(/\/dashboard\/tutorials$/)

    await page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: 'My SPLAT' })
      .click()
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  // Tests: the empty saved list's way out lands on the public library
  // How:   a signed-in contributor with nothing saved clicks "Browse the guide
  //        library"
  // Chain: the reported defect. app/dashboard/saved/[type]/page.tsx used a
  //        plain next/link, so the root layout never re-ran and /library
  //        rendered inside the account chrome until the next hard navigation
  test('the empty saved list\'s browse link lands on the public library', async ({ page }) => {
    const contributor = await createContributor()
    await acceptTerms(contributor.id)
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    // Nothing has been saved, so this is the empty state with the way out.
    await page.goto('/dashboard/saved/tutorials')
    await page.getByRole('link', { name: 'Browse the guide library' }).click()

    await expect(page).toHaveURL(/\/library$/)
    // The library's heading since the Soft Pop browse screens (4ad89618).
    await expect(page.getByRole('heading', { name: 'Adapt a toy in an evening', level: 1 })).toBeVisible()
  })

  // The final review round's headline gap: components/public-footer.tsx
  // renders ~45 plain next/link links on every account page, none of which
  // forced a full page load on a boundary crossing. A real click, not a
  // mocked-Link assertion, is the only thing that proves the fix.
  test('crossing via a footer link lands on the public page', async ({ page }) => {
    const contributor = await createContributor()
    await acceptTerms(contributor.id)
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')
    await page.goto('/dashboard/toys')

    // Scoped to <footer>: the whole point here is the footer's own link, the
    // site's largest unguarded surface before this fix. The footer lost its
    // "Guides" row when it became the board's curated columns (859eee42), so
    // this crosses via "Find a printer" instead.
    await page.locator('footer').getByRole('link', { name: 'Find a printer' }).click()
    await expect(page).toHaveURL(/\/printing$/)
    await expect(page.getByRole('heading', { name: 'You do not need a printer', level: 1 })).toBeVisible()
  })
})
