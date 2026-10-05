/**
 * The guide library, reset and reseeded (sub-project E of the guide overhaul,
 * spec docs/superpowers/specs/2026-10-05-guide-tags-design.md).
 *
 *   node scripts/seed-demo/guides.js --reset   delete EVERY guide and child profile on the
 *                                              project, and what only exists because of them
 *   node scripts/seed-demo/guides.js           seed 10 guides and 6 children
 *   node scripts/seed-demo/guides.js --remove  take this seed back out
 *
 * Ten real open designs (Makers Making Change, credited, files downloaded at
 * seed time) with invented people, chosen so every filter has something to
 * find: each of the four child questions, Device type, difficulty, build time
 * and printable parts vary across them. Every guide fills every section a
 * guide page draws — photos with captions, steps with tips and minutes, parts
 * with buy links and prices, tools with how to get them, files and print
 * settings, safety, the toy, who it's for, the closing line, picks with one
 * Required first, backing, community notes (pinned, missing step, open, with a
 * photo), builds, thanks and views — so the UI and the API are exercised on
 * real-shaped data. The six children answer the same four questions, so
 * Recommended has something to rank.
 *
 * Rows go in with the service role and are tracked in guides-manifest.json
 * (gitignored). Uses the demo cast from seed.js and sydney.js; both must have
 * been seeded first.
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const S = require('./seed.js')
const { db, days, log, useManifest, insert, put, update, file, upload } = S

const MANIFEST = path.join(__dirname, 'guides-manifest.json')
const CAST = require('./manifest.json')
const SYD = fs.existsSync(path.join(__dirname, 'sydney-manifest.json')) ? require('./sydney-manifest.json') : { users: {} }
const who = (k) => (CAST.users[k] || SYD.users[k]).id
const ORG = CAST.ids.orgs

// ── reset ───────────────────────────────────────────────────────────────────
async function removeFolder(bucket, prefix) {
  const { data } = await db.storage.from(bucket).list(prefix, { limit: 1000 })
  const files = []
  for (const f of data || []) {
    if (f.id) files.push(`${prefix}/${f.name}`)
    else files.push(...(await removeFolder(bucket, `${prefix}/${f.name}`)))
  }
  if (files.length) await db.storage.from(bucket).remove(files)
  return files
}

async function reset() {
  const { data: guides, error } = await db.from('tutorials').select('id, title')
  if (error) throw new Error(error.message)
  const ids = guides.map((g) => g.id)
  log(`resetting ${ids.length} guides`)
  // A print or build job holds its guide with ON DELETE RESTRICT; the job
  // exists only because of the guide, so it goes first (its messages, costs,
  // files and questions cascade with it).
  const tx = await db.from('toy_transactions').delete().not('tutorial_id', 'is', null).select('id')
  if (tx.error) throw new Error(`toy_transactions: ${tx.error.message}`)
  log(`${tx.data.length} print and build jobs`)
  // Saves and toy picks name a guide by id with no foreign key.
  await db.from('saves').delete().eq('entity_type', 'tutorial')
  await db.from('toy_picks').delete().eq('entity_type', 'tutorial')
  for (let i = 0; i < ids.length; i += 50) {
    const { error: e } = await db.from('tutorials').delete().in('id', ids.slice(i, i + 50))
    if (e) throw new Error(`tutorials: ${e.message}`)
  }
  let files = 0
  for (const id of ids) for (const bucket of ['toy-photos', 'tutorial-pdfs', 'stl-files']) files += (await removeFolder(bucket, id)).length
  log(`${ids.length} guides deleted, ${files} files removed`)
  const kids = await db.from('child_profiles').delete().not('id', 'is', null).select('id')
  if (kids.error) throw new Error(`child_profiles: ${kids.error.message}`)
  log(`${kids.data.length} child profiles deleted`)
  if (fs.existsSync(MANIFEST)) fs.unlinkSync(MANIFEST)
}

// ── remove (this seed only) ─────────────────────────────────────────────────
async function remove() {
  if (!fs.existsSync(MANIFEST)) return log('nothing to remove')
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  for (const r of [...m.rows].reverse()) await db.from(r.table).delete().eq('id', r.id)
  const byBucket = {}
  for (const s of m.storage) (byBucket[s.bucket] ||= []).push(s.path)
  for (const [b, paths] of Object.entries(byBucket)) await db.storage.from(b).remove(paths)
  fs.unlinkSync(MANIFEST)
  log(`removed ${m.rows.length} rows and ${m.storage.length} files`)
}

// ── content ─────────────────────────────────────────────────────────────────
const jaycar = (q) => ({ label: 'Jaycar', url: `https://www.jaycar.com.au/search?text=${encodeURIComponent(q)}` })
const core = (q) => ({ label: 'Core Electronics', url: `https://core-electronics.com.au/catalogsearch/result/?q=${encodeURIComponent(q)}` })
const bunnings = (q) => ({ label: 'Bunnings', url: `https://www.bunnings.com.au/search/products?q=${encodeURIComponent(q)}` })
const kmart = (q) => ({ label: 'Kmart', url: `https://www.kmart.com.au/search/?searchTerm=${encodeURIComponent(q)}` })
const SOLDER = [
  { name: 'Soldering iron and solder', get_by: 'buy', note: 'A 40–60 W iron with a fine tip is plenty.', buy_links: [jaycar('soldering iron'), core('soldering iron')] },
  { name: 'Wire strippers and flush cutters', get_by: 'buy', note: 'Flush cutters also clean printed supports.', buy_links: [jaycar('wire stripper')] },
  { name: 'Hot glue gun', get_by: 'borrow', note: 'Any craft glue gun; a makerspace will lend one.', buy_links: [kmart('glue gun')] },
  { name: 'Safety glasses', get_by: 'buy', note: 'Leads fly when you clip them.', buy_links: [bunnings('safety glasses')] },
]
const credit = (g) =>
  `\n\nBased on an open design from Makers Making Change (Neil Squire Society): ${g.repo}. Licence: ${g.licence}. Source: https://github.com/makersmakingchange/${g.repo}`

/**
 * The ten guides. `photos`, `stls` and `pdf` are keys into sources.json.
 * `tags` are the 128 columns; `stepPhotos` maps a step index to a photo key.
 */
