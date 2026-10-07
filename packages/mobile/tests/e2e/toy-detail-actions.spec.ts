// journeys: Y07 Y08
import { test, expect } from '@playwright/test'
import {
  adminClient,
  createContributor,
  createPublishedToy,
  createTutorial,
  makeOrgLeader,
  renameProfile,
  signInAsNewContributor,
  uniqueTitle,
} from './helpers'
import { notificationsFor, sendReport } from './family-toys-fixtures'

/**
 * The round buttons over a toy's photo (Save, Thank the holder, Report) and
 * the links on the page (the holding organisation, the guide it was built
 * from, the holder's picks), as a family that does not own the toy.
 */

async function heldByOrg(name: string) {
  const leader = await createContributor()
  const orgName = uniqueTitle('E2E Holding Org')
  const orgId = await makeOrgLeader(leader.id, orgName)
  const { data, error } = await adminClient()
    .from('toys')
    .insert({ owner_org_id: orgId, name, condition: 8, quantity: 3, status: 'published', offer_type: 'donation' })
    .select('id')
    .single()
  if (error || !data) throw new Error(`heldByOrg failed: ${error?.message}`)
  return { leader, orgId, orgName, toyId: data.id as string }
}

test('Save writes the save row and Saved takes it away again', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const owner = await createContributor()
  const toyId = await createPublishedToy(owner.id, { name: uniqueTitle('E2E Saveable Toy') })
  const saved = async () => {
    const { data } = await adminClient().from('saves').select('entity_type, entity_id').eq('profile_id', me.id)
    return data
  }

  await page.goto(`/toy-library/${toyId}`)
  const post = page.waitForResponse((r) => r.url().endsWith('/api/saves') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  expect((await post).status()).toBe(201)
  await expect(page.getByText('Saved to My saves')).toBeVisible()
  expect(await saved()).toEqual([{ entity_type: 'toy', entity_id: toyId }])

  const del = page.waitForResponse((r) => r.url().includes('/api/saves/') && r.request().method() === 'DELETE')
  await page.getByRole('button', { name: 'Saved. Tap to remove from My saves' }).click()
  await del
  await expect(page.getByText('Removed from My saves')).toBeVisible()
  expect(await saved()).toEqual([])
})

test("Thank the holder thanks a person once, tells them, and won't thank twice", async ({ page, browser, baseURL }) => {
  const me = await signInAsNewContributor(page)
  const owner = await createContributor()
  const ownerName = uniqueTitle('E2E Thanked Holder')
  await renameProfile(owner.id, ownerName)
  const toyId = await createPublishedToy(owner.id, { name: uniqueTitle('E2E Thanks Holder Toy') })

  await page.goto(`/toy-library/${toyId}`)
  await page.getByRole('button', { name: `Thank ${ownerName}`, exact: true }).click()
  await expect(page.getByText(`Thanks sent to ${ownerName}`)).toBeVisible()
  await expect(page.getByRole('button', { name: `Thanked ${ownerName}`, exact: true })).toBeVisible()

  const { data } = await adminClient().from('profile_thanks').select('profile_id, thanker_id').eq('thanker_id', me.id)
  expect(data).toEqual([{ profile_id: owner.id, thanker_id: me.id }])
  expect(await notificationsFor(owner.id, 'profile_thanked')).toHaveLength(1)

  // Pressing it again only says so; no second row, no second notification.
  await page.getByRole('button', { name: `Thanked ${ownerName}`, exact: true }).click()
  await expect(page.getByText(`You already thanked ${ownerName}`)).toBeVisible()
  expect(await notificationsFor(owner.id, 'profile_thanked')).toHaveLength(1)
})

test('Thank on an organisation-held toy thanks the organisation and notifies its leader', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const held = await heldByOrg(uniqueTitle('E2E Org Held Toy'))

  await page.goto(`/toy-library/${held.toyId}`)
  await page.getByRole('button', { name: `Thank ${held.orgName}`, exact: true }).click()
  await expect(page.getByText(`Thanks sent to ${held.orgName}`)).toBeVisible()

  const { data } = await adminClient().from('org_thanks').select('org_id, profile_id').eq('profile_id', me.id)
  expect(data).toEqual([{ org_id: held.orgId, profile_id: me.id }])
  const rows = await notificationsFor(held.leader.id, 'org_thanked')
  expect(rows).toHaveLength(1)
})

test('Report on a toy files a toy report with the toy named', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const owner = await createContributor()
  const name = uniqueTitle('E2E Reported Toy Page')
  const toyId = await createPublishedToy(owner.id, { name })

  await page.goto(`/toy-library/${toyId}`)
  await page.getByRole('button', { name: 'Report a problem', exact: true }).click()
  const body = `Battery door cracked ${Date.now()}`
  const rows = await sendReport(page, me.id, 'Safety concern', body)
  expect(rows).toEqual([
    { subject_kind: 'toy', subject_id: toyId, subject_label: name, category: 'safety', body, status: 'new' },
  ])
})

test('the holding organisation, the guide it was built from and the holder\'s picks all link on', async ({ page }) => {
  await signInAsNewContributor(page)
  const held = await heldByOrg(uniqueTitle('E2E Linked Toy'))
  const author = await createContributor()
  const guideTitle = uniqueTitle('E2E Built From Guide')
  const guideId = await createTutorial(author.id, { title: guideTitle })
  const otherName = uniqueTitle('E2E Picked Toy')
  const admin = adminClient()
  // A hand-picked toy has to be the holder's own listed toy, so it is the organisation's too.
  const { data: other, error: otherError } = await admin
    .from('toys')
    .insert({ owner_org_id: held.orgId, name: otherName, condition: 7, quantity: 1, status: 'published', offer_type: 'donation' })
    .select('id')
    .single()
  if (otherError || !other) throw new Error(otherError?.message)
  const otherId = other.id as string
  await admin.from('toys').update({ tutorial_id: guideId, picks_mode: 'picked' }).eq('id', held.toyId)
  const { error } = await admin.from('toy_picks').insert([
    { toy_id: held.toyId, position: 1, entity_type: 'toy', entity_id: otherId },
    { toy_id: held.toyId, position: 2, entity_type: 'tutorial', entity_id: guideId },
  ])
  if (error) throw new Error(error.message)

  const open = `/toy-library/${held.toyId}`

  await page.goto(open)
  await page.getByRole('link', { name: held.orgName, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/toy-library/organisation/${held.orgId}$`))

  await page.goto(open)
  await page.getByRole('link', { name: `Built from ${guideTitle}. Open the guide` }).click()
  await expect(page).toHaveURL(new RegExp(`/guides/${guideId}$`))

  await page.goto(open)
  await page.getByRole('link', { name: `Toy in the library: ${otherName}` }).click()
  await expect(page).toHaveURL(new RegExp(`/toy-library/${otherId}$`))

  await page.goto(open)
  await page.getByRole('link', { name: `Toy adaptation guide: ${guideTitle}` }).click()
  await expect(page).toHaveURL(new RegExp(`/guides/${guideId}$`))
})
