// journeys: G18 G19 K05 R03
import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, renameProfile, signInAsNewContributor, uniqueTitle } from './helpers'

// Where a guide hands a reader on: to a printer (Files tab) and to a maker
// (the overview's "Can't build it?" row). The request each one sends has to
// carry the guide the reader started from.
//
// Imports data from helpers only, never from components.

async function addPrinterRow(ownerId: string) {
  const { error } = await adminClient()
    .from('printers')
    .insert({ owner_id: ownerId, name: uniqueTitle('E2E Handoff Printer'), materials: ['PETG'], bed_x: 220, bed_y: 220, bed_z: 220, accepting: true, capacity: 2 })
  if (error) throw new Error(`addPrinterRow failed: ${error.message}`)
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

test('Ask someone to print opens the printer finder for this guide, and the request that goes out carries it', async ({ page }) => {
  const family = await signInAsNewContributor(page)
  const maker = await createContributor()
  const makerName = uniqueTitle('E2E Handoff Maker')
  await renameProfile(maker.id, makerName)
  await addPrinterRow(maker.id)
  const title = uniqueTitle('E2E Printable From Guide')
  const guide = await createTutorial(maker.id, { title })
  await addPart(guide)

  await page.goto(`/guides/${guide}`)
  await page.getByRole('tab', { name: 'Files' }).click()
  await expect(page.getByText('Mount', { exact: true })).toBeVisible()
  await expect(page.getByText('1 printable part · pick up to three printers nearby')).toBeVisible()
  await page.getByRole('button', { name: 'Ask someone to print' }).click()

  await expect(page).toHaveURL(new RegExp(`/printing\\?guide=${guide}`))
  // .last(): the guide page stays mounted behind the finder.
  await expect(page.getByText(title).last()).toBeVisible()
  await page.getByRole('button', { name: `Pick ${makerName}` }).click()
  await page.getByRole('button', { name: 'Ask 1 printer' }).click()
  await page.getByRole('checkbox', { name: /I understand/ }).click()
  await page.getByRole('button', { name: 'Send request' }).click()

  await page.waitForURL(/\/printing\/jobs\//)
  await expect(page.getByLabel('Progress: Requested')).toBeVisible()

  const { data } = await adminClient()
    .from('toy_transactions')
    .select('type, status, tutorial_id, owner_id, print_job_files(quantity)')
    .eq('requester_id', family.id)
  expect(data).toEqual([{ type: 'print', status: 'requested', tutorial_id: guide, owner_id: maker.id, print_job_files: [{ quantity: 1 }] }])
})

test('a guide with no printable files offers no printing, and says so', async ({ page }) => {
  const author = await createContributor()
  await signInAsNewContributor(page)
  const guide = await createTutorial(author.id, { title: uniqueTitle('E2E Nothing To Print'), withPdf: false })

  await page.goto(`/guides/${guide}`)
  await page.getByRole('tab', { name: 'Files' }).click()
  await expect(page.getByText('This guide has no files to download.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ask someone to print' })).toHaveCount(0)
})

test("Can't build it? opens the ask form with this guide chosen, and posting files a build request for it", async ({ page }) => {
  const family = await signInAsNewContributor(page)
  const author = await createContributor()
  const title = uniqueTitle('E2E Ask A Maker Guide')
  const guide = await createTutorial(author.id, { title })

  await page.goto(`/guides/${guide}`)
  await page.getByRole('button', { name: "Can't build it? Ask a maker nearby" }).click()

  await expect(page).toHaveURL(new RegExp(`/explore/makers-wanted/new\\?guide=${guide}`))
  // The guide is already the picked row, with a way to change it, not a search to redo.
  const picked = page.getByRole('radio', { name: title })
  await expect(picked).toBeVisible()
  await expect(page.getByText('Change', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Search guides', { exact: true })).toHaveCount(0)

  await page.getByPlaceholder('Newtown').fill('Glebe')
  await page.getByRole('checkbox', { name: /You cover the parts/ }).click()
  const posted = page.waitForResponse((r) => r.url().endsWith('/api/toy-transactions/build') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Post to Makers wanted' }).click()
  expect((await posted).status()).toBe(201)

  await page.waitForURL(/\/explore\/makers-wanted/)
  await expect(page.getByText(title)).toBeVisible()
  const { data } = await adminClient()
    .from('toy_transactions')
    .select('type, status, tutorial_id, requester_suburb, owner_id')
    .eq('requester_id', family.id)
  expect(data).toEqual([{ type: 'build', status: 'requested', tutorial_id: guide, requester_suburb: 'Glebe', owner_id: null }])
})
