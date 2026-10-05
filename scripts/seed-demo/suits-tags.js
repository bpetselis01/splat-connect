/**
 * Who each demo guide and toy suits (127), so the library filter page returns
 * results on the demo data. Matched by title or name, and only on rows a demo
 * manifest owns, so nobody else's guide or toy is touched.
 *
 *   node scripts/seed-demo/suits-tags.js   tag the rows the manifests list
 *
 * seed.js and sydney.js call applySuitsTags after inserting, so a reseed is tagged too.
 */
const fs = require('fs')
const path = require('path')

const GUIDES = {
  'Light Touch Switch': { movement: ['press'], hands: ['one', 'left', 'right'], play: ['light'], fit: { palm_width_mm: [30, 90] } },
  'Low Profile Switch': { movement: ['press'], hands: ['one', 'both'], fit: { palm_width_mm: [30, 110], tray_mm: [5, 40] } },
  'Switch Adapted Bubble Blower': { movement: ['press'], hands: ['one', 'both'], play: ['water', 'move'] },
  'One Handed Book Holder': { movement: ['grasp'], hands: ['one', 'left', 'right'], play: ['calm'], fit: { reach_cm: [20, 60] } },
  'Rumble Plate Dice Roller': { movement: ['press', 'proximity'], hands: ['both'], play: ['sound', 'move'] },
  'Simple Switch Tester': { movement: ['press', 'lever'], hands: ['one', 'both'], play: ['light', 'sound'] },
  'Switch Adapted Penguin': { movement: ['press'], hands: ['one', 'both'], play: ['move', 'sound'] },
}
const TOYS = {
  'Switch-adapted racing penguins': { movement: ['press'], hands: ['one', 'both'], play: ['move', 'sound'] },
  'Adapted bubble machine': { movement: ['press'], hands: ['one'], play: ['water'] },
  'Star projector night light': { movement: ['press'], hands: ['both'], play: ['light', 'calm'] },
  'Light-up spinning top (adapted)': { movement: ['press'], hands: ['one', 'left', 'right'], play: ['light', 'move'] },
  'Musical floor mat': { movement: ['press'], hands: ['both'], play: ['sound'], fit: { reach_cm: [10, 80] } },
  'Jack-in-the-box with switch turner': { movement: ['press'], hands: ['one', 'both'], play: ['move', 'sound'] },
  'Adapted bubble blower': { movement: ['press'], hands: ['one'], play: ['water'] },
  'Suction-cup switch mount': { movement: ['press', 'lever'], hands: ['one', 'left', 'right'], fit: { tray_mm: [5, 40] } },
  'One-handed book holder': { movement: ['grasp'], hands: ['one'], play: ['calm'], fit: { reach_cm: [20, 60] } },
  'Light Touch Switch (spare)': { movement: ['press'], hands: ['one', 'both'], fit: { palm_width_mm: [30, 90] } },
  'Camera-mount switch arm': { movement: ['press', 'proximity'], hands: ['one', 'left', 'right'], fit: { reach_cm: [15, 70] } },
  'Simple adaptive switch': { movement: ['press'], hands: ['one', 'both'], play: ['sound'] },
  'Racing penguins (adapted)': { movement: ['press'], hands: ['one', 'both'], play: ['move', 'sound'] },
  'Bubble machine, not adapted yet': { movement: ['press'], hands: ['both'], play: ['water'] },
}

/** Tags the listed rows; `ids` maps table → ids a manifest owns. */
async function applySuitsTags(db, ids) {
  let n = 0
  for (const [table, byTitle, col] of [['tutorials', GUIDES, 'title'], ['toys', TOYS, 'name']]) {
    const own = ids[table] || []
    if (!own.length) continue
    const { data, error } = await db.from(table).select(`id, ${col}`).in('id', own)
    if (error) throw new Error(`${table}: ${error.message}`)
    for (const row of data) {
      const tags = byTitle[row[col]]
      if (!tags) continue
      const { error: e } = await db.from(table).update({ movement: null, hands: null, play: null, fit: null, ...tags }).eq('id', row.id)
      if (e) throw new Error(`tag ${table} ${row[col]}: ${e.message}`)
      n++
    }
  }
  return n
}

module.exports = { applySuitsTags, GUIDES, TOYS }

if (require.main === module) {
  const { db } = require('./seed.js')
  const ids = { tutorials: [], toys: [] }
  for (const f of ['manifest.json', 'sydney-manifest.json']) {
    const p = path.join(__dirname, f)
    if (!fs.existsSync(p)) continue
    for (const r of JSON.parse(fs.readFileSync(p, 'utf8')).rows || []) if (ids[r.table]) ids[r.table].push(r.id)
  }
  applySuitsTags(db, ids)
    .then((n) => console.log(`Tagged ${n} demo guides and toys.`))
    .catch((e) => {
      console.error('✗', e.message)
      process.exit(1)
    })
}
