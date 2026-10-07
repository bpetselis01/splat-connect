import { adminClient, createContributor, createTutorial, renameProfile, uniqueTitle } from './helpers'

/**
 * Fixtures for the printing count specs (counts-printing.spec.ts): a printer
 * with a guide to print, printers of an organisation, and finished jobs seeded
 * straight into toy_transactions. Imports helpers only, never components.
 */

/** A guide with one printable part, authored by `authorId`. Returns id and title. */
export async function seedPrintableGuide(authorId: string) {
  const title = uniqueTitle('E2E Counts Guide')
  const id = await createTutorial(authorId, { title })
  const { data, error } = await adminClient()
    .from('stl_files')
    .insert({ tutorial_id: id, filename: 'mount.stl', file_url: `${id}/mount.stl`, print_minutes: 60, filament_grams: 10, material: 'PETG' })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedPrintableGuide part failed: ${error?.message}`)
  return { id, title, stlId: data.id as string }
}

/** One printer row, owned by a person or an organisation. */
export async function seedPrinter(owner: { profileId: string } | { orgId: string }, over: Record<string, unknown> = {}) {
  const { data, error } = await adminClient()
    .from('printers')
    .insert({
      ...('profileId' in owner ? { owner_id: owner.profileId } : { owner_org_id: owner.orgId }),
      name: uniqueTitle('E2E Counts Machine'),
      materials: ['PETG'],
      bed_x: 220,
      bed_y: 220,
      bed_z: 220,
      accepting: true,
      capacity: 3,
      ...over,
    })
    .select('id, name')
    .single()
  if (error || !data) throw new Error(`seedPrinter failed: ${error?.message}`)
  return data as { id: string; name: string }
}

/** A named contributor, for assertions that must not match another worker's fixture. */
export async function namedContributor(prefix: string) {
  const who = await createContributor()
  const name = uniqueTitle(prefix)
  await renameProfile(who.id, name)
  return { ...who, name }
}

/**
 * Print jobs on a printer, as the API leaves them once both sides confirmed.
 * `owner` says whose side they sit on: a person's printer or an organisation's.
 */
export async function seedCompletedPrints(
  n: number,
  job: { tutorialId: string; stlId: string; printerId: string; requesterId: string; owner: { profileId: string } | { orgId: string } }
) {
  const admin = adminClient()
  const now = new Date().toISOString()
  const ids: string[] = []
  for (let i = 0; i < n; i++) {
    const { data, error } = await admin
      .from('toy_transactions')
      .insert({
        type: 'print',
        status: 'completed',
        tutorial_id: job.tutorialId,
        printer_id: job.printerId,
        requester_id: job.requesterId,
        ...('profileId' in job.owner ? { owner_id: job.owner.profileId } : { owner_org_id: job.owner.orgId }),
        print_delivery: 'collect',
        print_colour: 'Any colour',
        owner_code: '111111',
        requester_code: '222222',
        pickup_line1: '12 Seeded St',
        pickup_suburb: 'Testville',
        pickup_state: 'VIC',
        pickup_postcode: '3000',
        printing_started_at: now,
        ready_at: now,
        ready_photo_url: `${job.requesterId}/seed.jpg`,
        owner_confirmed_at: now,
        requester_confirmed_at: now,
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(`seedCompletedPrints failed: ${error?.message}`)
    const { error: linkError } = await admin.from('print_job_files').insert({ transaction_id: data.id, stl_file_id: job.stlId, quantity: 1 })
    if (linkError) throw new Error(`seedCompletedPrints files failed: ${linkError.message}`)
    ids.push(data.id as string)
  }
  return ids
}

/** A request waiting on an organisation's machine (it counts on the leader's Me "Print orders"). */
export async function seedOrgOrder(job: { tutorialId: string; stlId: string; printerId: string; requesterId: string; orgId: string }) {
  const admin = adminClient()
  const { data, error } = await admin
    .from('toy_transactions')
    .insert({
      type: 'print',
      status: 'requested',
      tutorial_id: job.tutorialId,
      printer_id: job.printerId,
      requester_id: job.requesterId,
      owner_org_id: job.orgId,
      print_delivery: 'collect',
      print_colour: 'Any colour',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedOrgOrder failed: ${error?.message}`)
  const { error: linkError } = await admin.from('print_job_files').insert({ transaction_id: data.id, stl_file_id: job.stlId, quantity: 1 })
  if (linkError) throw new Error(`seedOrgOrder files failed: ${linkError.message}`)
  return data.id as string
}

/** An organisation's fixed pickup point: accepting an order needs one (accept_toy_transaction). */
export async function setOrgPickup(orgId: string) {
  const { error } = await adminClient()
    .from('organizations')
    .update({ pickup_line1: '1 Depot Rd', pickup_suburb: 'Testville', pickup_state: 'VIC', pickup_postcode: '3000' })
    .eq('id', orgId)
  if (error) throw new Error(`setOrgPickup failed: ${error.message}`)
}
