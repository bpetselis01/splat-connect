// packages/mobile/components/ui/Chip.tsx
import { Text, StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'
import { AnimatedPressable } from './AnimatedPressable'

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-selected={active}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: theme.radii.pill,
    paddingVertical: theme.spacing(3),
    paddingHorizontal: theme.spacing(4),
    backgroundColor: theme.colors.accentLight,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: theme.colors.text },
  text: { fontFamily: theme.fonts.semiBold, color: theme.colors.text },
  textActive: { color: '#ffffff' },
})
