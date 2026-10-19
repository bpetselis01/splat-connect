import { test, expect } from '@playwright/test'
import { adminClient, createContributor, setPickupAddress, signIn, signInAsNewContributor } from './helpers'
import { PICKUP, partyPage, seedPrintJob, txRow } from './maker-fixtures'
import { namedContributor, seedCompletedPrints, seedPrintableGuide, seedPrinter } from './counts-helpers-d'

/**
 * Printing journeys that need no second browser: the basics link, the finder's
 * filters, and the two lists a job moves through. Imports helpers only, never
 * components.
 */

test('R19 "Find a printer" on Printing basics opens the printer finder', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.goto('/printing/basics')
  await page.getByRole('button', { name: 'Find a printer' }).click()
  await expect(page).toHaveURL(/\/printing$/)
  await expect(page.getByText('Every request starts from a guide')).toBeVisible()
})

test('R18 My print requests lists the family’s own request with its state, and opens it', async ({ page, browser, baseURL }) => {
  const job = await seedPrintJob('requested')
  await signIn(page, job.requester.email, job.requester.password)
  await expect(page).toHaveURL(/\/home$/)

  await page.goto('/print-requests')
  const row = page.getByRole('button', { name: `${job.guideTitle}, Requested` })
  await expect(row).toBeVisible()
  await expect(row).toContainText(job.printerOwnerName)
  await row.click()
  await expect(page).toHaveURL(new RegExp(`/printing/jobs/${job.id}$`))
  await expect(page.getByLabel('Progress: Requested')).toBeVisible()

  // The printer is not the requester: the same job is not on their list.
  const printerPage = await partyPage(browser, baseURL, job.printer)
  try {
    await printerPage.goto('/print-requests')
    await expect(printerPage.getByText('New request')).toBeVisible()
    await expect(printerPage.getByRole('button', { name: new RegExp(job.guideTitle) })).toHaveCount(0)
  } finally {
    await printerPage.context().close().catch(() => {})
  }
})

test('R12 the printer’s Requests tab counts a waiting job, and accepting moves it to the Jobs tab', async ({ page }) => {
  const job = await seedPrintJob('requested')
  await setPickupAddress(job.printer.id, PICKUP)
  await signIn(page, job.printer.email, job.printer.password)
  await expect(page).toHaveURL(/\/home$/)

  await page.goto('/print-for-others')
  await expect(page.getByRole('tab', { name: 'Requests, 1' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Jobs', exact: true })).toBeVisible()
  await expect(page.getByText(job.guideTitle)).toBeVisible()

  await page.getByRole('button', { name: /^Accept/ }).click()
  await expect(page.getByRole('button', { name: 'Started printing' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Jobs, 1' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Requests', exact: true })).toBeVisible()
  expect((await txRow(job.id)).status).toBe('accepted')

  await page.getByRole('tab', { name: 'My printers' }).click()
  await expect(page.getByText(/1 of 3 used/)).toBeVisible()
})

test('R01 the finder’s Open now, material, 10 km and Verified chips each narrow the list', async ({ page }) => {
  test.setTimeout(180_000)
  const family = await createContributor()
  await setPickupAddress(family.id, { pickup_line1: '1 Test St', pickup_suburb: 'Newtown', pickup_state: 'NSW', pickup_postcode: '2042' })
  const author = await createContributor()
  const guide = await seedPrintableGuide(author.id)

  const owner = async (prefix: string, over: Record<string, unknown> = {}) => {
    const who = await namedContributor(prefix)
    const machine = await seedPrinter({ profileId: who.id }, { postcode: '2042', ...over })
    return { ...who, machine }
  }
  const everything = await owner('Finder Everything')
  const paused = await owner('Finder Paused', { accepting: false })
  const plaOnly = await owner('Finder PlaOnly', { materials: ['PLA'] })
  const far = await owner('Finder Far', { postcode: '3000' })
  const verified = await owner('Finder Verified')
  await seedCompletedPrints(3, { tutorialId: guide.id, stlId: guide.stlId, printerId: verified.machine.id, requesterId: author.id, owner: { profileId: verified.id } })
  const { error } = await adminClient()
    .from('printer_test_prints')
    .insert({ printer_id: verified.machine.id, photo_path: `${verified.machine.id}/${crypto.randomUUID()}.png`, verdict: 'pass', reviewed_at: new Date().toISOString() })
  if (error) throw new Error(`verified seed failed: ${error.message}`)

  await signIn(page, family.email, family.password)
  await expect(page).toHaveURL(/\/home$/)
  await page.goto(`/printing?guide=${guide.id}`)

  const pick = (o: { name: string }) => page.getByRole('button', { name: `Pick ${o.name}` })
  for (const o of [everything, paused, plaOnly, far, verified]) await expect(pick(o)).toBeVisible()

  await page.getByText('Open now', { exact: true }).click()
  await expect(pick(paused)).toHaveCount(0)
  await expect(pick(everything)).toBeVisible()

  await page.getByText('Has PETG', { exact: true }).click()
  await expect(pick(plaOnly)).toHaveCount(0)
  await expect(pick(far)).toBeVisible()

  await page.getByText('Within 10 km', { exact: true }).click()
  await expect(pick(far)).toHaveCount(0)
  await expect(pick(everything)).toBeVisible()

  await page.getByText('Verified', { exact: true }).first().click()
  await expect(pick(everything)).toHaveCount(0)
  await expect(pick(verified)).toBeVisible()
})
