/**
 * Who each demo guide and toy is for (128), so the library filter page returns
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
  'Light Touch Switch': { device_types: ['switch'], helps_with: ['moving'], access: ['press', 'touch', 'head'], one_hand: true, press_force: ['very_light', 'light'], play: ['light'] },
  'Low Profile Switch': { device_types: ['switch'], helps_with: ['moving'], access: ['press', 'touch'], one_hand: true, press_force: ['light', 'moderate'] },
  'Switch Adapted Bubble Blower': { device_types: ['adapted_toy'], helps_with: ['moving', 'calm'], access: ['press', 'watch'], press_force: ['light', 'moderate', 'full'], play: ['water', 'move'] },
  'One Handed Book Holder': { device_types: ['learning', 'daily_living'], helps_with: ['moving', 'learning'], access: ['grasp'], one_hand: true, play: ['calm'] },
  'Rumble Plate Dice Roller': { device_types: ['adapted_toy'], helps_with: ['moving', 'seeing'], access: ['press', 'head'], press_force: ['moderate', 'full'], play: ['sound', 'move'] },
  'Simple Switch Tester': { device_types: ['switch_interface'], access: ['press'], play: ['light', 'sound'] },
  'Switch Adapted Penguin': { device_types: ['adapted_toy'], helps_with: ['moving'], access: ['press', 'watch'], press_force: ['light', 'moderate'], play: ['move', 'sound'] },
}
const TOYS = {
  'Switch-adapted racing penguins': { helps_with: ['moving'], access: ['press'], one_hand: true, press_force: ['light', 'moderate'], play: ['move', 'sound'] },
  'Adapted bubble machine': { helps_with: ['moving'], access: ['press'], one_hand: true, press_force: ['light', 'moderate'], play: ['water'] },
  'Star projector night light': { helps_with: ['moving'], access: ['press'], press_force: ['light', 'moderate'], play: ['light', 'calm'] },
  'Light-up spinning top (adapted)': { helps_with: ['moving'], access: ['press'], one_hand: true, press_force: ['light', 'moderate'], play: ['light', 'move'] },
  'Musical floor mat': { helps_with: ['moving'], access: ['press'], press_force: ['light', 'moderate'], play: ['sound'] },
  'Jack-in-the-box with switch turner': { helps_with: ['moving'], access: ['press'], one_hand: true, press_force: ['light', 'moderate'], play: ['move', 'sound'] },
  'Adapted bubble blower': { helps_with: ['moving'], access: ['press'], one_hand: true, press_force: ['light', 'moderate'], play: ['water'] },
  'Suction-cup switch mount': { helps_with: ['moving'], access: ['press'], one_hand: true, press_force: ['light', 'moderate'] },
  'One-handed book holder': { helps_with: ['moving'], access: ['grasp'], one_hand: true, play: ['calm'] },
  'Light Touch Switch (spare)': { helps_with: ['moving'], access: ['press'], one_hand: true, press_force: ['light', 'moderate'] },
  'Camera-mount switch arm': { helps_with: ['moving'], access: ['press', 'head'], one_hand: true, press_force: ['light', 'moderate'] },
  'Simple adaptive switch': { helps_with: ['moving'], access: ['press'], one_hand: true, press_force: ['light', 'moderate'], play: ['sound'] },
  'Racing penguins (adapted)': { helps_with: ['moving'], access: ['press'], one_hand: true, press_force: ['light', 'moderate'], play: ['move', 'sound'] },
  'Bubble machine, not adapted yet': { helps_with: ['moving'], access: ['press'], press_force: ['light', 'moderate'], play: ['water'] },
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
      const { error: e } = await db.from(table).update({ helps_with: null, access: null, one_hand: null, press_force: null, play: null, ...(table === 'tutorials' ? { device_types: null } : {}), ...tags }).eq('id', row.id)
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
