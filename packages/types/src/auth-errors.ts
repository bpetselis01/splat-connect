// Every auth failure the sign-in screens can show, in the spec's words
// (docs/superpowers/specs/2026-09-30-mobile-sign-in-design.md § Errors).
//
// Supabase reports the same failure as a `code` on newer servers and only as a
// message on older ones, so each kind matches either.

type AuthProblemKind =
  | 'credentials'
  | 'unconfirmed'
  | 'registered'
  | 'no-account'
  | 'bad-code'
  | 'rate-limited'
  | 'offline'
  | 'weak-password'
  | 'long-password'
  | 'bad-email'
  | 'unreachable'
  | 'other'

export type AuthProblem = { kind: AuthProblemKind; message: string }

const COPY: Record<Exclude<AuthProblemKind, 'other' | 'unreachable'>, string> = {
  credentials: "That email and password don't match.",
  unconfirmed: 'That email is not confirmed yet. We sent you a new code.',
  registered: 'That email already has an account.',
  'no-account': 'No account uses that email.',
  'bad-code': "That code didn't work. Check the latest email, or send a new one.",
  'rate-limited': 'Too many tries. Wait a minute and try again.',
  offline: "You're offline. Check your connection and try again.",
  'weak-password': 'That password is too weak. Use at least 6 characters, and not a common password.',
  'long-password': 'Use 72 characters or fewer for the password.',
  'bad-email': "That email address doesn't look right. Check it for typos and try again.",
}

const RULES: [keyof typeof COPY, string[], RegExp][] = [
  ['credentials', ['invalid_credentials'], /invalid login credentials/i],
  ['unconfirmed', ['email_not_confirmed'], /email not confirmed/i],
  ['registered', ['user_already_exists', 'email_exists'], /already registered/i],
  ['no-account', ['otp_disabled'], /signups not allowed/i],
  ['bad-code', ['otp_expired'], /token has expired or is invalid/i],
  ['rate-limited', ['over_email_send_rate_limit', 'over_request_rate_limit'], /rate limit/i],
  ['offline', [], /network request failed|failed to fetch|network error/i],
  ['weak-password', ['weak_password'], /password should be at least/i],
  ['long-password', [], /password cannot be longer/i],
  ['bad-email', ['email_address_invalid'], /unable to validate email address|email address is too long/i],
]

type RawError = { message?: string; code?: string; status?: number; name?: string }

// Supabase gave up before it had a code to report: something between us and
// it (its WAF, a gateway) answered with HTML or a 5xx. The message is then a
// parser's or "{}", never copy.
const gaveUp = (e: RawError) =>
  e.name === 'AuthUnknownError' ||
  (e.name === 'AuthRetryableFetchError' && !!e.status) ||
  /json parse|unexpected (character|token)|not valid json/i.test(e.message ?? '')

export function problem(kind: keyof typeof COPY): AuthProblem {
  return { kind, message: COPY[kind] }
}

export function toProblem(error: RawError | null | undefined): AuthProblem | null {
  if (!error) return null
  const message = error.message ?? ''
  if (error.status === 429) return problem('rate-limited')
  for (const [kind, codes, pattern] of RULES) {
    if ((error.code && codes.includes(error.code)) || pattern.test(message)) {
      return problem(kind)
    }
  }
  if (gaveUp(error)) {
    const status = error.status ? ` (error ${error.status})` : ''
    return { kind: 'unreachable', message: `We couldn't reach SPLAT just now${status}. Try again in a minute.` }
  }
  const context = error.code ?? (error.status ? `error ${error.status}` : null)
  return { kind: 'other', message: `Something went wrong${context ? ` (${context})` : ''}. Try again in a minute.` }
}

