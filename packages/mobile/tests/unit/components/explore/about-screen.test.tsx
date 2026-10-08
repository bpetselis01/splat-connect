// packages/mobile/tests/unit/components/explore/about-screen.test.tsx
// journeys: Q16
import { render, screen, fireEvent } from '@testing-library/react-native'
import { Linking } from 'react-native'
import { ABOUT_LEAD, ABOUT_PILLARS, ABOUT_TEAM_BLURB } from '@splat-connect/types'
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

  it("says what SPLAT is and promises, in the web About page's words", () => {
    render(<AboutScreen />)
    expect(screen.getByText(ABOUT_LEAD)).toBeTruthy()
    for (const p of ABOUT_PILLARS) {
      expect(screen.getByText(p.t)).toBeTruthy()
      expect(screen.getByText(p.d)).toBeTruthy()
    }
    expect(screen.getByRole('link', { name: 'Our team' }).props.accessibilityHint).toBe(ABOUT_TEAM_BLURB)
    expect(screen.getByRole('link', { name: 'Contact' }).props.accessibilityHint).toBe(
      'Safety report: same day · Everything else: 2 to 5 days · Weekends: slower'
    )
  })

  it('exposes every row as accessibilityRole link, and nothing else claims the role', () => {
    render(<AboutScreen />)
    expect(screen.getAllByRole('link').length).toBe(ROWS.length)
  })
})
