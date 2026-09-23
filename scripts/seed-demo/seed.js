/**
 * A demo cast for the hosted database: six fictional accounts, three
 * organisations and seven real Makers Making Change designs, arranged so every
 * web and mobile screen has content and every state the UI draws differently
 * has one row. Spec: docs/superpowers/specs/2026-09-23-demo-seed-design.md.
 *
 *   node scripts/seed-demo/seed.js           seed (refuses if the cast exists)
 *   node scripts/seed-demo/seed.js --remove  take it all back out
 *
 * Content rows go in with the service role. Anything with side effects the
 * database does not do itself — exchanges, builds, print jobs, invites,
 * challenge membership, thanks, registrations — goes through the real API on
 * :3101 signed in as the person, so the messages, notifications, codes and
 * transfers are the API's own. The API must be running and pointed at the
 * same project (packages/api/.env.local).
 *
 * Every id is written to manifest.json as it is created, so a run that dies
 * halfway is still removable.
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { createClient } = require(
  require.resolve('@supabase/supabase-js', { paths: [path.resolve(__dirname, '../../packages/web')] })
)

const ROOT = path.resolve(__dirname, '../..')
const MANIFEST = path.join(__dirname, 'manifest.json')
const CACHE = path.join(__dirname, '.cache')
const API = process.env.SEED_API_URL || 'http://localhost:3101'
const SOURCES = require('./sources.json')

function readEnv(file) {
  const out = {}
  for (const line of fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}
const apiEnv = readEnv('packages/api/.env.local')
const URL_ = apiEnv.SUPABASE_URL
const db = createClient(URL_, apiEnv.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// ── the cast ────────────────────────────────────────────────────────────────
const CAST = {
  priya: { email: 'petselisbyron+priya@gmail.com', name: 'Priya Nair' },
  tom: { email: 'petselisbyron+tom@gmail.com', name: 'Tom Walsh' },
  mei: { email: 'fettmoose+mei@gmail.com', name: 'Mei Chen' },
  dan: { email: 'fettmoose+dan@gmail.com', name: 'Dan Kowalski' },
  sarah: { email: 'splat.general+northbank@gmail.com', name: "Sarah O'Connell" },
  hamish: { email: 'splat.general+mensshed@gmail.com', name: 'Hamish Reid' },
}
const ADMIN_EMAIL = 'byronpetselisap@gmail.com'

const HOME = {
  priya: { pickup_line1: '14 Scenic Drive', pickup_suburb: 'Merewether', pickup_state: 'NSW', pickup_postcode: '2291' },
  tom: { pickup_line1: '3 Elder Street', pickup_suburb: 'Lambton', pickup_state: 'NSW', pickup_postcode: '2299' },
  mei: { pickup_line1: '88 Beaumont Street', pickup_suburb: 'Hamilton', pickup_state: 'NSW', pickup_postcode: '2303' },
  dan: { pickup_line1: '21 Cavendish Road', pickup_suburb: 'Coorparoo', pickup_state: 'QLD', pickup_postcode: '4151' },
}

// ── manifest ────────────────────────────────────────────────────────────────
let manifest = { users: {}, rows: [], storage: [] }
const save = () => fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2))
const track = (table, id) => {
  manifest.rows.push({ table, id })
  save()
  return id
}

// ── small helpers ───────────────────────────────────────────────────────────
const days = (n) => new Date(Date.now() + n * 86400000).toISOString()
const log = (...a) => console.log('·', ...a)

async function insert(table, row) {
  const { data, error } = await db.from(table).insert(row).select('id').single()
  if (error) throw new Error(`${table}: ${error.message} ${JSON.stringify(row).slice(0, 200)}`)
  return track(table, data.id)
}
/** For bulk and join-table inserts that have no single id to track. */
async function put(table, rows) {
  const { error } = await db.from(table).insert(rows)
  if (error) throw new Error(`${table}: ${error.message}`)
}
async function update(table, id, patch) {
  const { error } = await db.from(table).update(patch).eq('id', id)
  if (error) throw new Error(`update ${table}: ${error.message}`)
}
async function file(key) {
  fs.mkdirSync(CACHE, { recursive: true })
  const rel = SOURCES.files[key]
  const local = path.join(CACHE, key + path.extname(decodeURIComponent(rel)))
  if (!fs.existsSync(local)) {
    const res = await fetch(SOURCES.base + rel)
    if (!res.ok) throw new Error(`download ${key}: ${res.status}`)
    fs.writeFileSync(local, Buffer.from(await res.arrayBuffer()))
  }
  return { buf: fs.readFileSync(local), name: path.basename(decodeURIComponent(rel)).replace(/\s+/g, '_') }
}
const MIME = { '.jpg': 'image/jpeg', '.pdf': 'application/pdf', '.stl': 'model/stl' }
async function upload(bucket, objectPath, buf) {
  const contentType = MIME[path.extname(objectPath)] || 'application/octet-stream'
  const { error } = await db.storage.from(bucket).upload(objectPath, buf, { contentType, upsert: true })
  if (error) throw new Error(`upload ${bucket}/${objectPath}: ${error.message}`)
  manifest.storage.push({ bucket, path: objectPath })
  save()
  return objectPath
}
async function publicPhoto(bucket, ownerId, key) {
  const { buf } = await file(key)
  const p = await upload(bucket, `${ownerId}/${crypto.randomUUID()}.jpg`, buf)
  return db.storage.from(bucket).getPublicUrl(p).data.publicUrl
}

