// Reanimated v4 + react-native-worklets 0.x have no native module in the Jest
// (jsdom/node) environment, so worklets must be mocked before reanimated loads.
// See: https://docs.swmansion.com/react-native-worklets/docs/guides/testing
//      https://docs.swmansion.com/react-native-reanimated/docs/guides/testing
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'))

require('react-native-reanimated').setUpTests()
