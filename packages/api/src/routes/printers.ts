/**
 * Printers: the machines people offer, and who may change them.
 *
 * A printer is a public offer — somebody has to be able to find it to send a
 * job to it — so the list is readable by anyone. What is NOT public is the
 * pickup address, and that is not on this table for exactly that reason: it
 * lives on the owner's profile or the organisation's record and is copied onto
 * a job at accept, the same rule 028 set for a toy handover.
 *
 * Writes go through the USER client so 058's owner policy is what decides,
 * rather than a filter written here. Reads go through the ADMIN client: 099
 * made the table's select grant per-column to keep `postcode` from anon and
 * signed-in keys, and the computed fields in SELECT take the whole row, which
 * a column grant cannot satisfy. 058's read policy is `using (true)`, so the
 * admin client sees no row the user client would not.
 *
 * Related files:
 * - supabase/migrations/058_printers_and_print_jobs.sql: the table and its two
 *   policies
 * - src/routes/toy-transactions.ts: POST /print, which fit-checks against these
 *   rows before it will create a job
 */
import { Hono } from 'hono'
import { createUserClient, createAdminClient } from '../supabase/client.js'
import { INVALID_TEXT_REPRESENTATION } from '../supabase/pg-errors.js'
import { ledOrgIds } from '../toy-access.js'
import { PHOTO_MIME, PHOTO_MAX_BYTES } from './upload.js'
import { PRINT_MATERIALS } from '@splat-connect/types'
import type { PrinterStats, TestPrint } from '@splat-connect/types'
import type { AuthVariables } from '../middleware/auth.js'

const printers = new Hono<{ Variables: AuthVariables }>()

const SELECT =
  'id, owner_id, owner_org_id, name, materials, bed_x, bed_y, bed_z, suburb, state, accepting, capacity, notes, filament_cents_per_g, rate_note, created_at, updated_at, printer_stats, verified'

type Row = {
  id: string
  owner_id: string | null
  owner_org_id: string | null
  name: string
  materials: string[]
  bed_x: number
  bed_y: number
  bed_z: number
  suburb: string | null
  state: string | null
  accepting: boolean
  capacity: number
  notes: string | null
  filament_cents_per_g: number | null
  rate_note: string | null
  created_at: string
  updated_at: string
  printer_stats: PrinterStats
  verified: boolean
}

/** One machine as written, once the user client's write has passed 058's policy. */
const readOne = (id: string) => createAdminClient().from('printers').select(SELECT).eq('id', id).single()

/**
 * How many accepted jobs each of these machines is carrying.
 *
 * Counted rather than filtered client-side, for the reason the brief's own list
 * of easy-to-miss schema changes gives about badge counts: a client filter over
 * a partial page is a number that is wrong exactly when it matters.
 */
async function openJobCounts(
  admin: ReturnType<typeof createAdminClient>,
  printerIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (printerIds.length === 0) return counts
  const { data } = await admin
    .from('toy_transactions')
    .select('printer_id')
    .in('printer_id', printerIds)
    .eq('status', 'accepted')
  for (const row of (data ?? []) as Array<{ printer_id: string }>) {
    counts.set(row.printer_id, (counts.get(row.printer_id) ?? 0) + 1)
  }
  return counts
}

/**
 * Owner and organisation names for these machines.
 *
 * Read with the ADMIN client, and deliberately: `profiles` has no policy that
 * lets one signed-in account read another's row, so the obvious PostgREST embed
 * comes back null and every printer reads "A contributor". Listing a machine is
 * a public offer and a family has to know who they are sending a job to, which
 * is a narrower disclosure than the contributor showcase and is why only the
 * name is selected here.
 */
async function ownerNames(
  admin: ReturnType<typeof createAdminClient>,
  rows: Row[]
): Promise<{ people: Map<string, string>; orgs: Map<string, string> }> {
  const personIds = [...new Set(rows.map((r) => r.owner_id).filter((id): id is string => !!id))]
  const orgIds = [...new Set(rows.map((r) => r.owner_org_id).filter((id): id is string => !!id))]

  const [people, orgs] = await Promise.all([
    personIds.length
      ? admin.from('profiles').select('id, name').in('id', personIds)
      : Promise.resolve({ data: [] }),
    orgIds.length
      ? admin.from('organizations').select('id, name').in('id', orgIds)
      : Promise.resolve({ data: [] }),
  ])

  return {
    people: new Map(
      ((people.data ?? []) as Array<{ id: string; name: string }>).map((p) => [p.id, p.name])
    ),
    orgs: new Map(
      ((orgs.data ?? []) as Array<{ id: string; name: string }>).map((o) => [o.id, o.name])
    ),
  }
}

