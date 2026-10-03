// The board's "Add a shortcut" sheet: every feature, grouped, one tap to put
// it on Home or take it off. A plain transparent Modal with our own sheet
// rather than a native formSheet, because a formSheet clips its ScrollView to
// the first child on iOS; here the ScrollView is the sheet's direct child.
import { useMemo, useRef, useState } from 'react'
import { Modal, PanResponder, View, Text, TextInput, ScrollView, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { FEATURES, useHomeShortcuts, type ShortcutGroup } from '../../lib/home-shortcuts'
import { theme } from '../../lib/theme'
import { TINT_BG } from './tint'

const GROUPS: ShortcutGroup[] = ['Learn and build', 'Toys', 'Printing', 'Community', 'Me']
// A downward drag on the handle area past this closes the sheet.
const CLOSE_DRAG = 80

export function AddShortcutSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { ids, add, remove } = useHomeShortcuts()
  const [query, setQuery] = useState('')
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const drag = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && g.dy > Math.abs(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dy > CLOSE_DRAG) closeRef.current()
      },
    })
  ).current

  const q = query.trim().toLowerCase()
  const groups = useMemo(
    () =>
      GROUPS.map((group) => ({
        group,
        items: FEATURES.filter((f) => f.group === group && f.name.toLowerCase().includes(q)),
      })).filter((g) => g.items.length > 0),
    [q]
  )

  return (
    <Modal
      testID="add-sheet-modal"
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={styles.sheet}>
          <View {...drag.panHandlers}>
            <View style={styles.grab} />
            <View style={styles.head}>
              <Text accessibilityRole="header" style={styles.title}>Add a shortcut</Text>
              <Text style={styles.count}>{`${ids.length} on Home`}</Text>
            </View>
          </View>
          <View style={styles.search}>
            <Ionicons name="search-outline" size={18} color={theme.colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search features"
              placeholderTextColor={theme.colors.muted}
              accessibilityLabel="Search features"
              autoCorrect={false}
              returnKeyType="search"
              style={styles.input}
            />
          </View>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {groups.length === 0 ? <Text style={styles.empty}>No features match</Text> : null}
            {groups.map(({ group, items }) => (
              <View key={group}>
                <Text testID="sheet-group" style={styles.group}>{group}</Text>
                <View style={styles.rows}>
                  {items.map((f) => {
                    const on = ids.includes(f.id)
                    return (
                      <Pressable
                        key={f.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={on ? `Remove ${f.name} from Home` : `Add ${f.name} to Home`}
                        onPress={() => (on ? remove(f.id) : add(f.id))}
                        style={styles.row}
                      >
                        <View style={[styles.icon, { backgroundColor: TINT_BG[f.tint] }]}>
                          <Ionicons name={f.icon} size={22} color={theme.colors.ink} />
                        </View>
                        <Text style={styles.name} numberOfLines={1}>{f.name}</Text>
                        <View testID="row-control" style={[styles.control, on && styles.controlOn]}>
                          <Ionicons
                            name={on ? 'checkmark' : 'add'}
                            size={16}
                            color={on ? theme.colors.successDeep : theme.colors.primaryDeep}
                          />
                        </View>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(28,37,48,0.38)' },
  sheet: {
    flex: 1,
    marginTop: 78,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(28,37,48,0.18)', alignSelf: 'center', marginTop: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10 },
  title: { fontFamily: theme.fonts.display, fontSize: 22, color: theme.colors.ink },
  count: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.muted },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.field,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
  },
  input: { flex: 1, paddingVertical: 10, fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.ink },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  group: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    letterSpacing: 0.96,
    textTransform: 'uppercase',
    color: theme.colors.muted,
    marginTop: 18,
    marginBottom: 8,
  },
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
  name: { flex: 1, fontFamily: theme.fonts.bold, fontSize: 14.5, color: theme.colors.ink },
  control: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentLight },
  controlOn: { backgroundColor: theme.colors.mintSoft },
  empty: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.muted, textAlign: 'center', paddingVertical: 32 },
})
