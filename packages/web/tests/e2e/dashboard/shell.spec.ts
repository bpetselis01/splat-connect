import { test, expect } from '@playwright/test'
import {
  signIn,
  createContributor,
  createTutorial,
  createOrgWithLeader,
  seedBackingRequest,
  seedLeaderApproval,
  acceptTerms,
  deleteOrg,
  deleteUser,
  uniqueTitle,
} from '../helpers'

/**
 * The journeys that prove capability-derived navigation and a merged dashboard
 * survive without a tab strip: what a contributor may reach, what a leader may
 * reach, the child and account flows, and the /my-tutorials redirect.
 *
 * Every navigation assertion below reads the My SPLAT hub itself. The rail was
 * retired on 2026-09-17 — the artboard's note on the hub is "replaces the old
 * sidebar entirely" — so the hub's cards ARE the capability-gated destination
 * list now, built from the same buildNav(caps) the rail used.
 *
 * Assertions are scoped to <main> because the fat footer repeats many of the
 * same destinations, and a hub card's accessible name is its whole content —
 * title, count and blurb — so the locators match by regex rather than exactly.
 */

test('a contributor sees no Organisation group', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    const hub = page.getByRole('main')

    await expect(hub.getByRole('link', { name: /My tutorials/ })).toBeVisible()
    await expect(hub.getByRole('link', { name: /Account/ })).toBeVisible()
    await expect(hub.getByRole('heading', { name: 'Organisation' })).toHaveCount(0)
    await expect(hub.getByRole('link', { name: /Review queue/ })).toHaveCount(0)
  } finally {
    await deleteUser(contributor.id)
  }
})

test('a leader sees the Organisation group, and the queue merges across two organisations with no picker', async ({
  page,
}) => {
  const leader = await createContributor()
  await acceptTerms(leader.id)
  const authorA = await createContributor()
  const authorB = await createContributor()
  const orgA = await createOrgWithLeader(leader.id, `Alpha ${Date.now()}`)
  const orgB = await createOrgWithLeader(leader.id, `Beta ${Date.now()}`)
  const titleA = uniqueTitle('Two Org Queue A')
  const titleB = uniqueTitle('Two Org Queue B')
  const tutorialA = await createTutorial(authorA.id, { title: titleA, status: 'pending' })
  const tutorialB = await createTutorial(authorB.id, { title: titleB, status: 'pending' })
  await seedBackingRequest(tutorialA, orgA)
  await seedBackingRequest(tutorialB, orgB)

  try {
    await signIn(page, leader.email, leader.password)
    await page.waitForURL('**/dashboard')

    const hub = page.getByRole('main')

    await expect(hub.getByRole('link', { name: /My tutorials/ })).toBeVisible()
    await expect(hub.getByRole('link', { name: /Review queue/ })).toBeVisible()

    await hub.getByRole('link', { name: /Review queue/ }).click()
    await expect(page).toHaveURL('/dashboard/organisation')

    // Both requests show in the single merged queue — no organisation picker
    // anywhere on the page to switch between them.
    await expect(page.getByRole('link', { name: titleA })).toBeVisible()
    await expect(page.getByRole('link', { name: titleB })).toBeVisible()
    await expect(page.getByRole('combobox')).toHaveCount(0)
  } finally {
    await deleteOrg(orgA)
    await deleteOrg(orgB)
    await deleteUser(leader.id)
    await deleteUser(authorA.id)
    await deleteUser(authorB.id)
  }
})

test('a leader reaches the existing review screen from the tab and approves a tutorial', async ({
  page,
}) => {
  const leader = await createContributor()
  await acceptTerms(leader.id)
  await acceptTerms(leader.id, 'org_leader_terms')
  const author = await createContributor()
  const orgName = `Reviewed Via Tab ${Date.now()}`
  const orgId = await createOrgWithLeader(leader.id, orgName)
  const title = uniqueTitle('Approved Via Tab')
  const tutorialId = await createTutorial(author.id, { title, status: 'pending' })
  await seedBackingRequest(tutorialId, orgId)

  try {
    await signIn(page, leader.email, leader.password)
    await page.waitForURL('**/dashboard')

    const hub = page.getByRole('main')

    await hub.getByRole('link', { name: /Review queue/ }).click()
    await expect(page).toHaveURL('/dashboard/organisation')

    // The row links to the existing per-project review screen, not a new one.
    await page.getByRole('link', { name: title }).click()
    await expect(page).toHaveURL(`/organizations/${orgId}/projects/${tutorialId}`)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()

    await page.getByRole('button', { name: /Back this project/i }).click()
    await expect(page.getByRole('button', { name: /Approve and publish/i })).toBeVisible()
    await page.getByRole('button', { name: /Approve and publish/i }).click()
    await expect(page).toHaveURL(new RegExp(`/organizations/${orgId}$`))

    await page.goto(`/tutorials/${tutorialId}`)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByText(new RegExp(`Backed by ${orgName}`))).toBeVisible()
  } finally {
    await deleteOrg(orgId)
    await deleteUser(leader.id)
    await deleteUser(author.id)
  }
})

