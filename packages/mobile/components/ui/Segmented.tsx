// packages/mobile/components/ui/Segmented.tsx
//
// The board's one-of-N switch, in its two dresses:
// - 'track' (Guides' All / Toy adaptation / Assistive tech): a sunken pill
//   track, the chosen segment raised white on it.
// - 'pills' (Inbox, Toy library): two free-standing pills, the chosen one
//   filled brand.
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'

type IconName = React.ComponentProps<typeof Ionicons>['name']

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  variant = 'track',
  label,
}: {
  options: { value: T; label: string; icon?: IconName }[]
  value: T
  onChange: (value: T) => void
  /** 'tint' is 'pills' with the chosen one tinted rather than filled — the
   *  Toy library's Toys / Organisations. */
  variant?: 'track' | 'pills' | 'tint'
  /** Names the group for a screen reader: "Guide type", "Inbox". */
  label: string
}) {
  const track = variant === 'track'
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={track ? styles.track : styles.pills}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            aria-selected={on}
            style={({ pressed }) => [
              track ? styles.seg : styles.pill,
              on && (track ? styles.segOn : variant === 'tint' ? styles.pillTint : styles.pillOn),
              pressed && styles.pressed,
            ]}
          >
            {o.icon ? (
              <Ionicons name={o.icon} size={14} color={on ? theme.colors.ink : theme.colors.muted} />
            ) : null}
            <Text
              style={[
                styles.text,
                track
                  ? { color: on ? theme.colors.ink : theme.colors.muted }
                  : on && (variant === 'tint' ? styles.pillTextTint : styles.pillTextOn),
              ]}
              numberOfLines={2}
            >
              {o.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceSunken,
  },
  seg: {
    flex: 1,
    minHeight: 44,
    borderRadius: theme.radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing(2),
  },
  segOn: { backgroundColor: theme.colors.surface, ...theme.shadow(1) },
  pills: { flexDirection: 'row', gap: theme.spacing(2) },
  pill: {
    flex: 1,
    minHeight: 44,
    borderRadius: theme.radii.pill,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pillOn: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primaryDark },
  pressed: { transform: [{ scale: theme.motion.pressScale }] },
  text: {
    fontFamily: theme.fonts.black,
    fontSize: theme.type.caption,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  pillTextOn: { color: theme.colors.surface },
  pillTint: { backgroundColor: theme.colors.accentLight, borderColor: theme.colors.primary },
  pillTextTint: { color: theme.colors.primaryDeep },
})
