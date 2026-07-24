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
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: theme.radii.sm },
  text: { fontSize: 13, fontFamily: theme.fonts.bold },
})