/**
 * The latest test print per machine (098), for the owner's Get verified line.
 * Never the photo: the owner already has it, and the path is the API's.
 */
async function latestTestPrints(
  admin: ReturnType<typeof createAdminClient>,
  printerIds: string[]
): Promise<Map<string, TestPrint>> {
  const latest = new Map<string, TestPrint>()
  if (printerIds.length === 0) return latest
  const { data } = await admin
    .from('printer_test_prints')
    .select('printer_id, verdict, note, submitted_at')
    .in('printer_id', printerIds)
    .order('submitted_at', { ascending: false })
  for (const t of (data ?? []) as Array<TestPrint & { printer_id: string }>) {
    if (!latest.has(t.printer_id)) latest.set(t.printer_id, { verdict: t.verdict, note: t.note, submitted_at: t.submitted_at })
  }
  return latest
}

/** null when the body is a valid printer, otherwise the reason it is not. */
function invalid(body: Record<string, unknown>, partial: boolean): string | null {
  const has = (k: string) => Object.hasOwn(body, k)

  if (!partial || has('name')) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 1 || name.length > 80) return 'Give the printer a name, 80 characters or fewer.'
  }
  if (!partial || has('materials')) {
    const materials = body.materials
    if (!Array.isArray(materials) || materials.length === 0) {
      return 'Say which materials the printer has loaded.'
    }
    if (!materials.every((m) => PRINT_MATERIALS.includes(m as never))) {
      return `Materials must be from: ${PRINT_MATERIALS.join(', ')}.`
    }
  }
  for (const axis of ['bed_x', 'bed_y', 'bed_z'] as const) {
    if (!partial || has(axis)) {
      const value = body[axis]
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 2000) {
        return 'Bed size is whole millimetres, up to 2000 per axis.'
      }
    }
  }
  if (has('capacity')) {
    const capacity = body.capacity
    if (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity < 0 || capacity > 20) {
      return 'Capacity is a whole number of jobs, up to 20.'
    }
  }
  if (has('notes') && body.notes !== null) {
    if (typeof body.notes !== 'string' || body.notes.length > 500) {
      return 'Notes are 500 characters or fewer.'
    }
  }
  // 070. Integer cents, never a float: a rounding error in a rate is a real
  // amount a family is asked for. Null is the toggle's off state.
  if (has('filament_cents_per_g') && body.filament_cents_per_g !== null) {
    const rate = body.filament_cents_per_g
    if (typeof rate !== 'number' || !Number.isInteger(rate) || rate < 0 || rate > 100_000) {
      return 'Filament cost is whole cents per gram, up to $1000.'
    }
  }
  if (has('rate_note') && body.rate_note !== null) {
    if (typeof body.rate_note !== 'string' || body.rate_note.length > 500) {
      return 'The cost note is 500 characters or fewer.'
    }
  }
  return null
}

/**
 * GET /api/printers
 *
 * Every machine, newest first, with its owner's name and how full it is.
 * Deliberately not filtered to "accepting": a requester choosing where to send
 * a job is better served by seeing a full machine marked full than by a list
 * that silently omits it and looks empty.
 */
// PENDING(locations-and-distance): distance from the asker needs a stored location, not a suburb.
printers.get('/', async (c) => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('printers')
    .select(SELECT)
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)

  const rows = (data ?? []) as unknown as Row[]
  const [counts, names] = await Promise.all([
    openJobCounts(
      admin,
      rows.map((r) => r.id)
    ),
    ownerNames(admin, rows),
  ])
  return c.json(
    rows.map((r) => ({
      ...r,
      owner_name: r.owner_id ? names.people.get(r.owner_id) ?? null : null,
      org_name: r.owner_org_id ? names.orgs.get(r.owner_org_id) ?? null : null,
      open_jobs: counts.get(r.id) ?? 0,
    }))
  )
})

/**
 * GET /api/printers/mine
 *
 * The caller's own machines and their organisations'. Registered before the
 * param route below, or "mine" is read as a printer id.
 */
