// packages/mobile/components/home/home-screen.tsx
//
// The Home tab root, from the approved mockup: a Home title with Edit, the
// Today card when something is waiting, the shortcut grid, then recents. It
// draws its own header (the tab has no native one) and clears the floating
// tab bar. The searchable Explore page is its own hidden route.
import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '../../lib/theme'
import { tabBarClearance } from '../../lib/tab-bar-layout'
import { scrollFrame, scrollContent } from '../../lib/layout'
import { useCapabilities } from '../../lib/capabilities'
import { useHomeShortcuts } from '../../lib/home-shortcuts'
import { Screen } from '../ui/Screen'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { ShortcutGrid } from './shortcut-grid'
import { RecentRows } from './recent-rows'
import { AddShortcutSheet } from './add-shortcut-sheet'

function TodayCard({ total, exchanges }: { total: number; exchanges: number }) {
  const router = useRouter()
  const count = `${total} new ${total === 1 ? 'message' : 'messages'}`
  // Only claim "your toy exchange" when every unread one is about it.
  const about = exchanges === total ? ' about your toy exchange.' : ' waiting for you.'
  return (
    <AnimatedPressable
      onPress={() => router.push('/inbox')}
      accessibilityRole="button"
      accessibilityLabel={`${count}${about} Open Inbox`}
      pressScale={0.98}
      style={styles.today}
    >
      <View style={styles.todayIcon}>
        <Ionicons name="notifications-outline" size={22} color={theme.colors.ink} />
      </View>
      <View style={styles.todayBody}>
        <Text style={styles.todayText}>
          <Text style={styles.todayCount}>{count}</Text>
          {about}
        </Text>
        <Text style={styles.todaySmall}>Inbox</Text>
      </View>
    </AnimatedPressable>
  )
}

export function HomeScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { caps } = useCapabilities()
  const shortcuts = useHomeShortcuts()
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [dragging, setDragging] = useState(false)
  const unread = caps?.unread

  return (
    <Screen ownHeader>
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEnabled={!dragging}
        style={scrollFrame}
        contentContainerStyle={[scrollContent, { paddingBottom: tabBarClearance(insets.bottom) }]}
      >
        <View style={styles.topbar}>
          <Text accessibilityRole="header" style={styles.title}>
            Home
          </Text>
          <AnimatedPressable
            onPress={() => setEditing((e) => !e)}
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Done' : 'Edit'}
            pressScale={0.96}
            style={[styles.editBtn, editing && styles.editBtnOn]}
          >
            <Text style={[styles.editText, editing && styles.editTextOn]}>{editing ? 'Done' : 'Edit'}</Text>
          </AnimatedPressable>
        </View>

        {!editing && unread && unread.total > 0 ? <TodayCard total={unread.total} exchanges={unread.exchanges} /> : null}

        <View style={styles.grid}>
          <ShortcutGrid
            features={shortcuts.features}
            editing={editing}
            onOpen={(f) => router.push(f.href)}
            onAdd={() => setAdding(true)}
            onEnterEdit={() => setEditing(true)}
            onRemove={shortcuts.remove}
            onMove={shortcuts.move}
            onMoveToTop={shortcuts.moveToTop}
            onDragging={setDragging}
          />
        </View>

        {editing ? (
          <Text style={styles.hint}>Drag to reorder. Let go and a menu appears.</Text>
        ) : (
          <>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Pick up where you left off
            </Text>
            <RecentRows />
          </>
        )}
      </ScrollView>
      <AddShortcutSheet visible={adding} onClose={() => setAdding(false)} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { fontFamily: theme.fonts.display, fontSize: 30, lineHeight: 33, color: theme.colors.ink },
  editBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    ...theme.shadow(1),
  },
  editBtnOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  editText: { fontFamily: theme.fonts.black, fontSize: 14, color: theme.colors.primaryDeep },
  editTextOn: { color: '#fff' },
  today: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.surface,
    ...theme.shadow(2),
  },
  todayIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.apricotSoft,
  },
  todayBody: { flex: 1 },
  todayText: { fontFamily: theme.fonts.regular, fontSize: 14, lineHeight: 19, color: theme.colors.ink },
  todayCount: { fontFamily: theme.fonts.black },
  todaySmall: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.muted },
  grid: { marginTop: 22 },
  hint: {
    marginTop: 22,
    textAlign: 'center',
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.muted,
  },
  sectionTitle: {
    marginTop: 26,
    marginBottom: 10,
    fontFamily: theme.fonts.display,
    fontSize: 19,
    lineHeight: 24,
    color: theme.colors.ink,
  },
})
