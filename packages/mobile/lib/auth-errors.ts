// Every auth failure the sign-in screens can show, in the spec's words
// (docs/superpowers/specs/2026-09-30-mobile-sign-in-design.md § Errors).
//
// Supabase reports the same failure as a `code` on newer servers and only as a
// message on older ones, so each kind matches either.

export type AuthProblemKind =
  | 'credentials'
  | 'unconfirmed'
  | 'registered'
  | 'no-account'
  | 'bad-code'
  | 'rate-limited'
  | 'offline'
  | 'other'

export type AuthProblem = { kind: AuthProblemKind; message: string }

const COPY: Record<Exclude<AuthProblemKind, 'other'>, string> = {
  credentials: "That email and password don't match.",
  unconfirmed: 'That email is not confirmed yet. We sent you a new code.',
  registered: 'That email already has an account.',
  'no-account': 'No account uses that email.',
  'bad-code': "That code didn't work. Check the latest email, or send a new one.",
  'rate-limited': 'Too many tries. Wait a minute and try again.',
  offline: "You're offline. Check your connection and try again.",
}

const RULES: [AuthProblemKind, string[], RegExp][] = [
  ['credentials', ['invalid_credentials'], /invalid login credentials/i],
  ['unconfirmed', ['email_not_confirmed'], /email not confirmed/i],
  ['registered', ['user_already_exists', 'email_exists'], /already registered/i],
  ['no-account', ['otp_disabled'], /signups not allowed/i],
  ['bad-code', ['otp_expired'], /token has expired or is invalid/i],
  ['rate-limited', ['over_email_send_rate_limit', 'over_request_rate_limit'], /rate limit/i],
  ['offline', [], /network request failed|failed to fetch|network error/i],
]

export function problem(kind: Exclude<AuthProblemKind, 'other'>): AuthProblem {
  return { kind, message: COPY[kind] }
}

export function toProblem(error: { message?: string; code?: string; status?: number } | null | undefined): AuthProblem | null {
  if (!error) return null
  const message = error.message ?? ''
  if (error.status === 429) return problem('rate-limited')
  for (const [kind, codes, pattern] of RULES) {
    if ((error.code && codes.includes(error.code)) || pattern.test(message)) {
      return problem(kind as Exclude<AuthProblemKind, 'other'>)
    }
  }
  return { kind: 'other', message: message || 'Something went wrong. Try again.' }
}
