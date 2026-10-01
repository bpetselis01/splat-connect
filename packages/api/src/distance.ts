/**
 * Distance for the four list APIs (099): `near=<postcode>` and `within=<km>`
 * on the query string, `km` on every row, nearest first when `near` is set.
 *
 * A row says which postcode it is at; postcode_kms (SQL: haversine between ABS
 * centroids, whole km) answers for all of them in one call. A row whose
 * postcode is missing or not an ABS postal area gets km: null, sorts last, and
 * is dropped only when `within` asks for a radius.
 */
import { createAdminClient } from './supabase/client.js'

export type Near = { near: string | null; within: number | null }

/** `near` and `within` from the query string, or the sentence the 400 carries. */
export function readNear(query: (key: string) => string | undefined): Near | string {
  const near = query('near')?.trim() || null
  if (near !== null && !/^\d{4}$/.test(near)) return 'near is a four-digit postcode.'
  const raw = query('within')
  if (raw === undefined || raw === '') return { near, within: null }
  const within = Number(raw)
  if (!Number.isInteger(within) || within < 1 || within > 5000) return 'within is whole kilometres, 1 to 5000.'
  return { near, within }
}

export async function byDistance<T extends object>(
  rows: T[],
  postcodeOf: (row: T) => string | null | undefined,
  { near, within }: Near
): Promise<Array<T & { km: number | null }>> {
  if (!near) return rows.map((r) => ({ ...r, km: null }))
  const postcodes = [...new Set(rows.map(postcodeOf).filter((p): p is string => !!p))]
  const km = new Map<string, number>()
  if (postcodes.length) {
    const { data, error } = await createAdminClient().rpc('postcode_kms', { origin: near, postcodes })
    if (error) throw new Error(error.message)
    for (const r of (data ?? []) as Array<{ postcode: string; km: number | null }>) {
      if (r.km !== null) km.set(r.postcode, r.km)
    }
  }
  const unknown = Number.MAX_SAFE_INTEGER
  return rows
    .map((r) => ({ ...r, km: km.get(postcodeOf(r) ?? '') ?? null }))
    .filter((r) => within === null || (r.km !== null && r.km <= within))
    .sort((a, b) => (a.km ?? unknown) - (b.km ?? unknown))
}