printers.get('/mine', async (c) => {
  const userId = c.get('userId')
  const admin = createAdminClient()
  const orgs = await ledOrgIds(admin, userId)

  const filter = orgs.length
    ? `owner_id.eq.${userId},owner_org_id.in.(${orgs.join(',')})`
    : `owner_id.eq.${userId}`

  const { data, error } = await admin
    .from('printers')
    .select(SELECT)
    .or(filter)
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)

  const rows = (data ?? []) as unknown as Row[]
  const [counts, names, latest] = await Promise.all([
    openJobCounts(
      admin,
      rows.map((r) => r.id)
    ),
    ownerNames(admin, rows),
    latestTestPrints(
      admin,
      rows.map((r) => r.id)
    ),
  ])
  return c.json(
    rows.map((r) => ({
      ...r,
      owner_name: r.owner_id ? names.people.get(r.owner_id) ?? null : null,
      org_name: r.owner_org_id ? names.orgs.get(r.owner_org_id) ?? null : null,
      open_jobs: counts.get(r.id) ?? 0,
      test_print: latest.get(r.id) ?? null,
    }))
  )
})

printers.get('/:id', async (c) => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('printers')
    .select(SELECT)
    .eq('id', c.req.param('id'))
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: error.message }, 500)
  }
  if (!data) return c.json({ error: 'Not found' }, 404)

  const row = data as unknown as Row
  const [counts, names] = await Promise.all([
    openJobCounts(admin, [row.id]),
    ownerNames(admin, [row]),
  ])
  return c.json({
    ...row,
    owner_name: row.owner_id ? names.people.get(row.owner_id) ?? null : null,
    org_name: row.owner_org_id ? names.orgs.get(row.owner_org_id) ?? null : null,
    open_jobs: counts.get(row.id) ?? 0,
  })
})

/**
 * POST /api/printers/:id/test-prints
 *
 * The owner's photo of the SPLAT test print (098), for an admin to pass or
 * fail. One waiting at a time. Written with the service role: the table has
 * no policy, and this is the one door an owner has to it.
 */
printers.post('/:id/test-prints', async (c) => {
  const userId = c.get('userId')
  const admin = createAdminClient()
  const { data: printer, error } = await admin
    .from('printers')
    .select('id, owner_id, owner_org_id')
    .eq('id', c.req.param('id'))
    .maybeSingle()
  if (error && error.code !== INVALID_TEXT_REPRESENTATION) return c.json({ error: error.message }, 500)
  const mine =
    !!printer &&
    (printer.owner_id === userId ||
      (!!printer.owner_org_id && (await ledOrgIds(admin, userId)).includes(printer.owner_org_id)))
  if (!mine) return c.json({ error: 'No such printer of yours.' }, 404)

  const { data: waiting } = await admin
    .from('printer_test_prints')
    .select('id')
    .eq('printer_id', printer.id)
    .is('verdict', null)
    .limit(1)
  if (waiting?.length) return c.json({ error: 'Your last test print is still waiting for a look.' }, 409)

  const form = await c.req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return c.json({ error: 'A photo of the SPLAT test print is required' }, 400)
  if (!PHOTO_MIME.includes(file.type)) return c.json({ error: 'Photos need to be a JPEG, PNG, WebP, AVIF or HEIC image.' }, 400)
  if (file.size > PHOTO_MAX_BYTES) return c.json({ error: 'Photos need to be under 10 MB.' }, 400)

  // Nothing in the path comes from the client: 098's CHECK pins it to this
  // printer's folder, a uuid, and the checked MIME type's extension.
  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.slice('image/'.length)
  const path = `${printer.id}/${crypto.randomUUID()}.${ext}`
  const bucket = admin.storage.from('printer-test-prints')
  const { error: uploadError } = await bucket.upload(path, file, { upsert: false })
  if (uploadError) return c.json({ error: uploadError.message }, 500)

  const { data: row, error: insertError } = await admin
    .from('printer_test_prints')
    .insert({ printer_id: printer.id, photo_path: path })
    .select('id, printer_id, verdict, note, submitted_at')
    .single()
  if (insertError) {
    await bucket.remove([path])
    // 098's one-waiting index: a second post raced past the check above.
    if (insertError.code === '23505') return c.json({ error: 'Your last test print is still waiting for a look.' }, 409)
    return c.json({ error: insertError.message }, 500)
  }
  return c.json(row, 201)
})

