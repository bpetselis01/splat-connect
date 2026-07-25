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
  text: { fontSize: theme.type.caption, fontFamily: theme.fonts.bold },
})
