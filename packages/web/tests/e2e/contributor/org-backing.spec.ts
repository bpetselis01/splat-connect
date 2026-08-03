import { test, expect } from '@playwright/test'
import {
  createContributor,
  createAdmin,
  createTutorial,
  createOrgWithLeader,
  seedBackingRequest,
  seedLeaderApproval,
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
    await acceptTerms(leader.id)
    await signIn(page, leader.email, leader.password)
    // Wait for the post-login redirect: signIn only clicks the button, so
    // navigating straight away races the auth cookie being set.
    await page.waitForURL('**/dashboard')
    await page.goto(`/organizations/${orgId}`)
    await expect(page.getByRole('heading', { name: orgName })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Accept the leader terms/i })).toBeVisible()
    await page.getByRole('button', { name: /I accept the organisation leader terms/i }).click()
    await expect(page.getByRole('heading', { name: /Accept the leader terms/i })).toHaveCount(0)

    // 3. They open it FROM THE QUEUE. This click is the test: it used to land on
    //    the public tutorial page, which serves approved work only, so the leader
    //    got a 404 on the one thing they must read before deciding. The earlier
    //    version of this journey navigated straight to the review URL and hid it.
    await page.getByRole('link', { name: title }).click()
    await expect(page).toHaveURL(`/organizations/${orgId}/projects/${tutorialId}`)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()

    // 4. And backs it. This stays on the page rather than returning to the queue,
    //    which is deliberate: backing leaves the leader with work still to do here,
    //    so the next action replaces the last one in place. Declining redirects,
    //    because after declining there is nothing left on this page.
    await page.getByRole('button', { name: /Back this project/i }).click()
    await expect(page.getByRole('button', { name: /Approve and publish/i })).toBeVisible()

    // 5. Approving is the end of the leader's work, so that one does return.
    await page.getByRole('button', { name: /Approve and publish/i }).click()
    await expect(page).toHaveURL(new RegExp(`/organizations/${orgId}$`))

    // 6. It is public, with the badge and the approver — what a parent sees.
    await page.goto(`/tutorials/${tutorialId}`)
    await expect(page.getByText(new RegExp(`Backed by ${orgName}`))).toBeVisible()
    await expect(page.getByText(/Approved by /)).toBeVisible()

    // 7. And it reaches the admin's spot-check, because the admin did not approve it.
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
  await acceptTerms(leader.id)
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
    // Through the project page: the queue lists, the project page acts. Deciding
    // without opening the thing you are deciding on was never the intent.
    await page.getByRole('link', { name: title }).click()
    await page.getByRole('button', { name: /^Decline$/ }).click()
    await expect(page).toHaveURL(new RegExp(`/organizations/${orgA}$`))

    // The author finds out on a page they already visit — nobody told them.
    await signIn(page, author.email, author.password)
    await page.waitForURL('**/dashboard')
    await page.goto('/my-tutorials')
    // Assert on the sentence that does the work, not the bare word: a contributor
    // whose organisations all said no must be told the tutorial is still queued.
    await expect(page.getByText(/declined · now reviewed by SPLAT/i)).toBeVisible()

    // And asks someone else, from the project itself.
    await page.goto(`/tutorials/${tutorialId}/edit`)
    await page.getByRole('tab', { name: 'Backing' }).click()
    await page.getByLabel(/Ask another organisation/i).selectOption(orgB)
    await page.getByRole('button', { name: /^Ask$/ }).click()
    // The panel shows the state badge beside the organisation's name; the
    // "X is deciding" sentence is the row-summary form used on /my-tutorials.
    await expect(page.getByText('DECIDING')).toBeVisible()
    // The stepper's collapsed pills show only a status glyph (done/attention/
    // neutral), never descriptive text, so there is no closed-pill equivalent
    // of the old accordion summary's "waiting" wording to assert on here.
  } finally {
    await deleteOrg(orgA)
    await deleteOrg(orgB)
    await deleteUser(author.id)
    await deleteUser(leader.id)
  }
})

/**
 * The other half of decision 14. The self-review block was removed on the argument
 * that the controls are reactive — spot-check surfaces a bad approval and the admin
 * responds. Detection shipped; the response did not. `/admin/review/[id]` refused
 * anything not pending, so an admin who found bad work had nowhere to click.
 */
test('an admin unpublishes a tutorial a leader approved', async ({ page }) => {
  const author = await createContributor()
  await acceptTerms(author.id)
  const leader = await createContributor()
  const admin = await createAdmin()
  const orgId = await createOrgWithLeader(leader.id, `Overruled ${Date.now()}`)
  const title = uniqueTitle('Published in error')
  const tutorialId = await createTutorial(author.id, { title, status: 'pending' })
  await seedLeaderApproval(tutorialId, orgId, leader.id)

  try {
    // 1. It is live, which is what makes taking it down a different act from
    //    turning down a submission — a parent may already have printed it.
    await page.goto(`/tutorials/${tutorialId}`)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()

    // 2. The admin finds it where the design says they will: spot-check lists what
    //    someone else approved.
    await signIn(page, admin.email, admin.password)
    await page.waitForURL('**/admin')
    await page.goto('/admin/spot-check')

    // 3. One click to the project, not to the public page. This link used to be a
    //    dead end: it went to /tutorials/[id], which offers an admin nothing.
    await page.getByRole('link', { name: title }).click()
    await expect(page).toHaveURL(`/admin/review/${tutorialId}`)

    // 4. The page names who approved it and for which organisation, because that is
    //    the context an admin needs before overriding another person's judgement.
    await expect(page.getByText(/Approved by/)).toBeVisible()

    // 5. The note is required — an unexplained takedown leaves the contributor
    //    nothing to act on.
    await page
      .getByLabel(/Why are you taking it down\?/i)
      .fill('Uses a part we cannot verify as child-safe.')
    await page.getByRole('button', { name: /^Unpublish$/ }).click()
    await expect(page).toHaveURL(/\/admin\/spot-check/)

    // 6. It is gone from the library.
    await page.goto(`/tutorials/${tutorialId}`)
    await expect(page.getByRole('heading', { name: title })).toHaveCount(0)

    // 7. And the contributor is told why, on the page they already use.
    await signIn(page, author.email, author.password)
    await page.waitForURL('**/dashboard')
    await page.goto('/my-tutorials')
    await expect(page.getByText(/child-safe/)).toBeVisible()
  } finally {
    await deleteOrg(orgId)
    await deleteUser(author.id)
    await deleteUser(leader.id)
    await deleteUser(admin.id)
  }
})
