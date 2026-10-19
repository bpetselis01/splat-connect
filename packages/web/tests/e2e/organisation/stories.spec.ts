import { test, expect, type Page } from '@playwright/test'
import { adminClient, createContributor, deleteUser, uniqueTitle } from '../helpers'
import { createLeaderSeat, removeLeaderSeat, signInAs, type LeaderSeat } from './leader'

let leader: LeaderSeat
let follower: Awaited<ReturnType<typeof createContributor>>

test.beforeAll(async () => {
  leader = await createLeaderSeat(`Stories Org ${Date.now()}`)
  follower = await createContributor()
  await adminClient().from('org_follows').insert({ org_id: leader.orgId, profile_id: follower.id })
})

test.afterAll(async () => {
  await removeLeaderSeat(leader)
  await deleteUser(follower.id)
})

async function fillStory(page: Page, title: string) {
  await page.getByLabel('Title', { exact: true }).fill(title)
  await page.getByLabel('One-sentence summary').fill('A drum, six weeks on.')
  await page.getByLabel(/^The story/).fill('It still gets played every day.')
  await page.getByLabel(/^Byline/).fill('The club')
}

async function followerSees(page: Page, line: string) {
  await signInAs(page, follower)
  await page.goto('/notifications')
  await expect(page.getByText(line)).toBeVisible()
}

test('WB25 publishing a new story needs the consent tick, lands on its public page and tells a follower', async ({ page }) => {
  const title = uniqueTitle('Leo’s drum')
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/stories/new')
  await fillStory(page, title)
  await expect(page.getByRole('button', { name: 'Publish to Stories' })).toBeDisabled()
  await page.getByRole('checkbox').check({ force: true })
  await page.getByRole('button', { name: 'Publish to Stories' }).click()
  await expect(page).toHaveURL(/\/about\/stories\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await followerSees(page, `${leader.orgName} published a story: ${title}`)
})

test('WB25 a draft saves without consent, returns to the list as a Draft and has no public page', async ({ page }) => {
  const title = uniqueTitle('Not yet')
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/stories/new')
  await fillStory(page, title)
  await page.getByRole('button', { name: 'Save as draft' }).click()
  await expect(page).toHaveURL('/dashboard/organisation/publish')
  await page.getByRole('tab', { name: /Stories/ }).click()
  const row = page.locator('article', { hasText: title })
  await expect(row).toContainText('Draft')
  await expect(row).toContainText('consent not confirmed')
  await expect(row.getByRole('link', { name: 'View' })).toHaveCount(0)
})

test('WB26 editing a draft and choosing "Publish to Stories" with consent publishes it and tells a follower', async ({ page }) => {
  const title = uniqueTitle('Draft to live story')
  const { data, error } = await adminClient()
    .from('org_stories')
    .insert({ org_id: leader.orgId, kind: 'family', title, summary: 'One sentence.', body: 'A paragraph.', byline: 'The club', consent_confirmed: false, status: 'draft', created_by: leader.id })
    .select('id')
    .single()
  if (error || !data) throw new Error(`story seed failed: ${error?.message}`)
  await signInAs(page, leader)
  await page.goto(`/dashboard/organisation/stories/${data.id}/edit`)
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(title)
  await expect(page.getByRole('button', { name: 'Publish to Stories' })).toBeDisabled()
  await page.getByRole('checkbox').check({ force: true })
  await page.getByRole('button', { name: 'Publish to Stories' }).click()
  await expect(page).toHaveURL(`/about/stories/${data.id}`)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await followerSees(page, `${leader.orgName} published a story: ${title}`)
})

test('WB26 an edit URL for a story that is not this organisation’s is a 404', async ({ page }) => {
  await signInAs(page, leader)
  const res = await page.goto('/dashboard/organisation/stories/00000000-0000-0000-0000-000000000000/edit')
  expect(res?.status()).toBe(404)
})