const GUIDES = [
  {
    key: 'lts', title: 'Light Touch Switch', kind: 'assistive_tech', difficulty: 'easy', build: 45, age: [2, 12],
    repo: 'Light-Touch-Switch', licence: 'CC BY-SA 4.0',
    description: 'A small, sensitive switch that needs only a light press, for children who tire quickly or have limited strength. It plugs into any switch-adapted toy with a standard 3.5 mm mono plug. Three printed parts, one tactile switch and a cable; the only tricky part is two solder joints.',
    photos: ['lts_photo', 'lps_photo'], captions: ['The finished switch', 'Sized against a hand'],
    pdf: 'lts_pdf', stls: [{ key: 'lts_base', minutes: 55, grams: 14, material: 'PLA' }, { key: 'lts_cap', minutes: 20, grams: 4, material: 'PLA' }],
    print: { layer_height_mm: 0.2, infill_percent: 20, material: 'PLA', print_minutes: 75 },
    tags: { device_types: ['switch'], helps_with: ['moving'], access: ['press', 'touch', 'head'], one_hand: true, press_force: ['very_light', 'light'], play: ['light', 'sound'] },
    steps: [
      { title: 'Prepare the prints and the switch', body: 'Remove the support material from the button cap with needle-nose pliers. Flush-cut the leads off one side of the tactile switch and straighten the other two.', tip: 'Wear safety glasses when clipping leads.', minutes: 10 },
      { title: 'Strip the cable', body: 'Cut the mono cable in half. Strip 2 cm of the outer jacket, then 1.5 cm from each inner wire, keeping the two wires apart.', minutes: 5 },
      { title: 'Solder the leads', body: 'Hold the switch in the jig and solder one wire to each lead. Test it with a switch tester or a toy you know works: it should run only while pressed.', tip: 'The iron is 350 °C. Rest it in its stand between joints.', minutes: 15 },
      { title: 'Glue and close', body: 'Hot-glue the switch flat in the recess of the base, fill around the cable, slide the cap on and push the pin home.', tip: 'Let the glue cool before you touch it.', minutes: 15 },
    ],
    stepPhotos: { 3: 'lts_photo' },
    parts: [
      { name: '12 mm tactile switch', quantity: 1, is_optional: false, price_cents: 120, buy_links: [jaycar('tactile switch 12mm'), core('tactile switch 12mm')] },
      { name: '3.5 mm mono cable, 1.5 m', quantity: 1, is_optional: false, price_cents: 450, buy_links: [jaycar('3.5mm mono cable')] },
      { name: 'Hot glue stick', quantity: 2, is_optional: false, price_cents: 80, buy_links: [kmart('glue sticks')] },
      { name: 'Non-slip pad', quantity: 1, is_optional: true, price_cents: 300, buy_links: [bunnings('non slip pad')] },
    ],
    tools: SOLDER,
    safety: [['Keep loose switches away from under-3s', 'The bare tactile switch is a choking-size part until it is glued in.'], ['Solder in a ventilated room', 'Open a window; flux fumes irritate.']],
    done: 'Plug it into the Switch Adapted Bubble Blower and let them press. A light tap is all it takes.',
    authors: [['mei', 'primary'], ['dan', 'collaborator']], backing: ['northbank'],
  },
  {
    key: 'bubble', title: 'Switch Adapted Bubble Blower', kind: 'toy_adaptation', difficulty: 'medium', build: 60, age: [1, 10],
    repo: 'Switch-Adapted-Bubble-Blower', licence: 'CC BY-SA 4.0',
    description: 'A battery bubble machine that a switch can run. You drill one hole, fit a mono jack and solder two wires across the power button. No printing needed. Bubbles are a great early cause-and-effect toy, and they are calming to watch.',
    photos: ['bubble_photo', 'bubble_photo2'], captions: ['Running from a switch', 'Everything you need'],
    pdf: 'bubble_pdf', stls: [], print: {},
    tags: { device_types: ['adapted_toy', 'sensory'], helps_with: ['moving', 'calm'], access: ['press', 'watch'], press_force: ['light', 'moderate', 'full'], play: ['water', 'move', 'calm'] },
    toy: { toy_name: 'Battery bubble machine', toy_brand: 'Gazillion', works_with: 'Any 3.5 mm mono switch — the Light Touch Switch is the easy one to press.', no_build_note: 'Not a builder? Ask a maker nearby from this page; most of them have done this one.' },
    steps: [
      { title: 'Open the battery bay', body: 'Remove the batteries, then the four screws holding the base. Lift the base off and find the two wires going to the power button.', minutes: 5 },
      { title: 'Drill for the jack', body: 'Mark a spot on the back away from the fan and drill a 6 mm hole. Deburr it with a larger bit turned by hand.', tip: 'Clamp the base; a drill bit can grab soft plastic and spin it.', minutes: 10 },
      { title: 'Wire the jack across the button', body: 'Solder one jack wire to each of the button\'s two wires, so the jack closes the circuit just like pressing the button.', minutes: 20 },
      { title: 'Test and close', body: 'Plug in a switch and fill the bubble tray. A press should start the fan; letting go should stop it. Refit the base.', minutes: 10 },
    ],
    stepPhotos: { 3: 'bubble_photo' },
    parts: [
      { name: 'Bubble machine', quantity: 1, is_optional: false, price_cents: 2500, buy_links: [kmart('bubble machine')] },
      { name: '3.5 mm mono panel jack', quantity: 1, is_optional: false, price_cents: 350, buy_links: [jaycar('3.5mm mono socket')] },
      { name: 'Hook-up wire', quantity: 1, is_optional: false, price_cents: 600, buy_links: [jaycar('hook up wire')] },
      { name: 'Bubble mixture, 1 L', quantity: 2, is_optional: false, price_cents: null, buy_links: [kmart('bubble mixture')] },
    ],
    tools: [...SOLDER.slice(0, 2), { name: 'Drill and 6 mm bit', get_by: 'borrow', note: 'Any cordless drill.', buy_links: [bunnings('6mm drill bit')] }],
    safety: [['Keep the battery screws in', 'The battery door must need a screwdriver to open.'], ['Bubble mixture is slippery', 'Run it on a tray or outdoors.']],
    done: 'Fill the tray, plug in the switch and step back. The first bubbles always get a laugh.',
    authors: [['mei', 'primary']], backing: ['northbank'],
  },
  {
    key: 'book', title: 'One Handed Book Holder', kind: 'assistive_tech', difficulty: 'easy', build: 20, age: [5, 18],
    repo: 'one-handed-book-holder', licence: 'CC BY-SA 4.0',
    description: 'A thumb ring that holds a paperback open, so a reader with the use of one hand can hold the book and turn pages. One print, no assembly. Good for school readers and bedtime stories.',
    photos: ['book_photo', 'book_photo2'], captions: ['Holding a paperback open', 'The ring on its own'],
    pdf: 'book_pdf', stls: [{ key: 'book_stl', minutes: 35, grams: 9, material: 'PETG' }],
    print: { layer_height_mm: 0.2, infill_percent: 30, material: 'PETG', print_minutes: 35 },
    tags: { device_types: ['learning', 'daily_living'], helps_with: ['moving', 'learning'], access: ['grasp'], one_hand: true, press_force: [], play: ['calm', 'pretend'] },
    steps: [
      { title: 'Print the ring', body: 'Print flat on the bed, no supports. PETG flexes without snapping when it is pushed onto a thick book.', minutes: 5 },
      { title: 'Size it to the reader', body: 'Try it on the reader\'s thumb. If it is loose, reprint at 90 %; if it pinches, at 110 %.', tip: 'Measure a small hand before printing; most children need 90 %.', minutes: 10 },
      { title: 'Smooth the edges', body: 'Sand any sharp edge where the ring meets the paddles until it is smooth to the touch.', minutes: 5 },
    ],
    stepPhotos: { 0: 'book_photo2' },
    parts: [{ name: 'PETG filament (about 9 g)', quantity: 1, is_optional: false, price_cents: 40, buy_links: [core('PETG filament')] }],
    tools: [{ name: 'Fine sandpaper', get_by: 'substitute', note: 'A nail file does the same job.', buy_links: [bunnings('sandpaper 240')] }],
    safety: [['No sharp edges', 'Run a finger round every edge before handing it over.']],
    done: 'Slide a book in, thumb through the ring, and read the first page together.',
    authors: [['mei', 'primary']], backing: [],
  },
  {
    key: 'rumble', title: 'Rumble Plate Dice Roller', kind: 'assistive_tech', difficulty: 'hard', build: 150, age: [4, 16],
    repo: 'Rumble-Plate-Dice-Roller', licence: 'CC BY-SA 4.0',
    description: 'A switch-activated dice roller for board game night: press the switch and a motor shakes the dice in a clear cup. The rumble can be felt through the table, so a child who is Deaf or hard of hearing feels the roll as well as seeing it. Six printed parts, a 130 motor and a battery pack.',
    // The source repo has no photos: the switch it pairs with, and a switch toy on games night.
    photos: ['lps_photo2', 'penguin_photo'], captions: ['The switch it pairs with', 'Another switch toy on games night'],
    pdf: 'rumble_pdf', stls: [{ key: 'rumble_base', minutes: 180, grams: 62, material: 'PLA' }, { key: 'rumble_lid', minutes: 60, grams: 18, material: 'PLA' }],
    print: { layer_height_mm: 0.2, infill_percent: 25, material: 'PLA', print_minutes: 240 },
    tags: { device_types: ['adapted_toy', 'hearing'], helps_with: ['moving', 'hearing', 'seeing'], access: ['press', 'head', 'foot'], press_force: ['moderate', 'full'], play: ['sound', 'move', 'build'] },
    steps: [
      { title: 'Print the base and lid', body: 'Print the base upside down with supports only under the motor bay. The lid prints flat.', minutes: 10 },
      { title: 'Fit the motor and weight', body: 'Press the motor into its bay and push the offset weight onto the shaft until it sits flush.', tip: 'A wobbly weight shakes the motor loose; glue it once it is centred.', minutes: 20 },
      { title: 'Wire the battery pack and jack', body: 'Solder the battery pack and the mono jack in series with the motor, so the switch completes the circuit.', minutes: 40 },
      { title: 'Seal the battery door', body: 'Fit the battery pack in its compartment and close it with the M3 screw.', tip: 'The screw is the child-safety lock; do not leave it out.', minutes: 10 },
      { title: 'Test a roll', body: 'Put two dice in the cup, fit the lid and press the switch for two seconds. The dice should tumble and settle.', minutes: 10 },
    ],
    stepPhotos: { 4: 'lps_photo2' },
    parts: [
      { name: '130 DC motor', quantity: 1, is_optional: false, price_cents: 350, buy_links: [jaycar('130 motor'), core('130 motor')] },
      { name: '2 × AA battery holder with switch', quantity: 1, is_optional: false, price_cents: 290, buy_links: [jaycar('2 x AA battery holder')] },
      { name: '3.5 mm mono panel jack', quantity: 1, is_optional: false, price_cents: 350, buy_links: [jaycar('3.5mm mono socket')] },
      { name: 'M3 × 10 screw', quantity: 2, is_optional: false, price_cents: 50, buy_links: [bunnings('m3 screw')] },
      { name: 'Clear plastic cup', quantity: 1, is_optional: true, price_cents: 200, buy_links: [kmart('clear cup')] },
    ],
    tools: [...SOLDER, { name: 'Small Phillips screwdriver', get_by: 'buy', note: 'For the battery door screw.', buy_links: [bunnings('screwdriver set')] }],
    safety: [['Battery door needs a tool', 'The M3 screw keeps AA cells away from small hands.'], ['Dice are small parts', 'Use large foam dice for children under 3.'], ['Motor gets warm', 'Do not run it for more than a minute at a time.']],
    done: 'Set up your favourite board game and hand over the switch. They roll for everyone.',
    authors: [['dan', 'primary'], ['mei', 'collaborator']], backing: ['mensShed'],
  },
  {
    key: 'mount', title: 'Switch Mounting Plate', kind: 'assistive_tech', difficulty: 'medium', build: 50, age: [2, 18],
    repo: '@mounting', licence: 'CERN-OHL-W v2 (hardware), CC BY-SA 4.0 (docs)',
    description: 'A printed plate that holds an assistive switch and bolts onto standard GoPro-style mounts, so a switch can be clamped to a wheelchair, a tray or a table arm and placed exactly where a child\'s press naturally lands — hand, head or knee.',
    photos: ['@mounting:0', '@mounting:1'], captions: ['A switch on its plate', 'Fitted to a GoPro arm'],
    pdf: '@mounting', stls: '@mounting', print: { layer_height_mm: 0.2, infill_percent: 40, material: 'PETG', print_minutes: 95 },
    tags: { device_types: ['mounting', 'tablet'], helps_with: ['moving', 'daily'], access: ['press', 'head', 'foot', 'touch'], press_force: ['light', 'moderate', 'full'], play: [] },
    steps: [
      { title: 'Print the plate', body: 'Print the plate in PETG at 40 % infill, flat side down; it takes the load of every press.', minutes: 5 },
      { title: 'Fit the switch', body: 'Seat the switch in the plate and fix it with the two screws from underneath.', minutes: 10 },
      { title: 'Attach the GoPro arm', body: 'Bolt the plate to a GoPro-style arm with the thumb screw, then clamp the arm to the tray or wheelchair frame.', tip: 'Tighten the clamp on a rubber pad so it cannot slip on smooth tubing.', minutes: 15 },
      { title: 'Place it with the child', body: 'Sit the child in their usual position and move the switch a centimetre at a time until a press is easy and repeatable.', tip: 'Ask the child\'s OT to help with placement the first time.', minutes: 20 },
    ],
    stepPhotos: { 2: '@mounting:1' },
    parts: [
      { name: 'GoPro-style articulating arm and clamp', quantity: 1, is_optional: false, price_cents: 2200, buy_links: [jaycar('gopro mount clamp')] },
      { name: 'M3 × 12 screw', quantity: 2, is_optional: false, price_cents: 60, buy_links: [bunnings('m3 screw')] },
      { name: 'Rubber pad for the clamp', quantity: 1, is_optional: true, price_cents: 200, buy_links: [bunnings('rubber pad')] },
    ],
    tools: [{ name: 'Small Phillips screwdriver', get_by: 'buy', note: 'For the switch screws.', buy_links: [bunnings('screwdriver set')] }, { name: 'Spanner', get_by: 'borrow', note: 'Only if your clamp uses a nut.', buy_links: [bunnings('adjustable wrench')] }],
    safety: [['Check the clamp before every use', 'A loose mount can swing into a child.'], ['No pinch points', 'Keep fingers clear of the arm joints while tightening.']],
    done: 'Sit beside them and try a few presses. When it lands every time, mark the arm position with tape.',
    authors: [['hamish', 'primary']], backing: ['mensShed'],
  },
  {
    key: 'joystick', title: 'Analog Thumbstick for the Xbox Adaptive Controller', kind: 'assistive_tech', difficulty: 'hard', build: 120, age: [6, 18],
    repo: '@controller', licence: 'CERN-OHL-P (hardware), CC BY-SA 4.0 (docs)',
    description: 'A small, low-force analog joystick with a U-shaped topper that plugs into the Xbox Adaptive Controller through 3.5 mm jacks. Kids with limited hand strength can steer and play console games with the whole family.',
    photos: ['@controller:0', '@controller:1'], captions: ['The thumbstick', 'With its U-shaped topper'],
    pdf: '@controller', stls: '@controller', print: { layer_height_mm: 0.2, infill_percent: 25, material: 'PLA', print_minutes: 210 },
    tags: { device_types: ['controller'], helps_with: ['moving'], access: ['grasp', 'touch', 'press'], press_force: ['very_light', 'light'], play: ['move', 'build'] },
    steps: [
      { title: 'Print the case and topper', body: 'Print the case halves and the topper. The topper prints best with a brim.', minutes: 10 },
      { title: 'Solder the thumbstick module', body: 'Solder the thumbstick module\'s two axes to the two 3.5 mm stereo cables as in the wiring diagram.', tip: 'Label each cable X and Y before closing the case.', minutes: 50 },
      { title: 'Close the case', body: 'Seat the module, route the cables through the strain relief and screw the case shut.', minutes: 20 },
      { title: 'Plug in and map', body: 'Plug the cables into the Xbox Adaptive Controller\'s left stick jacks and check the direction in the controller settings.', minutes: 40 },
    ],
    stepPhotos: { 3: '@controller:1' },
    parts: [
      { name: 'Analog thumbstick module', quantity: 1, is_optional: false, price_cents: 650, buy_links: [jaycar('joystick module'), core('analog joystick')] },
      { name: '3.5 mm stereo cable', quantity: 2, is_optional: false, price_cents: 900, buy_links: [jaycar('3.5mm stereo cable')] },
      { name: 'M2 screws', quantity: 4, is_optional: false, price_cents: 120, buy_links: [core('m2 screw')] },
      { name: 'Xbox Adaptive Controller', quantity: 1, is_optional: false, price_cents: null, buy_links: [] },
    ],
    tools: SOLDER,
    safety: [['No mains anywhere', 'It is powered by the controller only.'], ['Keep cables tidy', 'Route cables away from the child\'s neck.']],
    done: 'Pick a slow game first and let them drive. Turn the stick sensitivity down in settings if moves feel too quick.',
    authors: [['dan', 'primary']], backing: [],
  },
  {
    key: 'aac', title: '3D Core Vocabulary Symbols', kind: 'assistive_tech', difficulty: 'medium', build: 60, age: [2, 14],
    repo: '@communication', licence: 'CC BY 4.0 (models), CC BY-SA 4.0 (docs)',
    description: 'Printable tactile symbols for the core words children use most — go, stop, more, want — colour-coded by word type. A child who uses AAC, or who is blind or has low vision, can touch, find and combine words to say what they mean.',
    photos: ['@communication:0', '@communication:1'], captions: ['A set of core symbols', 'Colour-coded by word type'],
    pdf: '@communication', stls: '@communication', print: { layer_height_mm: 0.2, infill_percent: 20, material: 'PLA', print_minutes: 180 },
    tags: { device_types: ['communication', 'vision'], helps_with: ['communicating', 'seeing', 'learning'], access: ['touch', 'grasp', 'eyes'], one_hand: true, press_force: [], play: ['pretend', 'build'] },
    steps: [
      { title: 'Pick the first words', body: 'Start with six to ten words the child already wants to say: more, stop, go, help, mine, all done.', minutes: 10 },
      { title: 'Print by colour', body: 'Print each word type in its colour (verbs green, pronouns yellow) so the colour helps too.', tip: 'Print one test symbol first and check the raised shape is crisp.', minutes: 10 },
      { title: 'Mount on a board', body: 'Stick each symbol to a board or a ring with hook-and-loop dots so they can be swapped as the child learns.', minutes: 20 },
      { title: 'Model it every day', body: 'Touch the symbol yourself as you say the word in play, many times, without asking the child to copy.', minutes: 20 },
    ],
    stepPhotos: { 2: '@communication:1' },
    parts: [
      { name: 'PLA in four colours (about 80 g)', quantity: 1, is_optional: false, price_cents: 400, buy_links: [core('PLA filament')] },
      { name: 'Hook-and-loop dots', quantity: 1, is_optional: false, price_cents: 650, buy_links: [bunnings('velcro dots')] },
      { name: 'Foam board', quantity: 1, is_optional: true, price_cents: 500, buy_links: [kmart('foam board')] },
    ],
    tools: [{ name: 'Scissors', get_by: 'substitute', note: 'Anything that cuts the dots.', buy_links: [] }],
    safety: [['Symbols are larger than a choke tube', 'Keep any small test prints away from under-3s.'], ['Wipeable', 'PLA wipes clean with warm soapy water.']],
    done: 'Use it in a game straight away: "more" bubbles, "stop" bubbles. Words that work get used.',
    authors: [['tom', 'primary'], ['priya', 'collaborator']], backing: ['northbank'],
  },
  {
    key: 'vision', title: 'Tactile Route Map', kind: 'assistive_tech', difficulty: 'easy', build: 40, age: [6, 18],
    repo: '@vision', licence: 'CERN-OHL-P (hardware), CC BY-SA 4.0 (docs)',
    description: 'Glue-together tactile map pieces — crossings, intersections, bus stops, roundabouts — so a child who is blind or has low vision can feel the route to school before walking it.',
    photos: ['@vision:0', '@vision:1'], captions: ['A route laid out', 'Road feature pieces'],
    pdf: '@vision', stls: '@vision', print: { layer_height_mm: 0.28, infill_percent: 15, material: 'PLA', print_minutes: 140 },
    tags: { device_types: ['vision', 'learning'], helps_with: ['seeing', 'learning'], access: ['touch'], press_force: [], play: ['build', 'pretend'] },
    steps: [
      { title: 'Plan the route', body: 'Walk the route once and note every crossing, turn and landmark in order.', minutes: 15 },
      { title: 'Print the pieces', body: 'Print one piece per feature on the route, plus straight road sections.', minutes: 5 },
      { title: 'Glue it together', body: 'Glue the pieces onto a board in order, start at home and end at the school gate.', tip: 'Add a raised dot at the start so the reader always knows where to begin.', minutes: 15 },
      { title: 'Explore it together', body: 'Guide their fingers along the route and name each feature, then walk it for real.', minutes: 5 },
    ],
    stepPhotos: { 2: '@vision:0' },
    parts: [
      { name: 'PLA filament (about 70 g)', quantity: 1, is_optional: false, price_cents: 210, buy_links: [core('PLA filament')] },
      { name: 'A3 board', quantity: 1, is_optional: false, price_cents: 600, buy_links: [kmart('foam board')] },
      { name: 'Non-toxic PVA glue', quantity: 1, is_optional: false, price_cents: 450, buy_links: [kmart('pva glue')] },
    ],
    tools: [{ name: 'Clamps or pegs', get_by: 'substitute', note: 'Clothes pegs hold pieces while the glue sets.', buy_links: [] }],
    safety: [['Smooth edges', 'Sand every corner the fingers will travel over.']],
    done: 'Explore it together the night before, then walk the route in the morning.',
    authors: [['priya', 'primary']], backing: ['northbank'],
  },
  {
    key: 'sensory', title: 'Musical Grasping Toy', kind: 'assistive_tech', difficulty: 'easy', build: 25, age: [1, 8],
    repo: '@sensory', licence: 'CERN-OHL-W v2 (hardware), CC BY-SA 4.0 (docs)',
    description: 'A hand-held tube that plays music while it is squeezed. Practising a grasp becomes the reward itself: the harder the squeeze holds, the longer the song plays. A calming, rewarding sensory toy.',
    photos: ['@sensory:0', '@sensory:1'], captions: ['The grasping tube', 'Squeezed to play'],
    pdf: '@sensory', stls: '@sensory', print: { layer_height_mm: 0.16, infill_percent: 20, material: 'PLA', print_minutes: 120 },
    tags: { device_types: ['sensory', 'adapted_toy'], helps_with: ['moving', 'calm'], access: ['grasp'], one_hand: true, press_force: ['light', 'moderate'], play: ['sound', 'calm', 'soft'] },
    steps: [
      { title: 'Print the tube and caps', body: 'Print the tube upright and the two end caps flat.', minutes: 5 },
      { title: 'Fit the music module', body: 'Slide the squeeze-activated music module into the tube so its button sits under the soft grip.', tip: 'Set the volume low before closing; you can\'t reach it after.', minutes: 10 },
      { title: 'Close the caps', body: 'Screw the end caps on firmly; the battery cap needs a screwdriver.', minutes: 10 },
    ],
    stepPhotos: { 1: '@sensory:1' },
    parts: [
      { name: 'Squeeze music module', quantity: 1, is_optional: false, price_cents: 900, buy_links: [jaycar('music module')] },
      { name: 'Foam grip sleeve', quantity: 1, is_optional: false, price_cents: 350, buy_links: [kmart('foam grip')] },
      { name: 'PLA filament (about 40 g)', quantity: 1, is_optional: false, price_cents: 120, buy_links: [core('PLA filament')] },
    ],
    tools: [{ name: 'Small Phillips screwdriver', get_by: 'buy', note: 'For the battery cap.', buy_links: [bunnings('screwdriver set')] }],
    safety: [['Battery cap needs a tool', 'The coin cell must sit behind a screwed cap.'], ['Check the volume', 'Some modules are loud for a child with sensitive hearing.']],
    done: 'Hand it over and squeeze it with them the first time. The music does the encouraging.',
    authors: [['sarah', 'primary']], backing: [],
  },
  {
    key: 'daily', title: 'Easy Grip Cutlery Handles', kind: 'assistive_tech', difficulty: 'easy', build: 20, age: [2, 12],
    repo: '@daily_living', licence: 'CC BY-NC-SA 4.0',
    description: 'A kit of printed handle shapes — round, finger grip, straight, sphere and strap — that slide onto IKEA Identitet children\'s forks and spoons, so a child with a weak or limited grip can feed themselves.',
    photos: ['@daily_living:0', '@daily_living:1'], captions: ['The handle shapes', 'On a child\'s spoon'],
    pdf: '@daily_living', stls: '@daily_living', print: { layer_height_mm: 0.2, infill_percent: 15, material: 'PETG', print_minutes: 90 },
    tags: { device_types: ['daily_living'], helps_with: ['daily', 'moving'], access: ['grasp'], one_hand: true, press_force: [], play: [] },
    toy: {},
    steps: [
      { title: 'Choose the handle shape', body: 'Try the round handle first; the finger grip suits a child who holds with a fist, the strap one who cannot close their hand.', minutes: 5 },
      { title: 'Print in PETG', body: 'Print in PETG so it survives hot washing.', minutes: 5 },
      { title: 'Fit the cutlery', body: 'Push the fork or spoon into the handle until it clicks.', tip: 'Wash everything in warm soapy water before first use.', minutes: 10 },
    ],
    stepPhotos: { 2: '@daily_living:1' },
    parts: [
      { name: 'IKEA Identitet children\'s cutlery', quantity: 1, is_optional: false, price_cents: 500, buy_links: [{ label: 'IKEA', url: 'https://www.ikea.com/au/en/search/?q=identitet' }] },
      { name: 'PETG filament (about 30 g)', quantity: 1, is_optional: false, price_cents: 120, buy_links: [core('PETG filament')] },
    ],
    tools: [{ name: 'Kettle', get_by: 'substitute', note: 'Only to warm a tight handle.', buy_links: [] }],
    safety: [['Food-safe and cleanable', 'Wash before use; replace a handle if it cracks.']],
    done: 'Try it at a favourite meal first. Independence at the table is a big deal.',
    authors: [['tom', 'primary']], backing: [],
  },
]

