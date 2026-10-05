// packages/mobile/components/ui/Flash.tsx
//
// The board's toasts, as a line that says it and goes. The app has no toast
// host; a live-region line beside the control is enough for a confirmation.
import { useEffect, useRef, useState } from 'react'
import { Text, StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'

export function useFlash(ms = 2500) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  const flash = (next: string) => {
    if (timer.current) clearTimeout(timer.current)
    setMessage(next)
    timer.current = setTimeout(() => setMessage(null), ms)
  }
  return [message, flash] as const
}

export function FlashLine({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <Text accessibilityLiveRegion="polite" style={styles.flash}>
      {message}
    </Text>
  )
}

const styles = StyleSheet.create({
  flash: {
    alignSelf: 'center',
    marginVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1),
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.inverse,
    color: theme.colors.onInverse,
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.caption,
  },
})