/**
 * POST /api/printers
 *
 * Adds a machine, owned by the caller or by an organisation they lead. The
 * owner is decided here rather than taken from the body for the same reason a
 * cost line's payer is: a client-supplied owner can name one it has no business
 * naming, and 058's policy would then refuse the insert with nothing useful to
 * show for it.
 */
printers.post('/', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const userId = c.get('userId')
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Body must be an object' }, 400)
  }

  const problem = invalid(body, false)
  if (problem) return c.json({ error: problem }, 400)

  let ownerId: string | null = userId
  let ownerOrgId: string | null = null
  if (typeof body.owner_org_id === 'string') {
    const orgs = await ledOrgIds(createAdminClient(), userId)
    if (!orgs.includes(body.owner_org_id)) {
      return c.json({ error: 'You do not lead that organisation' }, 403)
    }
    ownerId = null
    ownerOrgId = body.owner_org_id
  }

  const { data, error } = await supabase
    .from('printers')
    .insert({
      owner_id: ownerId,
      owner_org_id: ownerOrgId,
      name: (body.name as string).trim(),
      materials: body.materials as string[],
      bed_x: body.bed_x as number,
      bed_y: body.bed_y as number,
      bed_z: body.bed_z as number,
      suburb: typeof body.suburb === 'string' ? body.suburb.trim() || null : null,
      state: typeof body.state === 'string' ? body.state.trim() || null : null,
      accepting: body.accepting !== false,
      capacity: typeof body.capacity === 'number' ? body.capacity : 1,
      notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
      filament_cents_per_g:
        typeof body.filament_cents_per_g === 'number' ? body.filament_cents_per_g : null,
      rate_note:
        typeof body.rate_note === 'string' && body.rate_note.trim() ? body.rate_note.trim() : null,
    })
    .select('id')
    .maybeSingle()

  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'That printer is not yours to add' }, 403)
  const saved = await readOne(data.id)
  if (saved.error) return c.json({ error: saved.error.message }, 500)
  return c.json(saved.data, 201)
})

/**
 * PATCH /api/printers/:id
 *
 * Availability, capacity, materials, bed, notes, rates. Ownership is deliberately not
 * changeable: moving a machine between a person and an organisation would move
 * the pickup address of every open job on it out from under its requesters.
 */
printers.patch('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Body must be an object' }, 400)
  }

  const problem = invalid(body, true)
  if (problem) return c.json({ error: problem }, 400)

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const field of [
    'name', 'materials', 'bed_x', 'bed_y', 'bed_z', 'accepting', 'capacity', 'filament_cents_per_g',
  ] as const) {
    if (Object.hasOwn(body, field)) patch[field] = body[field]
  }
  for (const field of ['suburb', 'state', 'notes', 'rate_note'] as const) {
    if (Object.hasOwn(body, field)) {
      patch[field] = typeof body[field] === 'string' && (body[field] as string).trim()
        ? (body[field] as string).trim()
        : null
    }
  }

  const { data, error } = await supabase
    .from('printers')
    .update(patch)
    .eq('id', c.req.param('id'))
    .select('id')
    .maybeSingle()

  if (error) return c.json({ error: error.message }, 500)
  // RLS returns no row rather than refusing, so an absent row IS the refusal.
  if (!data) return c.json({ error: 'No such printer of yours.' }, 404)
  const saved = await readOne(data.id)
  if (saved.error) return c.json({ error: saved.error.message }, 500)
  return c.json(saved.data)
})

/**
 * DELETE /api/printers/:id
 *
 * Only a machine nothing was ever printed on. 058's FK is `on delete restrict`
 * and that is the point rather than an obstacle: a finished job names the
 * printer it came off, and deleting the machine would take that out of the
 * record of a handover that happened.
 *
 * So the check is any job at all, not only open ones — the FK would refuse the
 * rest anyway, as a 500 with a Postgres message in it, and "close it instead"
 * is the answer in both cases.
 */
printers.delete('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const id = c.req.param('id')

  const { data: anyJob } = await createAdminClient()
    .from('toy_transactions')
    .select('id')
    .eq('printer_id', id)
    .limit(1)
  if ((anyJob ?? []).length > 0) {
    return c.json(
      {
        error:
          'This printer has jobs on its record, and they name it. Close it to new jobs instead of removing it.',
      },
      409
    )
  }

  const { data, error } = await supabase
    .from('printers')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'No such printer of yours.' }, 404)
  return c.json({ id: (data as { id: string }).id })
})

export default printers
