import path from 'node:path'
import { test, expect } from '@playwright/test'
import {
  signIn,
  createContributor,
  createParent,
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
 * anything: capability-derived nav groups on the rail, a merged dashboard, and
 * an account model where 'parent' and 'contributor' are the same kind of thing
 * underneath.
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
    await expect(page.getByRole('link', { name: 'Child profile', exact: true })).toBeVisible()
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

test('a contributor with no child profile creates one from the Child profile tab, and it persists across a reload', async ({
  page,
}) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    await page.getByRole('link', { name: 'Child profile', exact: true }).click()
    await expect(page).toHaveURL('/dashboard/child')

    await page.locator('#age').fill('7')
    await page.locator('#primary_diagnosis').fill('Cerebral palsy')
    await page.locator('#macs_level').selectOption('II')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved')).toBeVisible()

    await page.reload()
    await expect(page.locator('#age')).toHaveValue('7')
    await expect(page.locator('#primary_diagnosis')).toHaveValue('Cerebral palsy')
    await expect(page.locator('#macs_level')).toHaveValue('II')
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

test('a mobile-registered parent signs in on web and uploads a tutorial', async ({ page }) => {
  const parent = await createParent()
  await acceptTerms(parent.id)
  const title = uniqueTitle('Parent Uploaded')

  try {
    await signIn(page, parent.email, parent.password)
    await page.waitForURL('**/dashboard')

    await page.goto('/upload')

    // Step 1: Details
    await page.getByPlaceholder('e.g. Fisher-Price Piano').fill(title)
    await page.getByRole('button', { name: 'easy', exact: true }).click()
    await page.getByRole('button', { name: 'Next →' }).click()

    // Step 2: Files
    await page.locator('input[name="tutorial_pdf"]').setInputFiles(PDF_FIXTURE)
    await page.locator('input[name="toy_photo"]').setInputFiles(PHOTO_FIXTURE)
    await expect(page.getByRole('button', { name: 'Next →' })).toBeEnabled({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Next →' }).click()

    // Step 3: Parts
    await page.getByRole('button', { name: '+ Add part' }).click()
    await page.getByPlaceholder('Part name *').fill('E2E parent part')
    await page.getByRole('button', { name: 'Next →' }).click()

    // Step 4: Tools
    await page.getByRole('button', { name: '+ Add tool' }).click()
    await page.getByPlaceholder('Tool name *').fill('E2E parent tool')
    await page.getByRole('button', { name: 'Next →' }).click()

    // Step 5: STL files (optional — skip)
    await page.getByRole('button', { name: 'Next →' }).click()

    // Step 6: Review & submit. This is the write that was refused by RLS
    // before this work: a role='parent' account, not merely a UI gate.
    await expect(page.getByText(title)).toBeVisible()
    await page.getByRole('button', { name: 'Submit for review' }).click()

    await page.waitForURL('**/dashboard')
    const row = page.getByTestId('tutorial-row').filter({ hasText: title })
    await expect(row).toBeVisible()
    await expect(row.getByText('PENDING', { exact: true })).toBeVisible()
  } finally {
    await deleteUser(parent.id)
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

    await drawer.getByRole('link', { name: 'Child profile', exact: true }).click()
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
