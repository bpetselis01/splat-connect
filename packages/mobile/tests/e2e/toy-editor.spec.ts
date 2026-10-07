// journeys: W05 W06 W07 W08 W10 W11
import { test, expect, type Page } from '@playwright/test'
import { adminClient, createContributor, createPublishedToy, makeOrgLeader, signInAsNewContributor, uniqueTitle } from './helpers'
import { acceptNextConfirm } from './family-toys-fixtures'

/**
 * The toy editor end to end: details, photos (library upload, cover, switch
 * tag, remove), offer type and publish, hand-picked picks, delete, and an
 * organisation's Retire. Every assertion reads the toys row back.
 */

const PHOTO = 'tests/e2e/fixtures/test.jpg'

async function draftToy(ownerId: string, name: string) {
  const { data, error } = await adminClient()
    .from('toys')
    .insert({ owner_id: ownerId, name, condition: 5, status: 'draft', offer_type: null })
    .select('id')
    .single()
  if (error || !data) throw new Error(`draftToy failed: ${error?.message}`)
  return data.id as string
}

async function toyRow(id: string) {
  const { data, error } = await adminClient()
    .from('toys')
    .select('name, condition, switch_adapted, age_min, age_max, batteries, photo_urls, switch_photo_url, offer_type, status, picks_mode')
    .eq('id', id)
    .single()
  if (error || !data) throw new Error(`toyRow failed: ${error?.message}`)
  return data
}

/** Press Choose from library and hand the file chooser the fixture photo. */
async function addLibraryPhoto(page: Page, expectedCount: number, id: string) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Choose from library', exact: true }).click()
  await (await chooser).setFiles(PHOTO)
  await expect(page.getByRole('button', { name: `Remove photo ${expectedCount}` })).toBeVisible()
  await expect.poll(async () => (await toyRow(id)).photo_urls.length).toBe(expectedCount)
}

test('details, photos, offer type and publish: each step saves to the toy row', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const name = uniqueTitle('E2E Editor Toy')
  const id = await draftToy(me.id, name)

  await page.goto(`/toys/${id}/edit`)

  // W06: Save details writes the typed fields.
  const renamed = `${name} renamed`
  await page.getByLabel('Name', { exact: true }).fill(renamed)
  await page.getByRole('radio', { name: '9', exact: true }).click()
  await page.getByRole('switch', { name: 'Switch-adapted' }).click()
  await page.getByLabel('From age', { exact: true }).fill('3')
  await page.getByLabel('To age', { exact: true }).fill('8')
  await page.getByLabel('Batteries', { exact: true }).fill('2 x AA')
  await page.getByRole('button', { name: 'Save details', exact: true }).click()
  await expect.poll(async () => (await toyRow(id)).name).toBe(renamed)
  expect(await toyRow(id)).toMatchObject({
    condition: 9,
    switch_adapted: true,
    age_min: 3,
    age_max: 8,
    batteries: '2 x AA',
    status: 'draft',
  })
  await expect(page.getByText(renamed, { exact: true }).first()).toBeVisible()

  // W07: a switch-adapted toy needs a photo, and one that shows the switch.
  await page.getByRole('tab', { name: /Photos/ }).click()
  await addLibraryPhoto(page, 1, id)
  await addLibraryPhoto(page, 2, id)
  const both = (await toyRow(id)).photo_urls
  await expect(page.getByText('Cover', { exact: true })).toBeVisible()

  // The second photo becomes the cover.
  await page.getByRole('button', { name: 'Make photo 2 the cover' }).click()
  await expect.poll(async () => (await toyRow(id)).photo_urls[0]).toBe(both[1])

  // Tag the first shot as the one that shows the switch.
  await page.getByRole('radio', { name: 'Photo 1 shows the switch' }).click()
  await expect.poll(async () => (await toyRow(id)).switch_photo_url).toBe(both[1])

  // W08: choose how it is offered; publish stays disabled until then.
  await page.getByRole('tab', { name: /Review/ }).click()
  await expect(page.getByText('Still needed: How it is offered')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publish to the Toy Library' })).toBeDisabled()
  await page.getByRole('button', { name: 'Exchange', exact: true }).click()
  await expect.poll(async () => (await toyRow(id)).offer_type).toBe('exchange')
  await page.getByRole('button', { name: 'Both', exact: true }).click()
  await expect.poll(async () => (await toyRow(id)).offer_type).toBe('both')

  await page.getByRole('button', { name: 'Publish to the Toy Library' }).click()
  await expect(page.getByText('✓ Published · in the Toy Library')).toBeVisible()
  expect((await toyRow(id)).status).toBe('published')

  // And the toy is in the library for everyone.
  await page.goto('/toy-library')
  await page.getByPlaceholder('Search toys').fill(renamed)
  await expect(page.getByRole('button', { name: renamed, exact: true })).toBeVisible()

  // W07 again: removing the cover leaves the other photo, as the cover.
  await page.goto(`/toys/${id}/edit`)
  await page.getByRole('tab', { name: /Photos/ }).click()
  await page.getByRole('button', { name: 'Remove photo 1' }).click()
  await expect.poll(async () => (await toyRow(id)).photo_urls).toEqual([both[0]])
  // The removed photo was the switch's: the tag goes with it.
  expect((await toyRow(id)).switch_photo_url).toBeNull()
  await expect(page.getByRole('button', { name: 'Remove photo 1 — add another photo first' })).toBeDisabled()
})

