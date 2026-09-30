# Mobile sign-in and create account — design (Spec A)

Date: 2026-09-30 · Scope: `packages/mobile` + Supabase email templates · Visual
journey: https://claude.ai/artifact/Qg6rNnnESiK31ntJk5V31J (the mockups are
the screen reference; this file is the contract).

Spec B, **account deletion**, is a separate brainstorm. Neither store
submission can happen until Spec B ships: Apple 5.1.1(v) and Google Play both
require in-app deletion.

## Intent

The phone's auth still reads as the old Pixel pass: one `auth-screen.tsx` with
a Sign in / Create account switch. Replace it with the Soft Pop flow the web
board draws, adapted to a phone, and shaped by how widely used iOS and Android
apps sign people in. Success is a person on either platform who reaches Guides
by whichever method they already use elsewhere, without a dead end.

## Decisions (Byron, 2026-09-30)

| Question | Decision |
|---|---|
| Methods | All of them: Apple (iOS only), Google (iOS + Android), email + password, emailed 6-digit code |
| Guest browsing | No. Sign in stays required (Apple 5.1.1(v) allows this: the core is account-based) |
| "I'm mostly here to…" | Removed on mobile. All accounts are contributors; it only picked the first landing. Web keeps it for now |
| Terms | Checkbox in the email + password form. Apple, Google and code accounts get the board's terms gate right after sign-up |
| Structure | One route per step (approach A), not a bigger single screen |
| Confirm password | Removed; one field with a show/hide toggle |
| Email me a code | Sign in only. Never creates an account, never sets a password |
| Forgot password | One link for everyone. For a Google/Apple/code-only account it *adds* a password |

## Journey

```
Launch → session? ─yes→ terms accepted? ─yes→ Guides
                 │                       └no→ (onboarding)/terms → Guides
                 └no→ Welcome
Welcome ─Get started→ Create account ─Apple/Google→ (new? terms gate) → Guides
                                     └email+password→ Verify code → Guides
        ─I already have an account→ Sign in ─Apple/Google/password→ Guides
                                            ─Email me a code→ Verify code → Guides
                                            ─Forgot password→ Reset (code + new password) → Guides
```

A SPLAT account is its email. Supabase links every identity that proves the
same email to one user, so a Google sign-in with an address that already has a
password account lands in that account.

## Screens

