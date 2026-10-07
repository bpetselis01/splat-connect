// journeys: R07 R08 R10 R15 R16 L11
import { test, expect } from '@playwright/test'
import { adminClient, createContributor, makeOrgLeader, signIn, signInAsNewContributor } from './helpers'
import { partyPage, seedPrintJob, txRow } from './maker-fixtures'
import {
  namedContributor,
  seedCompletedPrints,
  seedOrgOrder,
  seedPrintableGuide,
  seedPrinter,
  setOrgPickup,
} from './counts-helpers-d'

/**
 * The printing numbers and states that must move without a reload. Every test
 * acts in the UI, reads the new value off a screen that was already open (or one
 * reached again by tabs, rows and back), and then reads the row from the database.
 */

test('the printer starts and finishes the print and the family’s open job page follows each stage on its own', async ({ browser, baseURL }) => {
  test.setTimeout(180_000)
  const job = await seedPrintJob('accepted')
  const printerPage = await partyPage(browser, baseURL, job.printer)
  const familyPage = await partyPage(browser, baseURL, job.requester)

  try {
    await familyPage.goto(`/printing/jobs/${job.id}`)
    await expect(familyPage.getByLabel('Progress: Accepted')).toBeVisible()
    await printerPage.goto(`/printing/jobs/${job.id}`)

    // R07: the family's page is never touched again; the job page polls.
    await printerPage.getByRole('button', { name: 'Started printing' }).click()
    await expect(printerPage.getByLabel('Progress: Printing')).toBeVisible()
    expect((await txRow(job.id)).printing_started_at).not.toBeNull()
    await expect(familyPage.getByLabel('Progress: Printing')).toBeVisible({ timeout: 25_000 })

    // R08: Mark ready needs a photo; the web picker is a file chooser.
    const chooser = printerPage.waitForEvent('filechooser')
    await printerPage.getByRole('button', { name: 'Mark ready for pickup' }).click()
    await (await chooser).setFiles('tests/e2e/fixtures/test.jpg')
    await expect(printerPage.getByLabel('Progress: Ready for pickup')).toBeVisible()
    const ready = await txRow(job.id)
    expect(ready.ready_at).not.toBeNull()
    expect(ready.ready_photo_url).toContain(job.id)
    await expect(familyPage.getByLabel('Progress: Ready for pickup')).toBeVisible({ timeout: 25_000 })
    await expect(familyPage.getByLabel('Photo of the finished parts')).toBeVisible({ timeout: 25_000 })
  } finally {
    await printerPage.context().close()
    await familyPage.context().close()
  }
})

test('an organisation’s print orders: Me counts the waiting order, the family’s fit answer reaches the machine card, accepting clears the count', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000)
  const leader = await signInAsNewContributor(page)
  const orgId = await makeOrgLeader(leader.id)
  await setOrgPickup(orgId)
  const family = await namedContributor('Counts Print Family')
  const author = await createContributor()
  const guide = await seedPrintableGuide(author.id)
  const machineA = await seedPrinter({ orgId })
  const machineB = await seedPrinter({ orgId })
  const base = { tutorialId: guide.id, stlId: guide.stlId, requesterId: family.id }
  const [doneId] = await seedCompletedPrints(1, { ...base, printerId: machineA.id, owner: { orgId } })
  const orderId = await seedOrgOrder({ ...base, printerId: machineB.id, orgId })

  const meRow = page.getByRole('button', { name: 'Print orders', exact: true })
  const familyPage = await partyPage(browser, baseURL, family)
  try {
    // L11: one order waiting, so Me says 1 and the screen's Requests tab says 1.
    await page.getByRole('tab', { name: 'Me', exact: true }).click()
    await expect(meRow).toHaveText(/Print orders1$/)
    await meRow.click()
    await expect(page.getByRole('tab', { name: 'Requests, 1' })).toBeVisible()
    const machineACard = page.getByRole('radio', { name: new RegExp(machineA.name) })
    await expect(machineACard).toContainText('1 completed')
    await expect(machineACard).not.toContainText('fitted first time')

    // R10: the family answers "Fitted" on the finished job.
    await familyPage.goto(`/printing/jobs/${doneId}`)
    await familyPage.getByRole('button', { name: 'Fitted', exact: true }).click()
    await expect(familyPage.getByRole('button', { name: 'Fitted', exact: true })).toBeDisabled()
    await expect.poll(async () => (await txRow(doneId!)).print_fit).toBe('fitted')

    // The leader leaves and comes back (a row, not a reload): the machine's record moved.
    await page.goBack()
    await expect(meRow).toHaveText(/Print orders1$/)
    await meRow.click()
    await expect(page.getByRole('radio', { name: new RegExp(machineA.name) })).toContainText('1 of 1 fitted first time')

    // Accepting the order empties Requests, and Me drops its count.
    await page.getByRole('button', { name: /^Accept (anyway )?on / }).click()
    await expect(page.getByRole('button', { name: 'Started printing' })).toBeVisible()
    expect(await txRow(orderId)).toMatchObject({ status: 'accepted' })
    await page.goBack()
    await expect(meRow).toHaveText(/Print orders$/)
  } finally {
    await familyPage.context().close()
  }
})