/** Families who say "Did it work?" and leave notes. */
const NOTES = {
  lts: [
    { by: 'priya', step: 3, body: 'A strip of foam tape under the switch stops it sliding on a tray.', pin: true },
    { by: 'tom', step: 5, body: 'Missing step: label the cable end so it does not get mixed up with headphones.', pin: true },
    { by: 'amira', step: null, body: 'Built two in an afternoon. My son loves it with the bubble machine.', photo: 'lts_photo' },
    { by: 'ben', step: 2, body: 'A cable from a cheap headphone splitter works too.' },
  ],
  bubble: [{ by: 'priya', step: 2, body: 'Drill slowly — mine cracked the first time at full speed.', pin: true }, { by: 'sofia', step: null, body: 'Bath-time favourite now. Keep the switch dry!' }],
  rumble: [{ by: 'tom', step: 2, body: 'Superglue the weight once it is centred, it worked loose for us.', pin: true }, { by: 'kenji', step: null, body: 'Our whole family plays with it on games night.' }],
  aac: [{ by: 'priya', step: 3, body: 'We recorded Grandma saying "more" and it is the most-pressed button.', photo: '@communication:0' }],
  vision: [{ by: 'amira', step: null, body: 'Our orientation and mobility teacher loved the contrast.' }],
  daily: [{ by: 'ben', step: 2, body: 'Worked on a fork too.', pin: true }],
}
const BUILDS = { lts: ['priya', 'tom', 'amira', 'ben'], bubble: ['priya', 'sofia'], book: ['tom'], rumble: ['kenji'], aac: ['priya'], vision: ['amira'], sensory: ['ben', 'sofia'], daily: ['ben'] }
const THANKS = { lts: ['priya', 'tom', 'amira'], bubble: ['priya', 'sofia'], book: ['tom'], rumble: ['kenji', 'priya'], mount: ['tom'], aac: ['priya', 'amira'], vision: ['amira'], sensory: ['ben'], daily: ['ben', 'sofia'], joystick: ['kenji'] }
const PICKS = {
  lts: [['bubble', true], ['mount', false], ['rumble', false]],
  bubble: [['lts', true], ['sensory', false]],
  rumble: [['lts', true], ['mount', false]],
  mount: [['lts', false], ['joystick', false]],
  joystick: [['mount', true]],
  aac: [['mount', false], ['lts', false]],
  vision: [['sensory', false], ['book', false]],
  sensory: [['vision', false]],
  daily: [['book', false]],
  book: [['daily', false]],
}

