// The shared auth controls' behaviour: which social buttons show and where
// each goes, how the code boxes read what is typed, the password field's
// "at least 6" hint, and the terms checkbox.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { useState } from 'react'
import { Platform } from 'react-native'
import { SocialButtons, CodeInput, PasswordField, TermsCheckbox } from '../../../../components/auth/parts'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
let mockApple = false
let mockGoogle = false
jest.mock('../../../../lib/social-auth', () => ({
  AppleButton: ({ onPress }: { onPress: () => void }) => {
    const { Pressable, Text } = require('react-native')
    return (
      <Pressable testID="native-apple" onPress={onPress}>
        <Text>native apple</Text>
      </Pressable>
    )
  },
  appleAvailable: () => Promise.resolve(mockApple),
  googleAvailable: () => mockGoogle,
}))

const original = Platform.OS
const setOS = (os: 'ios' | 'android') => Object.defineProperty(Platform, 'OS', { value: os, configurable: true })

beforeEach(() => {
  jest.clearAllMocks()
  mockApple = false
  mockGoogle = false
  setOS('ios')
})
afterAll(() => setOS(original as 'ios'))

describe('SocialButtons', () => {
  const draw = () => render(<SocialButtons onApple={onApple} onGoogle={onGoogle} />)
  const onApple = jest.fn()
  const onGoogle = jest.fn()

  it('A03 a build with no Google client id sends the Google button to Not built yet, and never signs in', () => {
    draw()
    fireEvent.press(screen.getByTestId('google-sign-in'))
    expect(onGoogle).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/not-built', params: { feature: 'google-sign-in' } })
  })

  it('A03 a build with Google configured signs in and does not open Not built yet', () => {
    mockGoogle = true
    draw()
    fireEvent.press(screen.getByTestId('google-sign-in'))
    expect(onGoogle).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('A03 on iOS without Apple switched on, a placeholder opens Not built yet and the native button is absent', async () => {
    draw()
    await act(async () => {})
    expect(screen.queryByTestId('native-apple')).toBeNull()
    fireEvent.press(screen.getByTestId('apple-sign-in'))
    expect(onApple).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/not-built', params: { feature: 'apple-sign-in' } })
  })

  it('A03 on iOS with Apple switched on, the native button replaces the placeholder and signs in', async () => {
    mockApple = true
    draw()
    fireEvent.press(await screen.findByTestId('native-apple'))
    expect(screen.queryByTestId('apple-sign-in')).toBeNull()
    expect(onApple).toHaveBeenCalledTimes(1)
  })

  it('Android never shows an Apple button of either kind', async () => {
    setOS('android')
    mockApple = true
    draw()
    await act(async () => {})
    expect(screen.queryByTestId('apple-sign-in')).toBeNull()
    expect(screen.queryByTestId('native-apple')).toBeNull()
    expect(screen.getByTestId('google-sign-in')).toBeTruthy()
  })

  it('unmounting before Apple answers does not update state or throw', async () => {
    const { unmount } = draw()
    unmount()
    await act(async () => {})
  })
})

describe('CodeInput', () => {
  function Harness({ onChange }: { onChange?: (v: string) => void }) {
    const [v, setV] = useState('')
    return <CodeInput value={v} onChange={(n) => { setV(n); onChange?.(n) }} />
  }
  const input = () => screen.getByTestId('code-input')

  it.each([
    ['123456', '123456'],
    ['12 34 56', '123456'],
    ['12-34-56', '123456'],
    ['  123456  ', '123456'],
    ['123456789', '123456'],
    ['a1b2c3', '123'],
    ['abcdef', ''],
    ['٣٤٥', ''],
    ['🧸1🧸', '1'],
    ['１２３４５６', ''],
  ])('typing %j gives %j', (typed, expected) => {
    const onChange = jest.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.changeText(input(), typed)
    expect(onChange).toHaveBeenLastCalledWith(expected)
  })

  it('draws one digit per box, in order, leaving the rest empty', () => {
    render(<Harness />)
    fireEvent.changeText(input(), '42')
    const shown = screen.getAllByText(/^\d?$/, { includeHiddenElements: true }).map((n) => n.props.children)
    expect(shown.filter((d: string) => d !== '' && d != null)).toEqual(['4', '2'])
  })

  it('is one labelled field to a screen reader, with the boxes hidden from it', () => {
    render(<Harness />)
    expect(screen.getByLabelText('6-digit code')).toBe(input())
  })
})

describe('PasswordField', () => {
  function Field({ isNew, initial = '' }: { isNew?: boolean; initial?: string }) {
    const [v, setV] = useState(initial)
    return <PasswordField isNew={isNew} value={v} onChangeText={setV} />
  }

  it('shows the six-character hint only for a new password', () => {
    const { rerender } = render(<Field />)
    expect(screen.queryByText('At least 6 characters')).toBeNull()
    rerender(<Field isNew />)
    expect(screen.getByText('At least 6 characters')).toBeTruthy()
  })

  it('a new password asks the OS for a generated one and an existing one for the saved one', () => {
    const { rerender } = render(<Field isNew />)
    expect(screen.getByLabelText('Password').props.autoComplete).toBe('new-password')
    rerender(<Field />)
    expect(screen.getByLabelText('Password').props.autoComplete).toBe('current-password')
  })

  it('never autocapitalises or autocorrects what is typed', () => {
    render(<Field />)
    expect(screen.getByLabelText('Password').props.autoCapitalize).toBe('none')
    expect(screen.getByLabelText('Password').props.autoCorrect).toBe(false)
  })

  it('keeps a typed password through show and hide', () => {
    render(<Field />)
    fireEvent.changeText(screen.getByLabelText('Password'), "it's-a-secret 🧸")
    fireEvent.press(screen.getByLabelText('Show password'))
    fireEvent.press(screen.getByLabelText('Hide password'))
    expect(screen.getByLabelText('Password').props.value).toBe("it's-a-secret 🧸")
  })
})

describe('TermsCheckbox', () => {
  it('reports its state as a checkbox and toggles on press', () => {
    const onPress = jest.fn()
    const { rerender } = render(<TermsCheckbox checked={false} onPress={onPress} />)
    expect(screen.getByTestId('accept-contributor-terms').props.accessibilityState).toEqual(expect.objectContaining({ checked: false }))
    fireEvent.press(screen.getByTestId('accept-contributor-terms'))
    expect(onPress).toHaveBeenCalledTimes(1)
    rerender(<TermsCheckbox checked onPress={onPress} />)
    expect(screen.getByTestId('accept-contributor-terms').props.accessibilityState).toEqual(expect.objectContaining({ checked: true }))
  })
})
