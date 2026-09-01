import { test, expect } from '@playwright/test'
import { createTutorial, signInAsNewContributor, uniqueTitle } from './helpers'

/**
 * The Explore tab: its three doors, the Learn path's read state, and search.
 *
 * Read state is device-local (lib/learn.ts, on the same storage the profile
 * segment uses), so on the web export it lives in this browser context's
 * storage — which is why each test signs in fresh rather than sharing a page.
 */

test('the three doors are there, with the learn path not yet started', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.goto('/explore')

  await expect(page.getByText('Learn', { exact: true })).toBeVisible()
  await expect(page.getByText('Get Involved', { exact: true })).toBeVisible()
  await expect(page.getByText('About SPLAT', { exact: true })).toBeVisible()
  await expect(page.getByText('0/6', { exact: true })).toBeVisible()
})

test('reading an article ticks it off and advances the Continue card', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.goto('/explore/learn')

  // Nothing read: Continue names the first article.
  await expect(page.getByText('1 · Toy adaptation 101')).toBeVisible()
  await expect(page.getByText('0 of 6 read', { exact: false })).toBeVisible()

  // exact: the Continue card's own label ("Continue: 1. Toy adaptation 101")
  // contains this one, so a substring match resolves to both.
  await page.getByRole('button', { name: '1. Toy adaptation 101', exact: true }).click()
  await page.waitForURL(/\/explore\/learn\/toy-adaptation-101$/)
  await page.getByRole('button', { name: 'Mark as read' }).click()

  // Back on the hub, the card has moved on and the count has gone up.
  await page.waitForURL(/\/explore\/learn$/)
  await expect(page.getByText('2 · Switch types explained')).toBeVisible()
  await expect(page.getByText('1 of 6 read', { exact: false })).toBeVisible()

  // And the tab's own progress chip agrees with the hub.
  await page.goto('/explore')
  await expect(page.getByText('1/6', { exact: true })).toBeVisible()
})

test('search finds a published guide and opens it', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Searchable Guide')
  const id = await createTutorial(contributor.id, { title })

  await page.goto('/explore')
  await page.getByPlaceholder('Search guides, toys, organisations').fill(title)

  await page.getByRole('button', { name: title }).click()
  await expect(page).toHaveURL(new RegExp(`/guides/${id}$`))
})

test('an empty query shows no results at all, rather than everything', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Hidden Guide')
  await createTutorial(contributor.id, { title })

  await page.goto('/explore')
  await expect(page.getByRole('button', { name: title })).toBeHidden()
})
