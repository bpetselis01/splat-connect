/**
 * Printers and the jobs on them.
 *
 * The rules with teeth, each with a test that fails if it is dropped:
 *
 * - **Either fact closes a machine.** The toggle is the deliberate act and the
 *   capacity is the honest one; a machine at capacity that still reads
 *   "accepting" would take a job it cannot start.
 * - **The parts must belong to the guide named.** Without that check a request
 *   could name any STL on the platform and the printer would be shown a part
 *   from a guide nobody in the conversation has read.
 * - **Declining a print needs a reason.** The artboard requires one, and a
 *   reason that lives only in the thread cannot be rendered on the list row
 *   that needs it.
 * - **Ready needs a photo, and cannot come before printing.** Both are 058
 *   constraints as well as route checks — "ready" without a photo is the state
 *   that lets somebody drive across town for nothing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let owner: TestUser
let outsider: TestUser
let tutorialId: string
let otherTutorialId: string
let stlIds: string[] = []
let otherStlId: string
let printerId: string
let jobId: string

const authed = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })
const json = (token: string, method: string, body: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
const photo = (token: string) => {
  const form = new FormData()
  form.append('file', new File([new Uint8Array([1, 2, 3])], 'part.png', { type: 'image/png' }))
  return { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
}

beforeAll(async () => {
  family = await createTestUser('contributor')
  owner = await createTestUser('contributor')
  outsider = await createTestUser('contributor')
  const admin = adminClient()

  const guide = async (title: string) => {
    const { data } = await admin
      .from('tutorials')
      .insert({ title, description: 'A guide', difficulty: 'easy', status: 'approved' })
      .select('id')
      .single()
    return data!.id as string
  }
  tutorialId = await guide('Switch mount, printable')
  otherTutorialId = await guide('A different guide')

  const { data: files } = await admin
    .from('stl_files')
    .insert([
      { tutorial_id: tutorialId, filename: 'base.stl', file_url: `${tutorialId}/base.stl` },
      { tutorial_id: tutorialId, filename: 'lid.stl', file_url: `${tutorialId}/lid.stl` },
    ])
    .select('id')
  stlIds = (files ?? []).map((f: { id: string }) => f.id)

  const { data: other } = await admin
    .from('stl_files')
    .insert({ tutorial_id: otherTutorialId, filename: 'x.stl', file_url: `${otherTutorialId}/x.stl` })
    .select('id')
    .single()
  otherStlId = other!.id
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().in('tutorial_id', [tutorialId, otherTutorialId])
  await admin.from('printers').delete().eq('owner_id', owner.id)
  await admin.from('tutorials').delete().in('id', [tutorialId, otherTutorialId])
  await Promise.all([
    deleteTestUser(family.id),
    deleteTestUser(owner.id),
    deleteTestUser(outsider.id),
  ])
})

describe('listing a printer', () => {
  it('creates one owned by the caller, whatever the body claims', async () => {
    const res = await app.request(
      '/api/printers',
      json(owner.token, 'POST', {
        // A client-supplied owner is ignored: the machine belongs to whoever
        // added it, and a body that names somebody else must not decide that.
        owner_id: outsider.id,
        name: 'Prusa MK4',
        materials: ['PLA', 'PETG'],
        bed_x: 250,
        bed_y: 210,
        bed_z: 220,
        suburb: 'Newtown',
        state: 'NSW',
        capacity: 1,
      })
    )
    expect(res.status).toBe(201)
    const printer = (await res.json()) as { id: string; owner_id: string; accepting: boolean }
    expect(printer.owner_id).toBe(owner.id)
    expect(printer.accepting).toBe(true)
    printerId = printer.id
  })

  it('records a standard rate in whole cents, and refuses a fractional one (070)', async () => {
    const set = await app.request(
      `/api/printers/${printerId}`,
      json(owner.token, 'PATCH', { filament_cents_per_g: 12, rate_note: 'PLA at spool cost.' })
    )
    expect(set.status).toBe(200)
    const printer = (await set.json()) as { filament_cents_per_g: number | null; rate_note: string | null }
    expect(printer.filament_cents_per_g).toBe(12)
    expect(printer.rate_note).toBe('PLA at spool cost.')

    const fraction = await app.request(
      `/api/printers/${printerId}`,
      json(owner.token, 'PATCH', { filament_cents_per_g: 12.5 })
    )
    expect(fraction.status).toBe(400)

    // Null is the toggle's off state, and clears the rate.
    const off = await app.request(
      `/api/printers/${printerId}`,
      json(owner.token, 'PATCH', { filament_cents_per_g: null })
    )
    expect(((await off.json()) as { filament_cents_per_g: number | null }).filament_cents_per_g).toBeNull()
  })

  it('refuses a bed size that is not whole millimetres, and an unknown material', async () => {
    const bed = await app.request(
      '/api/printers',
      json(owner.token, 'POST', { name: 'X', materials: ['PLA'], bed_x: 10.5, bed_y: 10, bed_z: 10 })
    )
    expect(bed.status).toBe(400)

    const material = await app.request(
      '/api/printers',
      json(owner.token, 'POST', { name: 'X', materials: ['Cheese'], bed_x: 10, bed_y: 10, bed_z: 10 })
    )
    expect(material.status).toBe(400)
  })

  it('lets only the owner change it', async () => {
    const byOther = await app.request(
      `/api/printers/${printerId}`,
      json(outsider.token, 'PATCH', { accepting: false })
    )
    // RLS returns no row rather than refusing, and an absent row IS the refusal.
    expect(byOther.status).toBe(404)

    const byOwner = await app.request(
      `/api/printers/${printerId}`,
      json(owner.token, 'PATCH', { capacity: 2 })
    )
    expect(byOwner.status).toBe(200)
    expect(((await byOwner.json()) as { capacity: number }).capacity).toBe(2)
  })
})

describe('asking for a print', () => {
  it('refuses a printer that is not taking jobs', async () => {
    await app.request(`/api/printers/${printerId}`, json(owner.token, 'PATCH', { accepting: false }))
    const res = await app.request(
      '/api/toy-transactions/print',
      json(family.token, 'POST', {
        tutorial_id: tutorialId,
        printer_id: printerId,
        stl_file_ids: stlIds,
      })
    )
    expect(res.status).toBe(409)
    await app.request(`/api/printers/${printerId}`, json(owner.token, 'PATCH', { accepting: true }))
  })

  /*
   * Why: without this a request could name any STL on the platform, and the
   * printer would be shown a part from a guide nobody in the conversation has
   * read.
   */
  it('refuses parts that do not belong to the guide named', async () => {
    const res = await app.request(
      '/api/toy-transactions/print',
      json(family.token, 'POST', {
        tutorial_id: tutorialId,
        printer_id: printerId,
        stl_file_ids: [stlIds[0], otherStlId],
      })
    )
    expect(res.status).toBe(400)
  })

  it('refuses sending a job to your own printer', async () => {
    const res = await app.request(
      '/api/toy-transactions/print',
      json(owner.token, 'POST', {
        tutorial_id: tutorialId,
        printer_id: printerId,
        stl_file_ids: stlIds,
      })
    )
    expect(res.status).toBe(400)
  })

  it('creates the job with the files it names', async () => {
    const res = await app.request(
      '/api/toy-transactions/print',
      json(family.token, 'POST', {
        tutorial_id: tutorialId,
        printer_id: printerId,
        stl_file_ids: stlIds,
        note: 'The large base plate, please.',
      })
    )
    expect(res.status).toBe(201)
    const tx = (await res.json()) as { id: string; type: string; printer_id: string; toy_id: null }
    expect(tx.type).toBe('print')
    expect(tx.printer_id).toBe(printerId)
    expect(tx.toy_id).toBeNull()
    jobId = tx.id

    const detail = await app.request(`/api/toy-transactions/${jobId}`, authed(family.token))
    const body = (await detail.json()) as { print_files: Array<{ filename: string }> }
    expect(body.print_files.map((f) => f.filename).sort()).toEqual(['base.stl', 'lid.stl'])
  })

  /*
   * Why: the capacity is the honest half of availability. One accepted job on a
   * capacity-one machine is a full machine, whatever the toggle says.
   */
  it('refuses a second job once the machine is full', async () => {
    await app.request(`/api/printers/${printerId}`, json(owner.token, 'PATCH', { capacity: 1 }))
    await app.request(
      `/api/toy-transactions/${jobId}/accept`,
      json(owner.token, 'POST', {
        pickup_line1: '1 Test St',
        pickup_suburb: 'Newtown',
        pickup_state: 'NSW',
        pickup_postcode: '2042',
      })
    )

    const res = await app.request(
      '/api/toy-transactions/print',
      json(family.token, 'POST', {
        tutorial_id: otherTutorialId,
        printer_id: printerId,
        stl_file_ids: [otherStlId],
      })
    )
    expect(res.status).toBe(409)
  })
})

