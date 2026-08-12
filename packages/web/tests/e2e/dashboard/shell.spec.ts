import path from 'node:path'
import { test, expect } from '@playwright/test'
import {
  signIn,
  createContributor,
  createTutorial,
  createOrgWithLeader,
  seedBackingRequest,
  acceptTerms,
  deleteOrg,
  deleteUser,
  uniqueTitle,
} from '../helpers'

const PDF_FIXTURE = path.join(__dirname, '..', 'fixtures', 'test.pdf')
const PHOTO_FIXTURE = path.join(__dirname, '..', 'fixtures', 'test.jpg')

/**
 * The journeys that prove the app shell replaces the tab strip without losing
 * anything: capability-derived nav groups on the rail and a merged dashboard.
 *
 * The first six are the ported tab-strip journeys; the rest are what the shell
 * itself introduces — collapse persistence, the narrow-viewport drawer and its
 * two native dismissals, the /my-tutorials redirect, a placeholder route, and
 * the bare onboarding gate.
 */

test('a contributor sees no Organisation group', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    await expect(page.getByRole('link', { name: 'My tutorials', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Child profiles', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Profile', exact: true })).toBeVisible()
    await expect(page.getByText('Organisation', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Review queue', exact: true })).toHaveCount(0)
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

    await expect(page.getByRole('link', { name: 'My tutorials', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Review queue', exact: true })).toBeVisible()

    await page.getByRole('link', { name: 'Review queue', exact: true }).click()
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

    await page.getByRole('link', { name: 'Review queue', exact: true }).click()
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

    await page.getByRole('link', { name: 'Child profiles', exact: true }).click()
    await expect(page).toHaveURL('/dashboard/child')

    // First child, named.
    await page.getByRole('link', { name: 'Add child' }).click()
    await expect(page).toHaveURL('/dashboard/child/new')
    await page.locator('#name').fill('Emma')
    await page.locator('#age').fill('7')
    await page.locator('#primary_diagnosis').fill('Cerebral palsy')
    await page.locator('#macs_level').selectOption('II')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/dashboard/child')
    await expect(page.getByRole('link', { name: /Emma/ })).toBeVisible()

    // Second child, left unnamed — the list must still tell them apart.
    await page.getByRole('link', { name: 'Add child' }).click()
    await page.locator('#age').fill('4')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL('/dashboard/child')
    await expect(page.getByRole('link', { name: /Child 2/ })).toBeVisible()

    // Edit the first child and confirm it persists across a reload.
    await page.getByRole('link', { name: /Emma/ }).click()
    await expect(page.locator('#age')).toHaveValue('7')
    await expect(page.locator('#macs_level')).toHaveValue('II')
    await page.locator('#age').fill('8')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved')).toBeVisible()
    await page.reload()
    await expect(page.locator('#age')).toHaveValue('8')

    // Delete is opened by a button named after the child, then gated on typing
    // the phrase back — components/delete-entity-button.tsx builds both from the
    // same label, so the user reads the identifier twice. Same shape as the toy
    // deletion in dashboard/toys.spec.ts.
    await page.getByRole('button', { name: 'Delete Emma' }).click()
    await page.getByLabel(/to confirm/i).fill('confirm_delete_Emma')
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page).toHaveURL('/dashboard/child')
    await expect(page.getByRole('link', { name: /Emma/ })).toHaveCount(0)
    // The survivor renumbers, because position is computed and not stored.
    await expect(page.getByRole('link', { name: /Child 1/ })).toBeVisible()
  } finally {
    await deleteUser(contributor.id)
  }
})

/**
 * Journey 5. Checked first whether the nav renders the user's name: it does
 * not — the rail (components/rail.tsx) shows only role-gated links and a
 * Sign out button, static labels, not the account name. So this asserts
 * persistence the way every other row in this file does: save, reload the
 * same tab, and read the field back — not a nav element that was never
 * wired to the name.
 */
test('a user renames themselves on the Profile tab and the change persists', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  const newName = uniqueTitle('Renamed Contributor')

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    await page.getByRole('link', { name: 'Profile', exact: true }).click()
    await expect(page).toHaveURL('/dashboard/profile')

    await page.locator('#name').fill(newName)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved')).toBeVisible()

    await page.reload()
    await expect(page.locator('#name')).toHaveValue(newName)
  } finally {
    await deleteUser(contributor.id)
  }
})

