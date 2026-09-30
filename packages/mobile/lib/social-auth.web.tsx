// The web build (Playwright e2e, phone-width audit) has neither native SDK, so
// neither button renders there. Same exports as social-auth.ts.
import type { SocialResult } from './social-auth'

export async function appleAvailable() {
  return false
}
export function googleAvailable() {
  return false
}
export async function appleCredential(): Promise<SocialResult<{ idToken: string; fullName: string | null }>> {
  return { failed: 'Not available on web.' }
}
export async function googleIdToken(): Promise<SocialResult<string>> {
  return { failed: 'Not available on web.' }
}
export async function googleSignOut() {}
export function AppleButton(_: { onPress: () => void; height: number }) {
  return null
}
