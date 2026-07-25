import { render, screen } from '@testing-library/react-native'
import { Text, StyleSheet } from 'react-native'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'
import { Screen } from '../../../../components/ui/Screen'
import { theme } from '../../../../lib/theme'

const ISLAND_INSET = { top: 59, bottom: 34, left: 0, right: 0 }

function flatPaddingTop(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style).paddingTop
}

describe('Screen', () => {
  it('offsets content below the status bar cutout on a device with a top inset', () => {
    render(
      <SafeAreaInsetsContext.Provider value={ISLAND_INSET}>
        <Screen testID="screen">
          <Text>Tutorial Library</Text>
        </Screen>
      </SafeAreaInsetsContext.Provider>
    )

    // Without this the header renders underneath the Dynamic Island.
    expect(flatPaddingTop('screen')).toBe(ISLAND_INSET.top + theme.spacing(4))
  })

  it('falls back to plain padding where there is no inset', () => {
    render(
      <SafeAreaInsetsContext.Provider value={{ top: 0, bottom: 0, left: 0, right: 0 }}>
        <Screen testID="screen">
          <Text>Tutorial Library</Text>
        </Screen>
      </SafeAreaInsetsContext.Provider>
    )

    expect(flatPaddingTop('screen')).toBe(theme.spacing(4))
  })
})
