/** 099. ABS postcode centres, and distance in whole km between two postcodes. */
import { describe, it, expect } from 'vitest'
import { adminClient } from '../helpers/auth.js'

describe('099 postcodes and distance', () => {
  it('loaded every ABS postal area', async () => {
    const { count } = await adminClient().from('postcode_centroids').select('postcode', { count: 'exact', head: true })
    expect(count).toBeGreaterThan(2500)
  })
  it('measures Sydney to Melbourne in whole km', async () => {
    const { data } = await adminClient().rpc('postcode_km', { a: '2000', b: '3000' })
    expect(data).toBeGreaterThan(705)
    expect(data).toBeLessThan(720)
  })
  it('is null when either end is unknown', async () => {
    const { data } = await adminClient().rpc('postcode_km', { a: '2000', b: '0000' })
    expect(data).toBeNull()
  })
  it('answers a list in one call', async () => {
    const { data } = await adminClient().rpc('postcode_kms', { origin: '2000', postcodes: ['2042', '0000'] })
    const byPostcode = Object.fromEntries((data as Array<{ postcode: string; km: number | null }>).map((r) => [r.postcode, r.km]))
    expect(byPostcode['2042']).toBeGreaterThanOrEqual(2)
    expect(byPostcode['2042']).toBeLessThanOrEqual(6)
    expect(byPostcode['0000']).toBeNull()
  })
  it('has the printer postcode column, and none on toy_transactions', async () => {
    expect((await adminClient().from('printers').select('postcode').limit(1)).error).toBeNull()
    expect((await adminClient().from('toy_transactions').select('requester_postcode').limit(1)).error).not.toBeNull()
  })
})