test('hand-picked picks save to toy_picks, and Automatic puts the mode back', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const name = uniqueTitle('E2E Picks Toy')
  const otherName = uniqueTitle('E2E Pick Target')
  const id = await createPublishedToy(me.id, { name })
  const otherId = await createPublishedToy(me.id, { name: otherName })

  await page.goto(`/toys/${id}/edit`)
  await page.getByRole('tab', { name: /Review/ }).click()
  await expect(page.getByText('Also worth a look', { exact: true })).toBeVisible()

  await page.getByRole('radio', { name: 'Hand-picked', exact: true }).click()
  await expect.poll(async () => (await toyRow(id)).picks_mode).toBe('picked')

  await page.getByRole('button', { name: otherName, exact: true }).click()
  await page.getByRole('button', { name: 'Save picks', exact: true }).click()
  await expect
    .poll(async () => {
      const { data } = await adminClient().from('toy_picks').select('entity_type, entity_id, position').eq('toy_id', id)
      return data
    })
    .toEqual([{ entity_type: 'toy', entity_id: otherId, position: 1 }])

  await page.getByRole('radio', { name: 'Automatic', exact: true }).click()
  await expect.poll(async () => (await toyRow(id)).picks_mode).toBe('auto')
})

test('Delete toy asks first, then removes the row and returns to My toys', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const name = uniqueTitle('E2E Delete Toy')
  const id = await createPublishedToy(me.id, { name })

  await page.goto(`/toys/${id}/edit`)
  acceptNextConfirm(page)
  await page.getByRole('button', { name: 'Delete toy', exact: true }).click()
  await expect(page).toHaveURL(/\/toys$/)

  const { data } = await adminClient().from('toys').select('id').eq('id', id)
  expect(data).toEqual([])
})

test('a dismissed Delete toy confirm leaves the toy alone', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const id = await createPublishedToy(me.id, { name: uniqueTitle('E2E Keep Toy') })

  await page.goto(`/toys/${id}/edit`)
  page.once('dialog', (d) => void d.dismiss())
  await page.getByRole('button', { name: 'Delete toy', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/toys/${id}/edit$`))
  expect((await toyRow(id)).status).toBe('published')
})

test("an organisation's toy is retired with a reason, and the row records both", async ({ page }) => {
  const leader = await signInAsNewContributor(page)
  const orgId = await makeOrgLeader(leader.id)
  const name = uniqueTitle('E2E Retire Bear')
  const { data, error } = await adminClient()
    .from('toys')
    .insert({ owner_org_id: orgId, name, condition: 6, quantity: 2, status: 'published', offer_type: 'donation' })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message)

  await page.goto(`/toys/${data.id}`)
  await page.getByLabel('Why it is retired', { exact: true }).fill('Broken 12 Aug')
  await page.getByRole('button', { name: 'Retire', exact: true }).click()

  await expect(page.getByText('Retired', { exact: true })).toBeVisible()
  await expect(page.getByText('Broken 12 Aug')).toBeVisible()
  const { data: row } = await adminClient().from('toys').select('retired_at, retired_note').eq('id', data.id).single()
  expect(row?.retired_note).toBe('Broken 12 Aug')
  expect(row?.retired_at).not.toBeNull()
})

test('a toy somebody else owns cannot be opened in the editor', async ({ page }) => {
  await signInAsNewContributor(page)
  const owner = await createContributor()
  const id = await createPublishedToy(owner.id, { name: uniqueTitle('E2E Not Mine') })

  await page.goto(`/toys/${id}/edit`)
  await expect(page.getByText("Couldn't load this toy.")).toBeVisible()
})
