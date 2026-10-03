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
    [{ code: 'weak_password', status: 422, message: 'Password should be at least 6 characters.' }, 'weak-password'],
    [{ code: 'validation_failed', status: 400, message: 'Password cannot be longer than 72 characters' }, 'long-password'],
    [{ code: 'validation_failed', status: 400, message: 'Unable to validate email address: invalid format' }, 'bad-email'],
    [{ code: 'validation_failed', status: 400, message: 'An email address is too long' }, 'bad-email'],
    [{ code: 'email_address_invalid', status: 400, message: 'Email address "a@b.c" is invalid' }, 'bad-email'],
    [{ name: 'AuthUnknownError', message: 'JSON Parse error: Unexpected character: <' }, 'unreachable'],
    [{ message: "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON" }, 'unreachable'],
    [{ name: 'AuthRetryableFetchError', status: 502, message: '{}' }, 'unreachable'],
  ])('%j is %s', (error, kind) => {
    expect(toProblem(error)?.kind).toBe(kind)
  })

  // Tests: the reported bug. Supabase's WAF answered sign-up with HTML, and
  //        the parser's own words reached the screen.
  it('never shows a parser message', () => {
    const p = toProblem({ name: 'AuthUnknownError', message: 'JSON Parse error: Unexpected character: <' })
    expect(p?.message).toBe("We couldn't reach SPLAT just now. Try again in a minute.")
  })

  it('says which status an unreachable server answered with, when it said', () => {
    expect(toProblem({ name: 'AuthRetryableFetchError', status: 502, message: '{}' })?.message).toBe(
      "We couldn't reach SPLAT just now (error 502). Try again in a minute."
    )
  })

  it('keeps an unknown message and adds its code', () => {
    expect(toProblem({ message: 'Signups are disabled for this project', code: 'signup_disabled', status: 422 })).toEqual({
      kind: 'other',
      message: 'Signups are disabled for this project (signup_disabled)',
    })
  })

  it('gives a status, and what to do, when there is no message', () => {
    expect(toProblem({ status: 500 })).toEqual({
      kind: 'other',
      message: 'Something went wrong (error 500). Try again in a minute.',
    })
  })

  it('is null for no error', () => {
    expect(toProblem(null)).toBeNull()
  })
})
