// Reanimated v4 + react-native-worklets 0.x have no native module in the Jest
// (jsdom/node) environment, so worklets must be mocked before reanimated loads.
// See: https://docs.swmansion.com/react-native-worklets/docs/guides/testing
//      https://docs.swmansion.com/react-native-reanimated/docs/guides/testing
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'))

require('react-native-reanimated').setUpTests()

// Screens read safe-area insets via useSafeAreaInsets, which throws without a
// SafeAreaProvider. Unit tests render components directly rather than through
// the root layout, so they use the library's own zero-inset mock.
// `.default` is required: the shipped mock is an ES default export.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default)

// @expo/ui's community BottomSheet is a SwiftUI / Compose sheet with no Jest
// environment behind it. The stand-in keeps the one behaviour the screens
// depend on — children mount only while presented — behind the same
// present/dismiss ref methods, so tests open the sheet the way a thumb would.
jest.mock('@expo/ui/community/bottom-sheet', () => {
  const React = require('react')
  const { View } = require('react-native')
  const Sheet = React.forwardRef(({ children, onDismiss }, ref) => {
    const [open, setOpen] = React.useState(false)
    React.useImperativeHandle(ref, () => ({
      present: () => setOpen(true),
      dismiss: () => {
        setOpen(false)
        onDismiss?.()
      },
    }))
    return open ? React.createElement(View, { testID: 'bottom-sheet' }, children) : null
  })
  return { __esModule: true, default: Sheet, BottomSheet: Sheet, BottomSheetModal: Sheet, BottomSheetView: View }
})
