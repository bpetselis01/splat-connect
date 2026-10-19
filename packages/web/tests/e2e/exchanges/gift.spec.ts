import { test, expect } from '@playwright/test'
import { createPublishedToy, deleteUser, uniqueTitle } from '../helpers'
import { fillPickup, inboxRow, myCode, openExchangesList, seat, unreadIs } from './support'

test('WY06 WY10 WX01 WX02 WX05 WX06 WX09 WX13 WX14 WY15 a Gift runs ask, accept, message, confirm and closed across two seats', async ({ browser, baseURL }) => {
  test.setTimeout(180_000)
  const holder = await seat(browser, baseURL, 'Holly Holder')
  const family = await seat(browser, baseURL, 'Fiona Family')
  const toyName = uniqueTitle('Gift drum')
  const toyId = await createPublishedToy(holder.id, { name: toyName, offer_type: 'donation' })
  try {
    // Ask
    await family.page.goto(`/toy-library/${toyId}`)
    await family.page.getByRole('link', { name: 'Ask to collect it' }).click()
    await expect(family.page).toHaveURL(new RegExp(`/toy-library/${toyId}/request\\?mode=donation`))
    await family.page.getByLabel(/Say who it is for/).fill('My daughter is five and presses with a flat palm.')
    await family.page.getByRole('button', { name: 'Send the request' }).click()
    await family.page.waitForURL(/\/dashboard\/exchanges\/[0-9a-f-]{36}$/)
    const thread = family.page.url()
    await expect(family.page.getByText('Not yet answered')).toBeVisible()
    await expect(family.page.getByText('Waiting to hear back')).toBeVisible()
    await expect(family.page.getByText('You are receiving this from')).toContainText('Holly Holder')

    // The holder is told, opens My exchanges, and the bucket empties
    await unreadIs(holder.page, 1)
    await inboxRow(holder.page, `Fiona Family requested ${toyName}`)
    await openExchangesList(holder.page)
    await expect(holder.page.getByText('1 waiting on you')).toBeVisible()
    await holder.page.getByRole('link', { name: 'Thread' }).first().click()
    await expect(holder.page).toHaveURL(thread)
    await unreadIs(holder.page, 0)
    await holder.page.goto(thread)
    await expect(holder.page.getByRole('heading', { name: 'Fiona Family wants this toy' })).toBeVisible()

    // Accept
    await holder.page.getByRole('button', { name: 'Accept', exact: true }).click()
    await fillPickup(holder.page, '1 Gift St')
    await holder.page.getByRole('button', { name: 'Accept request' }).click()
    await expect(holder.page.getByText('They said yes')).toBeVisible()
    await expect(holder.page.getByText('Meeting them')).toBeVisible()
    await expect(holder.page.getByText('Handover in Testville, VIC')).toBeVisible()

    await unreadIs(family.page, 1)
    await inboxRow(family.page, `Holly Holder accepted your request for ${toyName}`)
    await openExchangesList(family.page)
    await unreadIs(family.page, 0)

    // Message
    await family.page.goto(thread)
    const code = await myCode(family.page)
    await family.page.getByLabel(/^Message /).fill('Can we meet on Thursday after three?')
    await family.page.getByRole('button', { name: 'Send' }).click()
    await expect(family.page.getByRole('log', { name: 'Conversation' })).toContainText('Can we meet on Thursday after three?')
    await unreadIs(holder.page, 1)
    await inboxRow(holder.page, `Fiona Family sent a message about ${toyName}`)
    await holder.page.goto(thread)
    await expect(holder.page.getByRole('log', { name: 'Conversation' })).toContainText('Can we meet on Thursday after three?')
    await openExchangesList(holder.page)
    await unreadIs(holder.page, 0)

    // Confirm, and closed
    await holder.page.goto(thread)
    await holder.page.getByLabel(/other party.s code/i).fill(code)
    await holder.page.getByRole('button', { name: 'Confirm handoff' }).click()
    await expect(holder.page.getByText('Handoff complete.')).toBeVisible()
    await expect(holder.page.getByText(/^Closed \d/)).toBeVisible()

    // The family can list what they were given, and look back at the listing
    await family.page.goto(thread)
    await expect(family.page.getByText('Handed over', { exact: true }).first()).toBeVisible()
    await family.page.getByRole('link', { name: 'View the listing' }).click()
    await expect(family.page).toHaveURL(new RegExp(`/toy-library/${toyId}$`))
    await family.page.goto(thread)
    await family.page.getByRole('link', { name: 'Add to toy library' }).click()
    await expect(family.page).toHaveURL(/\/dashboard\/toys\/[0-9a-f-]{36}$/)
    await expect(family.page.getByRole('heading', { name: toyName })).toBeVisible()

    // The holder finds it under Given away, linking back to the thread
    await holder.page.goto('/dashboard/toys')
    await holder.page.getByRole('link', { name: new RegExp(toyName) }).click()
    await expect(holder.page).toHaveURL(thread)
  } finally {
    await deleteUser(holder.id)
    await deleteUser(family.id)
  }
})