test('the collapsed rail survives a reload without flashing open', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    const shell = page.locator('.shell')
    await expect(shell).toHaveAttribute('data-collapsed', 'false')

    await page.getByRole('button', { name: 'Collapse navigation' }).click()
    await expect(shell).toHaveAttribute('data-collapsed', 'true')

    // Chain: the cookie is read on the server, so the very first paint after a
    //        reload is already collapsed. A localStorage read in an effect
    //        would render expanded and snap.
    //
    // The DOM assertion below only proves the settled state — Playwright's
    // auto-retrying expect would still pass if the first frame rendered
    // expanded and a client effect corrected it moments later, which is
    // exactly the flash this test is named for. Fetching the raw HTML
    // response (sharing the page's cookies, including rail-collapsed) proves
    // the collapsed attribute was baked in before any client JS ran, which a
    // client-side determination cannot fake: there is no frame at which the
    // server-rendered bytes said 'false'.
    const html = await (await page.request.get(page.url())).text()
    expect(html).toContain('data-collapsed="true"')

    await page.reload()
    await expect(shell).toHaveAttribute('data-collapsed', 'true')

    // Survives a navigation too.
    await page.getByRole('link', { name: 'Profile', exact: true }).click()
    await expect(page).toHaveURL('/dashboard/profile')
    await expect(shell).toHaveAttribute('data-collapsed', 'true')
  } finally {
    await deleteUser(contributor.id)
  }
})

test('the rail opens as a drawer on a narrow viewport', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    const drawer = page.locator('dialog.shell-drawer')
    await expect(drawer).toBeHidden()

    await page.getByRole('button', { name: 'Open navigation' }).click()
    await expect(drawer).toBeVisible()

    await drawer.getByRole('link', { name: 'Child profiles', exact: true }).click()
    await expect(page).toHaveURL('/dashboard/child')
    await expect(drawer).toBeHidden()
  } finally {
    await deleteUser(contributor.id)
  }
})

// Chain: showModal() gives the drawer two native dismissal paths for free —
//        Escape and a backdrop click — neither exercised by the "opens as a
//        drawer" test above, which closes it via a row's onNavigate instead.
//        This is the last task that can add that coverage (shell-frame.tsx
//        shipped without unit tests in Task 4).
test('the drawer closes on Escape', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    const drawer = page.locator('dialog.shell-drawer')
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await expect(drawer).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
  } finally {
    await deleteUser(contributor.id)
  }
})

test('the drawer closes on a backdrop click', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    const drawer = page.locator('dialog.shell-drawer')
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await expect(drawer).toBeVisible()

    // The drawer box is 15rem (240px) wide on a 390px viewport; clicking past
    // it lands on the dialog's ::backdrop, whose click target is the dialog
    // element itself — not inside the rail content.
    await page.mouse.click(300, 400)
    await expect(drawer).toBeHidden()
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
    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByTestId('tutorial-row').filter({ hasText: title })).toBeVisible()
  } finally {
    await deleteUser(contributor.id)
  }
})

test('a placeholder route explains the feature instead of 404ing', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    await page.getByRole('link', { name: /Toy library/ }).click()
    await expect(page).toHaveURL('/toy-library')
    await expect(page.getByText('Toy Library is coming soon.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Browse tutorials' })).toBeVisible()
  } finally {
    await deleteUser(contributor.id)
  }
})

// Chain: the shell's <main> replaced the root layout's `mx-auto w-full
//        max-w-6xl` for every signed-in page, not just the dashboard. Dropping
//        the cap outright stretched library grids, prose and admin tables to
//        the full window on an ultrawide display while a signed-out visitor on
//        the same URL kept a column. reflow.spec.ts only tests narrow
//        viewports, so nothing else in the suite looks this way.
test('the main content column stays capped on an ultrawide viewport', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    await page.setViewportSize({ width: 2560, height: 1200 })
    const box = await page.locator('main#main').boundingBox()
    expect(box).not.toBeNull()
    // max-w-[100rem] = 1600px, border-box. Uncapped it would be ~2320 here
    // (2560 less the 15rem rail), so this fails loudly on a regression.
    expect(box!.width).toBeLessThanOrEqual(1601)
  } finally {
    await deleteUser(contributor.id)
  }
})

// Chain: WCAG 2.4.1 Bypass Blocks, Level A. The rail put up to fourteen tab
//        stops ahead of the page content on every route. A link that only
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

// Chain: a rail on the terms gate offers links middleware bounces straight
//        back, which is an escape hatch out of a gate.
test('the onboarding gate renders without the rail', async ({ page }) => {
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
    await expect(page.locator('.shell-rail')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Review queue' })).toHaveCount(0)
  } finally {
    await deleteUser(contributor.id)
  }
})
