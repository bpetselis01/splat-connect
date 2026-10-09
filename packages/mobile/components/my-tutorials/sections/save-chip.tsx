// The only feedback that a write happened, now the Save buttons are gone.
//
// Lives in the stack header (see (my)/tutorials/[id]/_layout.tsx) rather than
// at the top of each section's body, where it moved the content down a line
// every time its state changed. It reads the draft itself, so the header can
// declare it once for all seven screens.
import { useEffect } from 'react'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { useDraft } from '../../../lib/use-tutorial-draft'
import { theme } from '../../../lib/theme'
import type { DraftSaveState } from '../../../lib/use-tutorial-draft'

// The strings are the accessibility labels; the layout also keys off null.
export const SAVE_CHIP_LABEL: Record<DraftSaveState, string | null> = {
  idle: null,
  saving: 'Saving',
  saved: 'Saved',
  // The error itself is shown by an ErrorRow in the section; an icon as well
  // would be the same news twice.
  error: null,
}

export function SaveChip() {
  const { saveState } = useDraft()
  const reduce = useReducedMotion()
  const bob = useSharedValue(0)
  const pop = useSharedValue(0)
  useEffect(() => {
    if (saveState === 'saving' && !reduce) {
      bob.value = withRepeat(withSequence(withTiming(-3, { duration: 350 }), withTiming(0, { duration: 350 })), -1)
    } else bob.value = 0
    pop.value = saveState === 'saved' ? (reduce ? 1 : withSpring(1, { damping: 8 })) : 0
  }, [saveState, reduce, bob, pop])
  const cloud = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }))
  const tick = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }], opacity: pop.value }))

  const label = SAVE_CHIP_LABEL[saveState]
  if (!label) return null
  return saveState === 'saving' ? (
    <Animated.View testID="save-chip" accessible accessibilityLabel={label} style={cloud}>
      <Ionicons testID="save-chip-saving" name="cloud-upload-outline" size={22} color={theme.colors.primary} />
    </Animated.View>
  ) : (
    <Animated.View testID="save-chip" accessible accessibilityLabel={label} style={tick}>
      <Ionicons testID="save-chip-saved" name="checkmark-circle" size={22} color={theme.colors.success} />
    </Animated.View>
  )
}
