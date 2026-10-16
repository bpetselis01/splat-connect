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

describe('fieldError customization_fields', () => {
  const choice = { label: ' Tray thickness ', kind: 'choice', options: ['10 mm', '15 mm'] }
  it('derives keys and trims labels in place', () => {
    const body: Record<string, unknown> = { customization_fields: [choice] }
    expect(fieldError(body)).toBeNull()
    expect(body.customization_fields).toEqual([{ ...choice, label: 'Tray thickness', key: 'tray_thickness' }])
  })
  it('takes an empty list, which clears them', () => {
    expect(fieldError({ customization_fields: [] })).toBeNull()
  })
  it('refuses a malformed field with its sentence', () => {
    expect(fieldError({ customization_fields: [{ ...choice, options: ['10 mm'] }] })).toBe('“Tray thickness” needs 2 to 8 options.')
    expect(fieldError({ customization_fields: 'x' })).toBe('Customization fields must be a list.')
  })
})