/** Six children answering the four questions (128), each matching some guides. */
const CHILDREN = [
  { parent: 'priya', name: 'Arlo', age: 6, helps_with: ['moving'], access: ['press', 'touch'], one_hand: true, press_force: 'light', enjoys: ['light', 'sound', 'water'], everyday_needs: ['wipeable'], palm_width_mm: 58, reach_cm: 45, tray_mm: 30 },
  { parent: 'priya', name: 'Zara', age: 3, helps_with: ['seeing', 'calm'], access: ['grasp', 'watch'], one_hand: false, press_force: null, enjoys: ['soft', 'light', 'calm'], everyday_needs: ['no_flashing'] },
  { parent: 'tom', name: 'Ruby', age: 8, helps_with: ['communicating', 'learning'], access: ['press', 'eyes'], one_hand: false, press_force: 'very_light', enjoys: ['sound', 'pretend'], everyday_needs: ['shared_siblings'] },
  { parent: 'amira', name: 'Leo', age: 5, helps_with: ['hearing', 'moving'], access: ['press', 'head', 'foot'], one_hand: false, press_force: 'moderate', enjoys: ['move', 'build'], everyday_needs: ['travels_bag'] },
  { parent: 'ben', name: 'Mia', age: 10, helps_with: ['daily', 'calm'], access: ['grasp'], one_hand: true, press_force: null, enjoys: ['calm', 'move'], everyday_needs: ['quiet'] },
  { parent: 'sofia', name: 'Noah', age: 4, helps_with: ['moving', 'calm'], access: ['watch', 'press'], one_hand: false, press_force: 'full', enjoys: ['water', 'move'], everyday_needs: ['wheelchair_tray'] },
]

