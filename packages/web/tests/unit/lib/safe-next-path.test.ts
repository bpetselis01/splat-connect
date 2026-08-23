import { describe, it, expect } from 'vitest'
import { sanitiseNextPath } from '@/lib/safe-next-path'

describe('sanitiseNextPath', () => {
  it('accepts a legitimate same-origin path', () => {
    expect(sanitiseNextPath('/get-involved/submit-an-idea')).toBe('/get-involved/submit-an-idea')
  })

  it('rejects a missing or empty value', () => {
    expect(sanitiseNextPath(null)).toBeNull()
    expect(sanitiseNextPath(undefined)).toBeNull()
    expect(sanitiseNextPath('')).toBeNull()
  })

  it('rejects an absolute off-site URL', () => {
    expect(sanitiseNextPath('https://evil.example')).toBeNull()
  })

  it('rejects a protocol-relative URL', () => {
    expect(sanitiseNextPath('//evil.example')).toBeNull()
  })

  it('rejects a backslash used as an authority separator', () => {
    expect(sanitiseNextPath('/\\evil.example')).toBeNull()
  })

  it('rejects a javascript: URL', () => {
    expect(sanitiseNextPath('javascript:alert(1)')).toBeNull()
  })

  it('rejects a scheme hidden behind leading whitespace', () => {
    expect(sanitiseNextPath('  javascript:alert(1)')).toBeNull()
  })

  it('rejects a scheme hidden behind an embedded tab', () => {
    expect(sanitiseNextPath('java\tscript:alert(1)')).toBeNull()
  })

  it('rejects a scheme hidden behind an embedded newline', () => {
    expect(sanitiseNextPath('java\nscript:alert(1)')).toBeNull()
  })

  it('rejects a path that is not absolute-from-root', () => {
    expect(sanitiseNextPath('dashboard')).toBeNull()
  })

  it('rejects a backslash anywhere in an otherwise valid path', () => {
    expect(sanitiseNextPath('/get-involved\\evil')).toBeNull()
  })
})
