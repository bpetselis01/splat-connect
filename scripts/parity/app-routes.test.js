/** Run: node scripts/parity/app-routes.test.js */
const assert = require('node:assert')
const { withId, resolveAppRoute } = require('./app-routes')

const id = '3babf3f0-908f-46cb-bf9c-b5a575c3bec8'
assert.strictEqual(withId('/guides/[id]', `/tutorials/${id}`), `/guides/${id}`)
assert.strictEqual(withId('/guides/[id]/preview', `/tutorials/${id}/edit`), `/guides/${id}/preview`)
assert.strictEqual(withId('/organisation/[tutorialId]', `/admin/review?selected=${id}`), `/organisation/${id}`)
// No record: no route. The row is skipped, never measured on a list page.
assert.strictEqual(withId('/guides/[id]', null), null)
assert.strictEqual(withId('/guides/[id]', '/library'), null)

;(async () => {
  // An app id that is also a web screen id must not take the web route:
  // `editor` loaded /tutorials/<id>/edit, Expo's Unmatched Route page.
  const seeded = { editor: `/tutorials/${id}/edit`, 'app:org_review': `/organisation/${id}` }
  const ctx = { seeded, db: null, cache: new Map() }
  assert.strictEqual(await resolveAppRoute({ id: 'editor', route: '/tutorials/[id]', idFrom: 'editor' }, ctx), `/tutorials/${id}`)
  assert.strictEqual(await resolveAppRoute({ id: 'org_review', route: '/organisation/[tutorialId]' }, ctx), `/organisation/${id}`)
  console.log('app routes: 7 checks passed')
})()