// ── assets: sources.json keys, or "@<device type>[:n]" from mmc-sources ──────
const MMC = fs.existsSync(path.join(__dirname, 'mmc-sources.json')) ? require('./mmc-sources.json') : {}
function assetKeys(ref, kind) {
  if (typeof ref !== 'string' || !ref.startsWith('@')) return ref
  const [type, n] = ref.slice(1).split(':')
  const src = MMC[type]
  if (!src) throw new Error(`no MMC source for ${type}`)
  if (kind === 'pdf') return `${type}_pdf`
  if (kind === 'stls') return src.stls.map((_, i) => ({ key: `${type}_stl${i}`, minutes: 60 + i * 30, grams: 20 + i * 10, material: 'PLA' }))
  return `${type}_photo${Number(n) % src.photos.length}`
}
function repoOf(g) {
  return g.repo.startsWith('@') ? MMC[g.repo.slice(1)].repo : g.repo
}

/** A photo's own extension (MMC mixes .jpg and .png), so its type is right. */
const ext = (name) => (/\.png$/i.test(name) ? '.png' : '.jpg')
async function photoFile(id, key, folder = '') {
  const { buf, name } = await file(key)
  const p = await upload('toy-photos', `${id}/${folder}${crypto.randomUUID()}${ext(name)}`, buf)
  return { path: p, url: db.storage.from('toy-photos').getPublicUrl(p).data.publicUrl }
}

