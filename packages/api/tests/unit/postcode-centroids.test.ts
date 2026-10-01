// The two pure halves of scripts/postcode-centroids.mjs: a polygon's centroid
// (ESRI rings: outer clockwise, holes counter-clockwise, points [lng, lat]),
// and the INSERT 099 ends with.
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const { centroid, toSql } = (await import(path.join(root, 'scripts/postcode-centroids.mjs'))) as {
  centroid: (rings: number[][][]) => [number, number] | null
  toSql: (csv: string) => string
}

describe('centroid', () => {
  it('finds the middle of a square, as [lat, lng]', () => {
    expect(centroid([[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]])).toEqual([0.5, 0.5])
  })
  it('lets a hole pull the centre away from it', () => {
    const outer = [[0, 0], [0, 4], [4, 4], [4, 0], [0, 0]]
    const hole = [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]
    const [lat, lng] = centroid([outer, hole])!
    expect(lat).toBeCloseTo(28 / 12, 6)
    expect(lng).toBeCloseTo(28 / 12, 6)
  })
  it('is null for a ring with no area', () => {
    expect(centroid([[[0, 0], [1, 1], [0, 0]]])).toBeNull()
  })
})

describe('toSql', () => {
  it('writes an idempotent insert', () => {
    const sql = toSql('postcode,lat,lng\n2000,-33.8684,151.2082\n2042,-33.8989,151.1775\n')
    expect(sql).toContain("('2000', -33.8684, 151.2082)")
    expect(sql).toContain('on conflict (postcode) do update set lat = excluded.lat, lng = excluded.lng;')
  })
  it('refuses a row that is not a postcode and two numbers', () => {
    expect(() => toSql("postcode,lat,lng\n20x0,-33,151\n")).toThrow()
    expect(() => toSql("postcode,lat,lng\n2000,-33,'); drop table x; --\n")).toThrow()
  })
})
