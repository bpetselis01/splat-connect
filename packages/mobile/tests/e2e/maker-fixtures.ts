import { type Browser, type Page, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, renameProfile, signIn, uniqueTitle } from './helpers'

/**
 * Fixtures for the maker and printer journeys: rows for a print job or a build
 * in a chosen state, the two-party browser setup, and a reader for the
 * notification rows an action leaves. Imports helpers only, never components.
 */

/** A signed-in page in its own context, settled on Home. */
export async function partyPage(
  browser: Browser,
  baseURL: string | undefined,
  party: { email: string; password: string }
): Promise<Page> {
  // A context from the `browser` fixture inherits no `use` options, so baseURL is explicit.
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await signIn(page, party.email, party.password)
  await expect(page).toHaveURL(/\/home$/)
  return page
}

export const PICKUP = { pickup_line1: '12 Seeded St', pickup_suburb: 'Testville', pickup_state: 'VIC', pickup_postcode: '3000' }

/**
 * A print job on a person's printer, as the API leaves it at each stage:
 * 'requested', 'accepted', 'printing', 'ready' (photo path set) or 'completed'.
 */
export async function seedPrintJob(stage: 'requested' | 'accepted' | 'printing' | 'ready' | 'completed' = 'requested') {
  const admin = adminClient()
  const requester = await createContributor()
  const printer = await createContributor()
  const printerOwnerName = uniqueTitle('E2E Printer Owner')
  const requesterName = uniqueTitle('E2E Requester')
  await renameProfile(printer.id, printerOwnerName)
  await renameProfile(requester.id, requesterName)
  const guideTitle = uniqueTitle('E2E Print Guide')
  const guide = await createTutorial(printer.id, { title: guideTitle })
  const { data: part, error: partError } = await admin
    .from('stl_files')
    .insert({ tutorial_id: guide, filename: 'mount.stl', file_url: `${guide}/mount.stl`, print_minutes: 60, filament_grams: 10, material: 'PETG' })
    .select('id')
    .single()
  if (partError || !part) throw new Error(`seedPrintJob part failed: ${partError?.message}`)
  const { data: machine, error: machineError } = await admin
    .from('printers')
    .insert({ owner_id: printer.id, name: uniqueTitle('E2E Machine'), materials: ['PETG'], bed_x: 220, bed_y: 220, bed_z: 220, accepting: true, capacity: 3 })
    .select('id')
    .single()
  if (machineError || !machine) throw new Error(`seedPrintJob printer failed: ${machineError?.message}`)
  const now = new Date().toISOString()
  const past = (n: number) => (n <= ['requested', 'accepted', 'printing', 'ready', 'completed'].indexOf(stage) ? now : null)
  const accepted = stage !== 'requested'
  const { data: tx, error } = await admin
    .from('toy_transactions')
    .insert({
      type: 'print',
      status: stage === 'requested' ? 'requested' : stage === 'completed' ? 'completed' : 'accepted',
      tutorial_id: guide,
      printer_id: machine.id,
      requester_id: requester.id,
      owner_id: printer.id,
      print_delivery: 'collect',
      print_colour: 'Any colour',
      ...(accepted ? { owner_code: '111111', requester_code: '222222', ...PICKUP } : {}),
      printing_started_at: past(2),
      ready_at: past(3),
      ready_photo_url: past(3) ? `${requester.id}/seed.jpg` : null,
      ...(stage === 'completed' ? { owner_confirmed_at: now, requester_confirmed_at: now } : {}),
    })
    .select('id')
    .single()
  if (error || !tx) throw new Error(`seedPrintJob insert failed: ${error?.message}`)
  const { error: linkError } = await admin.from('print_job_files').insert({ transaction_id: tx.id, stl_file_id: part.id, quantity: 1 })
  if (linkError) throw new Error(`seedPrintJob files failed: ${linkError.message}`)
  return { id: tx.id as string, requester, printer, guideTitle, printerOwnerName, requesterName }
}

/**
 * A build request from a family. 'requested' with no maker is an open board
 * row; `withMaker` addresses it to one maker; 'accepted' is already claimed
 * (codes set), optionally with a working shot or its approval.
 */
export async function seedBuild(
  over: Partial<{ status: 'requested' | 'accepted'; withMaker: boolean; shot: boolean; approved: boolean }> = {}
) {
  const admin = adminClient()
  const requester = await createContributor()
  const maker = await createContributor()
  const requesterName = uniqueTitle('E2E Family')
  const makerName = uniqueTitle('E2E Maker')
  await renameProfile(requester.id, requesterName)
  await renameProfile(maker.id, makerName)
  const author = await createContributor()
  const title = uniqueTitle('E2E Build Guide')
  const guide = await createTutorial(author.id, { title })
  const status = over.status ?? 'requested'
  const { data: tx, error } = await admin
    .from('toy_transactions')
    .insert({
      type: 'build',
      status,
      tutorial_id: guide,
      requester_id: requester.id,
      requester_suburb: 'Glebe',
      travel_km: 10,
      urgency: 'No rush',
      build_brief: 'Please make it chunky.',
      ...(over.withMaker || status === 'accepted' ? { owner_id: maker.id } : {}),
      ...(status === 'accepted' ? { owner_code: '333333', requester_code: '444444' } : {}),
      ...(over.shot ? { working_photo_url: `${maker.id}/seed.jpg` } : {}),
      ...(over.approved ? { work_approved_at: new Date().toISOString() } : {}),
    })
    .select('id')
    .single()
  if (error || !tx) throw new Error(`seedBuild insert failed: ${error?.message}`)
  return { id: tx.id as string, requester, maker, title, requesterName, makerName }
}

/** Runs `click`, waits for the POST it fires to `/api/toy-transactions/:id<suffix>`, and fails with the response body unless it succeeds. */
export async function sent(page: Page, suffix: string, click: () => Promise<unknown>) {
  const response = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('/api/toy-transactions/') && r.url().endsWith(suffix)
  )
  await click()
  const r = await response
  expect(r.status(), await r.text()).toBeLessThan(300)
}

/** Notification rows of one type left for a recipient about one transaction. */
export async function notificationsFor(recipientId: string, type: string, transactionId: string) {
  const { data, error } = await adminClient()
    .from('notifications')
    .select('id, type, actor_name, toy_transaction_id')
    .eq('recipient_id', recipientId)
    .eq('type', type)
    .eq('toy_transaction_id', transactionId)
  if (error) throw new Error(`notificationsFor failed: ${error.message}`)
  return data ?? []
}

export async function txRow(id: string) {
  const { data, error } = await adminClient().from('toy_transactions').select('*').eq('id', id).single()
  if (error || !data) throw new Error(`txRow failed: ${error?.message}`)
  return data as Record<string, any>
}
