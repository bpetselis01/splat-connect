/**
 * Fills the fields that migrations 050–124 added, on rows that predate them,
 * so the screens built for those fields have something to draw on the hosted
 * development project. Every value is invented and believable; nothing
 * identifying is written and no row is created or deleted.
 *
 *   node scripts/seed-demo/fill.js            dry run: the diff per table, nothing written
 *   node scripts/seed-demo/fill.js --apply    write, recording every prior value in fill-manifest.json
 *   node scripts/seed-demo/fill.js --remove   put every recorded prior value back, then drop the manifest
 *
 * Only a null, empty-array or blank field is ever written, so a second --apply
 * finds nothing to do and --remove restores exactly what --apply changed.
 *
 * Left alone on purpose: child_profiles (a child's measurements are not ours
 * to invent), addresses, contact details, photos (they need uploads), and every
 * lifecycle column (settled_at, cancelled_at, review_note…) whose null is a
 * state, not a gap. The 'Deleted member' placeholder and the one nameless
 * profile are skipped too.
 */
const fs = require('fs')
const path = require('path')
const { createClient } = require(
  require.resolve('@supabase/supabase-js', { paths: [path.resolve(__dirname, '../../packages/web')] })
)

const ROOT = path.resolve(__dirname, '../..')
const MANIFEST = path.join(__dirname, 'fill-manifest.json')
const TODAY = new Date().toISOString().slice(0, 10)

function readEnv(file) {
  const out = {}
  for (const line of fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}
const apiEnv = readEnv('packages/api/.env.local')
const db = createClient(apiEnv.SUPABASE_URL, apiEnv.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const empty = (v) => v == null || (Array.isArray(v) && v.length === 0) || (typeof v === 'string' && v.trim() === '')
const pick = (list, i) => list[i % list.length]
const by = (rows, key) => rows.reduce((m, r) => ((m[r[key]] ||= []).push(r), m), {})
async function all(table, select = '*', order = 'id') {
  const { data, error } = await db.from(table).select(select).order(order, { ascending: true })
  if (error) throw new Error(`${table}: ${error.message}`)
  return data
}

/** One row's change: only the fields that are empty now, with what was there. */
function change(table, row, patch) {
  const prior = {}
  const next = {}
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || !empty(row[k])) continue
    prior[k] = row[k] === undefined ? null : row[k]
    next[k] = v
  }
  return Object.keys(next).length ? { table, id: row.id, label: row.title || row.name || '', prior, patch: next } : null
}

// ── what goes where ─────────────────────────────────────────────────────────
const STL_SIZE = [
  [/base|bottom/i, [72, 48, 14]],
  [/top|cap|lid/i, [72, 48, 9]],
]
const STL_TIME = [[48, 9], [36, 6], [55, 12]]
function stlPatch(f, i) {
  const [, size] = STL_SIZE.find(([re]) => re.test(f.filename)) || [null, [60, 40, 20]]
  const [print_minutes, filament_grams] = pick(STL_TIME, i)
  return { print_minutes, filament_grams, size_x_mm: size[0], size_y_mm: size[1], size_z_mm: size[2] }
}

const PART_PRICE = [
  [/bubble machine/i, 1500], [/jack|socket/i, 350], [/batter/i, 650], [/coin cell/i, 400], [/wire|cable/i, 450],
  [/heat-?shrink/i, 300], [/motor/i, 550], [/holder/i, 250], [/\bled\b/i, 80], [/switch/i, 120], [/cup/i, 200], [/dice/i, 300],
]
const partPrice = (name) => (PART_PRICE.find(([re]) => re.test(name)) || [null, 500])[1]

const TOOL_HOW = [
  [/safety glasses/i, 'buy', 'Any pair that wraps around is fine.'],
  [/glue gun/i, 'borrow', 'A low-temperature gun is kinder to a plastic toy shell.'],
  [/soldering/i, 'borrow', 'Any 30–40 W iron does; use lead-free solder.'],
  [/stripper|cutter/i, 'borrow', 'Flush cutters leave a tidy end on the jack wires.'],
  [/drill/i, 'borrow', 'Go slowly through a toy shell so the bit does not grab.'],
  [/screwdriver/i, 'buy', 'Toy screws are often triangle-head or Phillips #0.'],
  [/sandpaper|deburr/i, 'substitute', 'A nail file does the same job on a small print.'],
  [/scissors/i, 'substitute', null],
]
const toolHow = (name) => TOOL_HOW.find(([re]) => re.test(name)) || [null, 'buy', null]

