import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { adminClient, createTutorial, deleteUser, uniqueTitle } from '../helpers'
import { fillPickup, inboxRow, myCode, openExchangesList, seat, unreadIs, type Seat } from './support'

const PHOTO = path.join(__dirname, '..', 'fixtures', 'test.jpg')

async function cleanUp(tutorialId: string, ...seats: Seat[]) {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await admin.from('printers').delete().in('owner_id', seats.map((s) => s.id))
  await admin.from('tutorials').delete().eq('id', tutorialId)
  for (const s of seats) await deleteUser(s.id)
}

/** The printer owner lists a machine through the form, as a member would. */
async function listPrinter(page: Page, name: string) {
  await page.goto('/dashboard/printers')
  await page.getByRole('link', { name: 'Add a printer' }).click()
  await expect(page).toHaveURL(/\/dashboard\/printers\/new$/)
  await page.locator('input[name="name"]').fill(name)
  await page.getByLabel('Bed width').fill('200')
  await page.getByLabel('Bed depth').fill('200')
  await page.getByLabel('Bed height').fill('200')
  await page.locator('input[name="suburb"]').fill('Newtown')
  await page.locator('input[name="state"]').fill('NSW')
  await page.locator('input[name="postcode"]').fill('2042')
  await page.getByRole('button', { name: 'List this printer' }).click()
  await expect(page).toHaveURL(/\/dashboard\/printers$/)
  await page.getByRole('tab', { name: /^My printers/ }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
}

/** The family sends one print request to that one printer and lands on its thread. */
async function askForPrint(page: Page, tutorialId: string, printerName: string) {
  await page.goto(`/printing/requests?guide=${tutorialId}`)
  const printers = page.getByRole('group', { name: 'Printers' })
  // The checkboxes are visually hidden; the label is the click target.
  for (const ticked of await printers.getByRole('checkbox', { checked: true }).all()) await ticked.locator('xpath=ancestor::label').click()
  await printers.locator('label', { hasText: printerName }).click()
  await expect(printers.getByRole('checkbox', { checked: true })).toHaveCount(1)
  await page.getByRole('checkbox', { name: /I understand/ }).check({ force: true })
  await page.getByRole('button', { name: /Send request/ }).click()
  await page.waitForURL(/\/dashboard\/print-requests\/[0-9a-f-]{36}$/)
  return page.url()
}

test('WR09 WR12 WR13 WR16 WR17 WR18 WR20 WR21 WR22 a Print runs ask, accept, message, print, ready, confirm and collected across two seats', async ({ browser, baseURL }) => {
  test.setTimeout(300_000)
  const printer = await seat(browser, baseURL, 'Pat Printer')
  const family = await seat(browser, baseURL, 'Fiona Family')
  const title = uniqueTitle('Switch mount')
  const tutorialId = await createTutorial(printer.id, { title, status: 'approved' })
  const machine = uniqueTitle('Bench printer')
  try {
    await listPrinter(printer.page, machine)

    // Ask
    const thread = await askForPrint(family.page, tutorialId, machine)
    await expect(family.page.getByText('Waiting on the printer').first()).toBeVisible()
    await expect(family.page.getByRole('complementary').getByText('Waiting on the printers')).toBeVisible()
    await family.page.getByRole('link', { name: `From ${title}` }).click()
    await expect(family.page).toHaveURL(new RegExp(`/tutorials/${tutorialId}$`))

    // Accept, from the printer's thread
    await unreadIs(printer.page, 1)
    await inboxRow(printer.page, /Fiona Family requested/)
    await openExchangesList(printer.page)
    await unreadIs(printer.page, 0)
    await printer.page.goto(thread)
    await expect(printer.page.getByRole('heading', { name: 'Fiona Family is asking for a print' })).toBeVisible()
    await printer.page.getByRole('button', { name: 'Accept', exact: true }).click()
    await fillPickup(printer.page, '4 Print St')
    await printer.page.getByRole('button', { name: 'Accept request' }).click()
    await expect(printer.page.getByRole('complementary').getByText('Start it when the bed is free')).toBeVisible()
    await unreadIs(family.page, 1)
    await inboxRow(family.page, /Pat Printer accepted your request/)
    await openExchangesList(family.page)
    await unreadIs(family.page, 0)

    // Message
    await family.page.goto(thread)
    await family.page.getByLabel(/^Message /).fill('Black PLA please, if you have it.')
    await family.page.getByRole('button', { name: 'Send' }).click()
    await expect(family.page.getByRole('log', { name: 'Conversation' })).toContainText('Black PLA please, if you have it.')
    await unreadIs(printer.page, 1)
    await inboxRow(printer.page, /Fiona Family sent a message/)
    await openExchangesList(printer.page)
    await unreadIs(printer.page, 0)

    // On the bed, then ready with a photo
    await printer.page.goto(thread)
    await printer.page.getByRole('button', { name: 'It is on the bed' }).click()
    await expect(printer.page.getByRole('complementary').getByText('Post a photo when it comes off')).toBeVisible()
    await unreadIs(family.page, 1)
    await inboxRow(family.page, /Pat Printer started printing/)
    await openExchangesList(family.page)
    await unreadIs(family.page, 0)
    await printer.page.goto(thread)
    await printer.page.getByLabel('Photo of the finished parts').setInputFiles(PHOTO)
    await expect(printer.page.getByText(/^Ready \d/).first()).toBeVisible()
    await unreadIs(family.page, 1)
    await inboxRow(family.page, /Pat Printer finished printing/)
    await openExchangesList(family.page)
    await unreadIs(family.page, 0)

    // Collected: both codes, then closed
    await family.page.goto(thread)
    const familyCode = await myCode(family.page)
    await printer.page.goto(thread)
    const printerCode = await myCode(printer.page)
    await printer.page.getByLabel(/Enter the other party/).fill(familyCode)
    await printer.page.getByRole('button', { name: 'Confirm handoff' }).click()
    await expect(printer.page.getByText(/You have confirmed the handoff/)).toBeVisible()
    await family.page.goto(thread)
    await family.page.getByLabel(/Enter the other party/).fill(printerCode)
    await family.page.getByRole('button', { name: 'Confirm handoff' }).click()
    await expect(family.page.getByText('Handoff complete.')).toBeVisible()
    await expect(family.page.getByRole('complementary').getByText('Both of you confirmed')).toBeVisible()
    await expect(family.page.getByText(/^Closed \d/)).toBeVisible()
  } finally {
    await cleanUp(tutorialId, printer, family)
  }
})

async function seedPrinter(owner: Seat, name: string, over: Record<string, unknown> = {}) {
  const { data, error } = await adminClient()
    .from('printers')
    .insert({ owner_id: owner.id, name, materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, suburb: 'Newtown', state: 'NSW', ...over })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data!.id as string
}

async function seedJob(family: Seat, printer: Seat, printerId: string, tutorialId: string) {
  const { data, error } = await adminClient()
    .from('toy_transactions')
    .insert({
      type: 'print', status: 'requested', tutorial_id: tutorialId, printer_id: printerId, requester_id: family.id,
      owner_id: printer.id, print_group_id: crypto.randomUUID(),
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return `/dashboard/print-requests/${data!.id}`
}

test('WR14 WR15 a printer declines a Print request with a reason, and the family withdraws another', async ({ browser, baseURL }) => {
  test.setTimeout(150_000)
  const printer = await seat(browser, baseURL, 'Pat Printer')
  const family = await seat(browser, baseURL, 'Fiona Family')
  const title = uniqueTitle('Declined mount')
  const tutorialId = await createTutorial(printer.id, { title, status: 'approved' })
  try {
    const printerId = await seedPrinter(printer, uniqueTitle('Slow bench'))
    const declined = await seedJob(family, printer, printerId, tutorialId)
    await printer.page.goto(declined)
    await printer.page.getByRole('button', { name: 'Decline', exact: true }).click()
    await expect(printer.page.getByRole('button', { name: 'Send the decline' })).toBeDisabled()
    await printer.page.getByLabel('Why you cannot take it').fill('Bed is too small for the base plate.')
    await printer.page.getByRole('button', { name: 'Send the decline' }).click()
    await expect(printer.page.getByText('This request was declined.')).toBeVisible()
    await expect(printer.page.getByLabel('Progress', { exact: true }).getByText('Bed is too small for the base plate.')).toBeVisible()

    await unreadIs(family.page, 1)
    await inboxRow(family.page, /Pat Printer declined your request/)
    await family.page.goto(declined)
    await expect(family.page.getByLabel('Progress', { exact: true }).getByText('Bed is too small for the base plate.')).toBeVisible()

    const withdrawn = await seedJob(family, printer, printerId, tutorialId)
    await family.page.goto(withdrawn)
    await family.page.getByRole('button', { name: 'Withdraw the request' }).click()
    await expect(family.page.getByText('This request was withdrawn.')).toBeVisible()
    await unreadIs(printer.page, 1)
    await inboxRow(printer.page, /Fiona Family withdrew their request/)
  } finally {
    await cleanUp(tutorialId, printer, family)
  }
})

test('WR19 WR23 WR24 WR25 WR26 WR27 a printer answers requests from Print for others and keeps its machines', async ({ browser, baseURL }) => {
  test.setTimeout(180_000)
  const printer = await seat(browser, baseURL, 'Pat Printer')
  const family = await seat(browser, baseURL, 'Fiona Family')
  const taken = await createTutorial(printer.id, { title: uniqueTitle('Taken mount'), status: 'approved' })
  const refused = await createTutorial(printer.id, { title: uniqueTitle('Refused mount'), status: 'approved' })
  const machine = uniqueTitle('Bench printer')
  const spare = uniqueTitle('Spare printer')
  try {
    const printerId = await seedPrinter(printer, machine)
    await seedPrinter(printer, spare)
    const takenJob = await seedJob(family, printer, printerId, taken)
    const refusedJob = await seedJob(family, printer, printerId, refused)

    // Decline from the card with a preset reason
    await printer.page.goto('/dashboard/printers')
    const refusedTitle = (await adminClient().from('tutorials').select('title').eq('id', refused).single()).data!.title as string
    const takenTitle = (await adminClient().from('tutorials').select('title').eq('id', taken).single()).data!.title as string
    const refusedCard = printer.page.getByRole('listitem').filter({ hasText: refusedTitle })
    await refusedCard.getByRole('button', { name: /Decline/ }).click()
    await refusedCard.getByRole('button', { name: 'Too big for my bed' }).click()
    await expect(printer.page.getByRole('listitem').filter({ hasText: refusedTitle })).toHaveCount(0)
    await unreadIs(family.page, 1)
    await inboxRow(family.page, /Pat Printer declined your request/)
    await family.page.goto(refusedJob)
    await expect(family.page.getByLabel('Progress', { exact: true }).getByText('Too big for my bed')).toBeVisible()

    // Accept from the card, with a pickup address
    await printer.page.goto('/dashboard/printers')
    const takenCard = printer.page.getByRole('listitem').filter({ hasText: takenTitle })
    await takenCard.getByRole('button', { name: 'Accept', exact: true }).click()
    await fillPickup(printer.page, '5 Bench St')
    await printer.page.getByRole('button', { name: 'Accept request' }).click()
    await expect(printer.page.getByRole('listitem').filter({ hasText: takenTitle })).toHaveCount(0)
    await printer.page.getByRole('tab', { name: /^Jobs/ }).click()
    await expect(printer.page.getByRole('link', { name: /Start printing/ })).toHaveAttribute('href', takenJob)
    await printer.page.getByRole('link', { name: 'Thread', exact: true }).click()
    await expect(printer.page).toHaveURL(takenJob)
    await expect(printer.page.getByRole('link', { name: /Print for others/ })).toBeVisible()
    await printer.page.getByRole('link', { name: /Print for others/ }).click()
    await expect(printer.page).toHaveURL(/\/dashboard\/printers$/)

    // Pause one machine, change its slots, and remove the other
    await printer.page.getByRole('tab', { name: /^My printers/ }).click()
    const bench = printer.page.getByRole('listitem').filter({ has: printer.page.getByRole('heading', { name: machine }) })
    await bench.getByRole('button', { name: 'Paused' }).click()
    await expect(bench.getByText('Paused · not offered to anyone')).toBeVisible()
    await bench.getByLabel('Jobs at once').fill('3')
    await bench.getByLabel('Jobs at once').blur()
    await printer.page.reload()
    await printer.page.getByRole('tab', { name: /^My printers/ }).click()
    const reloaded = printer.page.getByRole('listitem').filter({ has: printer.page.getByRole('heading', { name: machine }) })
    await expect(reloaded.getByText('Paused · not offered to anyone')).toBeVisible()
    await expect(reloaded.getByLabel('Jobs at once')).toHaveValue('3')

    const other = printer.page.getByRole('listitem').filter({ has: printer.page.getByRole('heading', { name: spare }) })
    await other.getByRole('button', { name: 'Remove' }).click()
    await expect(printer.page.getByRole('heading', { name: spare })).toHaveCount(0)
  } finally {
    await adminClient().from('toy_transactions').delete().in('tutorial_id', [taken, refused])
    await adminClient().from('printers').delete().eq('owner_id', printer.id)
    await adminClient().from('tutorials').delete().in('id', [taken, refused])
    await deleteUser(printer.id)
    await deleteUser(family.id)
  }
})

test('WR02 WR03 WR10 WR11 WR19 a family finds a printer, filters the directory and moves between its requests and /printing', async ({ browser, baseURL }) => {
  test.setTimeout(150_000)
  const printer = await seat(browser, baseURL, uniqueTitle('Pat'))
  const family = await seat(browser, baseURL, 'Fiona Family')
  const title = uniqueTitle('Listed mount')
  const tutorialId = await createTutorial(printer.id, { title, status: 'approved' })
  try {
    const openName = uniqueTitle('Open bench')
    const pausedName = uniqueTitle('Paused bench')
    const printerId = await seedPrinter(printer, openName)
    await seedPrinter(printer, pausedName, { accepting: false })
    const job = await seedJob(family, printer, printerId, tutorialId)

    await family.page.goto('/printing')
    await family.page.getByRole('link', { name: /Add a printer/ }).first().click()
    await expect(family.page).toHaveURL(/\/dashboard\/printers\/new$/)

    await family.page.goto('/printing')
    const grid = family.page.locator('#printer-grid')
    await expect(grid.getByText(new RegExp(`${pausedName}`))).toBeVisible()
    await grid.getByRole('button', { name: 'Open now' }).click()
    await expect(grid.getByText(new RegExp(`${pausedName}`))).toHaveCount(0)
    await expect(grid.getByText(new RegExp(`${openName}`))).toBeVisible()
    await grid.getByRole('button', { name: 'Clear' }).first().click()
    await expect(grid.getByText(new RegExp(`${pausedName}`))).toBeVisible()

    await family.page.goto('/dashboard/print-requests')
    await family.page.getByRole('link', { name: 'Thread' }).click()
    await expect(family.page).toHaveURL(job)
    await family.page.getByRole('link', { name: /All print requests/ }).click()
    await expect(family.page).toHaveURL(/\/dashboard\/print-requests$/)
    await family.page.getByRole('link', { name: 'New request' }).click()
    await expect(family.page).toHaveURL(/\/printing$/)
  } finally {
    await cleanUp(tutorialId, printer, family)
  }
})
