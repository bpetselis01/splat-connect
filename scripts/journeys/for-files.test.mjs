import { test } from 'node:test'
import assert from 'node:assert/strict'
import { forFiles, format } from './for-files.mjs'

const row = (id, platform, route) => ({ id, platform, route })
const rows = [
  row('WY17', 'web', '/dashboard/toys/[id]'),
  row('WY18', 'web', '/dashboard/toys/[id]'),
  row('WY30', 'web', '/other'),
  row('W03', 'mobile', '(my)/toys/[id]/index'),
]
const layers = {
  'web-unit': { 'packages/web/tests/unit/toy.test.tsx': ['WY17'] },
  'web-e2e': {
    'packages/web/tests/e2e/dashboard/toys.spec.ts': ['WY17'],
    'packages/web/tests/e2e/exchanges/gift.spec.ts': ['WY18'],
    'packages/web/tests/e2e/other.spec.ts': ['WY30'],
  },
  'mobile-e2e': { 'packages/mobile/tests/e2e/toys.spec.ts': ['W03'] },
  api: { 'packages/api/tests/integration/toys.test.ts': ['WY17'] },
}
const run = (changed, optOuts) => format(forFiles(changed, rows, layers, optOuts), changed)

test('a web route file prints its rows, e2e specs and unit/api files', () => {
  assert.deepEqual(run(['packages/web/app/dashboard/toys/[id]/page.tsx']), [
    'row WY17 web /dashboard/toys/[id]',
    'row WY18 web /dashboard/toys/[id]',
    'e2e web tests/e2e/dashboard/toys.spec.ts',
    'e2e web tests/e2e/exchanges/gift.spec.ts',
    'unit packages/web/tests/unit/toy.test.tsx',
    'unit packages/api/tests/integration/toys.test.ts',
  ])
})

test('a mobile screen prints its rows and mobile e2e specs', () => {
  assert.deepEqual(run(['packages/mobile/app/(my)/toys/[id]/index.tsx']), [
    'row W03 mobile (my)/toys/[id]/index',
    'e2e mobile tests/e2e/toys.spec.ts',
  ])
})

test('a docs-only change has nothing to run', () => {
  assert.deepEqual(run(['docs/plans/x.md', 'README.md']), ['nothing to run'])
})

test('a route with no row trips the wire and falls back', () => {
  assert.deepEqual(run(['packages/web/app/foo/page.tsx']), [
    'missing no journey row: web /foo',
    'fallback packages/web/app/foo/page.tsx',
  ])
})

test('an opted-out route only falls back', () => {
  assert.deepEqual(run(['packages/web/app/foo/page.tsx'], { 'web /foo': 'static' }), ['fallback packages/web/app/foo/page.tsx'])
})

test('a shared component names no row and falls back', () => {
  assert.deepEqual(run(['packages/web/components/toy-card.tsx']), ['fallback packages/web/components/toy-card.tsx'])
})
