// The only file that touches the native Apple and Google sign-in SDKs, so
// tests mock one module and the web build swaps in social-auth.web.tsx.
//
// Each provider is available only when its env is set (see app.config.ts):
// a build made before the Apple/Google consoles are configured shows neither
// button instead of one that fails.
//
// Both SDKs are required lazily, never imported at the top. The Google module
// throws the moment it is imported into a binary built without it — which is
// every build until the next prebuild — so a top-level import would crash the
// app at launch rather than just hiding a button.
import { Platform } from 'react-native'
import type * as AppleModule from 'expo-apple-authentication'
import type * as GoogleModule from '@react-native-google-signin/google-signin'

export type SocialResult<T> = { ok: T } | { cancelled: true } | { failed: string }

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
const appleOn = Platform.OS === 'ios' && process.env.EXPO_PUBLIC_APPLE_SIGN_IN === '1'

const apple = () => require('expo-apple-authentication') as typeof AppleModule
const google = () => require('@react-native-google-signin/google-signin') as typeof GoogleModule

export async function appleAvailable(): Promise<boolean> {
  return appleOn && apple().isAvailableAsync()
}

export function googleAvailable(): boolean {
  return Boolean(webClientId) && (Platform.OS !== 'ios' || Boolean(iosClientId))
}

export async function appleCredential(): Promise<SocialResult<{ idToken: string; fullName: string | null }>> {
  const A = apple()
  try {
    const cred = await A.signInAsync({
      requestedScopes: [A.AppleAuthenticationScope.FULL_NAME, A.AppleAuthenticationScope.EMAIL],
    })
    if (!cred.identityToken) return { failed: 'Apple returned no identity token.' }
    // Apple sends the name on the first sign-in only.
    const fullName = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ') || null
    return { ok: { idToken: cred.identityToken, fullName } }
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return { cancelled: true }
    return { failed: (e as Error).message }
  }
}

let configured = false

export async function googleIdToken(): Promise<SocialResult<string>> {
  const G = google()
  try {
    if (!configured) {
      G.GoogleSignin.configure({ webClientId, iosClientId })
      configured = true
    }
    await G.GoogleSignin.hasPlayServices()
    const res = await G.GoogleSignin.signIn()
    if (!G.isSuccessResponse(res)) return { cancelled: true }
    if (!res.data.idToken) return { failed: 'Google returned no identity token.' }
    return { ok: res.data.idToken }
  } catch (e) {
    if (G.isErrorWithCode(e) && e.code === G.statusCodes.IN_PROGRESS) return { cancelled: true }
    return { failed: (e as Error).message }
  }
}

export async function googleSignOut(): Promise<void> {
  if (!configured) return
  try {
    await google().GoogleSignin.signOut()
  } catch {
    // Signing out of Supabase is what matters; a stale Google session only
    // means the account picker preselects the last account.
  }
}

/** Apple's own button — the HIG forbids a hand-drawn one. Same height and
 *  corner as the Google button beside it (App Review 4.8: no less prominent).
 *  Rendered only after appleAvailable() said yes. */
export function AppleButton({ onPress, height }: { onPress: () => void; height: number }) {
  const A = apple()
  return (
    <A.AppleAuthenticationButton
      buttonType={A.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={A.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={height / 2}
      style={{ width: '100%', height }}
      onPress={onPress}
    />
  )
}
