import { Keyboard } from 'react-native'
import { act, renderHook } from '@testing-library/react-native'
import { bottomClearance, useBottomClearance } from '../../../lib/bottom-clearance'
import { tabBarClearance } from '../../../lib/tab-bar-layout'
import { theme } from '../../../lib/theme'

jest.mock('react-native-safe-area-context', () => ({
  ...require('react-native-safe-area-context/jest/mock').default,
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}))

describe('bottomClearance', () => {
  it('is one gutter above the home indicator without a tab bar', () => {
    expect(bottomClearance(34)).toBe(34 + theme.spacing(3))
    expect(bottomClearance(0)).toBe(theme.spacing(3))
  })
  it('is the tab bar clearance with one, never the inset on top of it', () => {
    expect(bottomClearance(34, true)).toBe(tabBarClearance(34))
  })
  it('drops the inset while the keyboard covers it', () => {
    expect(bottomClearance(34, false, true)).toBe(theme.spacing(3))
  })
})

describe('useBottomClearance', () => {
  it('reads the inset and follows the keyboard', () => {
    const listeners: Record<string, () => void> = {}
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, cb: () => void) => {
      listeners[name] = cb
      return { remove: jest.fn() }
    }) as never)
    const { result } = renderHook(() => useBottomClearance())
    expect(result.current).toBe(34 + theme.spacing(3))
    act(() => (listeners.keyboardWillShow ?? listeners.keyboardDidShow)())
    expect(result.current).toBe(theme.spacing(3))
    act(() => (listeners.keyboardWillHide ?? listeners.keyboardDidHide)())
    expect(result.current).toBe(34 + theme.spacing(3))
  })
})
