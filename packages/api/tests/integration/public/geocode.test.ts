/** geocode.ts against the local geocodes table (126), with Nominatim stubbed. */
// journeys: Q13
import { describe, it, expect, afterAll, vi } from 'vitest'
import { geocodeAll } from '../../../src/geocode.js'
import { adminClient } from '../../helpers/auth.js'

const tag = `test-${Date.now()}`
const q = (s: string) => `${s} ${tag}, Australia`
const answer = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))

afterAll(async () => {
  await adminClient().from('geocodes').delete().like('query', `%${tag}%`)
})

describe('geocodeAll', () => {
  it('a miss is looked up, sent with a User-Agent, and cached; the next call reads the cache', async () => {
    const fetchImpl = vi.fn((_url: string | URL | Request, _init?: RequestInit) => answer([{ lat: '-32.89', lon: '151.70' }]))
    const first = await geocodeAll([q('1 University Dr'), null], { fetchImpl: fetchImpl as typeof fetch })
    expect(first.get(q('1 University Dr'))).toEqual({ lat: -32.89, lng: 151.7 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(String(fetchImpl.mock.calls[0][0])).toContain('countrycodes=au')
    expect((fetchImpl.mock.calls[0][1]!.headers as Record<string, string>)['User-Agent']).toMatch(/SPLAT-Connect/)

    const again = await geocodeAll([q('1 University Dr')], { fetchImpl: fetchImpl as typeof fetch })
    expect(again.get(q('1 University Dr'))).toEqual({ lat: -32.89, lng: 151.7 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('not found is cached as null and not asked again', async () => {
    const fetchImpl = vi.fn(() => answer([]))
    expect((await geocodeAll([q('Nowhere Rd')], { fetchImpl: fetchImpl as typeof fetch })).get(q('Nowhere Rd'))).toBeNull()
    await geocodeAll([q('Nowhere Rd')], { fetchImpl: fetchImpl as typeof fetch })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('a failed lookup gives no point and is not cached, so a later call retries', async () => {
    const down = vi.fn(() => answer({}, 503))
    expect((await geocodeAll([q('Flaky St')], { fetchImpl: down as typeof fetch })).has(q('Flaky St'))).toBe(false)
    const up = vi.fn(() => answer([{ lat: '-33.0', lon: '151.0' }]))
    expect((await geocodeAll([q('Flaky St')], { fetchImpl: up as typeof fetch })).get(q('Flaky St'))).toEqual({ lat: -33, lng: 151 })
  })

  it('a changed address is a new query, so it is looked up afresh', async () => {
    const fetchImpl = vi.fn(() => answer([{ lat: '-34.0', lon: '150.0' }]))
    await geocodeAll([q('2 Old Rd')], { fetchImpl: fetchImpl as typeof fetch })
    await geocodeAll([q('3 New Rd')], { fetchImpl: fetchImpl as typeof fetch })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('returns within the wait and finishes slow lookups in the background', async () => {
    let release!: () => void
    const slow = vi.fn(() => new Promise<Response>((r) => { release = () => r(new Response(JSON.stringify([{ lat: '-35', lon: '149' }]))) }))
    const t0 = Date.now()
    const out = await geocodeAll([q('Slow Ln')], { fetchImpl: slow as typeof fetch, waitMs: 300 })
    expect(Date.now() - t0).toBeLessThan(2500)
    expect(out.has(q('Slow Ln'))).toBe(false)
    await vi.waitFor(() => expect(slow).toHaveBeenCalled(), { timeout: 3000 })
    release()
    await vi.waitFor(async () => {
      const { data } = await adminClient().from('geocodes').select('found').eq('query', q('Slow Ln')).maybeSingle()
      expect(data?.found).toBe(true)
    }, { timeout: 3000 })
  })

  it('starts at most ten new lookups a call, and leaves the rest for later', async () => {
    const fetchImpl = vi.fn(() => answer([]))
    const many = Array.from({ length: 25 }, (_, i) => q(`${i} Many St`))
    await geocodeAll(many, { fetchImpl: fetchImpl as typeof fetch, waitMs: 0 })
    const cached = async () =>
      (await adminClient().from('geocodes').select('query', { count: 'exact', head: true }).like('query', `%Many St ${tag}%`)).count ?? 0
    // Each not-found query is tried twice (full, then narrowed), a second apart.
    await vi.waitFor(async () => expect(await cached()).toBe(10), { timeout: 40000, interval: 1000 })
    await new Promise((r) => setTimeout(r, 2500))
    expect(await cached()).toBe(10)
  }, 60000)
})
