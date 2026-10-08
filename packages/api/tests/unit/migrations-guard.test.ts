/**
 * Static guards over supabase/migrations, so they run in unit CI with no
 * database. scripts/check-schema-guards.sh asserts the same class of thing
 * against the remote project, but only when deploy secrets exist; these catch
 * the mistake at the commit that makes it.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const DIR = '../../supabase/migrations'
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()
const strip = (s: string) => s.replace(/--[^\n]*/g, '')
const all = files.map((f) => ({ f, sql: strip(readFileSync(`${DIR}/${f}`, 'utf8')) }))
const joined = all.map((m) => m.sql).join('\n')
const name = String.raw`(?:public\.)?"?(\w+)"?`

describe('migrations', () => {
  it('have a three-digit prefix and no two share one (123 was never used; that is fine)', () => {
    const prefixes = files.map((f) => f.match(/^(\d{3})_/)?.[1])
    expect(prefixes).not.toContain(undefined)
    expect(new Set(prefixes).size).toBe(files.length)
  })

  it('enable row level security on every table they create in public', () => {
    const created = [...joined.matchAll(new RegExp(String.raw`create\s+table\s+(?:if\s+not\s+exists\s+)?${name}\s*\(`, 'gi'))].map((m) => m[1])
    const dropped = new Set([...joined.matchAll(new RegExp(String.raw`drop\s+table\s+(?:if\s+exists\s+)?${name}`, 'gi'))].map((m) => m[1]))
    const rls = new Set([...joined.matchAll(new RegExp(String.raw`alter\s+table\s+(?:only\s+)?${name}\s+enable\s+row\s+level\s+security`, 'gi'))].map((m) => m[1]))
    expect(created.length).toBeGreaterThan(40)
    expect([...new Set(created)].filter((t) => !rls.has(t) && !dropped.has(t))).toEqual([])
  })

  it('pin search_path on every security definer function', () => {
    const bad: string[] = []
    for (const { f, sql } of all) {
      for (const chunk of sql.split(/create\s+(?:or\s+replace\s+)?function\s+/i).slice(1)) {
        const header = chunk.split(/\$\w*\$/)[0]
        if (/security\s+definer/i.test(header) && !/search_path/i.test(header)) bad.push(`${f}: ${header.slice(0, 50).trim()}`)
      }
    }
    expect(bad).toEqual([])
  })
})
