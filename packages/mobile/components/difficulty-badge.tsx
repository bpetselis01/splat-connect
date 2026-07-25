// packages/mobile/components/difficulty-badge.tsx
import { View, Text, StyleSheet } from 'react-native'
import type { Difficulty } from '@splat-connect/types'
import { theme } from '../lib/theme'

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const colors = theme.colors.difficulty[difficulty]
  const label = difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: theme.radii.pill },
  // Uppercased in the style, not the string, so the badge reads as a small
  // caps label while the text node stays title case — screen readers handle
  // "Easy" better than "EASY", and the unit test asserts title case.
  //
  // Note for anyone writing Playwright assertions against this: getByText
  // matches textContent, NOT the transformed text. It renders as "EASY" but
  // only `getByText('Easy')` will match. Verified, not assumed.
  //
  // Tracking added because uppercase text at this size sets tight.
  text: {
    fontSize: 12,
    fontFamily: theme.fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
})
