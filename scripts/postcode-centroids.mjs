#!/usr/bin/env node
// Postcode centre points for distance (migration 099), from the ABS's own
// boundaries.
//
// Source: Australian Bureau of Statistics, ASGS Edition 3, Postal Areas (POA)
// 2021, served at geo.abs.gov.au. © Commonwealth of Australia, CC BY 4.0 —
// credited on /about. The ABS publishes polygons, not points, so each postal
// area's centre is its area-weighted centroid: the shoelace sum over every
// ring, where ESRI's clockwise outer rings and counter-clockwise holes carry
// opposite signs, so a hole pulls the centre away from itself.
//
//   node scripts/postcode-centroids.mjs > supabase/data/abs-poa-2021-centroids.csv
//   node scripts/postcode-centroids.mjs --sql supabase/data/abs-poa-2021-centroids.csv
//
// The second form prints the INSERT that 099 ends with. Hosted Supabase cannot
// COPY from a file, so the data travels inside the migration.
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const SERVICE = 'https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/POA/MapServer/0/query'

/** [lat, lng] of a polygon given as ESRI rings of [lng, lat] points, or null when it has no area. */
export function centroid(rings) {
  let a = 0
  let cx = 0
  let cy = 0
  for (const ring of rings) {
    for (let i = 0; i + 1 < ring.length; i++) {
      const [x0, y0] = ring[i]
      const [x1, y1] = ring[i + 1]
      const c = x0 * y1 - x1 * y0
      a += c
      cx += (x0 + x1) * c
      cy += (y0 + y1) * c
    }
  }
  return a === 0 ? null : [cy / (3 * a), cx / (3 * a)]
}

/** The idempotent INSERT for `postcode,lat,lng` CSV text, 500 rows a statement. */
export function toSql(csv) {
  const rows = csv.trim().split('\n').slice(1).map((line) => line.split(','))
  for (const [postcode, lat, lng] of rows) {
    if (!/^\d{4}$/.test(postcode) || !/^-?\d+(\.\d+)?$/.test(lat) || !/^-?\d+(\.\d+)?$/.test(lng)) {
      throw new Error(`Not a postcode and two numbers: ${[postcode, lat, lng].join(',')}`)
    }
  }
  const statements = []
  for (let i = 0; i < rows.length; i += 500) {
    const values = rows
      .slice(i, i + 500)
      .map(([postcode, lat, lng]) => `  ('${postcode}', ${lat}, ${lng})`)
      .join(',\n')
    statements.push(
      `insert into public.postcode_centroids (postcode, lat, lng) values\n${values}\n` +
        'on conflict (postcode) do update set lat = excluded.lat, lng = excluded.lng;'
    )
  }
  return `${statements.join('\n\n')}\n`
}

async function fetchCsv() {
  const rows = []
  for (let offset = 0; ; ) {
    const query = new URLSearchParams({
      where: '1=1',
      outFields: 'poa_code_2021',
      returnGeometry: 'true',
      outSR: '4326',
      // ~100 m generalisation: a centroid moves by metres, the download by megabytes.
      maxAllowableOffset: '0.001',
      geometryPrecision: '5',
      orderByFields: 'poa_code_2021',
      resultOffset: String(offset),
      resultRecordCount: '500',
      f: 'json',
    })
    const res = await fetch(`${SERVICE}?${query}`)
    if (!res.ok) throw new Error(`The ABS service answered ${res.status}`)
    const body = await res.json()
    if (body.error) throw new Error(`The ABS service answered ${JSON.stringify(body.error)}`)
    if (!body.features?.length) break
    for (const f of body.features) {
      const code = f.attributes.poa_code_2021
      const c = /^\d{4}$/.test(code) && f.geometry ? centroid(f.geometry.rings) : null
      if (c) rows.push(`${code},${c[0].toFixed(4)},${c[1].toFixed(4)}`)
    }
    offset += body.features.length
  }
  if (rows.length < 2500) throw new Error(`Only ${rows.length} postal areas came back; expected about 2,640.`)
  return `${['postcode,lat,lng', ...rows].join('\n')}\n`
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const at = process.argv.indexOf('--sql')
  process.stdout.write(at === -1 ? await fetchCsv() : toSql(readFileSync(process.argv[at + 1], 'utf8')))
}
