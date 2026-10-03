// The sign-in buttons are 52px at normal text size, and grow rather than clip
// when the system text size is up: a fixed height let the label overflow its pill.
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { SocialButtons, CodeInput } from '../../../../components/auth/parts'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('../../../../lib/social-auth', () => ({
  AppleButton: () => null,
  appleAvailable: () => Promise.resolve(false),
  googleAvailable: () => false,
}))

describe('auth parts at large text', () => {
  it('lets the Google button grow and caps its label', () => {
    render(<SocialButtons onApple={() => {}} onGoogle={() => {}} />)
    const style = StyleSheet.flatten(screen.getByTestId('google-sign-in').props.style)
    expect(style.height).toBeUndefined()
    expect(style.minHeight).toBe(52)
    expect(screen.getByText('Continue with Google').props.maxFontSizeMultiplier).toBe(1.4)
  })

  it('caps the code digits so they stay inside their boxes', () => {
    render(<CodeInput value="12" onChange={() => {}} />)
    expect(screen.getByText('1', { includeHiddenElements: true }).props.maxFontSizeMultiplier).toBe(1.3)
  })
})
