import { test, expect } from '@playwright/test'
import { adminClient, setPickupAddress } from './helpers'
import { PICKUP, notificationsFor, partyPage, seedPrintJob, sent, txRow } from './maker-fixtures'

/**
 * The printer's side of a print job, against the real API: accept, start, post
 * the ready photo and message on one run; then the handover (both codes), the
 * family's fit answer and thanks on a job seeded at "ready". Each move checks
 * the row it writes, the notification the other side gets, and that side's page.
 *
 * Two browser contexts, one per party (see exchanges.spec.ts). The codes come
 * from the row: each screen shows only its own.
 */

test.setTimeout(180_000)
test('R05 R07 R08 R13 a printer accepts, starts, posts the ready photo and messages, and the family sees each step', async ({ browser, baseURL }) => {
  const job = await seedPrintJob('requested')
  await setPickupAddress(job.printer.id, PICKUP)
  const printerPage = await partyPage(browser, baseURL, job.printer)
  const familyPage = await partyPage(browser, baseURL, job.requester)

  try {
    // R13: the card on Print for others; the saved address goes with the accept.
    await printerPage.goto('/print-for-others')
    await expect(printerPage.getByText(job.guideTitle)).toBeVisible()
    await printerPage.getByRole('button', { name: /^Accept/ }).click()
    await expect(printerPage.getByRole('button', { name: 'Started printing' })).toBeVisible()
    const accepted = await txRow(job.id)
    expect(accepted).toMatchObject({ status: 'accepted', owner_id: job.printer.id, ...PICKUP })
    expect(await notificationsFor(job.requester.id, 'toy_accepted', job.id)).toHaveLength(1)
    await familyPage.goto(`/printing/jobs/${job.id}`)
    await expect(familyPage.getByLabel('Progress: Accepted')).toBeVisible()

    // R07: Started printing, from the job page.
    await printerPage.goto(`/printing/jobs/${job.id}`)
    await printerPage.getByRole('button', { name: 'Started printing' }).click()
    await expect(printerPage.getByLabel('Progress: Printing')).toBeVisible()
    expect((await txRow(job.id)).printing_started_at).not.toBeNull()
    expect(await notificationsFor(job.requester.id, 'print_started', job.id)).toHaveLength(1)
    await familyPage.goto(`/printing/jobs/${job.id}`)
    await expect(familyPage.getByLabel('Progress: Printing')).toBeVisible()

    // R05: a message from the printer lands in the family's thread and inbox.
    const hello = `Bed is warming ${Date.now()}`
    await printerPage.getByLabel(`Message ${job.requesterName}`).fill(hello)
    await sent(printerPage, '/messages', () => printerPage.getByRole('button', { name: 'Send', exact: true }).click())
    await expect(printerPage.getByText(hello)).toBeVisible()
    const { data: stored } = await adminClient().from('toy_transaction_messages').select('sender_id, kind').eq('transaction_id', job.id).eq('body', hello)
    expect(stored).toEqual([{ sender_id: job.printer.id, kind: 'user' }])
    expect(await notificationsFor(job.requester.id, 'toy_message', job.id)).toHaveLength(1)
    await familyPage.goto(`/printing/jobs/${job.id}`)
    await expect(familyPage.getByText(hello)).toBeVisible()

    // R08: Mark ready needs a photo, which the web picker takes as a file chooser.
    const chooser = printerPage.waitForEvent('filechooser', { timeout: 15_000 })
    await printerPage.getByRole('button', { name: 'Mark ready for pickup' }).click()
    await (await chooser).setFiles('tests/e2e/fixtures/test.jpg')
    await expect(printerPage.getByText('Waiting for pickup')).toBeVisible()
    const ready = await txRow(job.id)
    expect(ready.ready_at).not.toBeNull()
    expect(ready.ready_photo_url).toContain(job.id)
    expect(await notificationsFor(job.requester.id, 'print_ready', job.id)).toHaveLength(1)
    await familyPage.goto(`/printing/jobs/${job.id}`)
    await expect(familyPage.getByText('Ready for pickup', { exact: true }).first()).toBeVisible()
    await expect(familyPage.getByLabel('Photo of the finished parts')).toBeVisible()
  } finally {
    await printerPage.context().close().catch(() => {})
    await familyPage.context().close().catch(() => {})
  }
})

test('R09 R10 R11 both sides confirm the handover with each other’s code, then the family says it fitted and thanks the printer', async ({ browser, baseURL }) => {
  const job = await seedPrintJob('ready')
  const printerPage = await partyPage(browser, baseURL, job.printer)
  const familyPage = await partyPage(browser, baseURL, job.requester)

  try {
    // R09: the printer types the family's code; one side confirmed is not done.
    await printerPage.goto(`/printing/jobs/${job.id}`)
    await expect(printerPage.getByText('111111')).toBeVisible()
    await printerPage.getByLabel('Their code').fill('222222')
    await printerPage.getByRole('button', { name: 'Confirm handover' }).click()
    await expect(printerPage.getByText(`Waiting on ${job.requesterName} to confirm`)).toBeVisible()
    const half = await txRow(job.id)
    expect(half.owner_confirmed_at).not.toBeNull()
    expect(half.status).toBe('accepted')

    await familyPage.goto(`/printing/jobs/${job.id}`)
    await familyPage.getByLabel('Their code').fill('111111')
    await familyPage.getByRole('button', { name: 'I have collected it' }).click()
    await expect(familyPage.getByText('Both of you confirmed')).toBeVisible()
    expect((await txRow(job.id)).status).toBe('completed')

    // R10: Needs a reprint tells the printer. One answer only.
    await familyPage.getByRole('button', { name: 'Needs a reprint' }).click()
    await expect(familyPage.getByRole('button', { name: 'Fitted' })).toBeDisabled()
    await expect.poll(async () => (await txRow(job.id)).print_fit).toBe('reprint')
    expect(await notificationsFor(job.printer.id, 'toy_message', job.id)).toHaveLength(1)
    await printerPage.goto(`/printing/jobs/${job.id}`)
    await expect(printerPage.getByText('Needs a reprint.')).toBeVisible()

    // R11: thanks go to the printer's profile.
    await familyPage.getByRole('button', { name: 'Say thanks to the printer' }).click()
    // Thanking a person opens the optional-note sheet first (74ac01f1).
    await familyPage.getByRole('button', { name: 'Send thanks', exact: true }).click()
    await expect(familyPage.getByText('Thanks sent')).toBeVisible()
    const { data: thanks } = await adminClient().from('profile_thanks').select('thanker_id, transaction_id').eq('profile_id', job.printer.id)
    expect(thanks).toEqual([{ thanker_id: job.requester.id, transaction_id: job.id }])
    expect(await notificationsFor(job.printer.id, 'profile_thanked', job.id)).toHaveLength(1)
  } finally {
    await printerPage.context().close().catch(() => {})
    await familyPage.context().close().catch(() => {})
  }
})
