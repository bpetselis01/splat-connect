import { test, expect } from '@playwright/test'
import {
  createContributor,
  createAdmin,
  createTutorial,
  createOrgWithLeader,
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
    // 1. The leader sees the request only once the author has made it, so start
    //    with an empty queue to prove the row that appears is the one we created.
    await signIn(page, leader.email, leader.password)
    await page.goto(`/org/${orgId}`)
    await expect(page.getByRole('heading', { name: orgName })).toBeVisible()
    await expect(page.getByText(title)).toHaveCount(0)

    // 2. The author asks the organisation to back it. Done through the API rather
    //    than the six-step wizard: the wizard has its own coverage, and what
    //    matters here is that the leader's screen reacts.
    await page.request.post(`/api/tutorials/${tutorialId}/orgs`, { data: { org_id: orgId } })

    // 3. The leader accepts the terms, then backs it.
    await page.goto(`/org/${orgId}`)
    await expect(page.getByRole('heading', { name: /Accept the leader terms/i })).toBeVisible()
    await page.getByRole('button', { name: /I accept the organisation leader terms/i }).click()
    await expect(page.getByRole('heading', { name: /Accept the leader terms/i })).toHaveCount(0)

    await expect(page.getByText(title)).toBeVisible()
    await page.getByRole('button', { name: /Back this project/i }).click()

    // 4. And approves it.
    await page.getByRole('link', { name: title }).click()
    await page.getByRole('button', { name: /Approve and publish/i }).click()
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}$`))

    // 5. It is public, with the badge and the approver — what a parent sees.
    await page.goto(`/tutorials/${tutorialId}`)
    await expect(page.getByText(new RegExp(`Backed by ${orgName}`))).toBeVisible()
    await expect(page.getByText(/Approved by /)).toBeVisible()

    // 6. And it reaches the admin's spot-check, because the admin did not approve it.
    await signIn(page, admin.email, admin.password)
    await page.goto('/admin/spot-check')
    await expect(page.getByText(title)).toBeVisible()
  } finally {
    await deleteOrg(orgId)
    await deleteUser(author.id)
    await deleteUser(leader.id)
    await deleteUser(admin.id)
  }
})