const TOY_BRANDS = ['Anko', 'Fisher-Price', 'VTech', 'Playgro', 'Hamleys']
const toyNameFrom = (title) => title.replace(/^.*? - /, '').replace(/^switch[- ]adapted /i, '').trim().slice(0, 80)

const BATTERIES = ['2 × AA, included', '3 × AAA, not included', '4 × AA, included']
const FITTINGS = ['3.5 mm mono socket', '3.5 mm mono socket, side of the base']
const VOLUMES = ['Quiet', 'Medium, no volume control', 'Loud']

const POSTCODE = { Hamilton: '2303', Coorparoo: '4151', Callaghan: '2308', Merewether: '2291', Lambton: '2299', Newcastle: '2300', Parramatta: '2150' }

const ORGS = {
  SPLAT: {
    kind: 'Charity or disability service',
    about: 'SPLAT stands for Supporting Play by Adapting Toys. We make toy adaptation knowledge discoverable and shareable, so a parent who has never held a soldering iron can still get a toy their child can start. The knowledge on the platform is free and stays free.',
    suburb: 'Newcastle', state: 'NSW', service_area: 'Australia-wide, online', capabilities: ['Backs guides'],
  },
  'Northbank Uni Makerspace': {
    recycling_machines: ['Shredder', 'Extruder'], recycling_forms: ['Failed prints', 'Offcuts', 'Sprues and rafts'],
    recycling_min_kg: 2, recycling_max_kg: 20, recycling_turnaround: 'About two weeks',
    recycling_hours: 'Wednesdays 5–8 pm, with the makerspace', recycling_door: 'Loading dock, Building ES. Ring the bell.',
  },
  "Coorparoo Community Men's Shed": {
    kind: "Men's Shed or community workshop", visit_hours: 'Tuesday, Thursday and Saturday mornings, 8–12',
    service_area: 'Brisbane south side', rate_note: 'Materials at cost. A gold-coin donation keeps the kettle on.',
    payment_methods: ['cash'], recycling_machines: ['Shredder'], recycling_forms: ['Failed prints', 'Bottle caps'],
    recycling_min_kg: 2, recycling_max_kg: 10, recycling_turnaround: 'A month or so',
    recycling_hours: 'Saturday mornings', recycling_door: 'Side roller door off the car park',
  },
  'Little Steps Therapy Collective': {
    kind: 'Therapy practice', service_area: 'Western Sydney',
    about: 'A small paediatric therapy collective in western Sydney. Paused on SPLAT while the leadership changes hands.',
  },
}

const CAST_OCCUPATION = {
  'Priya Nair': 'Parent and carer', 'Tom Walsh': 'Retired electrician', 'Mei Chen': 'Engineering student',
  'Dan Kowalski': "Men's Shed volunteer", "Sarah O'Connell": 'Paediatric occupational therapist', 'Hamish Reid': 'Shed coordinator',
}
const SKIP_PROFILE = (p) => p.id === '00000000-0000-4000-8000-00000000dead' || empty(p.name)

const EVENT_COPY = {
  build_day: {
    description: 'Bring a toy or pick one from the shelf, and leave with it switch-adapted. Tools, parts and someone who has done it before are on hand all day.',
    what_to_bring: 'A toy to adapt if you have one, and a snack.',
    accessibility_note: 'Step-free entry and an accessible toilet on the same floor.',
    audience: 'Families, OTs and anyone curious',
  },
  workshop: {
    description: 'A hands-on session on the basics: stripping wire, tinning, and fitting a 3.5 mm jack into a toy. Two to a bench; every tool provided.',
    what_to_bring: 'Reading glasses if you use them.',
    accessibility_note: 'Seated work at benches. Tell us if you need a lower bench.',
    audience: 'Beginners welcome',
  },
  open_day: {
    description: 'Come and see the shed, try the adapted toys on the shelf, and take one home if it suits.',
    what_to_bring: 'Nothing. Tea and biscuits are on.',
    accessibility_note: 'Level concrete floor throughout; parking at the door.',
    audience: 'Families and carers',
  },
  print_day: {
    description: 'The printers run all day on switch parts and toy brackets from the guides. Drop in, pick a part, watch it print.',
    what_to_bring: 'A guide link for the part you want.',
    accessibility_note: 'Step-free entry.',
    audience: 'Anyone who needs a part printed',
  },
}

