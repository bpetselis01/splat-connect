# Sign-in journey — what is live and what is left

The journey: https://claude.ai/artifact/Qg6rNnnESiK31ntJk5V31J · Specs:
`docs/superpowers/specs/2026-09-30-mobile-sign-in-design.md` (A) and
`…-account-deletion-design.md` (B).

**How this is tracked.** Every unfinished item has an id in
`packages/mobile/lib/pending-features.ts`. The same id appears as a
`PENDING(<id>)` marker in each file that has to change (`git grep "PENDING("`),
and a button for it opens the app's "Not built yet" screen rather than
failing. `packages/api/tests/unit/pending-features.test.ts` fails if the
registry, the markers and the table below drift apart.

**Finishing an item:** do the work at each of its markers, delete the markers,
set `shipped: true` on its registry entry, and tick it here. Most of the work
is `bash scripts/setup-mobile-sign-in.sh`.

## Journey, step by step

| Artifact step | Live now | Left |
|---|---|---|
| 1 · Welcome | ✅ | — |
| 2 · Create account — email + password | ✅ | — |
| 2 · Create account — Continue with Apple (iOS) | Button opens Not built yet | `apple-sign-in` |
| 2 · Create account — Continue with Google | Button opens Not built yet | `google-sign-in` |
| 3 · Sign in — password, Forgot password, email code | ✅ | — |
| 3 · Sign in — Apple / Google | Buttons open Not built yet | `apple-sign-in`, `google-sign-in` |
| 3 · Sign in — Android one-tap saved account | Not started | `android-one-tap` |
| 4 · Enter the code | ✅ (templates + 6-digit codes live 2026-09-30) | `email-delivery` for anyone outside the team |
| 5 · Forgot password in the app | ✅ | `email-delivery` |
| 6 · Terms gate after Apple/Google/code sign-up | ✅ (reachable by code sign-up today) | — |
| 7 · Errors, Apple/Google system sheets | ✅ for email paths | sheets come with `apple-sign-in` / `google-sign-in` |
| B · Delete account (mobile, web, public page) | ✅ (083/084 live 2026-09-30) | confirmation email: `email-delivery` |
| B · Delete with Apple's sheet, revoke Apple access | Hidden until Apple accounts exist | `apple-revoke` |

## Pending items

| Id | Waits on | Wizard stage |
|---|---|---|
| `apple-sign-in` | Paid Apple Developer team; Sign in with Apple capability on `com.splatconnect.mobile`; Supabase Apple provider; `EXPO_PUBLIC_APPLE_SIGN_IN=1`; native rebuild | 3, 9, 13 |
| `google-sign-in` | Google Cloud consent screen + brand verification; web/iOS/Android OAuth clients; Supabase Google provider (skip nonce on); client ids in `.env.local`; native rebuild | 5–9, 13 |
| `android-one-tap` | `google-sign-in`; then a silent sign-in in `lib/social-auth.tsx` called from Sign in | — (code) |
| `apple-revoke` | `apple-sign-in`; Sign in with Apple key (.p8) and four `APPLE_*` values on the API | 12 |
| `email-delivery` | Resend on a verified domain; Supabase custom SMTP; `RESEND_API_KEY` + `MAIL_FROM` on the API; domain registered with Apple's private relay | Resend stage, 4 |

## Also found, not in the journey

- **Hosted `site_url` is `http://localhost:3000`,** so every link in a live
  email (confirm, magic link) points at localhost. Set it to the real web URL
  in Supabase → Authentication → URL Configuration. The app uses the code, so
  mobile is unaffected; web's link flow is.
- **Contributor terms version is still `v0-todo`** (`AGREEMENT_VERSIONS` in
  `packages/types`). The terms gate hides the version line until it is real.
