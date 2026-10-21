import { test, expect, type Page } from '@playwright/test'
import { createPublishedToy, deleteUser, uniqueTitle } from '../helpers'
import { fillPickup, inboxRow, myCode, openExchangesList, seat, unreadIs } from './support'

async function openBreakdown(page: Page) {
  const panel = page.locator('section[aria-labelledby="cost-heading"]')
  await panel.getByText('Breakdown').click()
  return panel
}

test('WY06 WY10 WX01 WX05 WX06 WX09 WX10 WX11 WX12 WY15 a Swap runs ask, accept, message, cost, confirm on both sides and closed', async ({ browser, baseURL }) => {
  test.setTimeout(180_000)
  const holder = await seat(browser, baseURL, 'Holly Holder')
  const family = await seat(browser, baseURL, 'Fiona Family')
  const toyName = uniqueTitle('Swap drum')
  const offeredName = uniqueTitle('Offered kite')
  const toyId = await createPublishedToy(holder.id, { name: toyName, offer_type: 'exchange' })
  await createPublishedToy(family.id, { name: offeredName, offer_type: 'exchange' })
  try {
    // Ask, offering a toy back
    await family.page.goto(`/toy-library/${toyId}`)
    await family.page.getByRole('link', { name: 'Offer a swap' }).click()
    await expect(family.page).toHaveURL(new RegExp(`/toy-library/${toyId}/request\\?mode=exchange`))
    await family.page.getByLabel(/Say who it is for/).fill('Her kite has a switch and she wants a drum to match.')
    await family.page.getByRole('button', { name: `Offer ${offeredName}` }).click()
    await family.page.waitForURL(/\/dashboard\/exchanges\/[0-9a-f-]{36}$/)
    const thread = family.page.url()
    await expect(family.page.getByText('Not yet answered')).toBeVisible()
    await expect(family.page.getByText(offeredName).first()).toBeVisible()

    await unreadIs(holder.page, 1)
    await inboxRow(holder.page, `Fiona Family requested ${toyName}`)
    await openExchangesList(holder.page)
    await unreadIs(holder.page, 0)

    // Accept
    await holder.page.goto(thread)
    await expect(holder.page.getByRole('heading', { name: 'Fiona Family wants this toy' })).toBeVisible()
    await holder.page.getByRole('button', { name: 'Accept', exact: true }).click()
    await fillPickup(holder.page, '2 Swap St')
    await holder.page.getByRole('button', { name: 'Accept request' }).click()
    await expect(holder.page.getByText('They said yes')).toBeVisible()
    await expect(holder.page.getByText('Meeting them')).toBeVisible()
    await unreadIs(family.page, 1)
    await inboxRow(family.page, `Holly Holder accepted your request for ${toyName}`)
    await openExchangesList(family.page)
    await unreadIs(family.page, 0)

    // Message, from the holder this time
    await holder.page.goto(thread)
    await holder.page.getByLabel(/^Message /).fill('Friday morning suits me.')
    await holder.page.getByRole('button', { name: 'Send' }).click()
    await expect(holder.page.getByRole('log', { name: 'Conversation' })).toContainText('Friday morning suits me.')
    await unreadIs(family.page, 1)
    await inboxRow(family.page, `Holly Holder sent a message about ${toyName}`)
    await family.page.goto(thread)
    await expect(family.page.getByRole('log', { name: 'Conversation' })).toContainText('Friday morning suits me.')
    await openExchangesList(family.page)
    await unreadIs(family.page, 0)

    // Costs: the holder claims postage back and adds a line to take away again; the family settles
    await holder.page.goto(thread)
    let panel = await openBreakdown(holder.page)
    await panel.getByLabel('What it was for').fill('Postage satchel')
    await panel.getByLabel('Amount').fill('12.50')
    await panel.getByRole('button', { name: 'Add cost' }).click()
    await expect(panel.getByText('Postage satchel')).toBeVisible()
    await expect(panel.getByTestId('cost-total')).toHaveText('$12.50')
    await panel.getByLabel('What it was for').fill('Tape')
    await panel.getByLabel('Amount').fill('3')
    await panel.getByRole('button', { name: 'Add cost' }).click()
    await expect(panel.getByTestId('cost-total')).toHaveText('$15.50')
    await panel.getByRole('button', { name: 'Remove Tape' }).click()
    await expect(panel.getByText('Tape')).toHaveCount(0)
    await expect(panel.getByTestId('cost-total')).toHaveText('$12.50')

    await family.page.goto(thread)
    panel = await openBreakdown(family.page)
    await expect(panel.getByText('You pay back')).toBeVisible()
    await panel.getByRole('button', { name: 'Mark settled' }).click()
    await expect(panel.getByRole('button', { name: 'Settled' })).toBeVisible()
    await expect(panel.getByTestId('cost-total')).toHaveText('$0.00')

    // Confirm: both sides type the other's code
    const holderCode = await myCode(holder.page)
    await family.page.goto(thread)
    const familyCode = await myCode(family.page)
    await family.page.getByLabel(/other party.s code/i).fill(holderCode)
    await family.page.getByRole('button', { name: 'Confirm handoff' }).click()
    await expect(family.page.getByText(/You have confirmed the handoff/)).toBeVisible()
    await expect(family.page.getByText('Waiting on the other confirmation')).toBeVisible()

    await holder.page.goto(thread)
    await holder.page.getByLabel(/other party.s code/i).fill(familyCode)
    await holder.page.getByRole('button', { name: 'Confirm handoff' }).click()
    await expect(holder.page.getByText('Handoff complete.')).toBeVisible()
    await expect(holder.page.getByText(/^Closed \d/)).toBeVisible()

    // Each side finds what they gave under Given away
    await holder.page.goto('/dashboard/toys')
    const gave = holder.page.getByRole('link', { name: new RegExp(toyName) })
    await expect(gave).toContainText(`Swapped with Fiona Family for ${offeredName}`)
    await gave.click()
    await expect(holder.page).toHaveURL(thread)
  } finally {
    await deleteUser(holder.id)
    await deleteUser(family.id)
  }
})