async function seed() {
  if (fs.existsSync(MANIFEST)) throw new Error('guides-manifest.json exists: run --remove (or --reset) first')
  useManifest(MANIFEST)
  const admin = (await db.from('profiles').select('id').eq('email', 'byronpetselisap@gmail.com').single()).data?.id ?? null
  const G = {}
  for (const g of GUIDES) {
    const id = await insert('tutorials', {
      title: g.title,
      description: g.description + credit({ repo: repoOf(g), licence: g.licence }),
      difficulty: g.difficulty, kind: g.kind, status: 'draft', maturity: 'complete',
      build_minutes: g.build, age_min: g.age[0], age_max: g.age[1],
      safety_declared_at: days(-40), prices_checked_on: days(-6).slice(0, 10),
      done_note: g.done, ...g.toy, ...g.print, ...g.tags,
      one_hand: g.tags.one_hand ?? false,
      press_force: g.tags.press_force?.length ? g.tags.press_force : null,
      play: g.tags.play?.length ? g.tags.play : null,
    })
    G[g.key] = id
    const photos = []
    for (const ref of g.photos) photos.push((await photoFile(id, assetKeys(ref, 'photo'))).url)
    const pdf = await upload('tutorial-pdfs', `${id}/tutorial.pdf`, (await file(assetKeys(g.pdf, 'pdf'))).buf)
    for (const s of assetKeys(g.stls, 'stls')) {
      const { buf, name } = await file(s.key)
      await insert('stl_files', { tutorial_id: id, filename: name, file_url: await upload('stl-files', `${id}/${name}`, buf), print_minutes: s.minutes, filament_grams: s.grams, material: s.material })
    }
    for (const [i, st] of g.steps.entries()) {
      const ref = g.stepPhotos?.[i]
      const photo = ref ? await photoFile(id, assetKeys(ref, 'photo'), 'steps/') : null
      await insert('tutorial_steps', {
        tutorial_id: id, position: i + 1, title: st.title, body: st.body, tip: st.tip ?? null, minutes: st.minutes ?? null,
        photo_url: photo?.url ?? null,
      })
    }
    for (const p of g.parts) await insert('parts', { tutorial_id: id, ...p })
    for (const t of g.tools) await insert('tools', { tutorial_id: id, ...t })
    for (const [i, [title, detail]] of g.safety.entries()) await insert('tutorial_safety_notes', { tutorial_id: id, position: i + 1, title, detail })
    for (const [k, role] of g.authors) await put('tutorial_contributors', { tutorial_id: id, profile_id: who(k), role })
    for (const o of g.backing) await insert('tutorial_orgs', { tutorial_id: id, org_id: ORG[o], status: 'accepted', responded_at: days(-35), responded_by: who(o === 'northbank' ? 'sarah' : 'hamish') })
    await update('tutorials', id, {
      photo_urls: photos, photo_captions: g.captions, tutorial_pdf_url: pdf, status: 'approved',
      reviewed_by: admin, reviewed_at: days(-30),
    })
    log(g.title)
  }

  for (const [k, picks] of Object.entries(PICKS))
    await put('tutorial_recommendations', picks.map(([r, required], i) => ({ tutorial_id: G[k], recommended_id: G[r], position: i + 1, required })))
  for (const [k, notes] of Object.entries(NOTES)) {
    for (const n of notes) {
      const photo = n.photo ? (await photoFile(G[k], assetKeys(n.photo, 'photo'), 'notes/')).path : null
      const author = GUIDES.find((g) => g.key === k).authors[0][0]
      await insert('tutorial_notes', {
        tutorial_id: G[k], step_position: n.step, author_id: who(n.by), body: n.body,
        photo_path: photo, photo_caption: photo ? 'How ours turned out' : null,
        pinned_at: n.pin ? days(-3) : null, pinned_by: n.pin ? who(author) : null,
      })
    }
  }
  for (const [k, people] of Object.entries(BUILDS)) await put('tutorial_builds', people.map((p, i) => ({ tutorial_id: G[k], profile_id: who(p), built_at: days(-20 + i * 3) })))
  for (const [k, people] of Object.entries(THANKS)) await put('tutorial_thanks', people.map((p) => ({ tutorial_id: G[k], profile_id: who(p) })))
  await put('tutorial_view_counts', GUIDES.map((g, i) => ({ tutorial_id: G[g.key], views: 40 + ((i * 37) % 260) })))
  await db.from('profiles').update({ featured_tutorial_id: G.lts }).eq('id', who('mei'))
  await db.from('toys').update({ tutorial_id: G.bubble }).in('id', [CAST.ids.toys.bubble].filter(Boolean))
  log('picks, notes, builds, thanks, views')

  for (const c of CHILDREN) {
    const { parent, ...row } = c
    await insert('child_profiles', { parent_id: who(parent), macs_source: 'estimated', bfmf_source: 'estimated', ...row })
  }
  log(`${CHILDREN.length} children`)
}

if (require.main === module) {
  const run = process.argv.includes('--reset') ? reset : process.argv.includes('--remove') ? remove : seed
  run().then(() => log('done')).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}

module.exports = { GUIDES, CHILDREN, reset, seed, remove }