test('a contributor adds two children, edits one, and deletes one', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    const hub = page.getByRole('main')

    await hub.getByRole('link', { name: /Account/ }).click()
    await expect(page).toHaveURL('/dashboard/profile')

    // Name, age and the clinical scores live on the Ability pill, not the one the
    // stepper opens on — ChildEditor splits the profile across four steps and
    // starts at Survey. Saving stays on the editor and swaps /new for the new
    // id, so the list is reached by navigating rather than by a redirect.
    //
    // The way back up is the breadcrumb trail (lib/trail.ts), which is what
    // replaced both the rail and the per-page back control.

    // First child, named.
    await page.getByRole('link', { name: 'Add child' }).click()
    await expect(page).toHaveURL('/dashboard/child/new')
    await page.locator('#name').fill('Emma')
    await page.locator('#age').fill('7')
    // The MACS/BFMF selects sit inside the collapsed "Clinical scores
    // (optional)" disclosure; a closed <details> hides them from actionability.
    await page.getByText('Clinical scores (optional)').click()
    await page.locator('#macs_level').selectOption('II')
    await page.getByRole('region', { name: 'Basics' }).getByRole('button', { name: 'Save' }).click()
    // Scoped to <main>: "Saved" is also a hub card and a footer link, so an
    // unscoped getByText('Saved') trips strict mode. The confirmation is page
    // content; the others are navigation.
    await expect(page.getByRole('main').getByText('Saved')).toBeVisible()
    await expect(page).toHaveURL(/\/dashboard\/child\/[0-9a-f-]{36}/)
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Account' }).click()
    await expect(page).toHaveURL('/dashboard/profile')
    await expect(page.getByRole('link', { name: /Emma/ })).toBeVisible()

    // Second child, left unnamed — the list must still tell them apart.
    await page.getByRole('link', { name: 'Add child' }).click()
    await page.locator('#age').fill('4')
    await page.getByRole('region', { name: 'Basics' }).getByRole('button', { name: 'Save' }).click()
    // Scoped to <main>: "Saved" is also a hub card and a footer link, so an
    // unscoped getByText('Saved') trips strict mode. The confirmation is page
    // content; the others are navigation.
    await expect(page.getByRole('main').getByText('Saved')).toBeVisible()
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Account' }).click()
    await expect(page).toHaveURL('/dashboard/profile')
    await expect(page.getByRole('link', { name: /Child 2/ })).toBeVisible()

    // Edit the first child and confirm it persists across a reload.
    await page.getByRole('link', { name: /Emma/ }).click()
    await expect(page.locator('#age')).toHaveValue('7')
    await expect(page.locator('#macs_level')).toHaveValue('II')
    await page.locator('#age').fill('8')
    await page.getByRole('region', { name: 'Basics' }).getByRole('button', { name: 'Save' }).click()
    // Scoped to <main>: "Saved" is also a hub card and a footer link, so an
    // unscoped getByText('Saved') trips strict mode. The confirmation is page
    // content; the others are navigation.
    await expect(page.getByRole('main').getByText('Saved')).toBeVisible()
    await page.reload()
    await expect(page.locator('#age')).toHaveValue('8')

    // Delete is opened by a button named after the child, then gated on typing
    // the phrase back — components/delete-entity-button.tsx builds both from the
    // same label, so the user reads the identifier twice. Same shape as the toy
    // deletion in dashboard/toys.spec.ts.
    await page.getByRole('button', { name: 'Delete Emma' }).click()
    await page.getByLabel(/to confirm/i).fill('confirm_delete_Emma')
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page).toHaveURL('/dashboard/profile')
    await expect(page.getByRole('link', { name: /Emma/ })).toHaveCount(0)
    // The survivor renumbers, because position is computed and not stored.
    await expect(page.getByRole('link', { name: /Child 1/ })).toBeVisible()
  } finally {
    await deleteUser(contributor.id)
  }
})

/**
 * Journey 5. Checked first whether the nav renders the user's name: it does
 * not — the header shows only role-gated links and a Sign out button, static
 * labels, not the account name. So this asserts
 * persistence the way every other row in this file does: save, reload the
 * same tab, and read the field back — not a nav element that was never
 * wired to the name.
 */
