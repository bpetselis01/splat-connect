import { test, expect } from '@playwright/test'
import { signIn, createContributor, createAdmin, acceptTerms } from '../helpers'

const PUBLIC_LABELS = ['Guides', 'Toy Library', '3D Printing', 'Learn', 'Get Involved', 'Impact', 'About']

/**
 * The reported defect: signing in deleted the whole public navigation, so
 * reaching /get-involved/submit-an-idea required signing out, navigating
 * signed-out, and signing back in. These three specs assert the property
 * that actually broke — the public sections stay reachable, and the rail
 * stays scoped to the account section — rather than any one component.
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
  // a contributor session would just bounce off it to "/". createAdmin() +
  // signIn() is the same helper login.spec.ts already exercises for the admin
  // sign-in flow, and one admin session covers every path below — the
  // contributor-terms gate that /dashboard and /dashboard/challenges sit
  // behind keys off having accepted the terms, not off role, so acceptTerms()
  // here is enough to reach them the same way a contributor would. Dropping
  // /admin, as the brief's fallback allowed for a suite with no admin helper,
  // would have left the account area itself — the exact place the original
  // bug hid the nav — unchecked.
  test('keeps every public section reachable from every signed-in page', async ({ page }) => {
    const admin = await createAdmin()
    await acceptTerms(admin.id)
    await signIn(page, admin.email, admin.password)
    await page.waitForURL('**/admin')

    // /dashboard keeps the header, so every public section is a direct pill
    // click away.
    await page.goto('/dashboard')
    for (const label of PUBLIC_LABELS) {
      await expect(page.getByRole('link', { name: new RegExp(label) }).first()).toBeVisible()
    }

    // Every other account page has no header — the dock is the way back to
    // My SPLAT, and from there every public section is reachable again.
    for (const path of ['/dashboard/challenges', '/admin']) {
      await page.goto(path)
      await expect(page.getByRole('link', { name: /Back to My SPLAT/ })).toBeVisible()
      await page.getByRole('link', { name: /Back to My SPLAT/ }).click()
      await expect(page).toHaveURL(/\/dashboard$/)
      for (const label of PUBLIC_LABELS) {
        await expect(page.getByRole('link', { name: new RegExp(label) }).first()).toBeVisible()
      }
    }

    await page.goto('/library')
    for (const label of PUBLIC_LABELS) {
      await expect(page.getByRole('link', { name: new RegExp(label) }).first()).toBeVisible()
    }
  })

  test('shows the rail only inside the account section', async ({ page }) => {
    const contributor = await createContributor()
    await acceptTerms(contributor.id)
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    // The branch's headline change: /dashboard keeps the header instead of
    // the rail, unlike every other account page.
    await expect(page.locator('.shell-rail')).toHaveCount(0)
    await expect(page.getByRole('banner')).toBeVisible()

    // The other half of that headline change, in reverse: a rail page has no
    // header at all — the two are mutually exclusive by construction. This
    // caught a real bug where Nav rendered unconditionally in app/layout.tsx,
    // regardless of whether the rail was also on screen.
    await page.goto('/dashboard/toys')
    await expect(page.getByRole('link', { name: 'Design challenges' }).first()).toBeVisible()
    await expect(page.locator('.shell-rail')).toHaveCount(1)
    await expect(page.getByRole('banner')).toHaveCount(0)

    await page.goto('/library')
    await expect(page.locator('.shell-rail')).toHaveCount(0)
  })

  // Tests: the rail's own "Back to My SPLAT" link forces a real navigation
  //        back to /dashboard, restoring the header and dropping the rail —
  //        not a soft transition that would leave the rail on screen with no
  //        header (the reported defect this link was added to fix)
  // How:   clicks the rail's link from a rail-only account page, then checks
  //        both halves of the header/rail split on the far side
  test('the rail\'s Back to My SPLAT link restores the header and drops the rail', async ({
    page,
  }) => {
    const contributor = await createContributor()
    await acceptTerms(contributor.id)
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')
    await page.goto('/dashboard/toys')
    await expect(page.locator('.shell-rail')).toHaveCount(1)

    await page.locator('.shell-rail').getByRole('link', { name: /Back to My SPLAT/ }).click()

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.locator('.shell-rail')).toHaveCount(0)
    await expect(page.getByRole('banner')).toBeVisible()
  })

  // The final review round's headline gap: components/public-footer.tsx
  // renders unconditionally on every account page (app/layout.tsx), with
  // ~45 plain next/link links, none of which forced a full page load on a
  // boundary crossing — every one of them could leave the rail on screen
  // over public content. A real click, not a mocked-Link assertion, is the
  // only thing that proves the fix: Playwright's .click() also fails if
  // another element (the rail, before the app/globals.css stacking fix)
  // visually intercepts the pointer at the footer link's coordinates, so
  // this test doubles as a regression guard for that CSS fix too.
  test('crossing via a footer link swaps the account chrome for public chrome', async ({ page }) => {
    const contributor = await createContributor()
    await acceptTerms(contributor.id)
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')
    // /dashboard itself has no rail (it keeps the header instead) — the
    // property under test needs a page that actually has one.
    await page.goto('/dashboard/toys')
    await expect(page.locator('.shell-rail')).toHaveCount(1)

    // Scoped to <footer>: "Guides" also appears as a nav pill and (via
    // hub-grid.tsx) a hub tile, and the whole point here is the footer's own
    // link (components/public-footer.tsx), the site's largest unguarded
    // surface before this fix.
    await page.locator('footer').getByRole('link', { name: 'Guides' }).click()
    await expect(page).toHaveURL(/\/library$/)
    await expect(page.locator('.shell-rail')).toHaveCount(0)
    // The destination's own content, not just the URL — app/library's h1.
    await expect(page.getByRole('heading', { name: 'Toy Adaptation Library', level: 1 })).toBeVisible()
  })
})