All sit on a shared `AuthStage` (Soft Pop canvas, safe areas, keyboard
avoidance, scroll on short phones, max-width 440 for tablets, foot line "No paid
tier. Not a medical device.").

1. **`(auth)/welcome`** — waving bear, "Welcome to SPLAT Connect", one-line
   lede, three promises (child profiles private · every guide reviewed · free,
   we never sell data), primary **Get started**, outline **I already have an
   account**. Signed-out redirects land here.
2. **`(auth)/create-account`** — back, "Create your account", social buttons,
   "or use your email", Your name, Email, Password (eye toggle, "At least 6
   characters" hint that turns green when met), terms checkbox ("I agree to the
   contributor terms and understand SPLAT Connect is not a medical device.") with
   **Contributor terms** and **Privacy policy** links, **Create my account**
   (disabled until ticked), "Have an account? Sign in".
3. **`(auth)/sign-in`** — back, small bear, "Welcome back", social buttons,
   Email, Password with **Forgot password?** on the label row, **Sign in**,
   outline **Email me a sign-in code**, "New here? Create an account". Path kept:
   existing screens push `/sign-in`.
4. **`(auth)/verify`** — params `email`, `type` (`signup` | `email`). Envelope
   badge, "Check your email", "We sent a 6-digit code to …", six-box code input
   that submits on the sixth digit, resend after 60 s, **Use a different email**
   (back). Foot: "The link in the email works too — it opens SPLAT on the web."
5. **`(auth)/forgot-password`** — Email (prefilled from Sign in), **Send code**.
   Always answers "If an account uses that email, a code is on its way" and moves
   on, so it reveals nothing.
6. **`(auth)/reset-password`** — Code, New password, **Save and sign in**
   (`verifyOtp` recovery → `updateUser({ password })`), "Send again".
7. **`(onboarding)/terms`** — "One step before you start" · Contributor terms ·
   version line; **Your name** only when the profile name is empty (pre-filled
   from Apple's one-time full name when given); scrolling terms blocks (board
   copy); checkbox; **Accept and continue**; "Sign out" link at the foot, no back.

### Social buttons

- iOS: native `AppleAuthenticationButton` (Continue, black; white in dark
  mode), then Google. Same height, same width, both above the fold.
- Android: Google only; no Apple.
- Google button: "Continue with Google", full-colour G, outline surface.
- A method whose client config is missing (env unset) does not render, so a
  build works before the consoles are set up.

## Architecture

- **`lib/use-auth-gate.ts`** — one hook for every signed-in layout:
  `{ state: 'loading' } | { redirect: '/welcome' } | { redirect: '/terms' } | { state: 'ok' }`.
  Terms redirect only on `hasContributorTerms === false` (null = unknown, never
  redirect). `(tabs)`, `(my)`, `printing`, `(onboarding)` use it;
  `(onboarding)/terms` skips the terms check. The Me tab's own terms gate in
  `profile-screen.tsx` is deleted as unreachable. Consequence: an older account
  that never accepted sees the gate on next launch.
- **`(auth)/_layout.tsx`** — Stack; a session redirects to `/guides`.
  `INTENT_LANDING` and the `intent_landed` write are removed.
  (`pendingIntent`/`SignupIntent` stay in `@splat-connect/types`; web uses them.)
- **`lib/auth-context.tsx`** — `signUp(email, password, name)` (no intent);
  new `verifyCode(email, token, type)`, `sendSignInCode(email)`
  (`shouldCreateUser: false`), `resendSignupCode(email)`, `sendPasswordReset(email)`,
  `resetPassword(email, token, password)`, `signInWithApple()`,
  `signInWithGoogle()`, `setProfileName(name)`. All return `{ error }`; the
  social ones may return `{ cancelled: true }`, which screens ignore. Apple's
  one-time full name is held in context for the terms gate. `signOut` also
  signs out of the Google SDK.
- **`lib/social-auth.ts`** — the only file importing
  `expo-apple-authentication` and `@react-native-google-signin/google-signin`;
  `appleAvailable()`, `googleAvailable()`, `appleCredential()`,
  `googleIdToken()`. Tests mock this file.
- **`lib/auth-errors.ts`** — maps Supabase messages/codes to the copy below.
- **`components/auth/`** — `AuthStage`, `SocialButtons`, `PasswordField`,
  `CodeInput`, `TermsCheckbox`, `ErrorRow`, `Bear` (the board's wave pose, from
  `TabHero`'s mascot). `components/auth-screen.tsx` is deleted.
- **Autofill** — name: `textContentType="name"`/`autoComplete="name"`; email:
  `emailAddress`/`email`; sign-in password: `password`/`current-password`;
  new passwords: `newPassword`/`new-password` with `passwordRules`; code:
  `oneTimeCode`/`one-time-code`.
- **Dependencies** — `expo-apple-authentication`,
  `@react-native-google-signin/google-signin` (+ its config plugin).
  `app.json` → `app.config.ts` so the Google iOS URL scheme comes from env;
  `ios.usesAppleSignIn: true`. Native rebuild required.
- **Env** — `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
  `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (+ derived `GOOGLE_IOS_URL_SCHEME`).
- **Supabase** — `supabase/templates/{confirmation,magic_link,recovery}.html`
  carry both `{{ .ConfirmationURL }}` and `{{ .Token }}`, wired in
  `config.toml` `[auth.email.template.*]`; the same HTML is pasted into the
  hosted project. Web's link flow is unchanged. Apple and Google providers
  enabled with the bundle id / web client id.

## Errors

Shown in `ErrorRow` above the submit button — icon plus words, announced to
screen readers, never colour alone.

| Case | Copy / behaviour |
|---|---|
| Wrong credentials | "That email and password don't match." Password cleared, email kept |
| Email not confirmed | Send a fresh signup code, go to Verify |
| Already registered (sign-up) | "That email already has an account." + **Sign in as {email}** |
| Code sign-in, unknown email | "No account uses that email." + **Create one** |
| Wrong/expired code | Boxes clear; "That code didn't work. Check the latest email, or send a new one." |
| Reset, unknown email | Same neutral message as a real one |
| Social cancelled | Nothing |
| Social failed | "Couldn't sign in with Apple/Google. Try again, or use your email." |
| Offline | "You're offline. Check your connection and try again." Values kept |
| Rate limited | "Too many tries. Wait a minute and try again." |

## Accessibility

Visible labels, 48-pt targets, return-key order, focus to first field and to
errors, code boxes read as one "6-digit code" field, Dynamic Type respected,
keyboard never covers the primary button. Phone-width and adherence scripts
cover the new routes.

## Tests

- Unit: each screen (renders, terms-disabled submit, error mapping, navigation),
  `use-auth-gate` (four outcomes), `auth-context` new methods with
  `social-auth` mocked, `CodeInput` (typing, paste, backspace), `auth-errors`.
- e2e (web build, local Supabase + Mailpit): email sign-up → code → Guides;
  code sign-in; forgot → reset → Guides; account without an agreement → terms
  gate → Guides.
- Maestro smoke: password sign-in (replaces the current flow's sign-in steps).
- Manual, on device: Apple and Google native sheets (not in the web build).

## Store requirements this spec satisfies

- Apple 4.8: Apple offered wherever Google is on iOS; system button, no smaller,
  above the fold; Hide My Email respected (no email or password asked after).
- Google branding: "Continue with Google", full-colour G, equal prominence.
- Privacy policy and terms reachable in-app from sign-up (Apple 5.1.1(i), Play
  User Data).
- Account screen shows how you sign in (Apple / Google / email) — HIG.
- Reviewer access (Apple 2.1, Play app access): the seed-demo account signs in
  by email + password, which bypasses the code; credentials go in App Store
  Connect and Play Console.

## Setup only Byron can do (wizard provided)

1. Apple Developer: enable Sign in with Apple on `com.splatconnect.mobile`;
   register the email sending domain (SPF/DKIM) with the private relay service
   so codes reach Hide My Email addresses.
2. Google Cloud: OAuth clients — iOS (bundle id), Android (package + SHA-1 of
   debug and release keys), Web (for Supabase); brand verification for the
   consent screen.
3. Supabase hosted: enable Apple (bundle id as client id) and Google (web client
   id, skip-nonce off); paste the three templates.
4. `.env` values above; `npx expo prebuild --clean`; rebuild on device.

## Release checklist (not built here)

Spec B account deletion · App Privacy labels + privacy manifests present in the
prebuild (GoogleSignIn, AppAuth) · Play Data safety (declare child-profile and
abilities data) · target audience adults, no child-styled store art ·
organisation developer account (5.1.1(ix)) · UGC report/block/contact audit
(Apple 1.2, Play UGC) · honest age-rating answers.

## Out of scope

Guest browsing; passkeys; web changes (intent tiles, reset flow); Apple
server-to-server notifications; password autofill domain files
(`apple-app-site-association` `webcredentials`, `assetlinks.json`) — recommended,
later.
