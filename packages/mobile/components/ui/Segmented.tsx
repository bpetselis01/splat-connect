// packages/mobile/components/ui/Segmented.tsx
//
// The board's one-of-N switch, in its two dresses:
// - 'track' (Guides' All / Toy adaptation / Assistive tech): a sunken pill
//   track, the chosen segment raised white on it.
// - 'pills' (Inbox, Toy library): two free-standing pills, the chosen one
//   filled brand.
// - 'boxed' (sign in / create account): one raised box split by an ink rule,
//   the chosen half filled ink, labels in uppercase.
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
  options: { value: T; label: string; icon?: IconName; testID?: string }[]
  value: T
  onChange: (value: T) => void
  /** 'tint' is 'pills' with the chosen one tinted rather than filled — the
   *  Toy library's Toys / Organisations. */
  variant?: 'track' | 'pills' | 'tint' | 'boxed'
  /** Names the group for a screen reader: "Guide type", "Inbox". */
  label: string
}) {
  const track = variant === 'track'
  const boxed = variant === 'boxed'
  const group = (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={track ? styles.track : boxed ? styles.boxClip : styles.pills}
    >
      {options.map((o, i) => {
        const on = o.value === value
        if (boxed) {
          return (
            <Pressable
              key={o.value}
              testID={o.testID}
              onPress={() => onChange(o.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.box, i > 0 && styles.boxDivider, on && styles.boxOn]}
            >
              {/* Uppercased in style, not in the string, so a screen reader is
                  handed "Sign in" rather than something it may spell out. */}
              <Text numberOfLines={1} style={[styles.boxText, on && styles.pillTextOn]}>
                {o.label}
              </Text>
            </Pressable>
          )
        }
        return (
          <Pressable
            key={o.value}
            testID={o.testID}
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
  // Two views because the clip that rounds the halves would also clip the shadow.
  return boxed ? <View style={styles.boxShadow}>{group}</View> : group
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
  boxShadow: {
    alignSelf: 'stretch',
    borderRadius: theme.radii.field,
    marginBottom: theme.spacing(5),
    ...theme.shadow(2),
  },
  boxClip: {
    flexDirection: 'row',
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  box: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing(2),
  },
  boxDivider: { borderLeftWidth: theme.border.hairline, borderLeftColor: theme.colors.ink },
  boxOn: { backgroundColor: theme.colors.ink },
  boxText: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    // Web sets these labels in IBM Plex Mono. The phone loads Nunito and
    // Jersey 10 only, and a fourth family for two words is not worth the
    // bundle; Nunito Black uppercase at web's 0.05em tracking is the match.
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.ink,
  },
})
