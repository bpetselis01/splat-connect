import { test, expect } from '@playwright/test'
import { createContributor, createTutorial, uniqueTitle } from '../helpers'

test('the home page renders the hero and the three SPLAT-in-30-seconds steps', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Home Featured')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Every child deserves to play.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'SPLAT in 30 seconds' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'A guide gets written' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'An organisation stands behind it' })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'A family builds it — or receives one' })
  ).toBeVisible()
})

test('the launcher grid surfaces all six sections with their blurbs', async ({ page }) => {
  await page.goto('/')

  // Scoped to the "Jump straight in" section: the header and footer repeat
  // several of these same labels ("Guides", "Learn", "About"), so an
  // unscoped text lookup would hit a Playwright strict-mode violation.
  const launcher = page.getByRole('heading', { name: 'Jump straight in' }).locator('..')
  const tiles = [
    { href: '/library', label: 'Guides', blurb: 'Adaptation tutorials' },
    { href: '/toy-library', label: 'Toy Library', blurb: 'Toys being given away' },
    { href: '/learn', label: 'Learn', blurb: 'Switches, tools, safety' },
    { href: '/get-involved', label: 'Get Involved', blurb: 'Make, give, or back' },
    { href: '/impact', label: 'Impact', blurb: 'Toys delivered' },
    { href: '/about', label: 'About', blurb: 'Who runs SPLAT' },
  ]
  for (const tile of tiles) {
    const link = launcher.locator(`a[href="${tile.href}"]`)
    await expect(link.getByText(tile.label, { exact: true })).toBeVisible()
    await expect(link.getByText(tile.blurb, { exact: true })).toBeVisible()
  }
})

test('the hero call to action reaches the guides library', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('link', { name: /Browse the Guides/ }).click()

  await expect(page).toHaveURL(/\/library$/)
  await expect(page.getByRole('heading', { name: 'Toy Adaptation Library' })).toBeVisible()
})

test('the recent-guides section links through to the library', async ({ page }) => {
  const contributor = await createContributor()
  await createTutorial(contributor.id, { title: uniqueTitle('E2E Home Recent'), status: 'approved' })

  await page.goto('/')

  // Scoped to the "Recent guides" heading's own container: the homepage also
  // has a second "View all" link (Learn the basics), and this must not follow
  // that one instead.
  const recentGuides = page.getByRole('heading', { name: 'Recent guides' }).locator('..')
  await recentGuides.getByRole('link', { name: /View all/ }).click()

  await expect(page).toHaveURL(/\/library$/)
})
