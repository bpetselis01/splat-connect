// packages/mobile/tests/unit/components/explore/about-screen.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { Linking } from 'react-native'
import { AboutScreen } from '../../../../components/explore/about-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const ROWS: [string, string][] = [
  ['Our team', '/about/team'],
  ['Partners and supporters', '/about/partners'],
  ['Support SPLAT', '/about/support'],
  ['Families', '/get-involved/families'],
  ['Contributors', '/get-involved/contributors'],
  ['Organisations', '/get-involved/organisations'],
  ['Impact', '/impact'],
  ['Contact', '/contact'],
  ['Safety', '/safety'],
]

describe('AboutScreen', () => {
  it('opens the matching web page for every link row', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve(true))
    render(<AboutScreen />)

    for (const [label, path] of ROWS) {
      fireEvent.press(screen.getByRole('link', { name: label }))
      expect(openURL).toHaveBeenCalledWith(`${process.env.EXPO_PUBLIC_WEB_URL}${path}`)
    }
    expect(openURL).toHaveBeenCalledTimes(ROWS.length)
  })

  it('exposes every row as accessibilityRole link, and nothing else claims the role', () => {
    render(<AboutScreen />)
    expect(screen.getAllByRole('link').length).toBe(ROWS.length)
  })
})
