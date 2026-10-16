import { expect, it } from 'vitest'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pickEditable } from '../../src/routes/pick-editable.js'

// maturity was deleted on 2026-10-09 (the library filter hid guides from their authors' readers
// with no way to see why). This fails if any source file reintroduces it.
it('has no maturity reference left in shipped source', () => {
  const root = resolve(__dirname, '../../../..')
  const out = execSync(
    `grep -rIl "maturity" packages/types/src packages/api/src packages/web/app packages/web/components packages/web/lib packages/mobile/app packages/mobile/components packages/mobile/lib || true`,
    { cwd: root }
  ).toString().trim()
  expect(out).toBe('')
})

// Old clients still send maturity in a PATCH; the allow-list drops it instead of erroring.
it('pickEditable ignores a stale maturity key', () => {
  expect(pickEditable({ title: 'x', maturity: 'prototype' }, ['title'])).toEqual({ title: 'x' })
})