const QUOTES = [
  ['He pressed it and the whole room cheered.', 'A parent at the build day'],
  ['I had never soldered. By lunch I had adapted two.', 'A first-time volunteer'],
  ['The shelf is never full for long.', 'The shed coordinator'],
]

// ── the plan ────────────────────────────────────────────────────────────────
async function plan() {
  const out = []
  const push = (c) => c && out.push(c)

  const stl = await all('stl_files')
  stl.forEach((f, i) => push(change('stl_files', f, stlPatch(f, i))))
  const stlByGuide = by(stl, 'tutorial_id')
  const minutesOf = (f, i) => f.print_minutes ?? stlPatch(f, i).print_minutes

  const parts = await all('parts', 'id, tutorial_id, name, price_cents')
  parts.forEach((p) => push(change('parts', p, { price_cents: partPrice(p.name) })))
  const partsByGuide = by(parts, 'tutorial_id')

  const tools = await all('tools', 'id, tutorial_id, name, get_by, note')
  tools.forEach((t) => {
    const [, get_by, note] = toolHow(t.name)
    push(change('tools', t, { get_by, note }))
  })

  const guides = await all('tutorials')
  const contributors = await all('tutorial_contributors', 'tutorial_id, profile_id, role', 'tutorial_id')
  guides.forEach((g, i) => {
    const files = stlByGuide[g.id] || []
    const adaptation = g.kind === 'toy_adaptation'
    const patch = {
      age_min: adaptation ? 2 : 5,
      age_max: adaptation ? 8 : 18,
      prices_checked_on: partsByGuide[g.id] ? TODAY : null,
    }
    if (files.length) {
      Object.assign(patch, {
        layer_height_mm: 0.2,
        infill_percent: files.length > 2 ? 15 : 20,
        material: files.find((f) => f.material)?.material || 'PLA',
        print_minutes: files.reduce((s, f, j) => s + minutesOf(f, j), 0),
      })
    }
    if (adaptation) {
      Object.assign(patch, {
        toy_name: toyNameFrom(g.title),
        toy_brand: pick(TOY_BRANDS, i),
        works_with: 'Any 3.5 mm mono switch. See the Light Touch Switch and Low Profile Switch guides.',
      })
    } else {
      Object.assign(patch, { access: ['press'], press_force: ['light'] })
    }
    push(change('tutorials', g, patch))
  })

  const toys = await all('toys')
  toys.forEach((t, i) =>
    push(
      change('toys', t, {
        age_min: t.switch_adapted ? 2 : 3,
        age_max: t.switch_adapted ? 8 : 10,
        batteries: pick(BATTERIES, i),
        switch_fitting: t.switch_adapted ? pick(FITTINGS, i) : null,
        volume: pick(VOLUMES, i),
      })
    )
  )

  const orgs = await all('organizations')
  orgs.forEach((o) => push(change('organizations', o, ORGS[o.name] || { kind: 'Charity or disability service' })))

  const printers = await all('printers')
  printers.forEach((p) =>
    push(change('printers', p, { postcode: POSTCODE[p.suburb] || null, filament_cents_per_g: 7, rate_note: 'Filament at cost.' }))
  )

  const profiles = await all('profiles', 'id, name, role, bio, occupation, featured_tutorial_id')
  const approved = new Set(guides.filter((g) => g.status === 'approved').map((g) => g.id))
  profiles.filter((p) => !SKIP_PROFILE(p)).forEach((p, i) => {
    const mine = contributors.filter((c) => c.profile_id === p.id && c.role === 'primary').map((c) => c.tutorial_id)
    const featured = mine.find((id) => approved.has(id)) || null
    const owned = toys.filter((t) => t.owner_id === p.id).length
    const count = (n, word) => (n ? `${n} ${word}${n === 1 ? '' : 's'}` : null)
    const tally = [count(mine.length, 'guide'), count(owned, 'toy')].filter(Boolean).join(' and ')
    const tester = /test|recheck/i.test(p.name)
    push(
      change('profiles', p, {
        occupation: CAST_OCCUPATION[p.name] || (p.role === 'admin' ? 'Platform admin' : tester ? 'Tester' : pick(['Maker and volunteer', 'Parent and carer'], i)),
        bio: tally && !tester ? `Adapts toys and writes up the steps so the next person can too. ${tally} on SPLAT so far.` : null,
        featured_tutorial_id: featured,
      })
    )
  })

  const events = await all('org_events')
  events.forEach((e) =>
    push(
      change('org_events', e, {
        ...(EVENT_COPY[e.kind] || EVENT_COPY.workshop),
        ...(e.format === 'online'
          ? {
              what_to_bring: 'A 3.5 mm jack and a spare toy if you want to follow along.',
              accessibility_note: 'Captions are on and the recording is shared afterwards.',
              online_url: 'https://meet.example.org/splat-intro',
            }
          : {}),
        cost_cents: 0,
        cost_note: 'Free',
      })
    )
  )

  const stories = await all('org_stories')
  stories.filter((s) => s.published_at).forEach((s, i) => {
    const [pull_quote, pull_quote_by] = pick(QUOTES, i)
    push(change('org_stories', s, { pull_quote, pull_quote_by }))
  })

  return out
}

