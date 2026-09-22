import { describe, it, expect } from 'vitest'
import { safePhotoSrc } from '@/lib/photo-src'

/*
 * The guard exists because next/image THROWS at render for a host that is not
 * in next.config.ts, which 500s the whole route rather than breaking one image.
 * A single stale row took down /, /library and /toy-library at once, so the
 * cases below are the ones that actually happened, not hypotheticals.
 */
describe('safePhotoSrc', () => {
  it('passes our own relative paths', () => {
    expect(safePhotoSrc('/illustrations/adapted-toy.svg')).toBe(
      '/illustrations/adapted-toy.svg'
    )
  })

  it('passes cloud storage', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/photos/a.jpg'
    expect(safePhotoSrc(url)).toBe(url)
  })

  it('passes the local stack, which dev and E2E run against', () => {
    const url = 'http://localhost:54321/storage/v1/object/public/photos/a.jpg'
    expect(safePhotoSrc(url)).toBe(url)
  })

  it('rejects the placeholder row that 500d three routes', () => {
    expect(safePhotoSrc('https://placeholder.invalid/photo.jpg')).toBeNull()
  })

  it('rejects an unconfigured host', () => {
    expect(safePhotoSrc('https://example.com/cover.jpg')).toBeNull()
  })

  it('rejects a supabase host outside the public object path', () => {
    expect(safePhotoSrc('https://abc.supabase.co/rest/v1/toys')).toBeNull()
  })

  it('rejects a lookalike host', () => {
    expect(safePhotoSrc('https://supabase.co.evil.test/storage/v1/object/public/a.jpg')).toBeNull()
  })

  it('handles absent and malformed values', () => {
    expect(safePhotoSrc(null)).toBeNull()
    expect(safePhotoSrc(undefined)).toBeNull()
    expect(safePhotoSrc('')).toBeNull()
    expect(safePhotoSrc('not a url')).toBeNull()
  })
})
