import { useEffect, useState } from 'react'
import { Keyboard, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tabBarClearance } from './tab-bar-layout'
import { theme } from './theme'

/**
 * The app's one bottom rule. A bottom action sits one gutter above the home
 * indicator, or one gutter above the floating tab bar on a tab root. A footer
 * band uses this as its paddingBottom; scroll content that ends in an action
 * uses it as its own, so the last button rests exactly where a pinned one would.
 * With the keyboard up the inset is already under the keyboard, so only the
 * gutter is left (KeyboardAvoidingView lifts the band by the keyboard's height).
 */
export function bottomClearance(insetBottom: number, hasTabBar = false, keyboardUp = false): number {
  if (hasTabBar) return tabBarClearance(insetBottom)
  return (keyboardUp ? 0 : insetBottom) + theme.spacing(3)
}

export function useBottomClearance(hasTabBar = false): number {
  const { bottom } = useSafeAreaInsets()
  const [keyboardUp, setKeyboardUp] = useState(false)
  useEffect(() => {
    const ios = Platform.OS === 'ios'
    const subs = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardUp(true)),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardUp(false)),
    ]
    return () => subs.forEach((s) => s.remove())
  }, [])
  return bottomClearance(bottom, hasTabBar, keyboardUp)
}
