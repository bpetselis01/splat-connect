// The board's "Add a shortcut" sheet: every feature, grouped, one tap to put
// it on Home or take it off. On iOS it is a native page sheet, so the system's
// swipe-down dismisses it from the header and from the list at its top; the
// ScrollView is the sheet's direct child because a native sheet clips one that
// is not. Elsewhere it is our own sheet over a dim, dragged down by a
// PanResponder from the header, or from the list while it sits at its top.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type GestureResponderHandlers,
  type PanResponderGestureState,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { FEATURES, useHomeShortcuts, type ShortcutGroup } from '../../lib/home-shortcuts'
import { theme } from '../../lib/theme'
import { TINT_BG } from './tint'

const GROUPS: ShortcutGroup[] = ['Learn and build', 'Toys', 'Printing', 'Community', 'Me']
// A downward drag past this closes the sheet, or a fling faster than FLING.
const CLOSE_DRAG = 100
const FLING = 1.2

/** A downward, mostly vertical drag the sheet should take from its children. */
export function claimsSheetDrag(g: Pick<PanResponderGestureState, 'dx' | 'dy'>, scrollY = 0) {
  return g.dy > 6 && g.dy > Math.abs(g.dx) && scrollY <= 0
}

export function shouldCloseSheet(g: Pick<PanResponderGestureState, 'dy' | 'vy'>) {
  return g.dy > CLOSE_DRAG || g.vy > FLING
}

function SheetContent({ headHandlers, onScroll }: { headHandlers?: GestureResponderHandlers; onScroll?: (y: number) => void }) {
  const { ids, add, remove } = useHomeShortcuts()
  const [query, setQuery] = useState('')
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
    <>
      <View testID="add-sheet-head" {...headHandlers}>
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
      <ScrollView
        testID="add-sheet-list"
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={onScroll ? (e) => onScroll(e.nativeEvent.contentOffset.y) : undefined}
      >
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
    </>
  )
}

/** The sheet for Android and web: slides in, follows the finger down, slides out. */
// ponytail: the JS driver, since a pan already moves it from JS; the native one if it ever janks.
function DragSheet({ onClose }: { onClose: () => void }) {
  const { height } = useWindowDimensions()
  const ty = useRef(new Animated.Value(height)).current
  const scrollY = useRef(0)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    Animated.spring(ty, { toValue: 0, useNativeDriver: false, damping: 22, stiffness: 220, mass: 0.9 }).start()
  }, [ty])

  const dismiss = () => Animated.timing(ty, { toValue: height, duration: 180, useNativeDriver: false }).start(() => closeRef.current())
  const dismissRef = useRef(dismiss)
  dismissRef.current = dismiss

  // One responder for the header, which always drags, and one for the sheet,
  // which takes the drag from the list only while the list is at its top.
  const responder = (needsTop: boolean) =>
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => claimsSheetDrag(g, needsTop ? scrollY.current : 0),
      onPanResponderMove: (_, g) => ty.setValue(Math.max(0, g.dy)),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, g) => {
        if (shouldCloseSheet(g)) dismissRef.current()
        else Animated.spring(ty, { toValue: 0, useNativeDriver: false }).start()
      },
      onPanResponderTerminate: () => Animated.spring(ty, { toValue: 0, useNativeDriver: false }).start(),
    })
  const head = useRef(responder(false)).current
  const sheet = useRef(responder(true)).current

  return (
    <View style={styles.root}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={dismiss} style={StyleSheet.absoluteFill} />
      <Animated.View
        testID="add-sheet"
        accessibilityViewIsModal
        onAccessibilityEscape={dismiss}
        {...sheet.panHandlers}
        style={[styles.sheet, { transform: [{ translateY: ty }] }]}
      >
        <SheetContent headHandlers={head.panHandlers} onScroll={(y) => (scrollY.current = y)} />
      </Animated.View>
    </View>
  )
}

export function AddShortcutSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  if (Platform.OS === 'ios') {
    // A native swipe-down leaves `visible` true until told, hence onDismiss.
    return (
      <Modal
        testID="add-sheet-modal"
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
        onDismiss={onClose}
      >
        <View style={styles.page} onAccessibilityEscape={onClose}>
          <SheetContent />
        </View>
      </Modal>
    )
  }
  return (
    <Modal testID="add-sheet-modal" visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <DragSheet onClose={onClose} />
    </Modal>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  root: { flex: 1, backgroundColor: theme.colors.scrim },
  sheet: {
    flex: 1,
    marginTop: 78,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: theme.colors.border, alignSelf: 'center', marginTop: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10 },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.title, color: theme.colors.ink },
  count: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
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
  input: { flex: 1, paddingVertical: 10, fontFamily: theme.fonts.semiBold, fontSize: theme.type.label, color: theme.colors.ink },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  group: {
    fontFamily: theme.fonts.black,
    fontSize: theme.type.caption,
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
  name: { flex: 1, fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  control: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentLight },
  controlOn: { backgroundColor: theme.colors.mintSoft },
  empty: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.label, color: theme.colors.muted, textAlign: 'center', paddingVertical: 32 },
})
