import { Text, StyleSheet } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { BarBand } from '../../../../components/ui/BarBand'
import { tabBarHidden } from '../../../../lib/tab-bar-visibility'

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context/jest/mock').default,
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}))

const style = () => StyleSheet.flatten(screen.getByTestId('bar-band').props.style)

afterEach(() => {
  tabBarHidden.value = 0
})

it('sits just above the bar while the bar shows, with a flat 12 below the button', () => {
  render(<BarBand><Text>Start building</Text></BarBand>)
  expect(style()).toMatchObject({ position: 'absolute', bottom: 0, paddingBottom: 12 })
  expect(style().transform).toEqual([{ translateY: -(66 + 34) }])
})

it('drops to the bottom edge, clearing the home indicator, once the bar tucks away', () => {
  tabBarHidden.value = 1
  render(<BarBand><Text>Start building</Text></BarBand>)
  expect(style()).toMatchObject({ paddingBottom: 34 })
  expect(style().transform).toEqual([{ translateY: -0 }])
})

it('reports its height so the page can pad its scroll content', () => {
  const onHeight = jest.fn()
  render(<BarBand onHeight={onHeight}><Text>Next</Text></BarBand>)
  fireEvent(screen.getByTestId('bar-band'), 'layout', { nativeEvent: { layout: { height: 88 } } })
  expect(onHeight).toHaveBeenCalledWith(88)
})
