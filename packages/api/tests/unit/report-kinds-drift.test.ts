import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { REPORT_SUBJECT_KINDS } from '@splat-connect/types'

// The constant the API validates against and the DB check that stores it must
// name the same kinds; 132 is the latest migration that rewrites the check.
describe('report subject kinds', () => {
  it('includes note', () => {
    expect(REPORT_SUBJECT_KINDS).toContain('note')
  })
  it('match migration 132 exactly', () => {
    const sql = readFileSync(new URL('../../../../supabase/migrations/132_report_note_kind.sql', import.meta.url), 'utf8')
    const check = /check \(subject_kind in \(([^)]+)\)\)/g
    const matches = [...sql.matchAll(check)]
    const last = matches[matches.length - 1]![1]!
    const inDb = last.split(',').map((s) => s.trim().replace(/'/g, '')).sort()
    expect(inDb).toEqual([...REPORT_SUBJECT_KINDS].sort())
  })
})
