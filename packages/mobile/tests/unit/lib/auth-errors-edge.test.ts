import { problem, toProblem } from '../../../lib/auth-errors'

// Edge shapes of what supabase-js hands back: codes without messages, messages
// without codes, odd casing, and servers that answer with nothing useful.
describe('toProblem, edge shapes', () => {
  it.each([
    ['user_already_exists', 'registered'],
    ['email_exists', 'registered'],
    ['over_email_send_rate_limit', 'rate-limited'],
    ['over_request_rate_limit', 'rate-limited'],
  ])('the bare code %s is %s, with no message at all', (code, kind) => {
    expect(toProblem({ code })?.kind).toBe(kind)
  })

  it.each([
    ['User already registered', 'registered'],
    ['INVALID LOGIN CREDENTIALS', 'credentials'],
    ['Email Not Confirmed', 'unconfirmed'],
    ['Token has expired or is invalid', 'bad-code'],
    ['FAILED TO FETCH', 'offline'],
    ['Network Error', 'offline'],
    ['Password should be at least 6 characters.', 'weak-password'],
  ])('the message "%s" matches whatever its case, as %s', (message, kind) => {
    expect(toProblem({ message })?.kind).toBe(kind)
  })

  it('a 429 is rate-limited whatever else the error says', () => {
    expect(toProblem({ status: 429, code: 'invalid_credentials', message: 'Invalid login credentials' })?.kind).toBe('rate-limited')
  })

  it('a known code wins over an unrelated message', () => {
    expect(toProblem({ code: 'email_not_confirmed', message: 'something else entirely' })?.kind).toBe('unconfirmed')
  })

  it('a message rule still matches when the code is one it does not know', () => {
    expect(toProblem({ code: 'brand_new_code', message: 'Invalid login credentials' })?.kind).toBe('credentials')
  })

  it('an unknown code on a 5xx with a message keeps the message, not the status', () => {
    expect(toProblem({ code: 'unexpected_failure', status: 500, message: 'Database error' })).toEqual({
      kind: 'other',
      message: 'Database error (unexpected_failure)',
    })
  })

  it('a message with a status but no code names the status', () => {
    expect(toProblem({ status: 503, message: 'Service Unavailable' })).toEqual({
      kind: 'other',
      message: 'Service Unavailable (error 503)',
    })
  })

  it('an empty object is still a sentence the person can act on', () => {
    expect(toProblem({})).toEqual({ kind: 'other', message: 'Something went wrong. Try again in a minute.' })
  })

  it('a code with an empty message names the code', () => {
    expect(toProblem({ code: 'mystery', message: '' })).toEqual({ kind: 'other', message: 'Something went wrong (mystery). Try again in a minute.' })
  })

  it('a retryable fetch error with no status is not called "unreachable (error undefined)"', () => {
    const p = toProblem({ name: 'AuthRetryableFetchError', message: 'Network request failed' })
    expect(p?.kind).toBe('offline')
    expect(p?.message).not.toMatch(/undefined/)
  })

  it('a retryable fetch error with no status and an unknown message is shown as itself', () => {
    expect(toProblem({ name: 'AuthRetryableFetchError', message: 'timeout' })).toEqual({ kind: 'other', message: 'timeout' })
  })

  it('an unknown error with HTML in its message is never shown verbatim as a parser error', () => {
    const p = toProblem({ message: 'Unexpected token < in JSON at position 0' })
    expect(p?.kind).toBe('unreachable')
    expect(p?.message).not.toMatch(/token|JSON/i)
  })

  it('emoji, quotes and angle brackets in a server message pass through untouched', () => {
    const message = `Can't use <b>"🧸"</b> & friends`
    expect(toProblem({ message })).toEqual({ kind: 'other', message })
  })

  it('a very long unknown message passes through whole', () => {
    const message = 'x'.repeat(2000)
    expect(toProblem({ message })?.message).toBe(message)
  })

  it('problem() builds the same sentence toProblem does', () => {
    expect(problem('registered')).toEqual(toProblem({ code: 'user_already_exists' }))
    expect(problem('offline').message).toMatch(/offline/i)
  })

  it('every sentence the spec names ends in a full stop and never mentions a code', () => {
    for (const kind of ['credentials', 'unconfirmed', 'registered', 'no-account', 'bad-code', 'rate-limited', 'offline', 'weak-password', 'long-password', 'bad-email'] as const) {
      expect(problem(kind).message).toMatch(/[.]$/)
      expect(problem(kind).message).not.toMatch(/_|\berror\b/i)
    }
  })
})
