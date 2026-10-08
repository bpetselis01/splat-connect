// packages/mobile/components/ui/Toast.tsx
//
// A short message that rises over the bottom of a screen and leaves on its
// own: the feedback for Save, Thanks and the like. The screen owns it
// (useToast) and places <Toast> last, above its pinned bar.
import { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'

export type ToastMessage = { text: string; undo?: () => void }

export function useToast(ms = 2800) {
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const show = (text: string, undo?: () => void) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ text, undo })
    timer.current = setTimeout(() => setToast(null), ms)
  }
  return { toast, show, hide: () => setToast(null) }
}

export function Toast({ toast, onHide, style }: { toast: ToastMessage | null; onHide: () => void; style?: StyleProp<ViewStyle> }) {
  const shown = useRef(new Animated.Value(0)).current
  const [last, setLast] = useState<ToastMessage | null>(toast)
  useEffect(() => {
    if (toast) setLast(toast)
    Animated.timing(shown, { toValue: toast ? 1 : 0, duration: toast ? 180 : 140, useNativeDriver: true }).start()
  }, [toast, shown])
  if (!last) return null
  return (
    <Animated.View
      pointerEvents={toast ? 'auto' : 'none'}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        style,
        { opacity: shown, transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
      ]}
    >
      <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
      <Text style={styles.text}>{last.text}</Text>
      {last.undo ? (
        <Pressable
          onPress={() => {
            last.undo?.()
            onHide()
          }}
          accessibilityRole="button"
          hitSlop={10}
          style={styles.undo}
        >
          <Text style={styles.undoText}>Undo</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: theme.spacing(4),
    right: theme.spacing(4),
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(3),
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.inverse,
    ...theme.shadow(3),
  },
  text: { flex: 1, fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.onInverse },
  undo: { minHeight: 32, justifyContent: 'center' },
  undoText: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.onInverse, textDecorationLine: 'underline' },
})