// ── the API, as a person ────────────────────────────────────────────────────
const anon = readEnv('packages/web/.env.local').NEXT_PUBLIC_SUPABASE_ANON_KEY
async function signIn(u) {
  const c = createClient(URL_, anon, { auth: { persistSession: false } })
  const { data, error } = await c.auth.signInWithPassword({ email: u.email, password: manifest.password })
  if (error) throw new Error(`sign in ${u.email}: ${error.message}`)
  u.token = data.session.access_token
}
async function api(u, method, route, body) {
  const form = body instanceof FormData
  const res = await fetch(`${API}/api${route}`, {
    method,
    headers: { Authorization: `Bearer ${u.token}`, ...(form || !body ? {} : { 'Content-Type': 'application/json' }) },
    body: form ? body : body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${route} as ${u.name}: ${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}
async function photoForm(key) {
  const { buf, name } = await file(key)
  const f = new FormData()
  f.append('file', new File([buf], name, { type: 'image/jpeg' }))
  return f
}
const tx = async (id) => (await db.from('toy_transactions').select('*').eq('id', id).single()).data
async function newTx(u, route, body) {
  const t = await api(u, 'POST', route, body)
  return track('toy_transactions', t.id)
}
/** Both codes are readable with the service role; each side types the other's. */
async function confirm(u, id, side) {
  const t = await tx(id)
  await api(u, 'POST', `/toy-transactions/${id}/confirm`, { code: side === 'owner' ? t.requester_code : t.owner_code })
}

// A receipt that is plainly a receipt — generated rather than anyone's real one.
function receiptPdf(lines) {
  const text = lines.map((l, i) => `BT /F1 12 Tf 60 ${740 - i * 20} Td (${l}) Tj ET`).join('\n')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = objs.map((o, i) => {
    const at = pdf.length
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
    return at
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf)
}

// ── Phase A: content ────────────────────────────────────────────────────────
async function phaseA(P) {
  const { data: adminProfile } = await db.from('profiles').select('id').eq('email', ADMIN_EMAIL).single()
  if (!adminProfile) throw new Error(`admin ${ADMIN_EMAIL} not found`)
  const ADMIN = adminProfile.id
  const { priya, tom, mei, dan, sarah, hamish } = P

  // Accounts and terms
  for (const [key, u] of Object.entries(P)) {
    const { data, error } = await db.auth.admin.createUser({
      email: u.email,
      password: manifest.password,
      email_confirm: true,
      user_metadata: { name: u.name },
    })
    if (error) throw new Error(`createUser ${u.email}: ${error.message}`)
    u.id = data.user.id
    manifest.users[key] = { id: u.id, email: u.email }
    save()
    await db.from('profiles').update({ name: u.name, role: 'contributor', ...(HOME[key] || {}) }).eq('id', u.id)
    const terms = ['contributor_terms', ...(key === 'sarah' || key === 'hamish' ? ['org_leader_terms'] : [])]
    for (const t of terms) {
      const { error: e } = await db.from('user_agreements').insert({ user_id: u.id, agreement_type: t, version: 'v0-todo' })
      if (e && e.code !== '23505') throw new Error(`terms: ${e.message}`)
    }
  }
  log('6 accounts')

  // Organisations
  const northbank = await insert('organizations', {
    name: 'Northbank Uni Makerspace',
    description: 'Student volunteers adapting toys and printing switch parts for Hunter families.',
    about:
      "We're the Assistive Tech Club at the Northbank campus makerspace: engineering, OT and design students who meet every Wednesday night. We keep a small shelf of adapted toys to lend or give, run build days each term, and print switch parts on the club's printer farm for any family that asks.",
    status: 'active',
    created_by: sarah.id,
    suburb: 'Callaghan',
    state: 'NSW',
    pickup_line1: 'Makerspace, Building ES, University Drive',
    pickup_suburb: 'Callaghan',
    pickup_state: 'NSW',
    pickup_postcode: '2308',
    pickup_instructions: 'Wednesdays 5–8pm. Ring the bell by the roller door.',
    capabilities: ['Backs guides', 'Holds toys', 'Has a printer', 'Takes recycling', 'Runs build days'],
    contact_email: CAST.sarah.email,
    website_url: 'https://example.org/northbank-makerspace',
    rate_note: 'Filament at cost, about 6c a gram. Student time is free.',
    recycling_materials: ['PLA', 'PETG'],
    recycling_note: 'Clean offcuts and failed prints only. No supports mixed with other plastics.',
  })
  const mensShed = await insert('organizations', {
    name: "Coorparoo Community Men's Shed",
    description: 'Woodwork and soldering benches, adapting toys in batches for Brisbane families.',
    about:
      'Retired sparkies, cabinet makers and a couple of teachers. We adapt toys in batches of ten, make sturdy switch mounts and cases, and hold an open day each month where families can try things before they take them home.',
    status: 'active',
    created_by: hamish.id,
    suburb: 'Coorparoo',
    state: 'QLD',
    pickup_line1: '40 Halstead Street',
    pickup_suburb: 'Coorparoo',
    pickup_state: 'QLD',
    pickup_postcode: '4151',
    pickup_instructions: 'Tuesday and Thursday mornings, side gate.',
    capabilities: ['Builds adaptations', 'Holds toys', 'Takes recycling', 'Runs build days'],
    contact_email: CAST.hamish.email,
    recycling_materials: ['PLA'],
    recycling_note: 'Bring it bagged and labelled.',
  })
  const littleSteps = await insert('organizations', {
    name: 'Little Steps Therapy Collective',
    description: 'OTs and speech pathologists running a switch-toy lending library.',
    status: 'suspended',
    created_by: ADMIN,
    suburb: 'Parramatta',
    state: 'NSW',
  })
  await put('org_leaders', [
    { org_id: northbank, user_id: sarah.id },
    { org_id: mensShed, user_id: hamish.id },
  ])
  await insert('organization_requests', {
    requester_id: hamish.id,
    org_name: "Coorparoo Community Men's Shed",
    what_they_do: 'We adapt toys in batches and build switch mounts. About 30 members, 6 of them on toys.',
    verification: 'Registered with the Australian Men’s Shed Association; ABN on our website.',
    status: 'approved',
    review_note: 'Checked the AMSA listing. Welcome aboard.',
    reviewed_by: ADMIN,
    reviewed_at: days(-60),
    organization_id: mensShed,
  })
  await insert('organization_requests', {
    requester_id: tom.id,
    org_name: 'Lambton Dads Toy Club',
    what_they_do: 'A few dads from school who want to fix and adapt toys together.',
    verification: 'Not registered yet — just us for now.',
    status: 'declined',
    review_note: 'Great idea. Come back once you have a place to meet and someone to contact besides you.',
    reviewed_by: ADMIN,
    reviewed_at: days(-12),
  })
  await insert('organization_requests', {
    requester_id: priya.id,
    org_name: 'Hunter Switch Toy Library',
    what_they_do: 'Parents lending switch-adapted toys to each other so kids can try before anyone builds one.',
    verification: 'Incorporated association in progress with NSW Fair Trading; our OT will vouch for us.',
    status: 'pending',
  })
  log('3 organisations, 3 org requests')

  // Guides
  const credit = (text, repo, licence) =>
    `\n\nBased on an open design from Makers Making Change (Neil Squire Society). ${text} Licence: ${licence}. Source: https://github.com/makersmakingchange/${repo}`
  const G = {}
  async function guide(key, t) {
    const id = await insert('tutorials', {
      title: t.title,
      description: t.description + credit(t.credit, t.repo, t.licence),
      difficulty: t.difficulty,
      kind: t.kind,
      status: 'draft',
      maturity: t.maturity || 'complete',
      build_minutes: t.build_minutes,
      age_min: t.age[0],
      age_max: t.age[1],
      safety_declared_at: t.status === 'draft' ? null : days(-40),
    })
    G[key] = id
    const photos = []
    for (const p of t.photos || []) photos.push(await publicPhoto('toy-photos', id, p))
    const pdf = await upload('tutorial-pdfs', `${id}/tutorial.pdf`, (await file(t.pdf)).buf)
    await update('tutorials', id, {
      photo_urls: photos,
      tutorial_pdf_url: pdf,
      status: t.status,
      rejection_note: t.rejection_note || null,
      ...(t.reviewed ? { reviewed_by: t.reviewed.by, reviewed_at: days(-30), reviewed_for_org_id: t.reviewed.org || null } : {}),
    })
    for (const s of t.stls || []) {
      const { buf, name } = await file(s.key)
      await insert('stl_files', {
        tutorial_id: id,
        filename: name,
        file_url: await upload('stl-files', `${id}/${name}`, buf),
        print_minutes: s.minutes ?? null,
        filament_grams: s.grams ?? null,
        material: s.material ?? null,
      })
    }
    for (const p of t.parts || []) await insert('parts', { tutorial_id: id, ...p })
    for (const tool of t.tools || []) await insert('tools', { tutorial_id: id, ...tool })
    for (const [pid, role] of t.contributors)
      await put('tutorial_contributors', { tutorial_id: id, profile_id: pid, role })
    return id
  }
  const shop = (label, q) => ({ label, url: `https://www.jaycar.com.au/search?text=${encodeURIComponent(q)}` })
  const core = (label, q) => ({ label, url: `https://core-electronics.com.au/catalogsearch/result/?q=${encodeURIComponent(q)}` })
  const solderingTools = [
    { name: 'Soldering iron and solder', buy_links: [shop('Jaycar', 'soldering iron')] },
    { name: 'Wire strippers and flush cutters', buy_links: [shop('Jaycar', 'wire stripper')] },
    { name: 'Hot glue gun' },
    { name: 'Safety glasses' },
  ]

  await guide('lts', {
    title: 'Light Touch Switch',
    description:
      'A small, sensitive switch that needs only a light press, for children who tire quickly or have limited strength. Plugs into any switch-adapted toy with a standard 3.5 mm mono plug. Three printed parts, one tactile switch and a cable; the only tricky step is two solder joints.',
    credit: '© 2024 Neil Squire / Makers Making Change, based on the original design by Kevin Cross (Thingiverse 3211154).',
    repo: 'Light-Touch-Switch',
    licence: 'CERN-OHL-W v2 (hardware), CC BY-SA 4.0 (documentation)',
    difficulty: 'medium',
    kind: 'assistive_tech',
    status: 'approved',
    build_minutes: 45,
    age: [3, 18],
    photos: ['lts_photo'],
    pdf: 'lts_pdf',
    stls: [
      { key: 'lts_base', minutes: 42, grams: 5, material: 'PLA' },
      { key: 'lts_cap', minutes: 27, grams: 3, material: 'PLA' },
    ],
    parts: [
      { name: '12 mm tactile switch', quantity: 1, buy_links: [shop('Jaycar', 'tactile switch 12mm'), core('Core Electronics', 'tactile switch 12mm')] },
      { name: '3.5 mm mono cable, 1.5 m', quantity: 1, buy_links: [shop('Jaycar', '3.5mm mono cable')] },
      { name: 'Heat-shrink tubing', quantity: 1, is_optional: true },
    ],
    tools: solderingTools,
    contributors: [[mei.id, 'primary']],
    reviewed: { by: sarah.id, org: northbank },
  })
  await guide('lps', {
    title: 'Low Profile Switch',
    description:
      'A flat switch that sits almost level with the table, so a hand resting on it can activate it with a small roll of the wrist. Two printed halves snap around a tactile switch. Good first soldering project.',
    credit: 'Designed by Kerilyn Kennedy, Makers Making Change; documentation by Neil Squire / Makers Making Change.',
    repo: 'Low-Profile-Switch',
    licence: 'CERN-OHL-P v2 (hardware), CC BY-SA 4.0 (documentation)',
    difficulty: 'easy',
    kind: 'assistive_tech',
    status: 'approved',
    build_minutes: 40,
    age: [3, 18],
    photos: ['lps_photo', 'lps_photo2'],
    pdf: 'lps_pdf',
    stls: [
      { key: 'lps_top', minutes: 46, grams: 11, material: 'PLA' },
      { key: 'lps_bottom', minutes: 55, grams: 12, material: 'PLA' },
    ],
    parts: [
      { name: '12 mm tactile switch', quantity: 1, buy_links: [shop('Jaycar', 'tactile switch 12mm')] },
      { name: '3.5 mm mono cable', quantity: 1, buy_links: [shop('Jaycar', '3.5mm mono cable')] },
    ],
    tools: solderingTools,
    contributors: [[mei.id, 'primary']],
    reviewed: { by: sarah.id, org: northbank },
  })
  await guide('bubble', {
    title: 'Switch Adapted Bubble Blower',
    description:
      'Adapt a battery bubble machine so a switch can run it. You drill one hole, fit a mono jack and solder two wires across the power button. No printing needed. Bubbles are a great early cause-and-effect toy.',
    credit: 'Toy adaptation by Kerilyn Kennedy, Makers Making Change; documentation by Neil Squire / Makers Making Change.',
    repo: 'Switch-Adapted-Bubble-Blower',
    licence: 'CC BY-SA 4.0',
    difficulty: 'medium',
    kind: 'toy_adaptation',
    status: 'approved',
    build_minutes: 60,
    age: [2, 10],
    photos: ['bubble_photo', 'bubble_photo2'],
    pdf: 'bubble_pdf',
    parts: [
      { name: 'Battery bubble machine', quantity: 1, buy_links: [{ label: 'Big W', url: 'https://www.bigw.com.au/search?text=bubble%20machine' }] },
      { name: '3.5 mm mono panel jack', quantity: 1, buy_links: [shop('Jaycar', '3.5mm mono socket')] },
      { name: 'Hook-up wire, 2 × 8 cm', quantity: 2 },
      { name: 'AA batteries', quantity: 4 },
    ],
    tools: [{ name: 'Drill with 6 mm bit' }, { name: 'Triangle-head screwdriver', is_optional: true }, ...solderingTools],
    contributors: [[mei.id, 'primary']],
    reviewed: { by: sarah.id, org: northbank },
  })
  await guide('book', {
    title: 'One Handed Book Holder',
    description:
      'A thumb ring that holds a paperback open, so a reader with the use of one hand can hold the book and turn pages. One print, no assembly. We are still testing ring sizes for small hands, so treat the sizing as a prototype.',
    credit: 'Design by Mathis (MyMiniFactory 41414); documentation © 2023 Neil Squire / Makers Making Change.',
    repo: 'one-handed-book-holder',
    licence: 'CERN-OHL-P (hardware), CC BY-SA 4.0 (documentation)',
    difficulty: 'easy',
    kind: 'assistive_tech',
    status: 'approved',
    maturity: 'prototype',
    build_minutes: 70,
    age: [6, 18],
    photos: ['book_photo', 'book_photo2'],
    pdf: 'book_pdf',
    stls: [{ key: 'book_stl', minutes: 60, grams: 7, material: 'PLA' }],
    tools: [{ name: 'Deburring tool or fine sandpaper' }],
    contributors: [[mei.id, 'primary']],
    reviewed: { by: sarah.id, org: northbank },
  })
  await guide('rumble', {
    title: 'Rumble Plate Dice Roller',
    description:
      'A switch-activated dice roller for board game night: press the switch and a small motor shakes the dice in a clear cup. Six printed parts, a 130 motor and a battery pack.',
    credit: 'Neil Squire / Makers Making Change.',
    repo: 'Rumble-Plate-Dice-Roller',
    licence: 'CERN-OHL-P',
    difficulty: 'hard',
    kind: 'assistive_tech',
    status: 'pending',
    build_minutes: 120,
    age: [5, 18],
    pdf: 'rumble_pdf',
    stls: [
      { key: 'rumble_base', material: 'PLA' },
      { key: 'rumble_lid', material: 'PLA' },
    ],
    parts: [
      { name: '130-size DC motor', quantity: 1, buy_links: [shop('Jaycar', '130 motor')] },
      { name: '2 × AAA battery holder', quantity: 1 },
      { name: 'Clear plastic cup, 300–600 ml', quantity: 1 },
      { name: 'Dice', quantity: 2 },
    ],
    tools: solderingTools,
    contributors: [[mei.id, 'primary']],
  })
  await guide('sst', {
    title: 'Simple Switch Tester',
    description:
      'A little box with a jack and an LED that tells you whether a switch works before you blame the toy. Handy for anyone adapting in batches.',
    credit: 'Neil Squire / Makers Making Change.',
    repo: 'Simple-Switch-Tester',
    licence: 'CERN-OHL-P (hardware), CC BY-SA 4.0 (documentation)',
    difficulty: 'medium',
    kind: 'assistive_tech',
    status: 'rejected',
    rejection_note:
      'Useful tool! Two things before we publish: the parts list is missing the LED resistor value, and step 6 needs a photo of the jack wiring so nobody reverses it.',
    reviewed: { by: ADMIN },
    build_minutes: 50,
    age: [12, 18],
    photos: ['sst_photo'],
    pdf: 'sst_pdf',
    stls: [
      { key: 'sst_top', material: 'PLA' },
      { key: 'sst_bottom', material: 'PLA' },
    ],
    parts: [
      { name: '3.5 mm mono panel jack', quantity: 1 },
      { name: '5 mm LED', quantity: 1 },
      { name: 'CR2032 coin cell and holder', quantity: 1 },
    ],
    tools: solderingTools,
    contributors: [[mei.id, 'primary']],
  })
  await guide('penguin', {
    title: 'Switch Adapted Penguin',
    description:
      'Adapt the classic stair-climbing penguin toy with a battery interrupter so a switch starts the race. Written up from the design challenge; still a draft.',
    credit: "Documentation by Neil Squire / Makers Making Change, after a video by 'Santa' Jerry Galland.",
    repo: 'Penguin-Switch-Adapted-Toy',
    licence: 'CERN-OHL-P (hardware), CC BY-SA 4.0 (documentation)',
    difficulty: 'easy',
    kind: 'toy_adaptation',
    status: 'draft',
    build_minutes: 45,
    age: [2, 8],
    photos: ['penguin_photo'],
    pdf: 'penguin_pdf',
    contributors: [
      [priya.id, 'primary'],
      [mei.id, 'collaborator'],
    ],
  })
  await put('tutorial_recommendations', [
    { tutorial_id: G.lts, recommended_id: G.lps, position: 1 },
    { tutorial_id: G.lts, recommended_id: G.bubble, position: 2 },
    { tutorial_id: G.bubble, recommended_id: G.lts, position: 1 },
  ])
  await put('tutorial_orgs', [
    { tutorial_id: G.lts, org_id: northbank, status: 'accepted', responded_by: sarah.id },
    { tutorial_id: G.bubble, org_id: northbank, status: 'accepted', responded_by: sarah.id },
    { tutorial_id: G.rumble, org_id: northbank, status: 'accepted', responded_by: sarah.id },
  ])
  log('7 guides with files')

  await db.from('profiles').update({
    public_showcase: true,
    featured_tutorial_id: G.lts,
    bio: 'Mechatronics engineer by day. I started adapting toys for my nephew and now print switches for anyone who asks. Hamilton, NSW.',
  }).eq('id', mei.id)
  await db.from('profiles').update({ public_showcase: false, bio: 'Electrician. Solder, mostly.' }).eq('id', dan.id)
  await db.from('profiles').update({ public_showcase: true, bio: 'Mum of two in Merewether. Arlo loves anything that lights up.' }).eq('id', priya.id)

  // Children
  const arlo = await insert('child_profiles', {
    parent_id: priya.id, name: 'Arlo', age: 6, macs_level: 'III', macs_source: 'manual', bfmf_score: '3', bfmf_source: 'manual',
    hand_involvement: 'unilateral', assist_hand: 'left', challenges: ['Grasping', 'Fine motor', 'Fatigue'], grip_type: 'Palmar',
    env_context: 'Home', palm_width_mm: 58, wrist_circ_mm: 120, hand_dominance: 'Right', sensory_preferences: ['Soft', 'Lightweight'],
  })
  await insert('child_profiles', { parent_id: priya.id, name: 'Zara', age: 3, macs_source: 'estimated', bfmf_source: 'estimated', challenges: ['Coordination'] })
  await insert('child_profiles', {
    parent_id: tom.id, name: 'Ruby', age: 8, macs_level: 'II', macs_source: 'manual', hand_involvement: 'bilateral',
    challenges: ['Strength', 'Holding'], grip_type: 'Cylindrical', env_context: 'School', hand_dominance: 'Left', sensory_preferences: ['Textured'],
  })
  log('3 children', arlo)

  // Toys
  const T = {}
  async function toy(key, row, photos, switchIdx) {
    const id = await insert('toys', { ...row, status: 'draft', photo_urls: [] })
    const urls = []
    for (const p of photos) urls.push(await publicPhoto('toy-photos-library', id, p))
    await update('toys', id, { photo_urls: urls, switch_photo_url: switchIdx == null ? null : urls[switchIdx], status: row.status })
    T[key] = id
  }
  await toy('penguin', { owner_id: tom.id, name: 'Switch-adapted racing penguins', description: 'The stair-climbing penguin set with a mono jack fitted. Ruby has outgrown it. All five penguins, slide works.', condition: 8, switch_adapted: true, offer_type: 'donation', status: 'published' }, ['penguin_photo', 'penguin_jack'], 1)
  await toy('bubble', { owner_id: tom.id, name: 'Adapted bubble machine', description: 'Adapted using the guide on here. Needs 4 AA. Comes with a big red switch.', condition: 7, switch_adapted: true, offer_type: 'donation', status: 'published' }, ['bubble_photo', 'bubble_photo2'], 0)
  await toy('star', { owner_id: tom.id, name: 'Star projector night light', description: 'Projects stars on the ceiling. Not adapted yet but the button is big and easy.', condition: 9, switch_adapted: false, offer_type: 'exchange', status: 'published' }, ['lps_photo2'])
  await toy('spinner', { owner_org_id: northbank, quantity: 3, name: 'Light-up spinning top (adapted)', description: 'Three of these on the club shelf, each with a Light Touch Switch included.', condition: 10, switch_adapted: true, offer_type: 'both', status: 'published' }, ['lts_photo'], 0)
  await toy('mat', { owner_id: priya.id, name: 'Musical floor mat', description: 'Piano mat, eight keys, works on batteries. Arlo prefers switches now.', condition: 6, switch_adapted: false, offer_type: 'both', status: 'published' }, ['bubble_photo2'])
  await toy('meiDraft', { owner_id: mei.id, name: 'Adapted plush puppy (in progress)', description: 'Still fitting the jack.', condition: 9, switch_adapted: true, offer_type: 'donation', status: 'draft' }, [])
  log('6 toys')

  // Printers
  const printers = {
    mei: await insert('printers', { owner_id: mei.id, name: 'Prusa MK4', materials: ['PLA', 'PETG'], bed_x: 250, bed_y: 210, bed_z: 220, suburb: 'Hamilton', state: 'NSW', accepting: true, capacity: 3, notes: 'Weeknights only. I can do colours if you bring the filament.', filament_cents_per_g: 6, rate_note: 'Filament at cost. No charge for my time.' }),
    dan: await insert('printers', { owner_id: dan.id, name: 'Ender 3 S1', materials: ['PLA'], bed_x: 220, bed_y: 220, bed_z: 270, suburb: 'Coorparoo', state: 'QLD', accepting: false, capacity: 1, notes: 'Down for a new hotend until next month.' }),
    northbank: await insert('printers', { owner_org_id: northbank, name: 'Bambu Lab X1 Carbon #1', materials: ['PLA', 'PETG', 'TPU'], bed_x: 256, bed_y: 256, bed_z: 256, suburb: 'Callaghan', state: 'NSW', accepting: true, capacity: 5, notes: 'Club printer. Jobs are picked up on Wednesday nights.', filament_cents_per_g: 5, rate_note: 'At cost.' }),
  }
  log('3 printers')

  // Events
  const buildDayQ = [
    { position: 1, prompt: "Child's first name (so we can label the toy)", answer_type: 'short', required: true },
    { position: 2, prompt: 'Anything we should know about how they use a switch?', answer_type: 'paragraph', required: false },
    { position: 3, prompt: 'How many people are coming?', answer_type: 'number', required: true },
    { position: 4, prompt: 'Which switch would you like to build?', answer_type: 'choice', required: true, options: ['Light Touch Switch', 'Low Profile Switch', 'Not sure yet'] },
    { position: 5, prompt: 'Happy to be in photos?', answer_type: 'boolean', required: false },
  ]
  const E = {}
  const event = async (key, row, questions = []) => {
    E[key] = await insert('org_events', { created_by: row.org_id === mensShed ? hamish.id : sarah.id, ...row })
    for (const q of questions) {
      const { data } = await db.from('org_event_questions').insert({ event_id: E[key], ...q }).select('id, position').single()
      E[`${key}Q${q.position}`] = data.id
    }
  }
  const lab = await publicPhoto('toy-photos', northbank, 'bubble_photo2')
  await event('buildDay', {
    org_id: northbank, title: 'Term 4 switch toy build day', kind: 'build_day', format: 'in_person', status: 'published',
    summary: 'Build a switch and adapt a toy for your child, with a student helper at every bench.',
    description: 'Bring your child\'s favourite battery toy, or take one from our shelf. We supply switches, jacks and solder. Kids welcome; there is a quiet room.',
    starts_at: days(18), ends_at: days(18.25), location: 'Makerspace, Building ES, University Drive', suburb: 'Callaghan', state: 'NSW',
    capacity: 20, prints_parts: true, part_sets_max: 30, what_to_bring: 'A battery toy, and its batteries', tools: ['Soldering iron', 'Hot glue gun'],
    accessibility_note: 'Step-free entry from the car park. Accessible toilet on the same floor.', cost_cents: 1500, cost_note: 'Covers parts. Waived if it is a stretch, just ask.',
    photo_urls: [lab],
  }, buildDayQ)
  await event('workshop', {
    org_id: northbank, title: 'Intro to switch adapting (online)', kind: 'workshop', format: 'online', status: 'published',
    summary: 'An hour on Zoom: how switch adapting works and what to buy.', starts_at: days(9), ends_at: days(9.04),
    online_url: 'https://example.org/zoom/switch-intro', capacity: 100,
  })
  await event('past', {
    org_id: northbank, title: 'Term 3 build day', kind: 'build_day', format: 'in_person', status: 'published',
    summary: 'Twenty-two toys adapted in one afternoon.', starts_at: days(-40), ends_at: days(-39.75),
    location: 'Makerspace, Building ES', suburb: 'Callaghan', state: 'NSW', capacity: 25,
  })
  await event('openDay', {
    org_id: mensShed, title: 'Shed open day: try before you take', kind: 'open_day', format: 'in_person', status: 'published',
    summary: 'Come and try adapted toys and switch mounts. Tea and biscuits.', starts_at: days(12), ends_at: days(12.2),
    location: '40 Halstead Street', suburb: 'Coorparoo', state: 'QLD', capacity: 1,
  })
  await event('draft', {
    org_id: northbank, title: 'Summer print day (draft)', kind: 'print_day', format: 'in_person', status: 'draft',
    summary: 'Printing switch parts in bulk over the break.', starts_at: days(70), ends_at: days(70.3), location: 'Makerspace', suburb: 'Callaghan', state: 'NSW',
  })
  await event('cancelled', {
    org_id: mensShed, title: 'Soldering basics morning', kind: 'workshop', format: 'in_person', status: 'published',
    summary: 'Cancelled: the hall is being painted.', starts_at: days(25), ends_at: days(25.15), location: '40 Halstead Street', suburb: 'Coorparoo', state: 'QLD',
    cancelled_at: days(-2),
  })
  log('6 events')

  // Stories
  const storyPhoto = await publicPhoto('toy-photos', northbank, 'lts_photo')
  await insert('org_stories', {
    org_id: northbank, kind: 'family', status: 'published', featured: true, consent_confirmed: true, published_at: days(-8), created_by: sarah.id,
    title: 'Arlo’s first switch', byline: 'Priya, Arlo’s mum',
    summary: 'A light touch switch and a spinning top: the first toy Arlo could start on his own.',
    body: 'Arlo has always loved things that light up, but buttons on toys are small and stiff. At the Term 3 build day a student helped us print and solder a Light Touch Switch. Now he taps it with the side of his hand and the top spins. He laughs every single time.',
    pull_quote: 'He laughs every single time.', pull_quote_by: 'Priya', link_tutorial_id: G.lts, photo_urls: [storyPhoto],
  })
  await insert('org_stories', {
    org_id: northbank, kind: 'maker', status: 'published', consent_confirmed: true, published_at: days(-20), created_by: sarah.id,
    title: 'Meet Mei, who prints switches on weeknights', byline: 'Northbank Makerspace',
    summary: 'An engineer with a Prusa and a list of families waiting.',
    body: 'Mei started adapting toys for her nephew. Two years on she has written three guides on SPLAT and prints parts for anyone within an hour of Hamilton.',
  })
  await insert('org_stories', {
    org_id: mensShed, kind: 'org_update', status: 'published', consent_confirmed: true, published_at: days(-35), created_by: hamish.id,
    title: 'Forty toys and counting', byline: "Coorparoo Men's Shed",
    summary: 'Our batch-adapting bench passed forty toys this month.',
    body: 'We changed to batches of ten in winter and it doubled what we get through. Thanks to everyone who dropped off toys.',
  })
  await insert('org_stories', {
    org_id: null, kind: 'announcement', status: 'published', consent_confirmed: true, published_at: days(-3), created_by: sarah.id,
    title: 'Print jobs are live', byline: 'SPLAT Connect',
    summary: 'Families can now ask a nearby printer for the parts in any guide.',
    body: 'Open a guide with printable parts and choose "Get it printed". Makers set their own rates; most print at cost.',
  })
  await insert('org_stories', {
    org_id: northbank, kind: 'family', status: 'draft', consent_confirmed: false, created_by: sarah.id,
    title: 'Ruby and the penguins (draft)', byline: 'Tom', summary: 'Waiting on Tom to approve the photos.', body: 'Draft.',
  })
  log('5 stories')

  // Recycling
  const drop = (row) => insert('recycling_dropoffs', { condition_declared: true, declaration_version: 'v1-2026-09', ...row })
  await drop({ org_id: northbank, contributor_id: priya.id, material: 'PLA', estimated_grams: 400, status: 'booked', note: 'Failed prints from the build day.' })
  await drop({ org_id: northbank, contributor_id: dan.id, material: 'PETG', estimated_grams: 1200, status: 'received', weighed_grams: 1150, credit_grams: 1000, decided_by: sarah.id, note: 'Two spools of offcuts.' })
  await drop({ org_id: mensShed, contributor_id: tom.id, material: 'PLA', estimated_grams: 300, status: 'declined', decided_by: hamish.id, note: 'Mixed with supports.' })
  await drop({ org_id: mensShed, contributor_id: priya.id, material: 'PLA', estimated_grams: 200, status: 'cancelled' })
  log('4 recycling drop-offs')

  // Challenges
  const I = {
    pending: await insert('toy_ideas', { author_id: priya.id, status: 'pending', title: 'Switch-operated crayon holder', summary: 'Arlo can hold a switch but not a crayon.', description: 'Something that holds a thick crayon and lets him draw by moving his whole arm, maybe with a cuff.', intended_use: 'Drawing at the kitchen table', primary_user: 'Arlo, 6, palmar grasp' }),
    active: await insert('toy_ideas', { author_id: priya.id, status: 'challenge', title: 'A page turner for picture books', summary: 'Turn a board-book page with one switch press.', description: 'Bedtime stories where Arlo turns the page himself. Board books first; paperbacks would be a bonus.', intended_use: 'Bedtime reading', primary_user: 'Arlo, 6' }),
    rejected: await insert('toy_ideas', { author_id: tom.id, status: 'rejected', review_note: 'This one needs mains power inside the toy, which we cannot publish safely.', title: 'Adapted ride-on car', summary: 'Switch control for a 12V ride-on.', description: 'Replace the pedal with a switch.', intended_use: 'Backyard', primary_user: 'Ruby, 8' }),
    graduated: await insert('toy_ideas', { author_id: priya.id, status: 'graduated', tutorial_id: G.penguin, title: 'Switch start for the racing penguins', summary: 'Let Zara start the penguin race.', description: 'The penguin toy has a tiny slide switch. A battery interrupter might do it.', intended_use: 'Play with her brother', primary_user: 'Zara, 3' }),
  }
  log('4 challenges')

  // Admin queues
  await insert('contact_messages', { topic: 'safety', name: 'Priya Nair', email: CAST.priya.email, sender_id: priya.id, status: 'open', body: 'The bubble machine guide says 4 AA but ours got warm near the jack after twenty minutes. Is that normal?' })
  await insert('contact_messages', { topic: 'organisation', name: 'Karen Liu', email: 'karen.liu@example.org', status: 'replied', handled_by: ADMIN, handled_at: days(-4), body: 'Our library would like to host a build day. Who do we talk to?' })
  await insert('contact_messages', { topic: 'other', name: 'Sam', email: 'sam@example.org', status: 'closed', handled_by: ADMIN, handled_at: days(-10), body: 'Love the site, that is all!' })
  await insert('member_reports', { reporter_id: priya.id, subject_kind: 'toy', subject_label: 'Adapted bubble machine', subject_id: T.bubble, category: 'safety', status: 'new', ok_to_contact: true, body: 'Jack gets warm after long use. Flagging in case others have the same machine.' })
  await insert('member_reports', { reporter_id: tom.id, subject_kind: 'person', subject_label: 'A requester on a past exchange', category: 'no_show', status: 'looking', handled_by: ADMIN, handled_at: days(-1), ok_to_contact: true, body: 'Waited 40 minutes at the agreed spot, no message.' })
  await insert('member_reports', { reporter_id: dan.id, subject_kind: 'guide', subject_label: 'Simple Switch Tester', subject_id: G.sst, category: 'wrong_info', status: 'resolved', handled_by: ADMIN, handled_at: days(-6), note_to_reporter: 'Thanks, sent back to the author to fix.', body: 'LED resistor value is missing.' })
  log('3 contact messages, 3 member reports')

  // Saves
  for (const [entity_type, entity_id] of [['tutorial', G.lts], ['toy', T.penguin], ['challenge', I.active], ['organisation', northbank]])
    await put('saves', { profile_id: priya.id, entity_type, entity_id })

  return { ADMIN, northbank, mensShed, littleSteps, G, T, E, I, printers }
}

// ── Phase B: the API, as each person ────────────────────────────────────────
async function phaseB(P, S) {
  const { priya, tom, mei, dan, sarah, hamish } = P
  const { G, T, E, I, printers, northbank, mensShed } = S
  for (const u of Object.values(P)) await signIn(u)
  const pickup = (k) => HOME[k]
  const X = {}

  // Collaboration, backing, thanks
  await api(mei, 'POST', `/tutorials/${G.lps}/collaborators/invite`, { email: dan.email })
  const inv1 = (await db.from('tutorial_collaborator_invites').select('id').eq('tutorial_id', G.lps).eq('invited_profile_id', dan.id).single()).data
  await api(dan, 'POST', `/collaborators/invites/${inv1.id}/accept`)
  await api(mei, 'POST', `/tutorials/${G.sst}/collaborators/invite`, { email: dan.email })
  // Backing can only be asked before publication (007's insert policy).
  await api(priya, 'POST', `/tutorials/${G.penguin}/orgs`, { org_id: northbank })
  await api(mei, 'POST', `/tutorials/${G.rumble}/orgs`, { org_id: mensShed })
  await api(hamish, 'POST', `/tutorials/${G.rumble}/orgs/${mensShed}/decline`)
  await api(priya, 'POST', `/tutorials/${G.lts}/thanks`)
  await api(tom, 'POST', `/tutorials/${G.lts}/thanks`)
  log('invites, backing, thanks')

  // Exchanges
  X.penguin = await newTx(priya, '/toy-transactions', { toy_id: T.penguin, type: 'donation' })

  X.bubble = await newTx(priya, '/toy-transactions', { toy_id: T.bubble, type: 'donation' })
  await api(tom, 'POST', `/toy-transactions/${X.bubble}/accept`, pickup('tom'))
  await api(priya, 'POST', `/toy-transactions/${X.bubble}/messages`, { body: 'Thank you so much! Is Saturday morning OK?' })
  await api(tom, 'POST', `/toy-transactions/${X.bubble}/messages`, { body: 'Saturday 10am works. I’ll throw in fresh batteries.' })
  const cost = await api(tom, 'POST', `/exchange-costs/${X.bubble}`, { description: 'Four AA batteries', amount_cents: 895 })
  await api(tom, 'PATCH', `/exchange-costs/${cost.id}/settle`, { settled: true })
  const rf = new FormData()
  rf.append('file', new File([receiptPdf(['Woolworths Lambton', 'Energizer AA x4        $8.95', 'Paid card', '2026-03-07'])], 'receipt.pdf', { type: 'application/pdf' }))
  const receipt = await api(priya, 'POST', `/exchange-costs/${X.bubble}/receipt`, rf)
  await api(priya, 'PUT', `/exchange-costs/${X.bubble}/settlement`, {
    method: 'Bank transfer', note: 'Paid Tom back on the day.', receipt_path: receipt?.receipt_path ?? receipt?.path,
  })
  await confirm(tom, X.bubble, 'owner')

  X.star = await newTx(priya, '/toy-transactions', { toy_id: T.star, type: 'exchange', offered_toy_id: T.mat })
  await api(tom, 'POST', `/toy-transactions/${X.star}/reject`, { reason: 'Sorry, Ruby decided she wants to keep it after all.' })

  X.mat = await newTx(tom, '/toy-transactions', { toy_id: T.mat, type: 'exchange', offered_toy_id: T.star })
  await api(priya, 'POST', `/toy-transactions/${X.mat}/accept`, pickup('priya'))
  await api(priya, 'POST', `/exchange-costs/${X.mat}`, { description: 'Postage to Lambton', amount_cents: 1250 })
  await api(priya, 'POST', `/exchange-costs/${X.mat}`, { description: 'New batteries (on me)', amount_cents: 0, claiming: false })
  await api(tom, 'POST', `/toy-transactions/${X.mat}/messages`, { body: 'Swapping the projector for the mat. Posted mine today.' })
  await confirm(tom, X.mat, 'requester')

  X.spinWithdrawn = await newTx(priya, '/toy-transactions', { toy_id: T.spinner, type: 'donation' })
  await api(sarah, 'POST', `/toy-transactions/${X.spinWithdrawn}/accept`, {})
  await api(priya, 'POST', `/toy-transactions/${X.spinWithdrawn}/withdraw`)
  X.spinner = await newTx(priya, '/toy-transactions', { toy_id: T.spinner, type: 'donation' })
  await api(sarah, 'POST', `/toy-transactions/${X.spinner}/accept`, {})
  await api(sarah, 'POST', `/toy-transactions/${X.spinner}/messages`, { body: 'Pick it up any Wednesday night. Bring the code.' })
  log('6 exchanges')

  // Builds
  X.buildDone = await newTx(priya, '/toy-transactions/build', { tutorial_id: G.bubble, maker_id: mei.id, build_brief: 'Could you adapt a bubble machine for Arlo? He uses a big button switch already.', child_label: 'Arlo, 6', requester_suburb: 'Merewether' })
  await api(mei, 'POST', `/toy-transactions/${X.buildDone}/accept`, pickup('mei'))
  await api(mei, 'POST', `/toy-transactions/${X.buildDone}/working-shot`, await photoForm('bubble_photo'))
  await api(priya, 'POST', `/toy-transactions/${X.buildDone}/approve-work`)
  await confirm(mei, X.buildDone, 'owner')
  await confirm(priya, X.buildDone, 'requester')

  X.buildShot = await newTx(priya, '/toy-transactions/build', { tutorial_id: G.lps, maker_id: mei.id, build_brief: 'A flat switch Arlo can roll his wrist onto, for the iPad switch interface at school.', child_label: 'Arlo, 6', requester_suburb: 'Merewether', urgency: 'Before school holidays' })
  await api(mei, 'POST', `/toy-transactions/${X.buildShot}/accept`, pickup('mei'))
  await api(mei, 'POST', `/exchange-costs/${X.buildShot}`, { description: 'Tactile switch and mono cable', amount_cents: 1290 })
  await api(mei, 'POST', `/toy-transactions/${X.buildShot}/working-shot`, await photoForm('lps_photo'))

  X.buildOpen = await newTx(priya, '/toy-transactions/build', { tutorial_id: G.lts, build_brief: 'A second Light Touch Switch for Arlo’s classroom. Happy to pay for parts.', child_label: 'Arlo, 6', requester_suburb: 'Merewether', travel_km: 15, urgency: 'Within a month', family_has_toy: true })
  X.buildSilent = await newTx(tom, '/toy-transactions/build', { tutorial_id: G.bubble, build_brief: 'Bubble machine for Ruby’s class, switch on a long lead.', child_label: 'Ruby, 8', requester_suburb: 'Lambton', travel_km: 40 })
  await api(dan, 'POST', `/toy-transactions/${X.buildSilent}/claim`)
  X.buildOrg = await newTx(priya, '/toy-transactions/build', { tutorial_id: G.lts, maker_org_id: northbank, build_brief: 'Could the club build one for Zara too? She is 3.', child_label: 'Zara, 3', requester_suburb: 'Merewether' })
  log('5 builds')

  // Print jobs
  const stl = async (tid) => (await db.from('stl_files').select('id').eq('tutorial_id', tid)).data.map((r) => r.id)
  const ltsFiles = await stl(G.lts)
  const lpsFiles = await stl(G.lps)
  const bookFiles = await stl(G.book)
  // One request to two printers (074): waiting on both, first to accept takes it.
  X.printRequested = await newTx(priya, '/toy-transactions/print', { printer_ids: [printers.mei, printers.northbank], tutorial_id: G.lts, stl_file_ids: ltsFiles, colour: 'Blue', delivery: 'collect', note: 'For the classroom switch — any shade of blue is fine.' })
  X.printStalled = await newTx(tom, '/toy-transactions/print', { printer_id: printers.mei, tutorial_id: G.lts, stl_file_ids: ltsFiles })
  await api(mei, 'POST', `/toy-transactions/${X.printStalled}/accept`, pickup('mei'))
  await api(mei, 'POST', `/toy-transactions/${X.printStalled}/print-started`)
  X.printRejected = await newTx(priya, '/toy-transactions/print', { printer_id: printers.mei, tutorial_id: G.book, stl_file_ids: bookFiles })
  await api(mei, 'POST', `/toy-transactions/${X.printRejected}/reject`, { reason: 'That ring is sized for adults. Let me test a smaller one first.' })
  X.printReady = await newTx(priya, '/toy-transactions/print', { printer_id: printers.northbank, tutorial_id: G.lps, stl_file_ids: lpsFiles })
  await api(sarah, 'POST', `/toy-transactions/${X.printReady}/accept`, {})
  await api(sarah, 'POST', `/toy-transactions/${X.printReady}/print-started`)
  await api(sarah, 'POST', `/toy-transactions/${X.printReady}/print-ready`, await photoForm('lps_photo2'))
  X.printDone = await newTx(tom, '/toy-transactions/print', { printer_id: printers.northbank, tutorial_id: G.lps, stl_file_ids: lpsFiles })
  await api(sarah, 'POST', `/toy-transactions/${X.printDone}/accept`, {})
  await api(sarah, 'POST', `/toy-transactions/${X.printDone}/print-started`)
  await api(sarah, 'POST', `/toy-transactions/${X.printDone}/print-ready`, await photoForm('lps_photo'))
  await confirm(sarah, X.printDone, 'owner')
  await confirm(tom, X.printDone, 'requester')
  X.eventParts = await newTx(tom, '/toy-transactions/print-at-event', { event_id: E.buildDay, tutorial_id: G.lts, stl_file_ids: ltsFiles, part_sets: 2, note: 'Two sets so Ruby has a spare.' })
  log('6 print jobs')

  // Registrations
  const answers = (childName, n, choice, photos) => ({
    [E.buildDayQ1]: childName, [E.buildDayQ2]: 'Uses the side of his hand; light presses only.', [E.buildDayQ3]: n,
    [E.buildDayQ4]: choice, [E.buildDayQ5]: photos,
  })
  await api(priya, 'POST', `/events/${E.buildDay}/registrations`, { name: priya.name, email: priya.email, cost_acknowledged: true, answers: answers('Arlo', 3, 'Light Touch Switch', true) })
  await api(tom, 'POST', `/events/${E.buildDay}/registrations`, { name: tom.name, email: tom.email, cost_acknowledged: true, answers: answers('Ruby', 2, 'Not sure yet', false) })
  await api(priya, 'POST', `/events/${E.workshop}/registrations`, { name: priya.name, email: priya.email })
  await api(tom, 'POST', `/events/${E.openDay}/registrations`, { name: tom.name, email: tom.email })
  await put('org_event_registrations', { event_id: E.past, user_id: priya.id, name: priya.name, email: priya.email })
  await update('org_events', E.workshop, { registrations_closed_at: days(-1) })
  log('registrations')

  // Challenge membership
  for (const u of [mei, tom, dan]) await api(u, 'POST', `/ideas/${I.active}/join`)
  await api(priya, 'POST', `/ideas/${I.active}/messages`, { body: 'Thanks for joining! Board books are the main thing, thick pages.' })
  await api(mei, 'POST', `/ideas/${I.active}/messages`, { body: 'A servo arm with a foam pad might work. I can print a test rig this week.' })
  await api(tom, 'POST', `/ideas/${I.active}/messages`, { body: 'Ruby would use this too. Happy to test.' })
  await api(priya, 'DELETE', `/ideas/${I.active}/participants/${dan.id}`)
  log('challenge thread')

  return X
}

// ── Phase C: time ───────────────────────────────────────────────────────────
async function phaseC(P, S, X) {
  const at = (n) => days(-n)
  const set = (id, patch) => update('toy_transactions', id, patch)
  await set(X.buildOpen, { created_at: at(15), updated_at: at(15) })
  await set(X.buildSilent, { created_at: at(20), updated_at: at(11) })
  await set(X.printStalled, { created_at: at(14), updated_at: at(11), printing_started_at: at(11) })
  // The impact chart plots completions by month — spread them.
  await set(X.bubble, { created_at: at(215), updated_at: at(200), owner_confirmed_at: at(200) })
  await set(X.buildDone, { created_at: at(120), updated_at: at(95), owner_confirmed_at: at(95), requester_confirmed_at: at(95), work_approved_at: at(97) })
  await set(X.printDone, { created_at: at(40), updated_at: at(30), owner_confirmed_at: at(30), requester_confirmed_at: at(30), ready_at: at(32), printing_started_at: at(33) })
  await set(X.star, { created_at: at(25), updated_at: at(24) })
  await set(X.spinWithdrawn, { created_at: at(18), updated_at: at(16) })

  // Notifications the API has no path to write here: review outcomes come from
  // an admin, whose account this seeder never signs in as.
  const { priya, tom, mei, sarah } = P
  const n = (recipient_id, type, extra) => ({ recipient_id, type, actor_name: 'SPLAT', tutorial_id: null, tutorial_title: '', toy_transaction_id: null, toy_name: null, idea_id: null, ...extra })
  const { data: rows, error } = await db.from('notifications').insert([
    n(mei.id, 'tutorial_approved', { tutorial_id: S.G.lts, tutorial_title: 'Light Touch Switch' }),
    n(mei.id, 'tutorial_rejected', { tutorial_id: S.G.sst, tutorial_title: 'Simple Switch Tester' }),
    n(sarah.id, 'tutorial_submitted', { tutorial_id: S.G.rumble, tutorial_title: 'Rumble Plate Dice Roller', actor_name: 'Mei Chen' }),
    n(priya.id, 'idea_approved', { idea_id: S.I.active }),
    n(priya.id, 'idea_graduated', { idea_id: S.I.graduated }),
    n(tom.id, 'idea_rejected', { idea_id: S.I.rejected }),
  ]).select('id')
  if (error) throw new Error(`notifications: ${error.message}`)
  rows.forEach((r) => track('notifications', r.id))

  // Read and unread both render: mark every other notification read, oldest first.
  for (const u of Object.values(P)) {
    const { data } = await db.from('notifications').select('id').eq('recipient_id', u.id).order('created_at')
    const read = (data || []).filter((_, i) => i % 2 === 0).map((r) => r.id)
    if (read.length) await db.from('notifications').update({ read_at: at(1) }).in('id', read)
  }
  log('backdated, notifications mixed')
}

// ── removal ─────────────────────────────────────────────────────────────────
async function remove() {
  const m = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { users: {}, rows: [], storage: [] }
  // Fall back to the emails when the manifest is gone.
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 })
  const emails = new Set(Object.values(CAST).map((c) => c.email))
  const userIds = [...new Set([...Object.values(m.users).map((u) => u.id), ...list.users.filter((u) => emails.has(u.email)).map((u) => u.id)])]
  if (!userIds.length) return console.log('Nothing to remove.')
  const ids = (table) => m.rows.filter((r) => r.table === table).map((r) => r.id)
  const { data: led } = await db.from('org_leaders').select('org_id').in('user_id', userIds)
  const orgIds = [...new Set([...ids('organizations'), ...(led || []).map((r) => r.org_id)])]
  const or = [`requester_id.in.(${userIds})`, `owner_id.in.(${userIds})`, ...(orgIds.length ? [`owner_org_id.in.(${orgIds})`] : [])].join(',')
  const { data: txs } = await db.from('toy_transactions').select('id').or(or)
  const txIds = (txs || []).map((t) => t.id)
  const del = async (table, col, values) => {
    if (!values.length) return
    const { error } = await db.from(table).delete().in(col, values)
    if (error) console.warn(`  ${table}: ${error.message}`)
  }
  await del('print_job_files', 'transaction_id', txIds)
  await del('toy_transactions', 'id', txIds)
  await del('toy_idea_messages', 'sender_id', userIds)
  const { data: authored } = await db.from('tutorial_contributors').select('tutorial_id').in('profile_id', userIds).eq('role', 'primary')
  await del('tutorials', 'id', [...new Set([...ids('tutorials'), ...(authored || []).map((r) => r.tutorial_id)])])
  await del('printers', 'id', ids('printers'))
  await del('org_events', 'org_id', orgIds)
  await del('org_stories', 'id', ids('org_stories'))
  await del('contact_messages', 'id', ids('contact_messages'))
  await del('organizations', 'id', orgIds)
  const byBucket = {}
  for (const s of m.storage) (byBucket[s.bucket] ||= []).push(s.path)
  for (const [bucket, paths] of Object.entries(byBucket)) {
    for (let i = 0; i < paths.length; i += 100) await db.storage.from(bucket).remove(paths.slice(i, i + 100))
  }
  // Receipts, working shots and print shots were uploaded by the API, under the transaction's id.
  for (const bucket of ['exchange-receipts', 'build-shots', 'print-shots']) {
    for (const t of txIds) {
      const { data: objs } = await db.storage.from(bucket).list(t)
      if (objs?.length) await db.storage.from(bucket).remove(objs.map((o) => `${t}/${o.name}`))
    }
  }
  for (const id of userIds) {
    const { error } = await db.auth.admin.deleteUser(id)
    if (error) console.warn(`  user ${id}: ${error.message}`)
  }
  if (fs.existsSync(MANIFEST)) fs.unlinkSync(MANIFEST)
  console.log(`Removed ${userIds.length} accounts, ${txIds.length} transactions, ${orgIds.length} organisations.`)
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  if (process.argv.includes('--remove')) return remove()

  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 })
  const taken = list.users.filter((u) => Object.values(CAST).some((c) => c.email === u.email))
  if (taken.length) throw new Error(`Seed accounts already exist (${taken.map((u) => u.email).join(', ')}). Run with --remove first.`)
  const health = await fetch(`${API}/health`).catch(() => null)
  if (!health?.ok) throw new Error(`API not reachable at ${API} — run pnpm dev:api first.`)

  manifest.password = `Splat-demo-${crypto.randomBytes(4).toString('hex')}`
  save()
  const P = Object.fromEntries(Object.entries(CAST).map(([k, v]) => [k, { ...v }]))
  const S = await phaseA(P)
  const X = await phaseB(P, S)
  await phaseC(P, S, X)
  manifest.ids = { orgs: { northbank: S.northbank, mensShed: S.mensShed, littleSteps: S.littleSteps }, tutorials: S.G, toys: S.T, events: S.E, ideas: S.I, printers: S.printers, transactions: X }
  save()
  console.log(`\nDone. Password for all six: ${manifest.password}`)
  for (const u of Object.values(P)) console.log(`  ${u.name.padEnd(16)} ${u.email}`)
}

main().catch((e) => {
  console.error('\n✗', e.message)
  console.error('  Partial seed is recorded in manifest.json; run with --remove to clear it.')
  process.exit(1)
})
