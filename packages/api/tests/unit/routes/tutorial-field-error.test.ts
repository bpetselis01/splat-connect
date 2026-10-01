import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../src/lib/supabase.js', () => ({ createUserClient: vi.fn(), createAdminClient: vi.fn() }))
const { fieldError } = await import('../../../src/routes/tutorials.js')

describe('fieldError prices_checked_on', () => {
  it('takes a real date', () => {
    expect(fieldError({ prices_checked_on: '2026-02-28' })).toBeNull()
  })
  it('refuses a day the month does not have, which Postgres would 500 on', () => {
    expect(fieldError({ prices_checked_on: '2026-02-31' })).toBe('Prices checked must be a date')
  })
  it('refuses a month that does not exist without throwing', () => {
    expect(fieldError({ prices_checked_on: '2026-13-01' })).toBe('Prices checked must be a date')
  })
})