// ── reporting and writing ───────────────────────────────────────────────────
function summarise(changes) {
  const tables = by(changes, 'table')
  let fields = 0
  for (const [table, rows] of Object.entries(tables)) {
    const cols = {}
    for (const r of rows) for (const [k, v] of Object.entries(r.patch)) (cols[k] ||= []).push(`${r.id.slice(0, 8)} ${r.label}`.trim() + ` → ${JSON.stringify(v)}`)
    console.log(`\n${table}  ${rows.length} rows`)
    for (const [k, examples] of Object.entries(cols)) {
      fields += examples.length
      console.log(`  ${k.padEnd(22)} ${String(examples.length).padStart(3)}   e.g. ${examples[0].slice(0, 90)}`)
    }
  }
  console.log(`\n${fields} fields across ${changes.length} rows in ${Object.keys(tables).length} tables.`)
}

async function write(table, id, patch) {
  const { error } = await db.from(table).update(patch).eq('id', id)
  if (error) throw new Error(`${table} ${id}: ${error.message}`)
}

async function apply(changes) {
  if (fs.existsSync(MANIFEST)) throw new Error(`${MANIFEST} exists: a fill is already applied. Run --remove first.`)
  const manifest = { applied_at: new Date().toISOString(), project: apiEnv.SUPABASE_URL, changes: [] }
  for (const c of changes) {
    manifest.changes.push({ table: c.table, id: c.id, prior: c.prior })
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2))
    await write(c.table, c.id, c.patch)
  }
  console.log(`Written. Prior values for ${changes.length} rows are in ${path.relative(ROOT, MANIFEST)}.`)
}

async function remove() {
  if (!fs.existsSync(MANIFEST)) return console.log('Nothing to remove.')
  const { changes } = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  for (const c of [...changes].reverse()) await write(c.table, c.id, c.prior)
  fs.unlinkSync(MANIFEST)
  console.log(`Restored ${changes.length} rows.`)
}

async function main() {
  if (process.argv.includes('--remove')) return remove()
  const changes = await plan()
  summarise(changes)
  if (process.argv.includes('--apply')) return apply(changes)
  console.log('Dry run. Nothing written; pass --apply to write.')
}

module.exports = { change, stlPatch, partPrice, toolHow, toyNameFrom }

if (require.main === module)
  main().catch((e) => {
    console.error('\n✗', e.message)
    process.exit(1)
  })
