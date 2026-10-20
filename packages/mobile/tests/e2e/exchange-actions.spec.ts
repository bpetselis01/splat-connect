import { test, expect } from '@playwright/test'
import {
  adminClient,
  createContributor,
  createPublishedToy,
  handoffCodes,
  renameProfile,
  signInAsNewContributor,
  uniqueTitle,
} from './helpers'
import { notificationsFor, partyPage, seedDonation, sendReport } from './family-toys-fixtures'

/**
 * The actions on an exchange thread that the happy-path spec does not drive:
 * Decline (and the requester hearing of it), a fresh handoff code, Add to toy
 * library, Say thanks, and Report. Transactions are seeded at the stage each
 * action needs; the request, accept and confirm chain lives in exchanges.spec.ts.
 */

test('X05 X15 Decline needs a reason, turns the request down, and the requester is told in their inbox and reads the reason', async ({ page, browser, baseURL }) => {
  const owner = await signInAsNewContributor(page)
  const ownerName = uniqueTitle('E2E Declining Owner')
  await renameProfile(owner.id, ownerName)
  const requester = await createContributor()
  const toyName = uniqueTitle('E2E Declined Toy')
  const toyId = await createPublishedToy(owner.id, { name: toyName, offer_type: 'donation' })
  const txId = await seedDonation(owner.id, requester.id, toyId, 'requested')

  await page.goto(`/exchanges/${txId}`)
  await page.getByRole('button', { name: 'Decline', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Send the decline' })).toBeDisabled()
  await page.getByLabel('Reason for declining').fill('Already given away')
  await page.getByRole('button', { name: 'Send the decline' }).click()

  await expect(page.getByText('Rejected', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Decline', exact: true })).toHaveCount(0)
  const { data: row } = await adminClient().from('toy_transactions').select('status').eq('id', txId).single()
  expect(row?.status).toBe('rejected')
  // The toy goes back on offer: a refusal does not take it off the shelf.
  const { data: toy } = await adminClient().from('toys').select('status, owner_id').eq('id', toyId).single()
  expect(toy).toEqual({ status: 'published', owner_id: owner.id })

  // The other side: one toy_rejected row naming the owner, and the inbox shows it.
  const rows = await notificationsFor(requester.id, 'toy_rejected')
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ toy_transaction_id: txId, actor_name: ownerName })
  const requesterPage = await partyPage(browser, baseURL, requester)
  try {
    // An exchange notification is drawn as its thread, flagged unread.
    await requesterPage.goto('/inbox')
    await expect(requesterPage.getByText('1 unread')).toBeVisible()
    await expect(requesterPage.getByRole('button', { name: `${toyName} with ${ownerName}` })).toBeVisible()
    await requesterPage.goto(`/exchanges/${txId}`)
    await expect(requesterPage.getByText('This request was declined.')).toBeVisible()
    await expect(requesterPage.getByText('Reason: Already given away')).toBeVisible()
  } finally {
    await requesterPage.context().close()
  }
})

test('X08 New code replaces my handoff code, and the old one stops being mine', async ({ page }) => {
  const requester = await signInAsNewContributor(page)
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  const owner = await createContributor()
  const toyId = await createPublishedToy(owner.id, { name: uniqueTitle('E2E Code Toy'), offer_type: 'donation' })
  const txId = await seedDonation(owner.id, requester.id, toyId, 'accepted')
  const before = (await handoffCodes(txId)).requester_code

  await page.goto(`/exchanges/${txId}`)
  await expect(page.getByText('Your handoff code', { exact: true })).toBeVisible()
  await expect(page.getByLabel(before.split('').join(' '))).toBeVisible()

  // Copy: the flash line names the code it copied.
  await page.getByRole('button', { name: 'Copy', exact: true }).click()
  await expect(page.getByText(`Code ${before} copied`)).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(before)

  const posted = page.waitForResponse((r) => r.url().endsWith('/new-code') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'New code', exact: true }).click()
  expect((await posted).status()).toBe(200)
  await expect(page.getByText('New code — the old one no longer works')).toBeVisible()

  const after = await handoffCodes(txId)
  expect(after.requester_code).not.toBe(before)
  await expect(page.getByLabel(after.requester_code.split('').join(' '))).toBeVisible()
  // Only my code moved: the owner's is untouched, and still not on my screen.
  const { data } = await adminClient().from('toy_transactions').select('owner_code').eq('id', txId).single()
  expect(data?.owner_code).toBe(after.owner_code)
})

test('X09 a completed handoff offers Add to toy library, which opens the received toy in the editor', async ({ page }) => {
  const requester = await signInAsNewContributor(page)
  const owner = await createContributor()
  const toyName = uniqueTitle('E2E Received Toy')
  const toyId = await createPublishedToy(owner.id, { name: toyName, offer_type: 'donation' })
  const txId = await seedDonation(owner.id, requester.id, toyId, 'completed')

  await page.goto(`/exchanges/${txId}`)
  await expect(page.getByText('Handoff complete.')).toBeVisible()
  await expect(page.getByText(`${toyName} is yours now.`, { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Add to toy library', exact: true }).click()

  await expect(page).toHaveURL(new RegExp(`/toys/${toyId}/edit$`))
  await expect(page.getByText(toyName, { exact: true }).first()).toBeVisible()
  const { data } = await adminClient().from('toys').select('owner_id, status').eq('id', toyId).single()
  expect(data).toEqual({ owner_id: requester.id, status: 'draft' })
})

test('X13 Say thanks writes one profile thanks, tells the giver, and cannot be sent twice', async ({ page, browser, baseURL }) => {
  const requester = await signInAsNewContributor(page)
  const owner = await createContributor()
  const ownerName = uniqueTitle('E2E Thanked Giver')
  await renameProfile(owner.id, ownerName)
  const toyName = uniqueTitle('E2E Thanks Toy')
  const toyId = await createPublishedToy(owner.id, { name: toyName, offer_type: 'donation' })
  const txId = await seedDonation(owner.id, requester.id, toyId, 'completed')

  await page.goto(`/exchanges/${txId}`)
  const thanks = page.getByRole('button', { name: `Say thanks to ${ownerName}`, exact: true })
  await thanks.click()
  await page.getByRole('button', { name: 'Send thanks', exact: true }).click()
  await expect(page.getByText('Thanks sent — they will see it in their notifications')).toBeVisible()
  await expect(thanks).toBeDisabled()

  const { data } = await adminClient()
    .from('profile_thanks')
    .select('profile_id, thanker_id, transaction_id')
    .eq('thanker_id', requester.id)
  expect(data).toEqual([{ profile_id: owner.id, thanker_id: requester.id, transaction_id: txId }])
  const rows = await notificationsFor(owner.id, 'profile_thanked')
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ toy_transaction_id: txId })

  const ownerPage = await partyPage(browser, baseURL, owner)
  try {
    await ownerPage.goto('/inbox')
    await expect(ownerPage.getByText('1 unread')).toBeVisible()
    await expect(ownerPage.getByRole('button', { name: new RegExp(`^${toyName} with `) })).toBeVisible()
  } finally {
    await ownerPage.context().close()
  }
})

test('X14 Report a problem on a thread files an exchange report naming the thread', async ({ page }) => {
  const requester = await signInAsNewContributor(page)
  const owner = await createContributor()
  const ownerName = uniqueTitle('E2E Reported Owner')
  await renameProfile(owner.id, ownerName)
  const toyName = uniqueTitle('E2E Reported Toy')
  const toyId = await createPublishedToy(owner.id, { name: toyName, offer_type: 'donation' })
  const txId = await seedDonation(owner.id, requester.id, toyId, 'accepted')

  await page.goto(`/exchanges/${txId}`)
  await page.getByRole('button', { name: /Report a problem$/ }).click()
  await expect(page.getByText(`About this exchange · with ${ownerName}.`, { exact: false })).toBeVisible()
  const body = `Did not turn up ${Date.now()}`
  const rows = await sendReport(page, requester.id, 'Didn’t show up', body)

  expect(rows).toEqual([
    {
      subject_kind: 'exchange',
      subject_id: txId,
      subject_label: `${toyName} — exchange with ${ownerName}`,
      category: 'no_show',
      body,
      status: 'new',
    },
  ])
})
