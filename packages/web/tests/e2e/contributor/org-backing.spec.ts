import { test, expect } from '@playwright/test'
import {
  createContributor,
  createAdmin,
  createTutorial,
  createOrgWithLeader,
  seedBackingRequest,
  acceptTerms,
  deleteOrg,
  deleteUser,
  signIn,
  uniqueTitle,
} from '../helpers'

/**
 * The whole delegated-review loop in one journey. The API has 110 integration
 * tests covering the rules; what this proves is that the screens are wired to
 * them — that a contributor can reach an organisation, a leader can answer, and a
 * parent sees the result.
 */
test('a project is backed by an organisation and published by its leader', async ({ page }) => {
  const author = await createContributor()
  const leader = await createContributor()
  const admin = await createAdmin()
  const orgName = `Riverside ${Date.now()}`
  const orgId = await createOrgWithLeader(leader.id, orgName)
  const title = uniqueTitle('Backed')
  const tutorialId = await createTutorial(author.id, { title, status: 'pending' })

  try {
    // 1. The author asks the organisation to back it. Seeded rather than driven
    //    through the six-step wizard: the wizard and the request endpoint both have
    //    their own coverage, and what this journey is for is the leader's screens.
    await seedBackingRequest(tutorialId, orgId)

    // 2. The leader arrives and is asked for the terms before anything else.
    await signIn(page, leader.email, leader.password)
    // Wait for the post-login redirect: signIn only clicks the button, so
    // navigating straight away races the auth cookie being set.
    await page.waitForURL('**/dashboard')
    await page.goto(`/organizations/${orgId}`)
    await expect(page.getByRole('heading', { name: orgName })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Accept the leader terms/i })).toBeVisible()
    await page.getByRole('button', { name: /I accept the organisation leader terms/i }).click()
    await expect(page.getByRole('heading', { name: /Accept the leader terms/i })).toHaveCount(0)

    await expect(page.getByText(title)).toBeVisible()
    await page.getByRole('button', { name: /Back this project/i }).click()

    // 3. Backing moves it from "asking" to "waiting for review". Assert on the
    //    review link's presence rather than clicking by title: the title appears in
    //    both lists, and in the asking list it links to the public page, which 404s
    //    for a tutorial that is not published yet.
    await expect(
      page.getByRole('link', { name: title }).and(page.locator(`a[href*="/review/"]`))
    ).toBeVisible()

    // 4. And approves it.
    await page.goto(`/organizations/${orgId}/review/${tutorialId}`)
    await page.getByRole('button', { name: /Approve and publish/i }).click()
    await expect(page).toHaveURL(new RegExp(`/organizations/${orgId}$`))

    // 5. It is public, with the badge and the approver — what a parent sees.
    await page.goto(`/tutorials/${tutorialId}`)
    await expect(page.getByText(new RegExp(`Backed by ${orgName}`))).toBeVisible()
    await expect(page.getByText(/Approved by /)).toBeVisible()

    // 6. And it reaches the admin's spot-check, because the admin did not approve it.
    await signIn(page, admin.email, admin.password)
    await page.waitForURL('**/admin')
    await page.goto('/admin/spot-check')
    await expect(page.getByText(title)).toBeVisible()
  } finally {
    await deleteOrg(orgId)
    await deleteUser(author.id)
    await deleteUser(leader.id)
    await deleteUser(admin.id)
  }
})

/**
 * The loop this whole feature exists to close, and the one that was untestable
 * before these screens existed: a contributor learns their project was turned down
 * and asks someone else, without anyone telling them where to look.
 */
test('a contributor sees a decline and asks someone else', async ({ page }) => {
  const author = await createContributor()
  await acceptTerms(author.id)
  const leader = await createContributor()
  await acceptTerms(leader.id, 'org_leader_terms')
  const orgA = await createOrgWithLeader(leader.id, `Declining ${Date.now()}`)
  const orgB = await createOrgWithLeader(leader.id, `Second ${Date.now()}`)
  const title = uniqueTitle('Turned down')
  const tutorialId = await createTutorial(author.id, { title, status: 'pending' })
  await seedBackingRequest(tutorialId, orgA)

  try {
    // The leader turns it down.
    await signIn(page, leader.email, leader.password)
    await page.waitForURL('**/dashboard')
    await page.goto(`/organizations/${orgA}`)
    await page.getByRole('button', { name: /^Decline$/ }).click()

    // The author finds out on a page they already visit — nobody told them.
    await signIn(page, author.email, author.password)
    await page.waitForURL('**/dashboard')
    await page.goto('/my-tutorials')
    // Assert on the sentence that does the work, not the bare word: a contributor
    // whose organisations all said no must be told the tutorial is still queued.
    await expect(page.getByText(/declined · now reviewed by SPLAT/i)).toBeVisible()

    // And asks someone else, from the project itself.
    await page.goto(`/tutorials/${tutorialId}/edit`)
    await page.getByText('Backing', { exact: false }).last().click()
    await page.getByLabel(/Ask another organisation/i).selectOption(orgB)
    await page.getByRole('button', { name: /^Ask$/ }).click()
    // The panel shows the state badge beside the organisation's name; the
    // "X is deciding" sentence is the row-summary form used on /my-tutorials.
    await expect(page.getByText('DECIDING')).toBeVisible()
    // And the accordion summary answers the question while shut.
    await expect(page.getByText(/Backing\s*waiting/i)).toBeVisible()
  } finally {
    await deleteOrg(orgA)
    await deleteOrg(orgB)
    await deleteUser(author.id)
    await deleteUser(leader.id)
  }
})
