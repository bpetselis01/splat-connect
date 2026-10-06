import { test, expect, type Page } from '@playwright/test'
import { adminClient, createContributor, createTutorial, signInAsNewContributor, uniqueTitle } from './helpers'

// Save from the guide page's hero, with the toast's Undo. The shelf and the
// saves table must agree with what the heart says.

const isSave = (method: string) => (r: { url: () => string; request: () => { method: () => string } }) =>
  r.request().method() === method && (method === 'POST' ? r.url().endsWith('/api/saves') : r.url().includes('/api/saves/'))

async function savedGuideRows(profileId: string, guideId: string) {
  const { data } = await adminClient().from('saves').select('entity_id').eq('profile_id', profileId).eq('entity_type', 'tutorial').eq('entity_id', guideId)
  return data ?? []
}

async function shelfHolds(page: Page, title: string) {
  await page.goto('/saved')
  await page.getByRole('button', { name: 'Guides' }).click()
  await expect(page.getByRole('button', { name: title })).toBeVisible()
}

test('Save raises a toast, Undo takes it back, and Save again puts it on the shelf', async ({ page }) => {
  const reader = await signInAsNewContributor(page)
  const author = await createContributor()
  const title = uniqueTitle('E2E Undo Save Guide')
  const id = await createTutorial(author.id, { title })

  await page.goto(`/guides/${id}`)
  const saved = page.waitForResponse(isSave('POST'))
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  expect((await saved).status()).toBe(201)
  await expect(page.getByText('Saved to My saves')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Saved. Tap to remove from My saves' })).toBeVisible()
  expect(await savedGuideRows(reader.id, id)).toHaveLength(1)

  const removed = page.waitForResponse(isSave('DELETE'))
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  expect((await removed).status()).toBeLessThan(300)
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible()
  expect(await savedGuideRows(reader.id, id)).toEqual([])

  // The shelf agrees, after a fresh load.
  await page.goto('/saved')
  await page.getByRole('button', { name: 'Guides' }).click()
  await expect(page.getByText('Nothing saved here yet.')).toBeVisible()

  await page.goto(`/guides/${id}`)
  const again = page.waitForResponse(isSave('POST'))
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  expect((await again).status()).toBe(201)
  expect(await savedGuideRows(reader.id, id)).toHaveLength(1)

  await shelfHolds(page, title)
})

test('unsaving from the heart says Removed, and its Undo saves the guide again', async ({ page }) => {
  const reader = await signInAsNewContributor(page)
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Unsave Undo Guide') })
  const { error } = await adminClient().from('saves').insert({ profile_id: reader.id, entity_type: 'tutorial', entity_id: id })
  if (error) throw new Error(error.message)

  await page.goto(`/guides/${id}`)
  const removed = page.waitForResponse(isSave('DELETE'))
  await page.getByRole('button', { name: 'Saved. Tap to remove from My saves' }).click()
  expect((await removed).status()).toBeLessThan(300)
  await expect(page.getByText('Removed from My saves')).toBeVisible()
  expect(await savedGuideRows(reader.id, id)).toEqual([])

  const back = page.waitForResponse(isSave('POST'))
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  expect((await back).status()).toBe(201)
  await expect(page.getByRole('button', { name: 'Saved. Tap to remove from My saves' })).toBeVisible()
  expect(await savedGuideRows(reader.id, id)).toHaveLength(1)
})
