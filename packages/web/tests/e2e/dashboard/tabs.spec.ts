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
 * The six journeys that prove the three unified-dashboard sub-projects work
 * end to end: one dashboard, capability-derived tabs, and an account model
 * where 'parent' and 'contributor' are the same kind of thing underneath.
 */

test('a contributor sees three tabs, not four', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    await expect(page.getByRole('link', { name: 'Tutorials', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Child profile', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Profile', exact: true })).toBeVisible()
    // Organisation is gated on leading an org — this account leads none.
    await expect(page.getByRole('link', { name: 'Organisation', exact: true })).toHaveCount(0)
  } finally {
    await deleteUser(contributor.id)
  }
})

test('a leader sees all four tabs, and the queue merges across two organisations with no picker', async ({
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

    // All four tabs, because this account leads an organisation.
    await expect(page.getByRole('link', { name: 'Tutorials', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Organisation', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Child profile', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Profile', exact: true })).toBeVisible()

    await page.getByRole('link', { name: 'Organisation', exact: true }).click()
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

    await page.getByRole('link', { name: 'Organisation', exact: true }).click()
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
 * not — components/nav.tsx shows only role-gated links and a Sign out
 * button, and the dashboard tab strip (components/dashboard-tabs.tsx) is
 * static labels, not the account name. So this asserts persistence the way
 * every other tab in this file does: save, reload the same tab, and read the
 * field back — not a nav element that was never wired to the name.
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

    await page.waitForURL('**/my-tutorials')
    const row = page.getByTestId('tutorial-row').filter({ hasText: title })
    await expect(row).toBeVisible()
    await expect(row.getByText('PENDING', { exact: true })).toBeVisible()
  } finally {
    await deleteUser(parent.id)
  }
})
