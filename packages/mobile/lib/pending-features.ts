// packages/mobile/lib/pending-features.ts
//
// Everything in the sign-in journey (https://claude.ai/artifact/Qg6rNnnESiK31ntJk5V31J)
// that is drawn and wired but cannot work yet, because it needs an account or
// console only Byron can set up. One source of truth for three things:
//
//   1. the "Not built yet" screen (app/not-built.tsx) a button opens instead
//      of failing — its title and blurb come from here;
//   2. the `PENDING(<id>)` markers left in every file that must change when
//      the item is finished (grep `PENDING(` to find them all);
//   3. the checklist in docs/superpowers/plans/2026-09-30-sign-in-remaining-work.md.
//
// packages/api/tests/unit/pending-features.test.ts keeps the three in step: a marker
// naming an unknown id, an id with no marker or no checklist row, or a marker
// left behind for an item marked shipped, all fail the suite.
//
// Finishing an item: do the work at each marker, delete the markers, set
// `shipped: true` here (or delete the entry), tick it in the checklist.
import type { ComponentProps } from 'react'
import type { Ionicons } from '@expo/vector-icons'

export type PendingFeature = {
  title: string
  /** What the person tapping the button is told. */
  blurb: string
  icon: ComponentProps<typeof Ionicons>['name']
  /** What it waits on — for the checklist, not shown in the app. */
  needs: string
  shipped?: boolean
}

export const PENDING_FEATURES = {
  'apple-sign-in': {
    title: 'Sign in with Apple',
    blurb: "Apple sign-in isn't switched on yet. Use your email for now — you can link Apple later.",
    icon: 'logo-apple',
    needs:
      'Paid Apple Developer team with the Sign in with Apple capability on com.splatconnect.mobile; Supabase Apple provider; EXPO_PUBLIC_APPLE_SIGN_IN=1 and a native rebuild.',
  },
  'google-sign-in': {
    title: 'Continue with Google',
    blurb: "Google sign-in isn't switched on yet. Use your email for now — the same address will link to Google later.",
    icon: 'logo-google',
    needs:
      'Google Cloud OAuth clients (web, iOS, Android + SHA-1) and brand verification; Supabase Google provider; EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID / _IOS_CLIENT_ID and a native rebuild.',
  },
  'android-one-tap': {
    title: 'One-tap sign-in on Android',
    blurb: 'Signing in with a saved Google account in one tap is coming with Google sign-in.',
    icon: 'flash-outline',
    needs:
      "Google sign-in first; then call Credential Manager on arriving at Sign in (GoogleSignin.signInSilently / hasPreviousSignIn) so a saved account or password is offered in one tap — the artifact's step 3.",
  },
  'apple-revoke': {
    title: 'Removing Apple access on deletion',
    blurb: 'Deleting an account signed in with Apple also removes SPLAT from your Apple ID once this is switched on.',
    icon: 'key-outline',
    needs:
      'A Sign in with Apple key (.p8) and APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY / APPLE_CLIENT_ID on the API.',
  },
  'email-delivery': {
    title: 'Emails to every member',
    blurb: 'Codes and confirmations only reach the SPLAT team until custom email is switched on.',
    icon: 'mail-outline',
    needs:
      "Resend (or any SMTP) on a verified domain: Supabase custom SMTP (the built-in sender only reaches the project team, 2/hour), RESEND_API_KEY + MAIL_FROM on the API, and the domain registered with Apple's private relay for Hide My Email users.",
  },
} satisfies Record<string, PendingFeature>

export type PendingFeatureId = keyof typeof PENDING_FEATURES
