// journeys: P04 L24 C11
import { test, expect } from '@playwright/test'
import {
  adminClient,
  createChallenge,
  createContributor,
  makeOrgLeader,
  signInAsNewContributor,
  uniqueTitle,
} from './helpers'
import { partyPage } from './org-fixtures'

/**
 * Live counts that move after a tap, with no reload in between: the org page's
 * "Thanked N times", the leader's thanks tally, and a challenge's "N saves".
 */

async function seedThanks(orgId: string, profileId: string, over: Record<string, unknown> = {}) {
  const { error } = await adminClient().from('org_thanks').insert({ org_id: orgId, profile_id: profileId, ...over })
  if (error) throw new Error(`seedThanks failed: ${error.message}`)
}

test('sending thanks moves "Thanked N times" on the org page without a reload', async ({ page }) => {
  const family = await signInAsNewContributor(page)
  const leader = await createContributor()
  const orgId = await makeOrgLeader(leader.id, uniqueTitle('E2E Thanked Org'))
  const earlier = await createContributor()
  await seedThanks(orgId, earlier.id)

  await page.goto(`/toy-library/organisation/${orgId}`)
  await expect(page.getByText('Thanked 1 time', { exact: true })).toBeVisible()

  const posted = page.waitForResponse((r) => r.url().endsWith(`/api/organizations/${orgId}/thanks`) && r.request().method() === 'POST')
  await page.getByRole('button', { name: /^Say thanks to/ }).click()
  await page.getByRole('button', { name: 'Send thanks' }).click()
  expect((await posted).status()).toBe(201)

  await expect(page.getByText('Thanked 2 times', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Thanked', exact: true })).toBeVisible()

  const { data } = await adminClient().from('org_thanks').select('profile_id').eq('org_id', orgId)
  expect(data?.map((r) => r.profile_id).sort()).toEqual([earlier.id, family.id].sort())
})

test('hiding a thanks note flips it to Hidden and Show again, and the counts stay put', async ({ page, browser, baseURL }) => {
  const leader = await signInAsNewContributor(page)
  const orgId = await makeOrgLeader(leader.id, uniqueTitle('E2E Hide Org'))
  const author = await createContributor()
  await seedThanks(orgId, author.id, { note: 'You fixed our switch.', byline: 'Wren', show_note: true })

  await page.goto('/organisation/profile')
  await expect(page.getByText('1 family has said thanks.', { exact: false })).toBeVisible()
  await expect(page.getByText('Wren · On your page')).toBeVisible()

  await page.getByRole('button', { name: 'Hide', exact: true }).click()
  await expect(page.getByText('Wren · Hidden')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show again' })).toBeVisible()
  const row = () =>
    adminClient().from('org_thanks').select('hidden_at').eq('org_id', orgId).eq('profile_id', author.id).single()
  expect((await row()).data?.hidden_at).not.toBeNull()
  // Hidden still counts: the leader's tally does not move.
  await expect(page.getByText('1 family has said thanks.', { exact: false })).toBeVisible()

  // ...and neither does the public count.
  const family = await createContributor()
  const familyPage = await partyPage(browser, baseURL, family)
  try {
    await familyPage.goto(`/toy-library/organisation/${orgId}`)
    await expect(familyPage.getByText('Thanked 1 time', { exact: true })).toBeVisible()
  } finally {
    await familyPage.context().close()
  }

  await page.getByRole('button', { name: 'Show again' }).click()
  await expect(page.getByText('Wren · On your page')).toBeVisible()
  expect((await row()).data?.hidden_at).toBeNull()
})

test('saving a challenge moves the "N saves" tile without a reload, and unsaving moves it back', async ({ page }) => {
  const viewer = await signInAsNewContributor(page)
  const author = await createContributor()
  const id = await createChallenge(author.id)

  await page.goto(`/explore/challenges/${id}`)
  await expect(page.getByText('saves', { exact: true })).toBeVisible()

  const saved = page.waitForResponse((r) => r.url().endsWith('/api/saves') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  expect((await saved).status()).toBeLessThan(300)
  await expect(page.getByText('save', { exact: true })).toBeVisible()
  const count = async () =>
    (await adminClient().from('saves').select('profile_id').eq('entity_id', id)).data?.map((r) => r.profile_id)
  expect(await count()).toEqual([viewer.id])

  await page.getByRole('button', { name: 'Saved', exact: true }).click()
  await expect(page.getByText('saves', { exact: true })).toBeVisible()
  await expect.poll(count).toEqual([])
})
