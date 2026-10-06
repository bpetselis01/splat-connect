// "Pick up where you left off": the board's recents rows, newest first. Draws
// nothing until something has been opened, so Home has no empty heading.
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useRecents, type Recent } from '../../lib/recents'
import { theme } from '../../lib/theme'
import { TINT_BG } from './tint'

const KIND: Record<Recent['kind'], { icon: React.ComponentProps<typeof Ionicons>['name']; tint: keyof typeof TINT_BG }> = {
  guide: { icon: 'book-outline', tint: 'sky' },
  toy: { icon: 'cube-outline', tint: 'apr' },
  event: { icon: 'calendar-outline', tint: 'honey' },
  printer: { icon: 'print-outline', tint: 'vio' },
  recycling: { icon: 'leaf-outline', tint: 'mint' },
  challenge: { icon: 'bulb-outline', tint: 'honey' },
  organisation: { icon: 'business-outline', tint: 'sun' },
}

export function RecentRows() {
  const router = useRouter()
  const { recents } = useRecents()
  if (recents.length === 0) return null
  return (
    <View style={styles.rows}>
      {recents.map((r) => (
        <Pressable
          key={r.key}
          accessibilityRole="button"
          accessibilityLabel={`${r.title}, ${r.subtitle}`}
          onPress={() => router.push(r.href)}
          style={styles.row}
        >
          <View testID="recent-icon" style={[styles.icon, { backgroundColor: TINT_BG[KIND[r.kind].tint] }]}>
            <Ionicons name={KIND[r.kind].icon} size={22} color={theme.colors.ink} />
          </View>
          <View style={styles.text}>
            <Text style={styles.title} numberOfLines={1}>{r.title}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{r.subtitle}</Text>
          </View>
          {r.badge ? (
            <View testID="recent-badge" style={styles.pill}>
              <Text style={styles.pillText}>{r.badge}</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  rows: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.panel,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    ...theme.shadow(1),
  },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  title: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, lineHeight: 18, color: theme.colors.ink },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceSunken },
  pillText: { fontFamily: theme.fonts.black, fontSize: theme.type.micro, color: theme.colors.ink },
})
