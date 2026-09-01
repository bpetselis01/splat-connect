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
 * The peer-to-peer loop end to end: request, accept, confirm, and the two ways
 * out of it. The mobile counterpart of packages/web/tests/e2e/toy-exchange.spec.ts.
 *
 * Two browser contexts rather than one page signed in and out: every tab and
 * every (my) screen is gated on a session, and /sign-in redirects a signed-in
 * caller straight back to /guides — so a second sign-in on the same page would
 * have to walk Account → Sign Out first, on every hop, for no assertion's
 * benefit. Separate contexts also mean each party's storage is genuinely their
 * own, which is what the codes below depend on.
 *
 * The codes themselves come from the database, not from either screen: the API
 * sanitises the row so each party sees only their OWN code
 * (routes/toy-transactions.ts sanitizeCodes), and the side doing the
 * confirming needs the other's. In life it is read out at the pickup.
 */

const PICKUP = {
  pickup_line1: '12 Seeded St',
  pickup_suburb: 'Testville',
  pickup_state: 'VIC',
  pickup_postcode: '3000',
}

/** A signed-in page of its own, settled on Guides. */
async function partyPage(
  browser: Browser,
  baseURL: string | undefined,
  party: { email: string; password: string }
): Promise<Page> {
  // baseURL is passed explicitly: a context built from the `browser` fixture
  // gets none of the config's `use` options, so every relative goto below
  // would otherwise have no origin to resolve against.
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await signIn(page, party.email, party.password)
  await expect(page).toHaveURL(/\/guides$/)
  return page
}

/** Request the toy as a donation and return the thread's transaction id. */
async function requestPickup(page: Page, toyId: string): Promise<string> {
  await page.goto(`/toy-library/${toyId}`)
  await page.getByRole('button', { name: 'Arrange pickup', exact: true }).click()
  await page.waitForURL(/\/exchanges\/[0-9a-f-]{36}/)
  return page.url().split('/exchanges/')[1]
}

test('a donation runs from request to handoff, and the toy changes hands', async ({ browser, baseURL }) => {
  const owner = await createContributor()
  // The saved address the accept form pre-fills from (caps.profile.pickup_*).
  await setPickupAddress(owner.id, PICKUP)
  const requester = await createContributor()
  const toyName = uniqueTitle('E2E Handoff Toy')
  const toyId = await createPublishedToy(owner.id, { name: toyName, offer_type: 'donation' })

  const requesterPage = await partyPage(browser, baseURL, requester)
  const ownerPage = await partyPage(browser, baseURL, owner)

  try {
    const txId = await requestPickup(requesterPage, toyId)

    await ownerPage.goto(`/exchanges/${txId}`)
    // The Accept branch is keyed off caps.profile.id, so the button being
    // there is itself proof the owner's capabilities have loaded — which is
    // what makes the pre-filled address below a fair assertion rather than a
    // race against the profile fetch.
    await ownerPage.getByRole('button', { name: 'Accept', exact: true }).click()
    await expect(ownerPage.getByLabel('Street address')).toHaveValue(PICKUP.pickup_line1)
    await expect(ownerPage.getByLabel('Postcode')).toHaveValue(PICKUP.pickup_postcode)
    await ownerPage.getByRole('button', { name: 'Accept request', exact: true }).click()
    await expect(ownerPage.getByText('12 Seeded St, Testville, VIC, 3000')).toBeVisible()
    await expect(ownerPage.getByText('ACCEPTED', { exact: true })).toBeVisible()

    // The requester's page has not been touched since it sent the request; the
    // 10s poll brings the acceptance to it. Their own code shows here, and the
    // owner's does not show on the owner's screen — that asymmetry is the whole
    // donation protocol.
    const codes = await handoffCodes(txId)
    await expect(requesterPage.getByText(codes.requester_code)).toBeVisible()
    await expect(ownerPage.getByText('Your handoff code:')).toHaveCount(0)

    await ownerPage.getByLabel('Enter their code').fill(codes.requester_code)
    await ownerPage.getByRole('button', { name: 'Confirm handoff', exact: true }).click()
    await expect(ownerPage.getByText('COMPLETED', { exact: true })).toBeVisible()

    // The toy is out of the library — it belongs to someone who never asked
    // for it to be listed.
    await requesterPage.goto('/toy-library')
    await requesterPage.getByPlaceholder('Search by toy name').fill(toyName)
    // The empty state first, then the absence. A bare toHaveCount(0) is
    // satisfied the instant it is evaluated — including before the search has
    // rendered anything at all — so on its own it would pass whether or not
    // the toy left the library. The empty state is the proof the list really
    // ran the query and came back with nothing.
    await expect(requesterPage.getByText('No toys here yet')).toBeVisible()
    // By role, not by text: the empty state's own hint quotes the search term
    // back, so the toy's name is on this screen either way. Only a card is a
    // button named after the toy (ToyRow's accessibilityLabel).
    await expect(requesterPage.getByRole('button', { name: toyName, exact: true })).toHaveCount(0)

    // The confirm handler transfers a person's toy to the requester as a draft
    // (routes/toy-transactions.ts transferToy) rather than archiving it — My
    // Toys filters on owner_id, so the giver's shelf clears itself. What the
    // giver keeps is the Given away section, read back off the completed
    // handoff: the toy's name, who got it, and a tap through to the thread.
    await ownerPage.goto('/toys')
    await expect(ownerPage.getByText('Given away')).toBeVisible()
    await expect(ownerPage.getByText('No toys on your shelf right now.')).toBeVisible()
    // One row: the toy, receding, and it opens the handoff it records.
    await ownerPage.getByRole('button', { name: toyName, exact: true }).click()
    await expect(ownerPage).toHaveURL(new RegExp(`/exchanges/${txId}$`))

    await requesterPage.goto('/toys')
    await expect(requesterPage.getByText(toyName)).toBeVisible()
    await expect(requesterPage.getByText('DRAFT', { exact: true })).toBeVisible()
  } finally {
    await requesterPage.context().close()
    await ownerPage.context().close()
  }
})

