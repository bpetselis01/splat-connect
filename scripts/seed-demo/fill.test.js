/**
 * Run: node scripts/seed-demo/fill.test.js
 *
 * change() is the whole safety story: it may only touch a field that is empty
 * now, and it must remember exactly what was there so --remove is exact.
 */
const assert = require('node:assert')
const { change, stlPatch, toyNameFrom } = require('./fill')

const row = { id: 'r1', title: 'Fat Moose - Light Up Melody Bear v2', material: 'PETG', tags: [], note: '   ', age_min: null }

const c = change('tutorials', row, { material: 'PLA', tags: ['a'], note: 'n', age_min: 2, print_minutes: 90, skipped: null })
assert.deepStrictEqual(c.patch, { tags: ['a'], note: 'n', age_min: 2, print_minutes: 90 }, 'a set field is never overwritten; null patch values are dropped')
assert.deepStrictEqual(c.prior, { tags: [], note: '   ', age_min: null, print_minutes: null }, 'prior holds exactly what each written field had')
assert.strictEqual(c.label, row.title)

assert.strictEqual(change('tutorials', { ...row, ...c.patch }, c.patch), null, 'a second pass over a filled row has nothing to do')
assert.strictEqual(change('t', { id: 'x', a: 1 }, { a: 2 }), null, 'no empty field means no change at all')

assert.deepStrictEqual(stlPatch({ filename: 'LTS_Base_v1.0.stl' }, 0), { print_minutes: 48, filament_grams: 9, size_x_mm: 72, size_y_mm: 48, size_z_mm: 14 })
assert.strictEqual(toyNameFrom('Fat Moose - Light Up Melody Bear v2'), 'Light Up Melody Bear v2')
assert.strictEqual(toyNameFrom('Switch Adapted Bubble Blower'), 'Bubble Blower')

console.log('fill.test.js ok')
