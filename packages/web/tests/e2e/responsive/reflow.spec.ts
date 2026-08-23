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

// Mobile navigation is explicitly out of scope for the My SPLAT front-door
// change (docs/superpowers/specs/2026-08-23-my-splat-front-door-design.md):
// the drawer's trigger lived in the header (components/nav.tsx), which no
// longer renders on any page that has a rail, so "Open navigation" has
// nothing left to render it. Skipped until mobile nav is redesigned.
test.skip('@responsive every rail link stays inside the viewport for a contributor', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  const width = page.viewportSize()!.width
  const openButton = page.getByRole('button', { name: 'Open navigation' })
  await expect(openButton).toBeVisible()
  await expectWithinViewport(openButton, width)

  await openButton.click()
  const drawer = page.locator('dialog.shell-drawer')
  await expect(drawer).toBeVisible()

  // 'Guides' and 'Organisations' were rail rows before the Browse group moved
  // to the public top bar (2026-08-21) — the rail now only carries rows a
  // plain contributor actually has, per lib/nav-model.ts.
  for (const name of ['My tutorials', 'My toys', 'Notifications']) {
    const link = drawer.getByRole('link', { name, exact: true })
    await expect(link).toBeVisible()
    await expectWithinViewport(link, width)
  }
  await expect(drawer.getByRole('button', { name: 'Sign out' })).toBeVisible()
})

test('@responsive the hero heading does not overflow', async ({ page }) => {
  await page.goto('/')

  const heading = page.getByRole('heading', { name: 'Press it. Watch it go.' })
  await expect(heading).toBeVisible()
  await expectWithinViewport(heading, page.viewportSize()!.width)
})

test('@responsive the library grid renders two columns at phone width', async ({ page }) => {
  const contributor = await createContributor()
  const marker = uniqueTitle('E2E Reflow Grid')
  await createTutorial(contributor.id, { title: `${marker} A`, status: 'approved' })
  await createTutorial(contributor.id, { title: `${marker} B`, status: 'approved' })

  await page.goto('/library')
  await page.getByPlaceholder('Search by toy name…').fill(marker)

  const cards = page.getByTestId('tutorial-card')
  await expect(cards).toHaveCount(2)

  // Two columns: the pair shares a row, so their vertical offsets match.
  const first = await cards.nth(0).boundingBox()
  const second = await cards.nth(1).boundingBox()
  expect(Math.abs(first!.y - second!.y)).toBeLessThan(4)
  expect(second!.x).toBeGreaterThan(first!.x)
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
  // The card is the link; the Edit button it replaced no longer exists.
  await expectWithinViewport(page.getByTestId('tutorial-row').first(), width)
  await expectWithinViewport(page.getByText('REJECTED', { exact: true }), width)
})

test('@responsive the new-tutorial page fits the viewport', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto('/upload')

  const width = page.viewportSize()!.width
  await expectWithinViewport(page.getByLabel('Title'), width)
  await expectWithinViewport(page.getByLabel('Difficulty'), width)
  await expectWithinViewport(page.getByRole('button', { name: 'Create' }), width)
})

test('@responsive the tutorial detail page stacks to a single column', async ({ page }) => {
  const contributor = await createContributor()
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Reflow Detail'),
    status: 'approved',
  })

  await page.goto(`/tutorials/${id}`)

  const pdf = page.getByRole('link', { name: 'Download Tutorial PDF' })
  const parts = page.getByRole('heading', { name: 'Parts needed' })
  const pdfBox = await pdf.boundingBox()
  const partsBox = await parts.boundingBox()

  // Stacked, not side by side: the parts heading sits below the PDF button.
  expect(partsBox!.y).toBeGreaterThan(pdfBox!.y)
  await expectWithinViewport(pdf, page.viewportSize()!.width)
})