test('a user renames themselves on the Account tab and the change persists', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  const newName = uniqueTitle('Renamed Contributor')

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    const hub = page.getByRole('main')

    await hub.getByRole('link', { name: /Account/ }).click()
    await expect(page).toHaveURL('/dashboard/profile')

    await page.locator('#name').fill(newName)
    await page.getByRole('button', { name: 'Save' }).click()
    // Scoped to <main>: "Saved" is also a hub card and a footer link, so an
    // unscoped getByText('Saved') trips strict mode. The confirmation is page
    // content; the others are navigation.
    await expect(page.getByRole('main').getByText('Saved')).toBeVisible()

    await page.reload()
    await expect(page.locator('#name')).toHaveValue(newName)
  } finally {
    await deleteUser(contributor.id)
  }
})


test('/my-tutorials redirects to the merged list', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  const title = uniqueTitle('Merged List')
  await createTutorial(contributor.id, { title, status: 'pending' })

  try {
    await signIn(page, contributor.email, contributor.password)
    // signIn() only clicks the button; the login redirect that sets the
    // session cookie is async. Racing it with an immediate goto() lands on
    // /login instead — wait for it to land first (same fix as
    // contributor-terms.spec.ts).
    await page.waitForURL('**/dashboard')
    await page.goto('/my-tutorials')
    await expect(page).toHaveURL('/dashboard/tutorials')
    await expect(page.getByTestId('tutorial-row').filter({ hasText: title })).toBeVisible()
  } finally {
    await deleteUser(contributor.id)
  }
})

/*
 * The hub advertises no door that does not open. `soon` is still a field on
 * NavRow, so a row added with it set would fail here as well as in
 * nav-model.test.ts, and this side proves the link goes somewhere real rather
 * than only that the flag is unset.
 */
test('the hub advertises no unbuilt destination, and its cards open real pages', async ({
  page,
}) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    const hub = page.getByRole('main')
    await expect(hub.getByText('Soon')).toHaveCount(0)

    await hub.getByRole('link', { name: /My print requests/ }).click()
    await expect(page).toHaveURL('/dashboard/print-requests')
    await expect(page.getByRole('heading', { name: 'My print requests' })).toBeVisible()
    // The real screen, not a plan for one.
    await expect(page.getByText('Not built yet', { exact: true })).toHaveCount(0)
  } finally {
    await deleteUser(contributor.id)
  }
})

// Chain: dropping the cap outright stretched library grids, prose and admin
//        tables to the full window on an ultrawide display. Since the rail was
//        retired every page shares .public-shell's cap, signed in or out, so
//        this guards one rule for the whole app. reflow.spec.ts only tests
//        narrow viewports, so nothing else in the suite looks this way.
test('the main content column stays capped on an ultrawide viewport', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')
    await page.goto('/dashboard/toys')

    await page.setViewportSize({ width: 2560, height: 1200 })
    const box = await page.locator('main#main').boundingBox()
    expect(box).not.toBeNull()
    // .public-shell is width: min(80%, 110rem) — 1760px. Uncapped this would
    // be the full 2560, so a regression fails loudly.
    expect(box!.width).toBeLessThanOrEqual(1761)
  } finally {
    await deleteUser(contributor.id)
  }
})

// Chain: WCAG 2.4.1 Bypass Blocks, Level A. The header puts a row of section
//        pills ahead of the page content on every route. A link that only
//        scrolls does not satisfy the criterion, so this asserts where focus
//        actually lands — which is why <main> carries tabIndex={-1}.
test('the skip link is the first tab stop and moves focus to the main content', async ({
  page,
}) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to main content' })
    await expect(skip).toBeFocused()
    // sr-only at rest; it has to be readable once it has focus.
    await expect(skip).toBeVisible()

    await page.keyboard.press('Enter')
    await expect(page.locator('main#main')).toBeFocused()
  } finally {
    await deleteUser(contributor.id)
  }
})

// Chain: navigation on the terms gate offers links middleware bounces straight
//        back, which is an escape hatch out of a gate. app/layout.tsx's bare
//        branch is what keeps the header off it.
test('the onboarding gate renders without site navigation', async ({ page }) => {
  const contributor = await createContributor()

  try {
    await signIn(page, contributor.email, contributor.password)
    // signIn() only clicks the button; the login page's own redirect (which
    // sets the session cookie) is async. Racing it with an immediate goto()
    // lands on /login instead of the gate — wait for it to land first, same
    // as contributor-terms.spec.ts.
    await page.waitForURL(/\/onboarding\/contributor-terms/)

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/onboarding\/contributor-terms/)
    await expect(page.getByRole('banner')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Review queue' })).toHaveCount(0)
  } finally {
    await deleteUser(contributor.id)
  }
})


