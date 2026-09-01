import { test, expect } from '@playwright/test'
import { createTutorial, signInAsNewContributor, uniqueTitle } from './helpers'

/**
 * The Saved shelf end to end: bookmark a guide in the library, find it under
 * Saved, unsave it in place, watch the shelf agree.
 */
test('a saved guide reaches the shelf, and unsaving clears it', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Saveable Guide')
  await createTutorial(contributor.id, { title })

  // Save it from the library card's bookmark island.
  await page.goto('/guides')
  await page.getByPlaceholder('Search by toy name').fill(title)
  await expect(page.getByRole('button', { name: title })).toBeVisible()
  // Awaited, not just clicked: the flip is optimistic, so a goto fired
  // straight after the click aborts the POST in flight and the save never
  // reaches the database — guides-library.spec.ts documents the same trap.
  const savedResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/saves') && r.request().method() === 'POST'
  )
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible()
  expect((await savedResponse).status()).toBe(201)

  // The hub counts it…
  await page.goto('/saved')
  await expect(page.getByRole('button', { name: 'Guides' })).toBeVisible()

  // …and the list holds it.
  await page.getByRole('button', { name: 'Guides' }).click()
  await expect(page.getByRole('button', { name: title })).toBeVisible()

  // Unsave in place: the row's island flips, and a reload shows it gone.
  const unsaved = page.waitForResponse(
    (r) => r.url().includes('/api/saves/') && r.request().method() === 'DELETE'
  )
  await page.getByRole('button', { name: 'Saved', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible()
  await unsaved
  await page.reload()
  await expect(page.getByText('Nothing saved here yet.')).toBeVisible()
})

test('an empty shelf points back at the browse surfaces', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.goto('/saved')

  await page.getByRole('button', { name: 'Toys' }).click()
  await expect(page.getByText('Nothing saved here yet.')).toBeVisible()
  await page.getByRole('button', { name: 'Browse the toy library' }).click()
  await expect(page).toHaveURL(/\/toy-library$/)
})
