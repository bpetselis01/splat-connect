// Registry ids → Ionicons for the Not built yet tile. Anything unlisted gets
// the fallback; the registry itself stays icon-free because web uses Phosphor.
import type { ComponentProps } from 'react'
import type { Ionicons } from '@expo/vector-icons'
type Icon = ComponentProps<typeof Ionicons>['name']

const ICONS: Record<string, Icon> = {
  'apple-sign-in': 'logo-apple',
  'google-sign-in': 'logo-google',
  'android-one-tap': 'flash-outline',
  'apple-revoke': 'key-outline',
  'email-delivery': 'mail-outline',
  'report-problem-mobile': 'flag-outline',
  'thank-people': 'heart-outline',
  'guide-community-notes': 'chatbubbles-outline',
  'guide-build-done': 'checkmark-done-outline',
  'makers-ask-first': 'chatbubble-ellipses-outline',
  'locations-and-distance': 'navigate-outline',
}

export const pendingIcon = (id: string): Icon => ICONS[id] ?? 'construct-outline'
