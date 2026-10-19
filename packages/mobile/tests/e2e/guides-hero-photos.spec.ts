import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, signInAsNewContributor, uniqueTitle } from './helpers'

// The hero's photos: the "n/N · caption" pill, full screen with its own
// counter, and ✕ back to the same guide page.

// 1x1 gifs: three distinct URLs (the carousel keys on the url) that load offline.
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const photos = (n: number) => Array.from({ length: n }, (_, i) => `${GIF}#photo-${i + 1}`)

async function guideWithPhotos(n: number, captions: string[] | null = ['Front', 'Side', 'Back']) {
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Hero Photos') })
  const { error } = await adminClient().from('tutorials').update({ photo_urls: photos(n), photo_captions: captions }).eq('id', id)
  if (error) throw new Error(`photo update failed: ${error.message}`)
  return id
}

test('G11 the hero counts its photos, opens one full screen at its own number, and ✕ returns to the guide', async ({ page }) => {
  await signInAsNewContributor(page)
  const id = await guideWithPhotos(3)

  await page.goto(`/guides/${id}`)
  await expect(page.getByText('1/3 · Front')).toBeVisible()

  // Photo 2 sits off to the right; the click scrolls it in, which moves the pill too.
  await page.getByLabel('Open photo 2 full screen').click()
  await expect(page.getByText('2 of 3', { exact: true })).toBeVisible()
  await expect(page.getByText('Side', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('Pinch to zoom')).toBeVisible()

  await page.getByRole('button', { name: 'Close photo' }).click()
  await expect(page.getByText('2 of 3', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Close photo' })).toHaveCount(0)
  // Still on this guide, with its page intact.
  await expect(page).toHaveURL(new RegExp(`/guides/${id}$`))
  await expect(page.getByRole('button', { name: 'Report a problem', exact: true })).toBeVisible()
})

test('G11 the viewer opens on the first photo, and a guide with one photo shows no counter in it', async ({ page }) => {
  await signInAsNewContributor(page)
  const many = await guideWithPhotos(3)
  const single = await guideWithPhotos(1, ['Only'])

  await page.goto(`/guides/${many}`)
  await page.getByLabel('Open photo 1 full screen').click()
  await expect(page.getByText('1 of 3', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close photo' }).click()

  await page.goto(`/guides/${single}`)
  await expect(page.getByText('1/1 · Only')).toBeVisible()
  await page.getByLabel('Open photo 1 full screen').click()
  await expect(page.getByRole('button', { name: 'Close photo' })).toBeVisible()
  await expect(page.getByText(/^\d+ of \d+$/)).toHaveCount(0)
})

test('a guide with no photos shows no pill and nothing to open', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E No Photos') })
  await adminClient().from('tutorials').update({ photo_urls: [] }).eq('id', id)

  await page.goto(`/guides/${id}`)
  await expect(page.getByRole('button', { name: 'Report a problem', exact: true })).toBeVisible()
  await expect(page.getByLabel(/^Open photo/)).toHaveCount(0)
  await expect(page.getByText(/^\d+\/\d+ · /)).toHaveCount(0)
})
