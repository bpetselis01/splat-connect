// packages/mobile/components/ui/FilterPanel.tsx
//
// The collapsed filters: one "Filters" pill under the search field, with a
// count of what is on, that unfolds the controls in place. Inline rather than
// a sheet, so there is no formSheet ScrollView to get wrong and the list
// stays one scroll.
import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'

export function FilterPanel({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={activeCount ? `Filters, ${activeCount} active` : 'Filters'}
        accessibilityState={{ expanded: open }}
        style={[styles.button, activeCount > 0 && styles.buttonOn]}
      >
        <Ionicons name="options-outline" size={16} color={theme.colors.primaryDark} />
        <Text style={styles.label}>Filters</Text>
        {activeCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{activeCount}</Text>
          </View>
        ) : null}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={theme.colors.muted} />
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: theme.spacing(2) },
  button: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: theme.spacing(4),
    borderRadius: theme.radii.pill,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...theme.shadow(1),
  },
  buttonOn: { backgroundColor: theme.colors.accentLight, borderColor: theme.colors.primary },
  label: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.ink },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: theme.fonts.black, fontSize: theme.type.micro, color: theme.colors.surface },
  body: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
})
