// packages/mobile/components/ui/FilterControls.tsx
//
// The pieces every filter surface shares (the Map's sheet, the libraries'
// filter page): the round filter button with its count, a group's label, and
// an option pill that is outlined until chosen, then the inverse pill.
import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'

/** Dark while open (an ✕ that closes) or while any filter is on, with the count on a badge. */
export function FilterButton({
  count,
  open = false,
  onPress,
  style,
}: {
  count: number
  open?: boolean
  onPress: () => void
  style?: StyleProp<ViewStyle>
}) {
  const on = open || count > 0
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={open ? 'Close filters' : count ? `Filters, ${count} on` : 'Filters'}
      style={[styles.button, on && styles.buttonOn, style]}
    >
      <Ionicons name={open ? 'close' : 'options-outline'} size={20} color={on ? theme.colors.onInverse : theme.colors.ink} />
      {count > 0 && !open ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  )
}

export function GroupLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <View style={styles.groupHead}>
      <Text style={styles.groupLabel}>{label}</Text>
      {hint ? <Text style={styles.groupHint}>{hint}</Text> : null}
    </View>
  )
}

/** A filter option: outlined, the inverse pill when chosen. `radio` for one-of-several groups. */
export function OptionPill({ label, on, onPress, radio }: { label: string; on: boolean; onPress: () => void; radio?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={radio ? 'radio' : 'button'}
      accessibilityState={radio ? { checked: on } : { selected: on }}
      style={[styles.option, on && styles.optionOn]}
    >
      <Text style={[styles.optionText, on && styles.optionTextOn]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow(2),
  },
  buttonOn: { backgroundColor: theme.colors.inverse },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.apricot,
    borderWidth: 2,
    borderColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: theme.fonts.black, fontSize: theme.type.micro, color: theme.colors.onColor },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.spacing(2) },
  groupLabel: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  groupHint: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted },
  option: {
    minHeight: 40,
    paddingHorizontal: theme.spacing(4),
    borderRadius: theme.radii.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionOn: { backgroundColor: theme.colors.inverse, borderColor: theme.colors.inverse },
  optionText: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  optionTextOn: { color: theme.colors.onInverse },
})
