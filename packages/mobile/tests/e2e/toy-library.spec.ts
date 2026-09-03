import { test, expect } from '@playwright/test'
import {
  createContributor,
  createPublishedToy,
  renameProfile,
  signInAsNewContributor,
  uniqueTitle,
  pickFilter,
} from './helpers'

/**
 * Browsing side of the toy library: what a card says, what the filters keep,
 * what the bookmark writes, and which request affordances a toy's offer_type
 * earns on its detail screen. The handoff itself lives in exchanges.spec.ts.
 *
 * Every test signs in as somebody OTHER than the toy's owner. The owner's own
 * toy hides the request block entirely (ToyDetailScreen's isOwner branch), so
 * a spec that browsed its own fixture would assert on the one case the
 * gating below is not about.
 */

test('a card carries its holder, its condition and its switch-adapted badge', async ({ page }) => {
  await signInAsNewContributor(page)
  const owner = await createContributor()
  const holder = uniqueTitle('E2E Holder')
  await renameProfile(owner.id, holder)
  const name = uniqueTitle('E2E Toy Card')
  await createPublishedToy(owner.id, { name, condition: 7, switch_adapted: true })

  await page.goto('/toy-library')
  // Narrowed to the one row first: the library is every worker's published
  // toys at once, and the lines below are not unique to this fixture unless
  // the list is.
  await page.getByPlaceholder('Search by toy name').fill(name)
  await expect(page.getByText(name)).toBeVisible()

  await expect(page.getByText(`7/10 · Held by ${holder}`)).toBeVisible()
  // Badge uppercases the string itself rather than leaning on textTransform,
  // so the text node really does read SWITCH-ADAPTED.
  await expect(page.getByText('SWITCH-ADAPTED', { exact: true })).toBeVisible()
})

test('the condition buckets keep only the toys that fall in them', async ({ page }) => {
  await signInAsNewContributor(page)
  const owner = await createContributor()
  // One search token, two toys: the bucket is then the only thing that can
  // explain either one disappearing.
  const token = uniqueTitle('E2E Bucket')
  const good = `${token} Good`
  const wellLoved = `${token} Worn`
  await createPublishedToy(owner.id, { name: good, condition: 9 })
  await createPublishedToy(owner.id, { name: wellLoved, condition: 2 })

  await page.goto('/toy-library')
  await page.getByPlaceholder('Search by toy name').fill(token)
  await expect(page.getByText(good)).toBeVisible()
  await expect(page.getByText(wellLoved)).toBeVisible()

  await pickFilter(page, 'Good (7–10)')
  await expect(page.getByText(good)).toBeVisible()
  await expect(page.getByText(wellLoved)).toHaveCount(0)

  await pickFilter(page, 'Well-loved (1–3)')
  await expect(page.getByText(wellLoved)).toBeVisible()
  await expect(page.getByText(good)).toHaveCount(0)

  // Fair sits between the two, so it is the bucket that proves the thresholds
  // exclude as well as include.
  await pickFilter(page, 'Fair (4–6)')
  await expect(page.getByText(good)).toHaveCount(0)
  await expect(page.getByText(wellLoved)).toHaveCount(0)
})

test('tapping Save on a toy card flips the bookmark and the flip survives a reload', async ({ page }) => {
  await signInAsNewContributor(page)
  const owner = await createContributor()
  const name = uniqueTitle('E2E Toy Save')
  await createPublishedToy(owner.id, { name })

  await page.goto('/toy-library')
  await page.getByPlaceholder('Search by toy name').fill(name)
  await expect(page.getByText(name)).toBeVisible()

  // Awaited, not just clicked: the flip is optimistic, so a reload fired
  // straight after the click aborts the POST in flight and the save never
  // reaches the database — which is exactly what this spec would then miss.
  const saved = page.waitForResponse(
    (r) => r.url().endsWith('/api/saves') && r.request().method() === 'POST'
  )
  await page.getByLabel('Save', { exact: true }).click()
  await expect(page.getByLabel('Saved', { exact: true })).toBeVisible()
  expect((await saved).status()).toBe(201)

  await page.reload()
  await page.getByPlaceholder('Search by toy name').fill(name)
  await expect(page.getByLabel('Saved', { exact: true })).toBeVisible()
})

test("the request block offers only what the toy's offer_type allows", async ({ page }) => {
  await signInAsNewContributor(page)
  const owner = await createContributor()
  const holder = uniqueTitle('E2E Detail Holder')
  await renameProfile(owner.id, holder)
  const donation = await createPublishedToy(owner.id, { offer_type: 'donation' })
  const exchange = await createPublishedToy(owner.id, { offer_type: 'exchange' })
  const both = await createPublishedToy(owner.id, { offer_type: 'both' })

  await page.goto(`/toy-library/${donation}`)
  await expect(page.getByText(`Held by ${holder}`)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Arrange pickup', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Arrange exchange', exact: true })).toHaveCount(0)

  await page.goto(`/toy-library/${exchange}`)
  await expect(page.getByRole('button', { name: 'Arrange exchange', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Arrange pickup', exact: true })).toHaveCount(0)

  await page.goto(`/toy-library/${both}`)
  await expect(page.getByRole('button', { name: 'Arrange pickup', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Arrange exchange', exact: true })).toBeVisible()
})

test('a listed toy that is not being offered says so instead of asking', async ({ page }) => {
  await signInAsNewContributor(page)
  const owner = await createContributor()
  // A published toy with no offer_type: it is in the library to be seen, not
  // to be asked for. The block has to say that rather than render nothing,
  // which would read as a screen that failed to load its buttons.
  const id = await createPublishedToy(owner.id, { offer_type: null })

  await page.goto(`/toy-library/${id}`)

  await expect(page.getByText('Not currently offered for donation or exchange.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Arrange pickup', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Arrange exchange', exact: true })).toHaveCount(0)
})
