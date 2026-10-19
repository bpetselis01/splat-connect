import { test, expect } from '@playwright/test'
import {
  adminClient,
  createContributor,
  createTutorial,
  renameProfile,
  signInAsNewContributor,
  uniqueTitle,
} from './helpers'

/**
 * Printing end to end: the teaching screens, adding a printer (and the ways the
 * form refuses), and a family's request through to withdrawing it.
 *
 * Imports data from helpers only, never from components (see the memory note on
 * e2e specs that import components stopping the whole suite loading).
 *
 * NOT covered here: the printer's accept/start/ready/collect chain, whose
 * "ready" step needs a photo from the OS picker, which a web export cannot
 * drive. Those moves are covered at unit level (offer-screen, job-screen,
 * actions).
 */

async function addPrinterRow(ownerId: string, over: Record<string, unknown> = {}) {
  const { data, error } = await adminClient()
    .from('printers')
    .insert({
      owner_id: ownerId,
      name: uniqueTitle('E2E Printer'),
      materials: ['PETG'],
      bed_x: 220,
      bed_y: 220,
      bed_z: 220,
      accepting: true,
      capacity: 2,
      ...over,
    })
    .select('id, name')
    .single()
  if (error || !data) throw new Error(`addPrinterRow failed: ${error?.message}`)
  return data as { id: string; name: string }
}

async function addPart(tutorialId: string) {
  const { error } = await adminClient().from('stl_files').insert({
    tutorial_id: tutorialId,
    filename: 'mount.stl',
    file_url: `${tutorialId}/mount.stl`,
    print_minutes: 60,
    filament_grams: 10,
    material: 'PETG',
  })
  if (error) throw new Error(`addPart failed: ${error.message}`)
}

test('the basics, an empty request list and an empty print queue each teach what to do next', async ({ page }) => {
  await signInAsNewContributor(page)

  await page.goto('/printing/basics')
  await expect(page.getByRole('heading', { name: 'Printing basics' }).first()).toBeVisible()

  await page.goto('/printing')
  await expect(page.getByText('Every request starts from a guide')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Find a guide' })).toBeVisible()

  await page.goto('/print-requests')
  await expect(page.getByText('New request')).toBeVisible()

  await page.goto('/print-for-others')
  await expect(page.getByText('Nothing waiting')).toBeVisible()
})

test('R17 adding a printer saves it, with an awkward name and a standard rate, and lists it under My printers', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const name = `O'Brien <b>P1S</b> & "Co" ${Date.now()}`

  await page.goto('/print-for-others')
  await page.getByRole('tab', { name: 'My printers' }).click()
  await page.getByRole('button', { name: 'Add a printer' }).click()

  await page.getByLabel('Make and model').fill(name)
  await page.getByLabel('Dollars per gram').fill('0.12')
  await page.getByRole('button', { name: 'Add printer' }).click()

  await page.getByRole('tab', { name: 'My printers' }).click()
  await expect(page.getByText(name, { exact: true })).toBeVisible()

  const { data } = await adminClient()
    .from('printers')
    .select('name, materials, bed_x, filament_cents_per_g')
    .eq('owner_id', me.id)
  expect(data).toEqual([{ name, materials: ['PETG'], bed_x: 220, filament_cents_per_g: 12 }])
})

test('the add-printer form refuses a blank name and a rate that is not dollars, and saves nothing', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  await page.goto('/print-for-others/add')

  await expect(page.getByRole('button', { name: 'Add printer' })).toBeDisabled()
  await page.getByLabel('Make and model').fill('     ')
  await expect(page.getByRole('button', { name: 'Add printer' })).toBeDisabled()

  await page.getByLabel('Make and model').fill('Ender 3')
  await page.getByLabel('Dollars per gram').fill('0.125')
  await page.getByRole('button', { name: 'Add printer' }).click()
  await expect(page.getByText('Filament cost is dollars per gram, like 0.12.')).toBeVisible()

  const { data } = await adminClient().from('printers').select('id').eq('owner_id', me.id)
  expect(data).toEqual([])
})

test('R03 R04 R06 a family picks a printer, sends the request, sees it waiting, and withdraws it', async ({ page }) => {
  const family = await signInAsNewContributor(page)
  const maker = await createContributor()
  const makerName = uniqueTitle('E2E Printer Owner')
  await renameProfile(maker.id, makerName)
  await addPrinterRow(maker.id)
  const title = uniqueTitle('E2E Printable Guide')
  const guide = await createTutorial(maker.id, { title })
  await addPart(guide)

  await page.goto(`/printing?guide=${guide}`)
  await expect(page.getByText(title)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pick a printer to continue' })).toBeDisabled()
  await page.getByRole('button', { name: `Pick ${makerName}` }).click()
  await page.getByRole('button', { name: 'Ask 1 printer' }).click()

  // The form: nothing sends until the agree line is ticked.
  await expect(page.getByRole('button', { name: 'Send request' })).toBeDisabled()
  await page.getByRole('checkbox', { name: /I understand/ }).click()
  await page.getByRole('button', { name: 'Send request' }).click()

  await page.waitForURL(/\/printing\/jobs\//)
  await expect(page.getByLabel('Progress: Requested')).toBeVisible()

  const { data: rows } = await adminClient()
    .from('toy_transactions')
    .select('id, type, status, requester_id, print_job_files(quantity)')
    .eq('requester_id', family.id)
  expect(rows).toHaveLength(1)
  expect(rows![0]).toMatchObject({ type: 'print', status: 'requested', print_job_files: [{ quantity: 1 }] })

  await page.getByRole('button', { name: 'Withdraw request' }).click()
  await expect(page.getByLabel('Progress: Withdrawn')).toBeVisible()
  const { data: after } = await adminClient().from('toy_transactions').select('status').eq('id', rows![0]!.id).single()
  expect(after).toEqual({ status: 'withdrawn' })
})

test('R02 a family cannot pick a fourth printer, and a full or paused one cannot be picked at all', async ({ page }) => {
  await signInAsNewContributor(page)
  const owner = await createContributor()
  const names: string[] = []
  for (let i = 0; i < 4; i++) {
    const who = await createContributor()
    const n = uniqueTitle(`E2E Pick ${i}`)
    await renameProfile(who.id, n)
    await addPrinterRow(who.id)
    names.push(n)
  }
  const pausedOwner = await createContributor()
  const pausedName = uniqueTitle('E2E Paused Owner')
  await renameProfile(pausedOwner.id, pausedName)
  await addPrinterRow(pausedOwner.id, { accepting: false })
  const guide = await createTutorial(owner.id, { title: uniqueTitle('E2E Cap Guide') })
  await addPart(guide)

  await page.goto(`/printing?guide=${guide}`)
  for (const n of names.slice(0, 3)) await page.getByRole('button', { name: `Pick ${n}` }).click()
  await expect(page.getByRole('button', { name: `Pick ${names[3]}` })).toBeDisabled()
  await expect(page.getByRole('button', { name: `Pick ${pausedName}` })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Ask 3 printers' })).toBeVisible()
})
