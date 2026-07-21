// packages/mobile/components/difficulty-badge.tsx
import { View, Text, StyleSheet } from 'react-native'
import type { Difficulty } from '@splat-connect/types'
import { theme } from '../lib/theme'

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const colors = theme.colors.difficulty[difficulty]
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{difficulty.toUpperCase()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 4 },
  text: { fontSize: 11, fontFamily: theme.fonts.bold },
})