describe('moving a job through the bed', () => {
  it('will not collect before it is ready', async () => {
    const res = await app.request(
      `/api/toy-transactions/${jobId}/confirm`,
      json(family.token, 'POST', { code: 'anything' })
    )
    expect(res.status).toBe(409)
  })

  it('will not mark ready before it has started', async () => {
    const res = await app.request(`/api/toy-transactions/${jobId}/print-ready`, photo(owner.token))
    expect(res.status).toBe(409)
  })

  it('lets only the printer start it', async () => {
    const byFamily = await app.request(
      `/api/toy-transactions/${jobId}/print-started`,
      json(family.token, 'POST', {})
    )
    expect(byFamily.status).toBe(403)

    const byOwner = await app.request(
      `/api/toy-transactions/${jobId}/print-started`,
      json(owner.token, 'POST', {})
    )
    expect(byOwner.status).toBe(200)
    expect(
      ((await byOwner.json()) as { printing_started_at: string }).printing_started_at
    ).not.toBeNull()
  })

  it('requires a photo to mark it ready', async () => {
    const noPhoto = await app.request(
      `/api/toy-transactions/${jobId}/print-ready`,
      json(owner.token, 'POST', {})
    )
    expect(noPhoto.status).toBe(400)

    const withPhoto = await app.request(
      `/api/toy-transactions/${jobId}/print-ready`,
      photo(owner.token)
    )
    expect(withPhoto.status).toBe(200)
    const body = (await withPhoto.json()) as { ready_at: string; ready_photo_url: string }
    expect(body.ready_at).not.toBeNull()
    expect(body.ready_photo_url).toContain(jobId)
  })

  it('closes on both codes and transfers no toy, because there is none', async () => {
    const admin = adminClient()
    const { data: row } = await admin
      .from('toy_transactions')
      .select('owner_code, requester_code')
      .eq('id', jobId)
      .single()

    await app.request(
      `/api/toy-transactions/${jobId}/confirm`,
      json(owner.token, 'POST', { code: row!.requester_code })
    )
    const last = await app.request(
      `/api/toy-transactions/${jobId}/confirm`,
      json(family.token, 'POST', { code: row!.owner_code })
    )
    expect(last.status).toBe(200)
    expect(((await last.json()) as { status: string }).status).toBe('completed')

    const { count } = await admin
      .from('toys')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', family.id)
    expect(count).toBe(0)
  })
})

