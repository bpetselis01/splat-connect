import { render, screen } from '@testing-library/react-native'
import { Text, StyleSheet } from 'react-native'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'
import { Screen } from '../../../../components/ui/Screen'
import { theme } from '../../../../lib/theme'

const ISLAND_INSET = { top: 59, bottom: 34, left: 0, right: 0 }

function flatPaddingTop(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style).paddingTop
}

function renderInInset(ui: React.ReactElement, inset = ISLAND_INSET) {
  return render(
    <SafeAreaInsetsContext.Provider value={inset}>{ui}</SafeAreaInsetsContext.Provider>
  )
}

describe('Screen', () => {
  it('offsets content below the status bar cutout when the screen draws its own header', () => {
    renderInInset(
      <Screen ownHeader testID="screen">
        <Text>Tutorial Library</Text>
      </Screen>
    )

    // Without this a tab root's own ScreenHeader renders underneath the
    // Dynamic Island — no native header has cleared it.
    expect(flatPaddingTop('screen')).toBe(ISLAND_INSET.top + theme.spacing(4))
  })

  it('does NOT pay the inset again under a native header', () => {
    renderInInset(
      <Screen testID="screen">
        <Text>Details</Text>
      </Screen>
    )

    // The regression this guards: every screen behind a native stack header
    // opened with insets.top + 16 of dead space, because the header had
    // already cleared the notch and Screen added it a second time. Invisible
    // on react-native-web, where insets.top is 0, which is how it survived.
    expect(flatPaddingTop('screen')).toBe(theme.spacing(4))
  })

  it('falls back to plain padding where there is no inset', () => {
    renderInInset(
      <Screen ownHeader testID="screen">
        <Text>Tutorial Library</Text>
      </Screen>,
      { top: 0, bottom: 0, left: 0, right: 0 }
    )

    expect(flatPaddingTop('screen')).toBe(theme.spacing(4))
  })
})
