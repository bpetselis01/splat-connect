// Whether the floating tab bar is tucked away: 0 shown, 1 hidden. One value for
// the whole app, because the bar is global and so are the bands that ride on it.
// Reading pages hide it as you scroll down and bring it back as you scroll up.
import { useRef } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { makeMutable, withTiming } from 'react-native-reanimated'
import { theme } from './theme'

export const tabBarHidden = makeMutable(0)

export const setTabBarHidden = (hidden: boolean) => {
  tabBarHidden.value = withTiming(hidden ? 1 : 0, { duration: theme.motion.base })
}

const TOP = 40
const TRAVEL = 10

/** One scroll event: `ref` is where the last decision was made. */
export function stepTabBar(ref: number, y: number): { ref: number; hidden?: boolean } {
  if (y <= TOP) return { ref: y, hidden: false }
  if (y > ref + TRAVEL) return { ref: y, hidden: true }
  if (y < ref - TRAVEL) return { ref: y, hidden: false }
  return { ref }
}

/** Spread onto a ScrollView / FlatList of a reading page. */
export function useHideTabBarOnScroll() {
  const ref = useRef(0)
  return {
    scrollEventThrottle: 16,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = stepTabBar(ref.current, e.nativeEvent.contentOffset.y)
      ref.current = next.ref
      if (next.hidden !== undefined) setTabBarHidden(next.hidden)
    },
  }
}
