/**
 * Address → point for the Map tab, cached in `geocodes` (126). The only file
 * that knows the geocoder: OpenStreetMap Nominatim, free and keyless. Moving to
 * Google's Geocoding API later means rewriting `lookup` alone.
 *
 * Nominatim's usage policy: at most one request a second, an identifying
 * User-Agent, results cached. The queue below is process-wide, every answer
 * (found or not) is stored, and a query in flight is shared, so two map loads
 * never look the same address up twice.
 */
import { createAdminClient } from './supabase/client.js'
import { chunk } from './chunk.js'

export type Point = { lat: number; lng: number }
type Fetch = typeof fetch

const ENDPOINT = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'SPLAT-Connect/1.0 (+https://github.com/bpetselis01/splat-connect)'
const GAP_MS = 1100

/** The cache key and the text sent: parts trimmed, blanks dropped, spaces collapsed, ", Australia" on the end. */
export function addressQuery(parts: Array<string | null | undefined>): string | null {
  const kept = parts.map((p) => p?.replace(/\s+/g, ' ').trim()).filter((p): p is string => !!p)
  return kept.length ? `${kept.join(', ')}, Australia` : null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** One Nominatim search. Null when it found nothing. Throws on a network or HTTP failure, which is not cached. */
async function search(q: string, fetchImpl: Fetch): Promise<Point | null> {
  const url = `${ENDPOINT}?${new URLSearchParams({ q, format: 'jsonv2', limit: '1', countrycodes: 'au' })}`
  const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`nominatim ${res.status}`)
  const [hit] = (await res.json()) as Array<{ lat: string; lon: string }>
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null
}

/**
 * The query, then the query with its first part dropped, and so on down to the
 * locality: "Makerspace, Building ES, University Drive, Callaghan NSW 2308"
 * finds nothing, "University Drive, Callaghan NSW 2308" does. A building name
 * or unit in line 1 is common and Nominatim does not know it.
 */
export function narrowings(query: string): string[] {
  const parts = query.split(', ')
  return parts.slice(0, Math.max(1, parts.length - 1)).map((_, i) => parts.slice(i).join(', '))
}

async function lookup(query: string, fetchImpl: Fetch): Promise<Point | null> {
  for (const [i, q] of narrowings(query).entries()) {
    if (i) await sleep(GAP_MS)
    const hit = await search(q, fetchImpl)
    if (hit) return hit
  }
  return null
}

let queue: Promise<unknown> = Promise.resolve()
const inFlight = new Map<string, Promise<Point | null>>()

/** Looks a query up, one request a second, and stores the answer. */
function resolve(query: string, fetchImpl: Fetch): Promise<Point | null> {
  const running = inFlight.get(query)
  if (running) return running
  const job = queue
    .then(() => lookup(query, fetchImpl))
    .then(async (point) => {
      await createAdminClient()
        .from('geocodes')
        .upsert({ query, lat: point?.lat ?? null, lng: point?.lng ?? null, found: !!point, geocoded_at: new Date().toISOString() })
      return point
    })
    .finally(() => inFlight.delete(query))
  // ponytail: one process, one queue. Several API instances would each keep their own pace; move the gap into the database if that day comes.
  queue = job.catch(() => null).then(() => sleep(GAP_MS))
  inFlight.set(query, job)
  return job
}

/**
 * Points for these queries: cached ones at once, new ones looked up. Waits up
 * to `waitMs` for the lookups; any still running finish in the background and
 * are cached for the next call. A query missing from the result (still
 * running, or failed) or mapped to null (not found) gets no point.
 */
export async function geocodeAll(
  queries: Array<string | null>,
  { waitMs = 3000, fetchImpl = fetch }: { waitMs?: number; fetchImpl?: Fetch } = {}
): Promise<Map<string, Point | null>> {
  const wanted = [...new Set(queries.filter((q): q is string => !!q))]
  const out = new Map<string, Point | null>()
  const admin = createAdminClient()
  const reads = await Promise.all(chunk(wanted).map((qs) => admin.from('geocodes').select('query, lat, lng, found').in('query', qs)))
  for (const r of reads.flatMap((x) => (x.data ?? []) as Array<{ query: string; lat: number | null; lng: number | null; found: boolean }>)) {
    out.set(r.query, r.found ? { lat: r.lat!, lng: r.lng! } : null)
  }
  const misses = wanted.filter((q) => !out.has(q))
  if (!misses.length) return out
  const jobs = misses.map((q) =>
    resolve(q, fetchImpl).then(
      (point) => out.set(q, point),
      (err: Error) => console.error('[geocode] lookup failed:', q, err.message)
    )
  )
  await Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, waitMs))])
  return new Map(out)
}
