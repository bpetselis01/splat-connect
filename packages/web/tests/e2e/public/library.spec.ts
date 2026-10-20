import { test, expect } from '@playwright/test'
import { createContributor, createTutorial, signIn, uniqueTitle } from '../helpers'

// The board's #library: skill and time facets, the tag groups, a Recommended-first sort, and the header
// search arriving as ?q=. Spec docs/superpowers/specs/2026-09-18-library-backend-design.md.

test('WG01 the library lists an approved guide, hides a pending one, and counts the reviewed guides', async ({ page }) => {
  const contributor = await createContributor()
  const approved = uniqueTitle('E2E Library Approved')
  const pending = uniqueTitle('E2E Library Pending')
  await createTutorial(contributor.id, { title: approved, status: 'approved' })
  await createTutorial(contributor.id, { title: pending, status: 'pending' })

  await page.goto(`/library?q=${encodeURIComponent('E2E Library')}`)

  await expect(page.getByRole('heading', { name: 'Adapt a toy in an evening' })).toBeVisible()
  await expect(page.getByText(approved)).toBeVisible()
  await expect(page.getByText(pending)).toHaveCount(0)
  await expect(page.getByText('reviewed guides').locator('xpath=preceding-sibling::dd')).toHaveText(/^[1-9]\d*$/)
})

test('WG02 the header search arrives as a removable chip', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Library Search')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto(`/library?q=${encodeURIComponent(title)}`)
  // Scoped to the card: the same words are on the search chip above the grid.
  await expect(page.getByTestId('tutorial-card').getByText(title)).toBeVisible()
  await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible()

  await page.goto('/library?q=zzz-no-such-guide-zzz')
  await expect(page.getByText('Nothing matches all of those yet')).toBeVisible()
  await page.getByRole('button', { name: /zzz-no-such-guide-zzz/ }).click()
  await expect(page.getByText('Nothing matches all of those yet')).toHaveCount(0)
})

test('WG04 Time filters on hands-on minutes, and Needs printing on STL files', async ({ page }) => {
  const contributor = await createContributor()
  const marker = uniqueTitle('E2E Time')
  const quick = `${marker} quick`
  const printed = `${marker} printed`
  await createTutorial(contributor.id, { title: quick, status: 'approved', buildMinutes: 20, withStl: false })
  await createTutorial(contributor.id, { title: printed, status: 'approved', buildMinutes: 90 })

  await page.goto(`/library?q=${encodeURIComponent(marker)}`)
  await page.getByRole('button', { name: 'Under 30 min' }).click()
  await expect(page.getByText(quick)).toBeVisible()
  await expect(page.getByText(printed)).toHaveCount(0)

  // One choice per facet: picking another option replaces the first.
  await page.getByRole('button', { name: 'Needs printing', exact: true }).click()
  await expect(page.getByText(printed)).toBeVisible()
  await expect(page.getByText(quick)).toHaveCount(0)
})