test('Get verified posts the test print, and once an admin passes it the printer card shows the Verified shield', async ({ page }) => {
  test.setTimeout(180_000)
  const owner = await signInAsNewContributor(page)
  const family = await createContributor()
  const guide = await seedPrintableGuide(owner.id)
  const machine = await seedPrinter({ profileId: owner.id })
  const admin = adminClient()

  await page.getByRole('tab', { name: 'Me', exact: true }).click()
  await page.getByRole('button', { name: 'Print for others', exact: true }).click()
  await page.getByRole('tab', { name: 'My printers' }).click()
  const card = page.getByText(machine.name, { exact: true })
  await expect(card).toBeVisible()
  await expect(page.getByRole('button', { name: 'Get verified' })).toBeVisible()

  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Get verified' }).click()
  await (await chooser).setFiles('tests/e2e/fixtures/test.jpg')
  await expect(page.getByText('Waiting', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Get verified' })).toBeHidden()
  const { data: sent } = await admin.from('printer_test_prints').select('id, photo_path, verdict').eq('printer_id', machine.id)
  expect(sent).toEqual([expect.objectContaining({ verdict: null })])
  expect(sent![0]!.photo_path).toContain(machine.id)

  // The web admin passes it and the printer has three finished jobs (098's rule).
  await seedCompletedPrints(3, { tutorialId: guide.id, stlId: guide.stlId, printerId: machine.id, requesterId: family.id, owner: { profileId: owner.id } })
  const { error } = await admin
    .from('printer_test_prints')
    .update({ verdict: 'pass', reviewed_at: new Date().toISOString() })
    .eq('id', sent![0]!.id)
  if (error) throw new Error(`review failed: ${error.message}`)

  // Me -> Print for others is a fresh visit of the screen, not a reload of the page.
  await page.goBack()
  await page.getByRole('button', { name: 'Print for others', exact: true }).click()
  await page.getByRole('tab', { name: 'My printers' }).click()
  await expect(page.getByText('Verified', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Get verified' })).toBeHidden()
})

test('pausing a printer turns its Pick button off in the finder, and opening it turns it back on', async ({ page, browser, baseURL }) => {
  test.setTimeout(180_000)
  const owner = await namedContributor('Counts Printer Owner')
  const guide = await seedPrintableGuide(owner.id)
  const machine = await seedPrinter({ profileId: owner.id })
  const family = await createContributor()
  const accepting = async () =>
    (await adminClient().from('printers').select('accepting').eq('id', machine.id).single()).data?.accepting

  await signIn(page, owner.email, owner.password)
  await expect(page).toHaveURL(/\/home$/)
  const familyPage = await partyPage(browser, baseURL, family)
  const askAgain = async () => {
    await familyPage.getByRole('tab', { name: 'Files' }).click()
    await familyPage.getByRole('button', { name: 'Ask someone to print' }).click()
    return familyPage.getByRole('button', { name: `Pick ${owner.name}` })
  }
  try {
    await familyPage.goto(`/guides/${guide.id}`)
    await expect(await askAgain()).toBeEnabled()

    // R16: pause. The printer's own card flips, the row follows, the finder is now closed to it.
    await page.goto('/print-for-others')
    await page.getByRole('tab', { name: 'My printers' }).click()
    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    await expect(page.getByText('Paused', { exact: true })).toBeVisible()
    expect(await accepting()).toBe(false)
    await familyPage.goBack()
    await expect(await askAgain()).toBeDisabled()

    await page.getByRole('button', { name: 'Open to requests', exact: true }).click()
    await expect(page.getByText('Open', { exact: true })).toBeVisible()
    expect(await accepting()).toBe(true)
    await familyPage.goBack()
    await expect(await askAgain()).toBeEnabled()
  } finally {
    await familyPage.context().close()
  }
})

