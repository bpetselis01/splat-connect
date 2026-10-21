import { test, expect } from '@playwright/test'
import { createContributor, createPublishedToy, createTutorial, uniqueTitle } from '../helpers'

/*
 * The page these three tests describe was rebuilt from the Soft Pop artboard
 * on 2026-09-17 (a23f5dad): "SPLAT in 30 seconds" became the five-scene
 * scroll-world, the seven-tile launcher became three doors, and the hero's
 * "Browse the guides" became "Find a guide". Learn and Impact are reached from
 * the header's More menu instead (tests/e2e/public/navigation.spec.ts).
 */
test('WH06 the hero, the three stat chips and the five-scene journey load from the home content', async ({ page }) => {
  const author = await createContributor()
  await createTutorial(author.id, { title: uniqueTitle('E2E Home Chip'), status: 'approved' })
  // Reduced motion stacks the five scenes as plain blocks; in full motion all
  // but the one on stage are inert, and so out of the accessibility tree.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Press it. Watch it go.', level: 1 })).toBeVisible()
  // Three chips, the first counted from the live guides (an admin can relabel them, so not by label).
  const chips = page.locator('section.hero .stat-chip')
  await expect(chips).toHaveCount(3)
  await expect(chips.first()).toContainText(/[1-9]\d*/)
  const journey = page.getByRole('region', { name: 'How SPLAT works, as a journey' })
  const scenes = [
    'A child finds the toy that won’t play back.',
    'A maker adapts it and writes every step down.',
    'Someone nearby prints the parts that hold it all together.',
    'A therapy service reviews it and puts their name on it.',
    'The toy comes home — built, or borrowed.',
  ]
  for (const name of scenes) {
    await expect(journey.getByRole('heading', { name, level: 2 })).toBeVisible()
  }
  await expect(journey.getByRole('article')).toHaveCount(scenes.length)
})

test('WH02 the three doors each lead somewhere real, and the guides door opens the library', async ({ page }) => {
  await page.goto('/')

  // Scoped to the doors band: the header and the recent rows link to the same
  // hubs, so an unscoped lookup would hit a strict-mode violation.
  const doors = page.getByRole('region', { name: 'Where to start' })
  const tiles = [
    { href: '/library', title: 'I’m looking for a guide' },
    { href: '/toy-library', title: 'I’d like a ready-made toy' },
    { href: '/get-involved', title: 'I make things' },
  ]
  for (const tile of tiles) {
    await expect(doors.locator(`a[href="${tile.href}"]`).getByText(tile.title, { exact: true })).toBeVisible()
  }

  // Count, not just presence: a door added or dropped without this list
  // changing fails here.
  await expect(doors.getByRole('link')).toHaveCount(tiles.length)

  // The door's call to action carries the live count, then follows through.
  await expect(doors.locator('a[href="/library"]').locator('.door__cta')).toHaveText(/Browse [1-9]\d* guides?/)
  await doors.locator('a[href="/get-involved"]').click()
  await expect(page).toHaveURL(/\/get-involved$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('WH01 the hero call to action reaches the guides library, and the secondary the toy library', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('link', { name: 'Find a guide' }).click()

  await expect(page).toHaveURL(/\/library$/)
  await expect(page.getByRole('heading', { name: 'Adapt a toy in an evening', level: 1 })).toBeVisible()

  await page.goto('/')
  await page.locator('section.hero a.btn-quiet').click()
  await expect(page).toHaveURL(/\/toy-library$/)
})

test('WH04 the recent-guides section links through to the library, and a card opens its guide', async ({ page }) => {
  const contributor = await createContributor()
  await createTutorial(contributor.id, { title: uniqueTitle('E2E Home Recent'), status: 'approved' })

  await page.goto('/')

  // Scoped to the "Recent guides" heading's own container: the homepage also
  // has a second "View all" link (Learn the basics), and this must not follow
  // that one instead.
  const recentGuides = page.getByRole('heading', { name: 'Recent guides' }).locator('..')
  await recentGuides.getByRole('link', { name: /View all/ }).click()

  await expect(page).toHaveURL(/\/library$/)

  await page.goto('/')
  await page.locator('.recent').first().getByTestId('tutorial-card').first().click()
  await expect(page).toHaveURL(/\/tutorials\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('WH03 the cost card and the plastic card lead to the printing basics and the recycling page', async ({ page }) => {
  await page.goto('/')
  const costs = page.getByRole('region', { name: 'What things cost' })
  await costs.getByRole('link', { name: 'See how printing costs work' }).click()
  await expect(page).toHaveURL(/\/printing\/basics$/)

  await page.goto('/')
  await costs.getByRole('link', { name: 'See who takes plastic' }).click()
  await expect(page).toHaveURL(/\/get-involved\/recycling$/)
})

test('WH05 the recent-toys section links through to the toy library, and a card opens its toy', async ({ page }) => {
  const owner = await createContributor()
  await createPublishedToy(owner.id, { name: uniqueTitle('E2E Home Recent Toy') })

  await page.goto('/')
  const recentToys = page.getByRole('heading', { name: 'Recent toys' }).locator('..')
  await recentToys.getByRole('link', { name: /View all/ }).click()
  await expect(page).toHaveURL(/\/toy-library$/)

  await page.goto('/')
  await page.locator('.recent').nth(1).getByTestId('toy-library-card').first().click()
  await expect(page).toHaveURL(/\/toy-library\/[0-9a-f-]{36}$/)
})
