// Tagged @responsive, so only the mobile-chrome project runs these (see
// playwright.config.ts). Every other spec runs at desktop width and would not
// notice a nav that clips its own links or a heading that overflows.
import { test, expect, type Locator } from '@playwright/test'
import { signIn, createContributor, createTutorial, uniqueTitle, acceptTerms } from '../helpers'

/** Fails if the element spills outside the viewport on either side. */
async function expectWithinViewport(locator: Locator, viewportWidth: number) {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(-1)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1)
}

// The rail and its narrow-viewport drawer were retired on 2026-09-17 — the
// artboard's note on the My SPLAT hub is "replaces the old sidebar entirely".
// The header renders on every page at every width now, so the drawer test that
// stood here has nothing left to open; the header's own reflow is covered by
// the public cases below.

test('@responsive the hero heading does not overflow', async ({ page }) => {
  await page.goto('/')

  const heading = page.getByRole('heading', { name: 'Press it. Watch it go.' })
  await expect(heading).toBeVisible()
  await expectWithinViewport(heading, page.viewportSize()!.width)
})

// Since 4ad89618 the grid is the board's `repeat(auto-fill, minmax(240px, 1fr))`,
// which at phone width fits one card per row, not two. The library's own
// search box went at the same time; the header search arrives as ?q=.
test('@responsive the library grid renders one column at phone width', async ({ page }) => {
  const contributor = await createContributor()
  const marker = uniqueTitle('E2E Reflow Grid')
  await createTutorial(contributor.id, { title: `${marker} A`, status: 'approved' })
  await createTutorial(contributor.id, { title: `${marker} B`, status: 'approved' })

  await page.goto(`/library?q=${encodeURIComponent(marker)}`)

  const cards = page.getByTestId('tutorial-card')
  await expect(cards).toHaveCount(2)

  // One column: the pair shares a left edge and the second sits below the first.
  const first = await cards.nth(0).boundingBox()
  const second = await cards.nth(1).boundingBox()
  expect(Math.abs(first!.x - second!.x)).toBeLessThan(4)
  expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height)
  const width = page.viewportSize()!.width
  await expectWithinViewport(cards.nth(0), width)
  await expectWithinViewport(cards.nth(1), width)
})

test('@responsive a dashboard row keeps its controls inside the viewport', async ({ page }) => {
  const contributor = await createContributor()
  await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Reflow Dashboard Row With A Fairly Long Title'),
    status: 'rejected',
    rejection_note: 'A rejection note long enough to force the row to wrap on a phone.',
  })
  await acceptTerms(contributor.id)

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto('/dashboard/tutorials')

  const width = page.viewportSize()!.width
  // The card is the link; the Edit button it replaced no longer exists. A
  // returned guide wears the "Needs you" stage pill since ac7791e2.
  const row = page.getByTestId('tutorial-row').first()
  await expectWithinViewport(row, width)
  await expectWithinViewport(row.getByText('Needs you', { exact: true }), width)
})

test('@responsive the new-tutorial page fits the viewport', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto('/upload')

  const width = page.viewportSize()!.width
  // The kind is a radio card pair on the form itself.
  await expectWithinViewport(page.getByRole('radio', { name: /Toy adaptation/ }), width)
  await expectWithinViewport(page.getByLabel('Title'), width)
  await expectWithinViewport(page.getByLabel('Difficulty'), width)
  await expectWithinViewport(page.getByRole('button', { name: /Create draft/ }), width)
})

test('@responsive the tutorial detail page stacks to a single column', async ({ page }) => {
  const contributor = await createContributor()
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Reflow Detail'),
    status: 'approved',
  })

  await page.goto(`/tutorials/${id}`)

  // Since 1909fb6a the page is content + a 360px rail from lg up; below that
  // the rail (stats, the PDF button) stacks under the content column.
  const pdf = page.getByRole('link', { name: 'Sign in to download' })
  const content = page.getByRole('tabpanel', { name: 'Parts & tools' })
  const rail = page.getByRole('complementary').filter({ has: pdf })
  const contentBox = await content.boundingBox()
  const railBox = await rail.boundingBox()

  // Stacked, not side by side: same left edge, rail below the content.
  expect(Math.abs(railBox!.x - contentBox!.x)).toBeLessThan(4)
  expect(railBox!.y).toBeGreaterThanOrEqual(contentBox!.y + contentBox!.height)
  const width = page.viewportSize()!.width
  await expectWithinViewport(content, width)
  await expectWithinViewport(pdf, width)
})
