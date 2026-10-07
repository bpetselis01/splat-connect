// journeys: G03
import { test, expect, type Page } from '@playwright/test'
import { adminClient, createTutorial, signInAsNewContributor, uniqueTitle } from './helpers'

// The library's filter page itself: Sort by, the live "Show N" count, Reset,
// and ✕ throwing away what was never applied. guides-library.spec.ts covers
// what the applied filters do to the list.

/**
 * Three guides under one search prefix, created oldest first, so each answer
 * has a different guide: A is the slowest and easy, B the quickest and medium,
 * C in the middle and hard. Newest first would read C, B, A.
 */
async function threeGuides(page: Page) {
  const contributor = await signInAsNewContributor(page)
  const prefix = uniqueTitle('E2E Filter Page')
  const admin = adminClient()
  const specs = [
    { name: 'A', difficulty: 'easy', minutes: 90 },
    { name: 'B', difficulty: 'medium', minutes: 20 },
    { name: 'C', difficulty: 'hard', minutes: 45 },
  ] as const
  for (const s of specs) {
    const id = await createTutorial(contributor.id, { title: `${prefix} ${s.name}`, difficulty: s.difficulty })
    const { error } = await admin.from('tutorials').update({ build_minutes: s.minutes }).eq('id', id)
    if (error) throw new Error(`build_minutes update failed: ${error.message}`)
  }
  await page.goto('/guides')
  await page.getByPlaceholder('Search guides').fill(prefix)
  const rows = page.getByRole('button', { name: new RegExp(`^${prefix}`) })
  await expect(rows).toHaveCount(3)
  return { prefix, rows }
}

const openFilters = (page: Page) => page.getByRole('button', { name: /^Filters/ }).click()
const radio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true })
const pill = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

test('Sort by Quickest reorders the list by build time, and the heading says so', async ({ page }) => {
  const { prefix, rows } = await threeGuides(page)
  await expect(rows.nth(0)).toHaveAccessibleName(new RegExp(`${prefix} C`))
  await expect(rows.nth(2)).toHaveAccessibleName(new RegExp(`${prefix} A`))

  await openFilters(page)
  await radio(page, 'Quickest').click()
  await page.getByRole('button', { name: 'Show 3 guides' }).click()

  await expect(page.getByText('3 guides · Quickest first')).toBeVisible()
  await expect(rows.nth(0)).toHaveAccessibleName(new RegExp(`${prefix} B`))
  await expect(rows.nth(1)).toHaveAccessibleName(new RegExp(`${prefix} C`))
  await expect(rows.nth(2)).toHaveAccessibleName(new RegExp(`${prefix} A`))
  // A sort is not a filter: it adds no tag and no count on the button.
  await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeVisible()
})

test('the Show button counts the guides the page would show as the choices change', async ({ page }) => {
  const { rows } = await threeGuides(page)

  await openFilters(page)
  await expect(page.getByRole('button', { name: 'Show 3 guides' })).toBeVisible()
  await pill(page, 'Medium').click()
  await expect(page.getByRole('button', { name: 'Show 1 guide', exact: true })).toBeVisible()
  await pill(page, 'Easy').click()
  await expect(page.getByRole('button', { name: 'Show 2 guides' })).toBeVisible()
  await pill(page, 'Medium').click()
  await expect(page.getByRole('button', { name: 'Show 1 guide', exact: true })).toBeVisible()
  await radio(page, 'Under 30 min').click()
  await expect(page.getByRole('button', { name: 'Show 0 guides' })).toBeVisible()
  await radio(page, 'Any time').click()
  await expect(page.getByRole('button', { name: 'Show 1 guide', exact: true })).toBeVisible()

  // Show applies the draft.
  await page.getByRole('button', { name: 'Show 1 guide', exact: true }).click()
  await expect(rows).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Remove filter: Easy' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Filters, 1 on' })).toBeVisible()
})

test('Reset puts every choice back, so applying shows the whole list in its default order', async ({ page }) => {
  const { prefix, rows } = await threeGuides(page)

  await openFilters(page)
  await radio(page, 'Quickest').click()
  await pill(page, 'Hard').click()
  await expect(page.getByRole('button', { name: 'Show 1 guide', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Show 3 guides' })).toBeVisible()
  await page.getByRole('button', { name: 'Show 3 guides' }).click()

  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0)).toHaveAccessibleName(new RegExp(`${prefix} C`))
  await expect(page.getByText('3 guides · Recommended')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Remove filter/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeVisible()
})

test('Reset also lifts a filter that was already applied, once Show confirms it', async ({ page }) => {
  const { rows } = await threeGuides(page)
  await openFilters(page)
  await pill(page, 'Hard').click()
  await page.getByRole('button', { name: 'Show 1 guide', exact: true }).click()
  await expect(rows).toHaveCount(1)

  await openFilters(page)
  // It opens on what is applied.
  await expect(page.getByRole('button', { name: 'Show 1 guide', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await page.getByRole('button', { name: 'Show 3 guides' }).click()
  await expect(rows).toHaveCount(3)
  await expect(page.getByRole('button', { name: /^Remove filter/ })).toHaveCount(0)
})

test('✕ discards what was picked and leaves what was applied, and the page reopens on the applied choices', async ({ page }) => {
  const { rows } = await threeGuides(page)

  // Nothing applied: pick, close, nothing changes.
  await openFilters(page)
  await pill(page, 'Easy').click()
  await expect(page.getByRole('button', { name: 'Show 1 guide', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close filters' }).click()
  await expect(page.getByRole('button', { name: 'Close filters' })).toHaveCount(0)
  await expect(rows).toHaveCount(3)
  await expect(page.getByRole('button', { name: /^Remove filter/ })).toHaveCount(0)

  // The draft was dropped: reopened, it counts all three again.
  await openFilters(page)
  await expect(page.getByRole('button', { name: 'Show 3 guides' })).toBeVisible()

  // Applied Hard; then picking Easy as well and closing keeps just Hard.
  await pill(page, 'Hard').click()
  await page.getByRole('button', { name: 'Show 1 guide', exact: true }).click()
  await expect(rows).toHaveCount(1)
  await openFilters(page)
  await pill(page, 'Easy').click()
  await expect(page.getByRole('button', { name: 'Show 2 guides' })).toBeVisible()
  await page.getByRole('button', { name: 'Close filters' }).click()
  await expect(rows).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Remove filter: Hard' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove filter: Easy' })).toHaveCount(0)
})
