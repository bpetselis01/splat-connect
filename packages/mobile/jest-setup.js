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
