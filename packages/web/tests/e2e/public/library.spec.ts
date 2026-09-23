import { test, expect } from '@playwright/test'
import { createContributor, createTutorial, signIn, uniqueTitle } from '../helpers'

// The board's #library: three one-choice facets, a sort menu, and the header
// search arriving as ?q=. Spec docs/superpowers/specs/2026-09-18-library-backend-design.md.

test('the library lists an approved guide and hides a pending one', async ({ page }) => {
  const contributor = await createContributor()
  const approved = uniqueTitle('E2E Library Approved')
  const pending = uniqueTitle('E2E Library Pending')
  await createTutorial(contributor.id, { title: approved, status: 'approved' })
  await createTutorial(contributor.id, { title: pending, status: 'pending' })

  await page.goto(`/library?q=${encodeURIComponent('E2E Library')}`)

  await expect(page.getByRole('heading', { name: 'Adapt a toy in an evening' })).toBeVisible()
  await expect(page.getByText(approved)).toBeVisible()
  await expect(page.getByText(pending)).toHaveCount(0)
})

test('the header search arrives as a removable chip', async ({ page }) => {
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

test('Time filters on hands-on minutes, and Needs printing on STL files', async ({ page }) => {
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

test('sort by build time, then flip it', async ({ page }) => {
  const contributor = await createContributor()
  const marker = uniqueTitle('E2E Sort')
  await createTutorial(contributor.id, { title: `${marker} long`, status: 'approved', buildMinutes: 120 })
  await createTutorial(contributor.id, { title: `${marker} short`, status: 'approved', buildMinutes: 15 })

  await page.goto(`/library?q=${encodeURIComponent(marker)}`)
  await page.getByRole('button', { name: 'Newest first' }).click()
  await page.getByRole('option', { name: /Build time/ }).click()
  const titles = page.getByTestId('tutorial-card').locator('.browse-card__title')
  await expect(titles).toHaveText([`${marker} short`, `${marker} long`])

  await page.getByRole('button', { name: 'Switch to longest first' }).click()
  await expect(titles).toHaveText([`${marker} long`, `${marker} short`])
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
