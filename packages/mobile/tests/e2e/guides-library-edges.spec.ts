import { test, expect } from '@playwright/test'
import { createTutorial, signInAsNewContributor, uniqueTitle } from './helpers'

// Edge inputs on the library: awkward titles, searches that find nothing, and a
// bookmark tapped twice. Written against the same selectors as guides-library.spec.ts.

test('a guide whose title holds quotes, markup, an ampersand and an emoji is found by that exact search and opens', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle(`E2E "Quoted" <b>Big</b> & Co 🧸`)
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/guides')
  await page.getByPlaceholder('Search by toy name').fill(title)
  await expect(page.getByRole('button', { name: title })).toBeVisible()
  await page.getByRole('button', { name: title }).click()

  // .last(): the library stays mounted behind the detail screen.
  await expect(page.getByText(title).last()).toBeVisible()
})

test('a 300-character title does not break the card or the detail screen', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle(`E2E Long ${'x'.repeat(300)}`)
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/guides')
  await page.getByPlaceholder('Search by toy name').fill(title)
  await expect(page.getByRole('button', { name: title })).toBeVisible()
  await page.getByRole('button', { name: title }).click()
  await expect(page.getByText('Created by a Playwright E2E test.').last()).toBeVisible()
})

test('searches full of SQL and wildcard characters find nothing and show the empty state, not an error', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile Wildcard'), status: 'approved' })

  await page.goto('/guides')
  const box = page.getByPlaceholder('Search by toy name')
  for (const q of [`'; drop table tutorials; --`, '%', '_', '\\', '""', '<script>alert(1)</script>', '🧸🧸🧸']) {
    await box.fill(q)
    await expect(page.locator('text=/No tutorials/i').first()).toBeVisible()
    await expect(page.getByText("Couldn't load tutorials.")).toHaveCount(0)
  }
})

test('clearing a search that found nothing brings the library back', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile Cleared')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/guides')
  const box = page.getByPlaceholder('Search by toy name')
  await box.fill('zzz-no-such-toy-zzz')
  await expect(page.locator('text=/No tutorials/i').first()).toBeVisible()
  await box.fill(title)
  await expect(page.getByRole('button', { name: title })).toBeVisible()
})

test('tapping Save twice quickly leaves the bookmark where the last tap put it, and a reload agrees', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile DoubleSave')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/guides')
  await page.getByPlaceholder('Search by toy name').fill(title)
  await expect(page.getByText(title)).toBeVisible()

  // Both requests are armed before the taps: the optimistic flip answers at once
  // and a reload fired early would abort the second one in flight.
  const post = page.waitForResponse((r) => r.url().endsWith('/api/saves') && r.request().method() === 'POST')
  const del = page.waitForResponse((r) => r.url().includes('/api/saves/') && r.request().method() === 'DELETE')
  await page.getByLabel('Save', { exact: true }).click()
  await page.getByLabel('Saved', { exact: true }).click()
  await post
  await del

  await expect(page.getByLabel('Save', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByPlaceholder('Search by toy name').fill(title)
  await expect(page.getByLabel('Save', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Saved', { exact: true })).toHaveCount(0)
})

test('a failed save puts the bookmark back and nothing is on the shelf', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile SaveFails')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/guides')
  await page.getByPlaceholder('Search by toy name').fill(title)
  await expect(page.getByText(title)).toBeVisible()
  await page.route('**/api/saves', (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()))

  await page.getByLabel('Save', { exact: true }).click()
  await expect(page.getByLabel('Save', { exact: true })).toBeVisible()

  await page.unroute('**/api/saves')
  await page.goto('/saved')
  await page.getByRole('button', { name: 'Guides' }).click()
  await expect(page.getByText('Nothing saved here yet.')).toBeVisible()
})

test('the Saved shelf says it could not load, and Try again recovers', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.route('**/api/saves/tutorials', (route) => route.abort())
  await page.goto('/saved/tutorials')
  await expect(page.getByText("Couldn't load your saved guides.")).toBeVisible()

  await page.unroute('**/api/saves/tutorials')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('Nothing saved here yet.')).toBeVisible()
})

test('an unknown Saved slug falls back to the Saved hub', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.goto('/saved/not-a-kind')
  await expect(page.getByRole('button', { name: 'Guides' })).toBeVisible()
})
