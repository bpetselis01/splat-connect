import { toProblem } from '../../../lib/auth-errors'

describe('toProblem', () => {
  it.each([
    [{ code: 'invalid_credentials' }, 'credentials'],
    [{ message: 'Invalid login credentials' }, 'credentials'],
    [{ code: 'email_not_confirmed' }, 'unconfirmed'],
    [{ code: 'otp_disabled' }, 'no-account'],
    [{ message: 'Signups not allowed for otp' }, 'no-account'],
    [{ code: 'otp_expired' }, 'bad-code'],
    [{ status: 429, message: 'x' }, 'rate-limited'],
    [{ message: 'email rate limit exceeded' }, 'rate-limited'],
    [{ message: 'Network request failed' }, 'offline'],
  ])('%j is %s', (error, kind) => {
    expect(toProblem(error)?.kind).toBe(kind)
  })

  it('keeps an unknown message rather than inventing one', () => {
    expect(toProblem({ message: 'Password should be at least 6 characters' })).toEqual({
      kind: 'other',
      message: 'Password should be at least 6 characters',
    })
  })

  it('is null for no error', () => {
    expect(toProblem(null)).toBeNull()
  })
})
