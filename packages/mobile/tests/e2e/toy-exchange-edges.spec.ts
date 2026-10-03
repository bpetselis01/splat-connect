import { test, expect, type Browser, type Page } from '@playwright/test'
import {
  createContributor,
  createPublishedToy,
  handoffCodes,
  renameProfile,
  setPickupAddress,
  signIn,
  signInAsNewContributor,
  uniqueTitle,
} from './helpers'

/**
 * The outliers around the toy and exchange journeys: awkward names and
 * messages, a wrong or padded handover code, and giving a toy away twice.
 * Imports only e2e helpers, never a component (see e2e-specs-import-no-components).
 *
 * NOT YET RUN: written alongside the unit edge suites without starting the
 * stack, so the first run may need selector tweaks.
 */

const PICKUP = { pickup_line1: '12 Seeded St', pickup_suburb: 'Testville', pickup_state: 'VIC', pickup_postcode: '3000' }

async function partyPage(browser: Browser, baseURL: string | undefined, party: { email: string; password: string }): Promise<Page> {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await signIn(page, party.email, party.password)
  await expect(page).toHaveURL(/\/home$/)
  return page
}

async function requestPickup(page: Page, toyId: string): Promise<string> {
  await page.goto(`/toy-library/${toyId}`)
  await page.getByRole('button', { name: 'Ask to collect it', exact: true }).click()
  await page.waitForURL(/\/exchanges\/[0-9a-f-]{36}/)
  return page.url().split('/exchanges/')[1]
}

test('a toy with quotes, angle brackets and an ampersand in its name can be added and found again', async ({ page }) => {
  await signInAsNewContributor(page)
  const name = `Sam's "Sparky" <b>drum</b> & co ${Date.now()}`

  await page.goto('/toys/new')
  await page.getByPlaceholder('Name').fill(`  ${name}  `)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.waitForURL(/\/toys\/[0-9a-f-]{36}\/edit/)
  // Saved without the spaces around it, and drawn as text rather than markup.
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible()

  await page.goto('/toys')
  await expect(page.getByText(name, { exact: true })).toBeVisible()
})

test('Create stays held for a name of only spaces', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.goto('/toys/new')
  await page.getByPlaceholder('Name').fill('     ')
  await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeDisabled()
})

test('messages with emoji, markup and quotes arrive exactly as typed, and survive a reload', async ({ browser, baseURL }) => {
  const owner = await createContributor()
  const requester = await createContributor()
  await renameProfile(requester.id, uniqueTitle('E2E Msg Requester'))
  const toyId = await createPublishedToy(owner.id, { name: uniqueTitle('E2E Msg Toy'), offer_type: 'donation' })

  const requesterPage = await partyPage(browser, baseURL, requester)
  const ownerPage = await partyPage(browser, baseURL, owner)
  try {
    const txId = await requestPickup(requesterPage, toyId)
    const text = `Thank you 🧸 <i>so</i> much & "really" — ${'x'.repeat(300)}`

    await ownerPage.goto(`/exchanges/${txId}`)
    await ownerPage.getByRole('textbox', { name: /^Message / }).fill(`   ${text}   `)
    await ownerPage.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(ownerPage.getByText(text, { exact: true })).toBeVisible()

    await ownerPage.reload()
    await expect(ownerPage.getByText(text, { exact: true })).toBeVisible()
    // The other side's 10s poll brings it over without a reload.
    await expect(requesterPage.getByText(text, { exact: true })).toBeVisible({ timeout: 20_000 })
  } finally {
    await requesterPage.context().close()
    await ownerPage.context().close()
  }
})

test('a wrong handover code is refused and the exchange stays open, then the right code padded with spaces completes it', async ({ browser, baseURL }) => {
  const owner = await createContributor()
  await setPickupAddress(owner.id, PICKUP)
  const requester = await createContributor()
  const toyId = await createPublishedToy(owner.id, { name: uniqueTitle('E2E Code Toy'), offer_type: 'donation' })

  const requesterPage = await partyPage(browser, baseURL, requester)
  const ownerPage = await partyPage(browser, baseURL, owner)
  try {
    const txId = await requestPickup(requesterPage, toyId)
    await ownerPage.goto(`/exchanges/${txId}`)
    await ownerPage.getByRole('button', { name: 'Accept', exact: true }).click()
    await ownerPage.getByRole('button', { name: 'Accept request', exact: true }).click()
    await expect(ownerPage.getByTestId('stage-Handover-current')).toBeVisible()

    const { requester_code } = await handoffCodes(txId)
    const wrong = requester_code === '000000' ? '111111' : '000000'

    await ownerPage.getByLabel('Enter their code').fill(wrong)
    await ownerPage.getByRole('button', { name: 'Confirm handoff', exact: true }).click()
    await expect(ownerPage.getByText('Incorrect code', { exact: true })).toBeVisible()
    await expect(ownerPage.getByTestId('stage-Handover-current')).toBeVisible()

    // A short code is refused the same way.
    await ownerPage.getByLabel('Enter their code').fill(requester_code.slice(0, 3))
    await ownerPage.getByRole('button', { name: 'Confirm handoff', exact: true }).click()
    await expect(ownerPage.getByText('Incorrect code', { exact: true })).toBeVisible()

    await ownerPage.getByLabel('Enter their code').fill(` ${requester_code} `)
    await ownerPage.getByRole('button', { name: 'Confirm handoff', exact: true }).click()
    await expect(ownerPage.getByText('Completed', { exact: true })).toBeVisible()
  } finally {
    await requesterPage.context().close()
    await ownerPage.context().close()
  }
})

test('an owner cannot ask for their own toy, and the library shows a one-toy search as one toy', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  await renameProfile(me.id, uniqueTitle('E2E Own'))
  const name = uniqueTitle('E2E Own Toy')
  const toyId = await createPublishedToy(me.id, { name, offer_type: 'both' })

  await page.goto(`/toy-library/${toyId}`)
  await expect(page.getByText(name).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ask to collect it', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Arrange exchange', exact: true })).toHaveCount(0)

  await page.goto('/toy-library')
  await page.getByPlaceholder('Search by toy name').fill(name)
  await expect(page.getByText('1 toy', { exact: true })).toBeVisible()
})
