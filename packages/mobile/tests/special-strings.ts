// The special-character matrix the auth screens and the sign-up e2e run over.
// `server` is what local Supabase answered for that email or password at
// sign-up (probed 2026-10-02); absent means it accepted it.
type Case = { label: string; value: string; server?: { status: number; code: string; message: string } }

const badEmail = { status: 400, code: 'validation_failed', message: 'Unable to validate email address: invalid format' }

export const NAMES: Case[] = [
  { label: 'apostrophe', value: "O'Brien" },
  { label: 'quotes', value: 'Sam "Sparky" Lee' },
  { label: 'backslash', value: 'Back\\slash' },
  { label: 'percent', value: '100% Sam' },
  { label: 'ampersand', value: 'Tom & Jerry' },
  { label: 'plus', value: 'Sam+1' },
  { label: 'angle brackets', value: '<b>Sam</b>' },
  { label: 'unicode', value: 'Zoë Ångström 李雷' },
  { label: 'emoji', value: 'Sam 🧸🦄' },
  { label: 'RTL', value: 'سارة' },
  { label: 'very long', value: 'N'.repeat(500) },
  { label: 'leading/trailing spaces', value: '  Pat  ' },
]

export const EMAILS: Case[] = [
  { label: 'apostrophe', value: "o'brien@splat-test.local" },
  { label: 'plus', value: 'sam+tag@splat-test.local' },
  { label: 'percent', value: 'sam%1@splat-test.local' },
  { label: 'ampersand', value: 'tom&jerry@splat-test.local' },
  { label: 'leading/trailing spaces', value: '  pad@splat-test.local  ' },
  { label: 'quotes', value: '"sam"@splat-test.local', server: badEmail },
  { label: 'backslash', value: 'sam\\x@splat-test.local', server: badEmail },
  { label: 'angle brackets', value: '<sam>@splat-test.local', server: badEmail },
  { label: 'unicode', value: 'zoë@splat-test.local', server: badEmail },
  { label: 'emoji', value: '🧸@splat-test.local', server: badEmail },
  { label: 'RTL', value: 'سارة@splat-test.local', server: badEmail },
  { label: 'very long', value: `${'x'.repeat(300)}@splat-test.local`, server: { status: 400, code: 'validation_failed', message: 'An email address is too long' } },
]

export const PASSWORDS: Case[] = [
  { label: 'apostrophe', value: "it's-a-secret" },
  { label: 'quotes', value: 'say "open"' },
  { label: 'backslash', value: 'back\\slash\\' },
  { label: 'percent', value: '100%-sure' },
  { label: 'ampersand', value: 'salt&pepper' },
  { label: 'plus', value: 'one+one=2' },
  { label: 'angle brackets', value: '<secret>' },
  { label: 'unicode', value: 'Zoë-Ångström' },
  { label: 'emoji', value: '🧸🦄🧸🦄' },
  { label: 'RTL', value: 'كلمةسر' },
  { label: 'leading/trailing spaces', value: '  padded  ' },
  { label: 'whitespace only', value: '        ' },
  { label: 'very long', value: 'p'.repeat(73), server: { status: 400, code: 'validation_failed', message: 'Password cannot be longer than 72 characters' } },
]

/** Refused on the screen before any request. */
export const BLANK = '   '
