import { test, expect } from '@playwright/test'
import {
  acceptTerms,
  addLeader,
  createContributor,
  createOrg,
  createTutorial,
  deleteOrg,
  deleteUser,
  makeLeader,
  seedBackingRequest,
  adminClient,
  uniqueTitle,
} from '../helpers'
import { createLeaderSeat, removeLeaderSeat, signInAs, type LeaderSeat } from './leader'

let leader: LeaderSeat
let author: Awaited<ReturnType<typeof createContributor>>

test.beforeAll(async () => {
  leader = await createLeaderSeat(`Review Org ${Date.now()}`)
  author = await createContributor()
  await acceptTerms(author.id)
})

test.afterAll(async () => {
  await removeLeaderSeat(leader)
  await deleteUser(author.id)
})

async function askedTutorial(title: string) {
  const id = await createTutorial(author.id, { title, status: 'pending' })
  await seedBackingRequest(id, leader.orgId)
  return id
}

test('WB01 a leader of two organisations picks which one the other pages act for', async ({ page }) => {
  const second = `Second Org ${Date.now()}`
  const secondId = await makeLeader(leader.id, second)
  try {
    await signInAs(page, leader)
    await page.goto('/dashboard/organisation')
    for (const name of [second, leader.orgName]) {
      await page.getByRole('button', { name: /^Acting for .*\. Change organisation\.$/ }).click()
      await page.getByRole('radio', { name: new RegExp(name) }).click()
      await expect(page.getByRole('button', { name: `Acting for ${name}. Change organisation.` })).toBeVisible()
      await page.goto('/dashboard/organisation/requests')
      await expect(page.getByRole('heading', { name: `Requests to ${name}` })).toBeVisible()
      await page.goto('/dashboard/organisation')
    }
  } finally {
    await adminClient().from('org_leaders').delete().eq('org_id', secondId)
    await deleteOrg(secondId)
  }
})

test('WB02 the review queue lists what is waiting on the organisation and opens the project', async ({ page }) => {
  const asked = uniqueTitle('Asked to back')
  const askedId = await askedTutorial(asked)
  const reviewTitle = uniqueTitle('Ready to review')
  const reviewId = await createTutorial(author.id, { title: reviewTitle, status: 'pending' })
  await adminClient().from('tutorial_orgs').insert({ tutorial_id: reviewId, org_id: leader.orgId, status: 'accepted' })
  try {
    await signInAs(page, leader)
    await page.goto('/dashboard/organisation')
    await expect(page.getByText('2 waiting')).toBeVisible()
    await expect(page.getByText('Leader terms accepted')).toBeVisible()
    const rows = page.locator('article')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText(asked)
    await expect(rows.nth(0)).toContainText('Asked to back')
    await expect(rows.nth(1)).toContainText(reviewTitle)
    await expect(rows.nth(1)).toContainText('Ready to review')
    await rows.nth(1).getByRole('link', { name: 'Start the review' }).click()
    await expect(page).toHaveURL(`/organizations/${leader.orgId}/projects/${reviewId}`)
    await expect(page.getByRole('button', { name: 'Approve and publish' })).toBeVisible()
  } finally {
    await adminClient().from('tutorials').delete().in('id', [askedId, reviewId])
  }
})

test('WB03 a leader who has not accepted the leader terms is asked to, and the strip clears once they do', async ({ page }) => {
  const bare = await createContributor()
  await acceptTerms(bare.id)
  const orgId = await createOrg(`Unsigned Org ${Date.now()}`)
  await addLeader(orgId, bare.id)
  try {
    await signInAs(page, bare)
    await page.goto('/dashboard/organisation')
    await expect(page.getByText('You have not accepted the leader terms. You can read the queue, but not approve anything.')).toBeVisible()
    await expect(page.getByText('Leader terms accepted')).toHaveCount(0)
    await page.getByRole('button', { name: 'Read and accept' }).click()
    await page.getByRole('button', { name: /I accept the organisation leader terms/i }).click()
    await expect(page.getByText('Leader terms accepted')).toBeVisible()
    await expect(page.getByText('You have not accepted the leader terms.', { exact: false })).toHaveCount(0)
  } finally {
    await deleteOrg(orgId)
    await deleteUser(bare.id)
  }
})

test('WB04 backing a project tells the author, and the review decision replaces the ask', async ({ page }) => {
  const title = uniqueTitle('Back me')
  const id = await askedTutorial(title)
  try {
    await signInAs(page, leader)
    await page.goto(`/organizations/${leader.orgId}/projects/${id}`)
    await page.getByRole('button', { name: 'Back this project' }).click()
    await expect(page.getByRole('button', { name: 'Approve and publish' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back this project' })).toHaveCount(0)

    await signInAs(page, author)
    await page.goto('/notifications')
    await expect(page.getByText(`${leader.orgName} agreed to back "${title}"`)).toBeVisible()
  } finally {
    await adminClient().from('tutorials').delete().eq('id', id)
  }
})

test('WB05 declining a project returns the leader to the organisation and tells the author', async ({ page }) => {
  const title = uniqueTitle('Not for us')
  const id = await askedTutorial(title)
  try {
    await signInAs(page, leader)
    await page.goto(`/organizations/${leader.orgId}/projects/${id}`)
    await page.getByRole('button', { name: 'Decline', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/organizations/${leader.orgId}$`))

    await signInAs(page, author)
    await page.goto('/notifications')
    await expect(page.getByText(`${leader.orgName} can't back "${title}" right now`)).toBeVisible()
  } finally {
    await adminClient().from('tutorials').delete().eq('id', id)
  }
})

test('WB06 approving publishes the guide under the organisation and tells the author', async ({ page }) => {
  const title = uniqueTitle('Approve me')
  const id = await askedTutorial(title)
  await adminClient().from('tutorial_orgs').update({ status: 'accepted' }).eq('tutorial_id', id)
  try {
    await signInAs(page, leader)
    await page.goto(`/organizations/${leader.orgId}/projects/${id}`)
    await page.getByRole('button', { name: 'Approve and publish' }).click()
    await expect(page).toHaveURL(new RegExp(`/organizations/${leader.orgId}$`))

    await page.goto(`/tutorials/${id}`)
    await expect(page.getByText(new RegExp(`Backed by ${leader.orgName}`))).toBeVisible()

    await signInAs(page, author)
    await page.goto('/notifications')
    await expect(page.getByText(`"${title}" was approved and is now published`)).toBeVisible()
  } finally {
    await adminClient().from('tutorials').delete().eq('id', id)
  }
})

test('WB07 rejecting needs a note, keeps the guide off the library and tells the author', async ({ page }) => {
  const title = uniqueTitle('Send back')
  const id = await askedTutorial(title)
  await adminClient().from('tutorial_orgs').update({ status: 'accepted' }).eq('tutorial_id', id)
  try {
    await signInAs(page, leader)
    await page.goto(`/organizations/${leader.orgId}/projects/${id}`)
    await page.getByLabel('Why are you rejecting this?').fill('The bolt list is missing a washer.')
    await page.getByRole('button', { name: 'Reject' }).click()
    await expect(page).toHaveURL(new RegExp(`/organizations/${leader.orgId}$`))

    await signInAs(page, author)
    await page.goto('/notifications')
    await expect(page.getByText(`"${title}" was rejected`)).toBeVisible()
    await expect(page.getByText('The bolt list is missing a washer.')).toBeVisible()
  } finally {
    await adminClient().from('tutorials').delete().eq('id', id)
  }
})
