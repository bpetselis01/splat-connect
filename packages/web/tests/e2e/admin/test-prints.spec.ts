import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { adminClient, createContributor, uniqueTitle } from '../helpers'
import { expectCardMoved, liveCount, signInAdmin } from './support'

const printerIds: string[] = []
const PHOTO = readFileSync(join(__dirname, '../fixtures/test.jpg'))

test.afterAll(async () => {
  const db = adminClient()
  for (const id of printerIds) {
    const { data: files } = await db.storage.from('printer-test-prints').list(id)
    if (files?.length) await db.storage.from('printer-test-prints').remove(files.map((f) => `${id}/${f.name}`))
  }
  await db.from('printers').delete().in('id', printerIds)
})

async function seedTestPrint(ownerId: string, printerName: string) {
  const db = adminClient()
  const { data: printer, error } = await db
    .from('printers')
    .insert({ owner_id: ownerId, name: printerName, materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  printerIds.push(printer.id)
  const path = `${printer.id}/${crypto.randomUUID()}.jpg`
  const upload = await db.storage.from('printer-test-prints').upload(path, PHOTO, { contentType: 'image/jpeg' })
  if (upload.error) throw new Error(upload.error.message)
  const { data: row, error: rowError } = await db.from('printer_test_prints').insert({ printer_id: printer.id, photo_path: path }).select('id').single()
  if (rowError) throw new Error(rowError.message)
  return row.id as string
}

test('WM34 passing a test print records the verdict and note on its row, and the Test prints card drops', async ({ page }) => {
  const owner = await createContributor()
  const name = uniqueTitle('E2E Pass Printer')
  const id = await seedTestPrint(owner.id, name)
  await signInAdmin(page)
  const before = await liveCount('testPrints')

  await page.goto('/admin/test-prints')
  await page.waitForLoadState('networkidle')
  const row = page.getByRole('listitem').filter({ hasText: name })
  await expect(row.getByRole('img', { name: `Test print from ${name}` })).toBeVisible()
  await row.getByLabel(`Note for ${name}`).fill('Clean layers.')
  await row.getByRole('button', { name: 'Pass' }).click()

  await expect(row).toContainText('Passed — Clean layers.')
  await expect(row.getByRole('button', { name: 'Pass' })).toHaveCount(0)
  const { data } = await adminClient().from('printer_test_prints').select('verdict, note').eq('id', id).single()
  expect(data).toEqual({ verdict: 'pass', note: 'Clean layers.' })
  await expectCardMoved(page, 'testPrints', before, -1)
})

test('WM34 failing a test print shows Failed with the note the owner will read', async ({ page }) => {
  const owner = await createContributor()
  const name = uniqueTitle('E2E Fail Printer')
  const id = await seedTestPrint(owner.id, name)
  await signInAdmin(page)

  await page.goto('/admin/test-prints')
  await page.waitForLoadState('networkidle')
  const row = page.getByRole('listitem').filter({ hasText: name })
  await row.getByLabel(`Note for ${name}`).fill('Heavy stringing.')
  await row.getByRole('button', { name: 'Fail' }).click()

  await expect(row).toContainText('Failed — Heavy stringing.')
  const { data } = await adminClient().from('printer_test_prints').select('verdict, note').eq('id', id).single()
  expect(data).toEqual({ verdict: 'fail', note: 'Heavy stringing.' })
})
