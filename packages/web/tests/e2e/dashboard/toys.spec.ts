import path from 'node:path'
import { test, expect } from '@playwright/test'
import { signIn, createContributor, createPublishedToy, acceptTerms, adminClient, deleteUser, uniqueTitle } from '../helpers'

const PHOTO_FIXTURE = path.join(__dirname, '..', 'fixtures', 'test.jpg')

test('WY13 WY14 WY16 WY17 WY19 WY20 WY21 WY24 a contributor adds a toy, edits it, uploads a cover photo, publishes it, and deletes it', async ({
  page,
}) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    await page.goto('/dashboard/toys')
    await page.getByRole('link', { name: 'Add a toy' }).click()
    await page.waitForURL('**/dashboard/toys/new')
    // The board's one card: kind, name, condition, photos. No locked wizard.
    await page.getByRole('radio', { name: /Standard toy/ }).click()
    await page.locator('#new-toy-name').fill('E2E Test Toy')
    await page.locator('#new-toy-condition').fill('6')
    await page.getByRole('button', { name: /Create listing/ }).click()
    // Creation opens the listing editor on Status.
    await page.waitForURL(/\/dashboard\/toys\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { name: 'E2E Test Toy' })).toBeVisible()

    await page.getByRole('tab', { name: 'Details' }).click()
    await page.locator('#toy-condition').fill('9')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    // Scoped to <main>: the rail carries a "Saved" row of its own.
    await expect(page.getByRole('main').getByText('Saved', { exact: true })).toBeVisible()

    // Listing needs a photo and an offer type; the header button waits for both.
    const list = page.getByRole('button', { name: 'List it in the library' }).first()
    await expect(list).toBeDisabled()

    await page.getByRole('tab', { name: 'Photos' }).click()
    // A photo uploads and saves as it is added, so the tile appearing IS the
    // confirmation.
    await page.locator('#toy-add-photo').setInputFiles(PHOTO_FIXTURE)
    await expect(page.getByText('Cover')).toBeVisible({ timeout: 20_000 })

    await page.getByRole('tab', { name: 'Status' }).click()
    await expect(list).toBeDisabled()
    await page.getByRole('radio', { name: /Donation/ }).click()
    await expect(list).toBeEnabled()
    await list.click()
    await expect(page.getByText('Families can ask for this')).toBeVisible()

    await page.goto('/dashboard/toys')
    const card = page.getByRole('link', { name: /E2E Test Toy/ })
    await expect(card).toBeVisible()
    // The board's stage words: Live once listed, never Hidden.
    await expect(card.getByText('Live')).toBeVisible()
    await expect(card.getByText('Hidden')).toHaveCount(0)

    await card.click()
    await expect(page).toHaveURL(/\/dashboard\/toys\/[0-9a-f-]{36}$/)
    await page.getByRole('button', { name: 'Delete toy' }).click()
    await page.getByLabel(/to confirm/i).fill('confirm_delete_toy')
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.waitForURL('**/dashboard/toys')
    await expect(page.getByText('E2E Test Toy')).toHaveCount(0)
  } finally {
    await deleteUser(contributor.id)
  }
})

test('WY12 the My toys chips count each stage and narrow the shelf to it', async ({ page }) => {
  const owner = await createContributor()
  await acceptTerms(owner.id)
  const asker = await createContributor()
  const live = uniqueTitle('Live drum')
  const asked = uniqueTitle('Asked drum')
  const hidden = uniqueTitle('Hidden drum')
  await createPublishedToy(owner.id, { name: live })
  const askedId = await createPublishedToy(owner.id, { name: asked })
  const { error } = await adminClient().from('toys').insert({ owner_id: owner.id, name: hidden, condition: 5, status: 'draft' })
  if (error) throw new Error(error.message)
  await adminClient().from('toy_transactions').insert({ type: 'donation', status: 'requested', toy_id: askedId, requester_id: asker.id, owner_id: owner.id })
  try {
    await signIn(page, owner.email, owner.password)
    await page.goto('/dashboard/toys')
    const chips = page.getByRole('group', { name: 'Filter toys by status' })
    await expect(chips.getByRole('link', { name: /^All/ })).toContainText('3')
    await expect(chips.getByRole('link', { name: /^Needs you/ })).toContainText('1')

    await chips.getByRole('link', { name: /^Hidden/ }).click()
    await expect(page).toHaveURL(/stage=hidden/)
    await expect(page.getByRole('link', { name: new RegExp(hidden) })).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(live) })).toHaveCount(0)

    await chips.getByRole('link', { name: /^Needs you/ }).click()
    await expect(page.getByRole('link', { name: new RegExp(asked) })).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(hidden) })).toHaveCount(0)
  } finally {
    await deleteUser(owner.id)
    await deleteUser(asker.id)
  }
})

test('WY18 WY22 WY23 an owner saves who a live toy suits, pauses it, and hand-picks what is shown beside it', async ({ page, browser }) => {
  const owner = await createContributor()
  await acceptTerms(owner.id)
  const name = uniqueTitle('Suit drum')
  const sibling = uniqueTitle('Sibling drum')
  const toyId = await createPublishedToy(owner.id, { name })
  await createPublishedToy(owner.id, { name: sibling })
  try {
    await signIn(page, owner.email, owner.password)
    await page.goto(`/dashboard/toys/${toyId}`)

    await page.getByRole('tab', { name: 'Details' }).click()
    await page.getByRole('button', { name: 'Light touch' }).click()
    await page.getByRole('button', { name: "Save who it's for" }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
    await page.reload()
    await page.getByRole('tab', { name: 'Details' }).click()
    await expect(page.getByRole('button', { name: 'Light touch' })).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('tab', { name: 'Status' }).click()
    await page.getByRole('button', { name: 'Mark unavailable' }).click()
    await expect(page.getByRole('button', { name: 'Take requests again' })).toBeVisible()
    const guest = await (await browser.newContext()).newPage()
    await guest.goto(`/toy-library/${toyId}`)
    await expect(guest.getByText('Not taking requests right now')).toBeVisible()
    await page.goto(`/dashboard/toys/${toyId}`)
    await page.getByRole('button', { name: 'Take requests again' }).click()
    await expect(page.getByRole('button', { name: 'Mark unavailable' })).toBeVisible()
    await guest.reload()
    await expect(guest.getByRole('link', { name: 'Sign in to ask for it' })).toBeVisible()

    await page.goto(`/dashboard/toys/${toyId}`)
    await page.getByRole('radio', { name: 'Hand-picked' }).click()
    await expect(page.getByRole('radio', { name: 'Hand-picked' })).toHaveAttribute('aria-checked', 'true')
    await page.getByLabel(new RegExp(sibling)).check()
    await page.getByRole('button', { name: 'Save picks' }).click()
    await expect(page.getByRole('button', { name: 'Save picks' })).toBeEnabled()
    await guest.reload()
    await expect(guest.getByRole('region', { name: 'Also worth a look' })).toContainText(sibling)
  } finally {
    await deleteUser(owner.id)
  }
})
