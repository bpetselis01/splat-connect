/** Run: node scripts/parity/app-routes.test.js */
const assert = require('node:assert')
const { withId } = require('./app-routes')

const id = '3babf3f0-908f-46cb-bf9c-b5a575c3bec8'
assert.strictEqual(withId('/guides/[id]', `/tutorials/${id}`), `/guides/${id}`)
assert.strictEqual(withId('/guides/[id]/preview', `/tutorials/${id}/edit`), `/guides/${id}/preview`)
assert.strictEqual(withId('/organisation/[tutorialId]', `/admin/review?selected=${id}`), `/organisation/${id}`)
// No record: no route. The row is skipped, never measured on a list page.
assert.strictEqual(withId('/guides/[id]', null), null)
assert.strictEqual(withId('/guides/[id]', '/library'), null)
console.log('app routes: 5 checks passed')