test('either side can withdraw while the handoff is still open', async ({ browser, baseURL }) => {
  const owner = await createContributor()
  const requester = await createContributor()
  const toyName = uniqueTitle('E2E Withdraw Toy')
  const toyId = await createPublishedToy(owner.id, { name: toyName, offer_type: 'donation' })

  const requesterPage = await partyPage(browser, baseURL, requester)
  const ownerPage = await partyPage(browser, baseURL, owner)

  try {
    const txId = await requestPickup(requesterPage, toyId)

    // This owner has no saved address, so the form comes up empty and gets
    // typed — the other half of the accept path the happy case seeds.
    await ownerPage.goto(`/exchanges/${txId}`)
    await ownerPage.getByRole('button', { name: 'Accept', exact: true }).click()
    await expect(ownerPage.getByLabel('Street address')).toHaveValue('')
    await ownerPage.getByLabel('Street address').fill('8 Typed Rd')
    await ownerPage.getByLabel('Suburb').fill('Testville')
    await ownerPage.getByLabel('State').fill('VIC')
    await ownerPage.getByLabel('Postcode').fill('3001')
    await ownerPage.getByRole('button', { name: 'Accept request', exact: true }).click()
    await expect(ownerPage.getByText('8 Typed Rd, Testville, VIC, 3001')).toBeVisible()

    // An accepted handoff that falls through has to be escapable, or both
    // people are trapped and the toy stays locked against every rival request
    // — the reason Withdraw is live on 'accepted' and not just 'requested'.
    await requesterPage.goto(`/exchanges/${txId}`)
    await expect(requesterPage.getByText('ACCEPTED', { exact: true })).toBeVisible()
    await requesterPage.getByRole('button', { name: 'Withdraw', exact: true }).click()
    await expect(requesterPage.getByText('WITHDRAWN', { exact: true })).toBeVisible()
    // Nothing left to say or do: the composer and the withdraw button both go
    // with the transaction closing.
    await expect(requesterPage.getByRole('button', { name: 'Withdraw', exact: true })).toHaveCount(0)

    // And the toy is back on the shelf for everyone else.
    await requesterPage.goto('/toy-library')
    await requesterPage.getByPlaceholder('Search by toy name').fill(toyName)
    await expect(requesterPage.getByRole('button', { name: toyName, exact: true })).toBeVisible()
  } finally {
    await requesterPage.context().close()
    await ownerPage.context().close()
  }
})

test('an exchange request names both toys in the thread', async ({ page }) => {
  const requester = await signInAsNewContributor(page)
  const owner = await createContributor()
  const ownerName = uniqueTitle('E2E Swap Owner')
  await renameProfile(owner.id, ownerName)
  const theirToy = uniqueTitle('E2E Wanted Toy')
  const myToy = uniqueTitle('E2E Offered Toy')
  const toyId = await createPublishedToy(owner.id, { name: theirToy, offer_type: 'exchange' })
  // The chooser lists the requester's own published, unarchived toys — with
  // none, Arrange exchange refuses rather than opening an empty radio group.
  await createPublishedToy(requester.id, { name: myToy })

  await page.goto(`/toy-library/${toyId}`)
  await page.getByRole('button', { name: 'Arrange exchange', exact: true }).click()

  await expect(page.getByText('Offer one of your toys', { exact: true })).toBeVisible()
  await page.getByRole('radio', { name: myToy, exact: true }).click()
  await page.getByRole('button', { name: 'Start exchange', exact: true }).click()

  await page.waitForURL(/\/exchanges\/[0-9a-f-]{36}/)
  // The swap header is one string, so this is also the assertion that the
  // offered toy reached the transaction rather than being dropped at the POST.
  await expect(page.getByText(`${theirToy} ⇄ ${myToy}`)).toBeVisible()
  await expect(page.getByText(`Exchange with ${ownerName}`)).toBeVisible()
  await expect(page.getByText('REQUESTED', { exact: true })).toBeVisible()
})
