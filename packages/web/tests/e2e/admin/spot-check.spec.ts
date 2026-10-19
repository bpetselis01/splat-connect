import { test, expect } from '@playwright/test'
import { createAdmin, createContributor, createOrg, createTutorial, deleteOrg, makeLeader, seedLeaderApproval, signIn, uniqueTitle } from '../helpers'

test('WM10 spot-check lists a guide a leader approved, and its Review and Unpublish links open the review page', async ({ page }) => {
  const author = await createContributor()
  const leader = await createContributor()
  const admin = await createAdmin()
  const title = uniqueTitle('E2E Spot Check')
  const orgName = uniqueTitle('E2E Spot Org')
  const orgId = await createOrg(orgName)
  try {
    await makeLeader(leader.id, undefined, orgId)
    const id = await createTutorial(author.id, { title, status: 'pending' })
    await seedLeaderApproval(id, orgId, leader.id)

    await signIn(page, admin.email, admin.password)
    await page.waitForURL('**/admin')
    // The sample is random and capped at ten by default; a wide limit makes the fixture appear.
    await page.goto('/admin/spot-check?limit=500')

    const row = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: title, exact: true }) })
    await expect(row).toContainText(`for ${orgName}`)
    await expect(row.getByRole('link', { name: 'Open' })).toHaveAttribute('href', `/admin/review/${id}`)
    await expect(row.getByRole('link', { name: 'Unpublish' })).toHaveAttribute('href', `/admin/review/${id}#unpublish`)

    await row.getByRole('link', { name: 'Unpublish' }).click()
    await page.waitForURL(`**/admin/review/${id}#unpublish`)
    await expect(page.getByRole('heading', { name: 'Unpublish this tutorial' })).toBeVisible()
  } finally {
    await deleteOrg(orgId)
  }
})
