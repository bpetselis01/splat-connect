import { describe, it, expect, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pickActingOrg, actingOrg } from '@/lib/acting-org'

let cookie: string | undefined
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n === 'splat_acting_org' && cookie ? { value: cookie } : undefined) }),
}))

const A = { id: 'oA', name: 'North' } as never
const B = { id: 'oB', name: 'South' } as never

describe('actingOrg', () => {
  it('picks the cookie org', async () => {
    cookie = 'oB'
    expect((await actingOrg({ ledOrgs: [A, B] })).id).toBe('oB')
  })
  it('ignores a cookie for an org the person does not lead', async () => {
    cookie = 'oZ'
    expect((await actingOrg({ ledOrgs: [A, B] })).id).toBe('oA')
  })
  it('falls back to the first led org with no cookie', async () => {
    cookie = undefined
    expect((await actingOrg({ ledOrgs: [A, B] })).id).toBe('oA')
    expect(pickActingOrg([B, A], undefined).id).toBe('oB')
  })
})

describe('ledOrgs[0] guard', () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const e of readdirSync(dir)) {
      const full = join(dir, e)
      if (statSync(full).isDirectory()) {
        if (e !== 'node_modules' && e !== '.next') walk(full, out)
      } else if (/\.tsx?$/.test(e)) out.push(full)
    }
    return out
  }
  it('is not used in app/ or components/; pages read actingOrg', () => {
    const root = join(__dirname, '../../..')
    const offenders = ['app', 'components']
      .flatMap((d) => walk(join(root, d)))
      .filter((f) => /ledOrgs\??\.?\[0\]/.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })
})
