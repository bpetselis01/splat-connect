/**
 * A Sydney demo cast for the Map tab, on top of seed.js's cast: nine real
 * Sydney organisations at their public addresses, invented families and
 * makers, toys built from real open designs (Makers Making Change, and
 * Thingiverse by link only), events, printers, drop-offs and exchanges in
 * flight. Byron chose real organisations (2026-10-05); each one's description
 * says it is a demo listing, not affiliated. Nothing here was given by them.
 *
 *   node scripts/seed-demo/sydney.js           seed (refuses if the cast exists)
 *   node scripts/seed-demo/sydney.js --remove  take it all back out
 *
 * Ids go to sydney-manifest.json (gitignored) as they are made, so a run that
 * dies halfway is still removable. Exchanges go through the API on :3101, as
 * seed.js does.
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const S = require('./seed.js')

const MANIFEST = path.join(__dirname, 'sydney-manifest.json')
const { db, days, log, insert, update, publicPhoto, signIn, api, newTx } = S

// ── people: invented, on Byron's own inboxes (never bpetselis01) ───────────
const CAST = {
  lena: { email: 'splat.general+syd-lead1@gmail.com', name: 'Lena Moreau', job: 'Community programs coordinator' },
  raj: { email: 'splat.general+syd-lead2@gmail.com', name: 'Raj Patel', job: 'Occupational therapist' },
  grace: { email: 'splat.general+syd-lead3@gmail.com', name: 'Grace Okafor', job: 'Librarian' },
  amira: { email: 'petselisbyron+syd-amira@gmail.com', name: 'Amira Haddad', job: 'Nurse' },
  ben: { email: 'petselisbyron+syd-ben@gmail.com', name: 'Ben Fraser', job: 'Builder' },
  sofia: { email: 'fettmoose+syd-sofia@gmail.com', name: 'Sofia Russo', job: 'Graphic designer' },
  kenji: { email: 'fettmoose+syd-kenji@gmail.com', name: 'Kenji Watanabe', job: 'Software engineer' },
}
// Where the families and makers live: suburb is what the map shows, never the street.
const HOME = {
  amira: { pickup_line1: '12 Livingstone Road', pickup_suburb: 'Marrickville', pickup_state: 'NSW', pickup_postcode: '2204' },
  ben: { pickup_line1: '40 Church Street', pickup_suburb: 'Parramatta', pickup_state: 'NSW', pickup_postcode: '2150' },
  sofia: { pickup_line1: '9 Gould Street', pickup_suburb: 'Bondi Beach', pickup_state: 'NSW', pickup_postcode: '2026' },
  kenji: { pickup_line1: '3 Victoria Avenue', pickup_suburb: 'Chatswood', pickup_state: 'NSW', pickup_postcode: '2067' },
}

// ── real organisations, public addresses (sources in the commit message) ───
const NOT_AFFILIATED = (name) => `Demo listing on SPLAT Connect for testing. Not affiliated with or endorsed by ${name}.`
const ORGS = {
  freedom: { leader: 'raj', name: 'Freedom Solutions (formerly TADNSW)', line1: 'Unit 10, 185 Briens Road', suburb: 'Northmead', postcode: '2152', kind: 'Assistive technology charity', blurb: 'Volunteer engineers building custom assistive devices.' },
  leichhardtShed: { leader: 'lena', name: "Leichhardt Community Men's Shed", line1: 'Building B703 South Crescent, Callan Park, Balmain Road', suburb: 'Lilyfield', postcode: '2039', kind: "Men's shed", blurb: 'Woodwork and electronics benches at Callan Park.', takes: ['PLA', 'PETG'] },
  marrickvilleShed: { leader: 'lena', name: "Marrickville Men's Shed", line1: '107 Redfern Street', suburb: 'Marrickville', postcode: '2204', kind: "Men's shed", blurb: 'Thursday sessions, tools and tea.', takes: ['PLA'] },
  parramattaLib: { leader: 'grace', name: 'Parramatta Library', line1: '5 Parramatta Square', suburb: 'Parramatta', postcode: '2150', kind: 'Public library', blurb: '3D printing workshops and a maker space.', printer: true },
  darlingSqLib: { leader: 'grace', name: 'Darling Square Library', line1: '1 Little Pier Street', suburb: 'Haymarket', postcode: '2000', kind: 'Public library', blurb: 'Makerspace with 3D printers and a laser cutter.', printer: true },
  cpa: { leader: 'raj', name: 'Cerebral Palsy Alliance', line1: '187 Allambie Road', suburb: 'Allambie Heights', postcode: '2100', kind: 'Disability service', blurb: 'Therapy and switch-adapted toy workshops.' },
  robodino: { leader: 'lena', name: 'Robots & Dinosaurs', line1: 'Unit 10, 27 Bank Street', suburb: 'Meadowbank', postcode: '2114', kind: 'Hackerspace', blurb: "Sydney's community hackerspace.", printer: true, takes: ['PLA', 'PETG', 'TPU'] },
  northcott: { leader: 'raj', name: 'Northcott', line1: '1 Fennell Street', suburb: 'North Parramatta', postcode: '2151', kind: 'Disability service', blurb: 'Disability support across NSW.' },
  waverleyShed: { leader: 'lena', name: "Waverley Community Men's Shed", line1: '125 Birrell Street', suburb: 'Waverley', postcode: '2024', kind: "Men's shed", blurb: 'In the grounds of the War Memorial Hospital.', takes: ['PLA'] },
}

// ── designs: Thingiverse by link and credit only (its robots.txt disallows downloads) ──
const THING = (id, by) => `\n\nBuilt from "${by.title}" by ${by.designer} on Thingiverse (https://www.thingiverse.com/thing:${id}), used under the licence listed there.`
const MMC = '\n\nBased on an open design from Makers Making Change (Neil Squire Society).'

let manifest
const track = (key, u) => {
  manifest.users[key] = { id: u.id, email: u.email }
  S.save()
}

async function seed() {
  const P = Object.fromEntries(Object.entries(CAST).map(([k, v]) => [k, { ...v }]))
  for (const [key, u] of Object.entries(P)) {
    const { data, error } = await db.auth.admin.createUser({ email: u.email, password: manifest.password, email_confirm: true, user_metadata: { name: u.name } })
    if (error) throw new Error(`createUser ${u.email}: ${error.message}`)
    u.id = data.user.id
    track(key, u)
    await db.from('profiles').update({ name: u.name, role: 'contributor', occupation: u.job, ...(HOME[key] || {}) }).eq('id', u.id)
    const terms = ['contributor_terms', ...(['lena', 'raj', 'grace'].includes(key) ? ['org_leader_terms'] : [])]
    for (const t of terms) {
      const { error: e } = await db.from('user_agreements').insert({ user_id: u.id, agreement_type: t, version: 'v0-todo' })
      if (e && e.code !== '23505') throw new Error(`terms: ${e.message}`)
    }
  }
  log(`${Object.keys(P).length} accounts`)

  const O = {}
  for (const [key, o] of Object.entries(ORGS)) {
    O[key] = await insert('organizations', {
      name: o.name,
      description: `${o.blurb} ${NOT_AFFILIATED(o.name)}`,
      status: 'active',
      created_by: P[o.leader].id,
      kind: o.kind,
      suburb: o.suburb,
      state: 'NSW',
      pickup_line1: o.line1,
      pickup_suburb: o.suburb,
      pickup_state: 'NSW',
      pickup_postcode: o.postcode,
      capabilities: [...(o.printer ? ['Has a printer'] : []), ...(o.takes ? ['Takes recycling'] : []), 'Holds toys'],
      ...(o.takes ? { recycling_materials: o.takes, recycling_forms: ['Offcuts', 'Failed prints'], recycling_min_kg: 2, recycling_gives: 'credit' } : {}),
    })
    await db.from('org_leaders').insert({ org_id: O[key], user_id: P[o.leader].id })
  }
  log(`${Object.keys(O).length} organisations`)

  // Printers: three organisations' and two people's.
  for (const key of ['parramattaLib', 'darlingSqLib', 'robodino']) {
    const o = ORGS[key]
    await insert('printers', { owner_org_id: O[key], name: key === 'robodino' ? 'Prusa XL' : 'Bambu Lab P1S', materials: key === 'robodino' ? ['PLA', 'PETG', 'TPU'] : ['PLA'], bed_x: 256, bed_y: 256, bed_z: 256, suburb: o.suburb, state: 'NSW', postcode: o.postcode, accepting: true, capacity: 3, filament_cents_per_g: 5, rate_note: 'At cost.' })
  }
  await insert('printers', { owner_id: P.kenji.id, name: 'Bambu Lab A1 mini', materials: ['PLA', 'PETG'], bed_x: 180, bed_y: 180, bed_z: 180, suburb: 'Chatswood', state: 'NSW', postcode: '2067', accepting: true, capacity: 2, notes: 'Evenings and weekends.' })
  await insert('printers', { owner_id: P.sofia.id, name: 'Prusa MK4S', materials: ['PLA'], bed_x: 250, bed_y: 210, bed_z: 220, suburb: 'Bondi Beach', state: 'NSW', postcode: '2026', accepting: true, capacity: 1 })
  log('5 printers')

  // Events, upcoming, in person at each host's own address.
  const event = (key, leader, title, kind, inDays, summary) =>
    insert('org_events', {
      org_id: O[key], created_by: P[leader].id, title, kind, format: 'in_person', status: 'published', summary,
      starts_at: days(inDays), ends_at: days(inDays + 0.15), location: ORGS[key].line1, suburb: ORGS[key].suburb, state: 'NSW', capacity: 20,
    })
  await event('robodino', 'lena', 'Switch toy build night', 'build_day', 6, 'Bring a battery toy; leave with it switch-adapted.')
  await event('parramattaLib', 'grace', 'Intro to 3D printing switch parts', 'workshop', 10, 'Print a Light Touch Switch cap and take it home.')
  await event('cpa', 'raj', 'Switch-adapted toy workshop for families', 'workshop', 15, 'Therapists and volunteers adapt toys alongside families.')
  await event('marrickvilleShed', 'lena', 'Shed open morning: try adapted toys', 'open_day', 4, 'Try toys and switch mounts before you take one home.')
  await event('darlingSqLib', 'grace', 'Makerspace print day', 'print_day', 21, 'Bulk-printing switch parts for families on the waitlist.')
  log('5 events')

  // Toys: organisations' and families', with real open designs' photos.
  const T = {}
  async function toy(key, row, photo) {
    const id = await insert('toys', { ...row, status: 'draft', photo_urls: [] })
    const url = await publicPhoto('toy-photos-library', id, photo)
    await update('toys', id, { photo_urls: [url], status: 'published' })
    T[key] = id
  }
  await toy('jackBox', { owner_org_id: O.freedom, quantity: 2, name: 'Jack-in-the-box with switch turner', description: 'A motor turns the handle when the switch is pressed.' + THING(2653588, { title: 'Jack in the Box Turner for Assistive Switch Users', designer: 'atmakers' }), condition: 9, switch_adapted: true, offer_type: 'donation' }, 'sst_photo')
  await toy('cpaPenguins', { owner_org_id: O.cpa, quantity: 3, name: 'Switch-adapted racing penguins', description: 'From our toy workshop shelf. Mono jack fitted.' + MMC, condition: 10, switch_adapted: true, offer_type: 'donation' }, 'penguin_photo')
  await toy('northcottBubbles', { owner_org_id: O.northcott, quantity: 2, name: 'Adapted bubble blower', description: 'Big switch included. Needs 4 AA.' + MMC, condition: 9, switch_adapted: true, offer_type: 'donation' }, 'bubble_photo')
  await toy('shedMount', { owner_org_id: O.waverleyShed, quantity: 4, name: 'Suction-cup switch mount', description: 'Holds a switch on a table or tray without drilling.' + THING(3538797, { title: 'Suction-Cup Switch Mount', designer: 'Volksswitch' }), condition: 10, switch_adapted: false, offer_type: 'donation' }, 'lps_photo2')
  await toy('amiraBook', { owner_id: P.amira.id, name: 'One-handed book holder', description: 'Our daughter has moved on to a tablet stand.' + MMC, condition: 8, switch_adapted: false, offer_type: 'both' }, 'book_photo')
  await toy('amiraSwitch', { owner_id: P.amira.id, name: 'Light Touch Switch (spare)', description: 'Printed two, only need one.' + MMC, condition: 10, switch_adapted: true, offer_type: 'donation' }, 'lts_photo')
  await toy('benMount', { owner_id: P.ben.id, name: 'Camera-mount switch arm', description: 'Fits any tripod or desk clamp.' + THING(2061248, { title: '3 Inch AT Switch Camera Mount', designer: 'atmakers' }), condition: 9, switch_adapted: false, offer_type: 'exchange' }, 'lps_photo')
  await toy('sofiaSwitch', { owner_id: P.sofia.id, name: 'Simple adaptive switch', description: 'Tactile-switch build, quiet click.' + THING(6931675, { title: 'Simple Adaptive Switch', designer: 'twinarcher' }), condition: 9, switch_adapted: true, offer_type: 'donation' }, 'sst_photo')
  await toy('kenjiPenguins', { owner_id: P.kenji.id, name: 'Racing penguins (adapted)', description: 'Our son outgrew them. All five penguins.' + MMC, condition: 7, switch_adapted: true, offer_type: 'donation' }, 'penguin_jack')
  await toy('benBubbles', { owner_id: P.ben.id, name: 'Bubble machine, not adapted yet', description: 'Big easy button. Happy to swap.', condition: 8, switch_adapted: false, offer_type: 'exchange' }, 'bubble_photo2')
  log(`${Object.keys(T).length} toys`)

  // Exchanges in flight, through the API as the people.
  for (const u of Object.values(P)) await signIn(u)
  const t1 = await newTx(P.amira, '/toy-transactions', { toy_id: T.cpaPenguins, type: 'donation' })
  await api(P.raj, 'POST', `/toy-transactions/${t1}/accept`, {})
  await api(P.raj, 'POST', `/toy-transactions/${t1}/messages`, { body: 'Pick them up any weekday. Ask at reception.' })
  await newTx(P.sofia, '/toy-transactions', { toy_id: T.jackBox, type: 'donation' })
  const t3 = await newTx(P.kenji, '/toy-transactions', { toy_id: T.amiraSwitch, type: 'donation' })
  await api(P.amira, 'POST', `/toy-transactions/${t3}/accept`, HOME.amira)
  await newTx(P.amira, '/toy-transactions', { toy_id: T.benMount, type: 'exchange', offered_toy_id: T.amiraBook })
  log('4 exchanges')
}

async function remove() {
  const m = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { users: {}, rows: [], storage: [] }
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 })
  const emails = new Set(Object.values(CAST).map((c) => c.email))
  const userIds = [...new Set([...Object.values(m.users).map((u) => u.id), ...list.users.filter((u) => emails.has(u.email)).map((u) => u.id)])]
  if (!userIds.length) return console.log('Nothing to remove.')
  const ids = (table) => m.rows.filter((r) => r.table === table).map((r) => r.id)
  const orgIds = ids('organizations')
  const or = [`requester_id.in.(${userIds})`, `owner_id.in.(${userIds})`, ...(orgIds.length ? [`owner_org_id.in.(${orgIds})`] : [])].join(',')
  const txIds = ((await db.from('toy_transactions').select('id').or(or)).data || []).map((t) => t.id)
  const del = async (table, col, values) => {
    if (!values.length) return
    const { error } = await db.from(table).delete().in(col, values)
    if (error) console.warn(`  ${table}: ${error.message}`)
  }
  await del('toy_transactions', 'id', txIds)
  await del('toys', 'id', ids('toys'))
  await del('printers', 'id', ids('printers'))
  await del('org_events', 'id', ids('org_events'))
  await del('organizations', 'id', orgIds)
  const paths = m.storage.filter((s) => s.bucket === 'toy-photos-library').map((s) => s.path)
  for (let i = 0; i < paths.length; i += 100) await db.storage.from('toy-photos-library').remove(paths.slice(i, i + 100))
  for (const id of userIds) {
    const { error } = await db.auth.admin.deleteUser(id)
    if (error) console.warn(`  user ${id}: ${error.message}`)
  }
  if (fs.existsSync(MANIFEST)) fs.unlinkSync(MANIFEST)
  console.log(`Removed ${userIds.length} accounts, ${txIds.length} transactions, ${orgIds.length} organisations.`)
}

async function main() {
  manifest = S.useManifest(MANIFEST)
  if (process.argv.includes('--remove')) return remove()
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 })
  const taken = list.users.filter((u) => Object.values(CAST).some((c) => c.email === u.email))
  if (taken.length) throw new Error(`Sydney accounts already exist (${taken.map((u) => u.email).join(', ')}). Run with --remove first.`)
  const health = await fetch(`${S.API}/health`).catch(() => null)
  if (!health?.ok) throw new Error(`API not reachable at ${S.API} — run pnpm dev:api first.`)
  manifest.password = `Splat-syd-${crypto.randomBytes(4).toString('hex')}`
  S.save()
  await seed()
  console.log(`\nDone. Password for all ${Object.keys(CAST).length}: ${manifest.password}`)
  for (const u of Object.values(CAST)) console.log(`  ${u.name.padEnd(16)} ${u.email}`)
}

main().catch((e) => {
  console.error('\n✗', e.message)
  console.error('  Partial seed is recorded in sydney-manifest.json; run with --remove to clear it.')
  process.exit(1)
})
