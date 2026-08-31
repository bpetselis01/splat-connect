// packages/mobile/components/ui/Meter.tsx
import { View, StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'

/**
 * A hard-edged fill bar — condition-out-of-10 today, reused by Learn's
 * progress rows in Phase 4. `value/max` drives the fill width as a
 * percentage, so the bar never needs to know its own pixel width.
 */
export function Meter({ value, max = 10, width = 50 }: { value: number; max?: number; width?: number }) {
  const pct = Math.max(0, Math.min(1, max === 0 ? 0 : value / max)) * 100

  return (
    <View accessibilityLabel={`${value} of ${max}`} style={[styles.track, { width }]}>
      <View testID="meter-fill" style={[styles.fill, { width: `${pct}%` }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    height: 7,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: 2,
    backgroundColor: theme.colors.surfaceSunken,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: theme.colors.mint,
  },
})