describe('declining a print', () => {
  it('needs a reason, and stores it', async () => {
    const created = await app.request(
      '/api/toy-transactions/print',
      json(family.token, 'POST', {
        tutorial_id: otherTutorialId,
        printer_id: printerId,
        stl_file_ids: [otherStlId],
      })
    )
    const { id } = (await created.json()) as { id: string }

    const noReason = await app.request(`/api/toy-transactions/${id}/reject`, json(owner.token, 'POST', {}))
    expect(noReason.status).toBe(400)

    const withReason = await app.request(
      `/api/toy-transactions/${id}/reject`,
      json(owner.token, 'POST', { reason: 'Bed is too small for the base plate.' })
    )
    expect(withReason.status).toBe(200)
    const body = (await withReason.json()) as { status: string; decline_reason: string }
    expect(body.status).toBe('rejected')
    expect(body.decline_reason).toBe('Bed is too small for the base plate.')
  })
})

describe('removing a printer', () => {
  /*
   * Why: a finished job names the printer it came off. 058's FK is
   * `on delete restrict` for that reason, so the refusal covers closed jobs
   * too — otherwise it surfaces as a 500 with a Postgres message in it.
   */
  it('refuses once anything has been printed on it, and says what to do instead', async () => {
    const blocked = await app.request(`/api/printers/${printerId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${owner.token}` },
    })
    expect(blocked.status).toBe(409)
    expect(((await blocked.json()) as { error: string }).error).toMatch(/Close it to new jobs/)
  })

  it('removes a machine nothing was ever sent to', async () => {
    const created = await app.request(
      '/api/printers',
      json(owner.token, 'POST', {
        name: 'Spare Ender',
        materials: ['PLA'],
        bed_x: 220,
        bed_y: 220,
        bed_z: 250,
      })
    )
    const { id } = (await created.json()) as { id: string }

    const removed = await app.request(`/api/printers/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${owner.token}` },
    })
    expect(removed.status).toBe(200)
  })
})