test('WG03 sort by Quickest', async ({ page }) => {
  const contributor = await createContributor()
  const marker = uniqueTitle('E2E Sort')
  await createTutorial(contributor.id, { title: `${marker} long`, status: 'approved', buildMinutes: 120 })
  await createTutorial(contributor.id, { title: `${marker} short`, status: 'approved', buildMinutes: 15 })

  await page.goto(`/library?q=${encodeURIComponent(marker)}`)
  // Recommended is the default: with no child profile it is newest first.
  await expect(page.getByRole('button', { name: 'Recommended' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Quickest' }).click()
  const titles = page.getByTestId('tutorial-card').locator('.browse-card__title')
  await expect(titles).toHaveText([`${marker} short`, `${marker} long`])
})

test('a signed-in visitor thanks a guide once, and the count shows on its card', async ({ page }) => {
  const author = await createContributor()
  const reader = await createContributor()
  const title = uniqueTitle('E2E Thanks')
  const id = await createTutorial(author.id, { title, status: 'approved' })

  await signIn(page, reader.email, reader.password)
  await page.goto(`/tutorials/${id}`)
  await page.getByRole('button', { name: /Say thanks/ }).click()
  await expect(page.getByRole('button', { name: /Thanked/ })).toBeDisabled()

  await page.reload()
  await expect(page.getByRole('button', { name: /Thanked/ })).toBeDisabled()

  await page.goto(`/library?q=${encodeURIComponent(title)}`)
  await expect(page.getByTitle('Times people said thanks for this guide')).toHaveText('1 thanks')
})

// The board gives a guest Share alone (a1535727): no Say thanks button to
// bounce off, and the rail's one account call to action — the download —
// takes them to sign up and back to the guide.
test('a signed-out visitor gets Share alone, and the account call to action goes to sign up', async ({ page }) => {
  const author = await createContributor()
  const id = await createTutorial(author.id, { status: 'approved' })

  await page.goto(`/tutorials/${id}`)
  await expect(page.getByRole('button', { name: 'Share' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Say thanks/ })).toHaveCount(0)

  await page.getByRole('link', { name: 'Sign in to download' }).click()
  await expect(page).toHaveURL(new RegExp(`/signup\\?next=%2Ftutorials%2F${id}&reason=download`))
  await expect(page.getByText('You need an account to download tutorial files.')).toBeVisible()
})

test('WG05 Clear filters in the empty state brings the whole list back', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Library Clear')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/library?q=zzz-no-such-guide-zzz')
  await expect(page.getByText('Nothing matches all of those yet')).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()

  await expect(page.getByText('Nothing matches all of those yet')).toHaveCount(0)
  await expect(page.getByTestId('tutorial-card').first()).toBeVisible()
})

test('WG06 Show more reveals the guides past the first 24', async ({ page }) => {
  const contributor = await createContributor()
  const marker = uniqueTitle('E2E More')
  for (let i = 0; i < 25; i++) await createTutorial(contributor.id, { title: `${marker} ${i}`, status: 'approved' })

  await page.goto(`/library?q=${encodeURIComponent(marker)}`)
  await expect(page.getByTestId('tutorial-card')).toHaveCount(24)
  await expect(page.getByText('Showing 24 of 25')).toBeVisible()
  await page.getByRole('button', { name: 'Show more guides' }).click()
  await expect(page.getByTestId('tutorial-card')).toHaveCount(25)
  await expect(page.getByRole('button', { name: 'Show more guides' })).toHaveCount(0)
})

test('WG07 a guide card opens its guide', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Library Open')
  const id = await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto(`/library?q=${encodeURIComponent(title)}`)
  await page.getByTestId('tutorial-card').filter({ hasText: title }).click()

  await expect(page).toHaveURL(new RegExp(`/tutorials/${id}$`))
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
})

test('WG10 Pick for my child sends a signed-out visitor through sign up, and a signed-in one to the wizard', async ({ page }) => {
  await page.goto('/library')
  await page.getByRole('link', { name: 'Pick for my child' }).first().click()
  await expect(page).toHaveURL(/\/signup\?next=%2Fonboarding%2Fchild&reason=child/)

  const reader = await createContributor()
  await signIn(page, reader.email, reader.password)
  await page.goto('/library')
  await page.getByRole('link', { name: 'Pick for my child' }).first().click()
  await expect(page).toHaveURL(/\/onboarding\/child/)
})

test('WG11 the hero offers Submit a guide, and the filter note offers Submit an idea', async ({ page }) => {
  await page.goto('/library')
  await page.locator('.browse-hero__aside').getByRole('link', { name: 'Submit a guide' }).click()
  await expect(page).toHaveURL(/\/get-involved\/submit-a-tutorial$/)
  await expect(page.getByRole('heading', { name: 'Submit a guide', level: 1 })).toBeVisible()

  await page.goto('/library')
  await page.locator('#guide-grid').getByRole('link', { name: /Submit an idea/ }).first().click()
  await expect(page).toHaveURL(/\/get-involved\/submit-an-idea$/)

  await page.goto('/library?q=zzz-no-such-guide-zzz')
  await page.locator('#guide-grid').getByRole('link', { name: 'Browse toys instead' }).click()
  await expect(page).toHaveURL(/\/toy-library$/)
})
