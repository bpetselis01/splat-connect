// Extends app.json with the two sign-in providers, each switched on by env so a
// build still works before its console is set up (see the sign-in spec,
// docs/superpowers/specs/2026-09-30-mobile-sign-in-design.md).
//
// Apple: the Sign in with Apple entitlement is refused by a free personal
// signing team, so it is added only when EXPO_PUBLIC_APPLE_SIGN_IN=1.
// Google: the config plugin needs the iOS client's reversed id as a URL scheme,
// derived here from EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID. Without it the plugin
// falls back to Firebase mode and prebuild fails, so it is left out entirely.
import type { ConfigContext, ExpoConfig } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => {
  // PENDING(apple-sign-in): set EXPO_PUBLIC_APPLE_SIGN_IN=1 once the App ID has the
  // capability (paid team), then `npx expo prebuild --clean` and rebuild.
  const apple = process.env.EXPO_PUBLIC_APPLE_SIGN_IN === '1'
  // PENDING(google-sign-in): EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (+ _WEB_CLIENT_ID in .env.local)
  // from Google Cloud, then prebuild and rebuild.
  const googleIos = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  const plugins = [...(config.plugins ?? [])]
  if (apple) plugins.push('expo-apple-authentication')
  if (googleIos) {
    const iosUrlScheme = `com.googleusercontent.apps.${googleIos.replace('.apps.googleusercontent.com', '')}`
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme }])
  }
  return {
    ...config,
    name: config.name ?? 'mobile',
    slug: config.slug ?? 'mobile',
    ios: { ...config.ios, usesAppleSignIn: apple },
    plugins,
  }
}
