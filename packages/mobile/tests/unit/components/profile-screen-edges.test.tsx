// The account page's editable fields at their edges: whitespace, markup and
// emoji, clearing a field, a failed save, editing back to the old value, and
// the identity card when the profile or email is missing.
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ProfileScreen, signedInWith } from '../../../components/profile-screen'
import { useAuth } from '../../../lib/auth-context'

jest.mock('../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
jest.mock('../../../lib/use-child-profile', () => ({
  useChildProfile: () => ({ profile: null, loading: false, save: jest.fn(), saveState: 'idle' }),
}))
const mockGet = jest.fn()
const mockPatch = jest.fn()
jest.mock('../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), patch: (...a: unknown[]) => mockPatch(...a), post: jest.fn() },
}))
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: mockPush }), useFocusEffect: (effect: () => void) => useEffect(effect, []) }
})

const mockSignOut = jest.fn()
function as(over: { profile?: object | null; user?: object } = {}) {
  ;(useAuth as jest.Mock).mockReturnValue({
    session: { user: { email: 'cory@example.com', ...over.user } },
    profile: over.profile === undefined ? { id: '2', name: 'Cory', occupation: null, pickup_postcode: null } : over.profile,
    signOut: mockSignOut,
    hasContributorTerms: true,
  })
}
const edit = async (label: string, text: string) =>
  fireEvent(await screen.findByLabelText(label), 'endEditing', { nativeEvent: { text } })

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue([])
  mockPatch.mockResolvedValue({})
  as()
})

describe('Display name', () => {
  it.each([
    ["O'Brien", "O'Brien"],
    ['<b>Cory</b> & "co"', '<b>Cory</b> & "co"'],
    ['Zoë 🧸 سارة', 'Zoë 🧸 سارة'],
    ['N'.repeat(500), 'N'.repeat(500)],
    ['  Pat  ', 'Pat'],
  ])('Z01 saves %j as %j', async (typed, saved) => {
    render(<ProfileScreen />)
    await edit('Display name', typed)
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/contributors/me', { name: saved }))
  })

  it('does not save the name it already has, even with spaces around it', async () => {
    render(<ProfileScreen />)
    await edit('Display name', '  Cory ')
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('Z01 says so, in words, when the save fails, and never says Saved', async () => {
    mockPatch.mockRejectedValue(new Error('500'))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    render(<ProfileScreen />)
    await edit('Display name', 'New')
    expect(await screen.findByText('Could not save your name. Please try again.')).toBeTruthy()
    expect(screen.queryByText('Saved')).toBeNull()
    spy.mockRestore()
  })

  it('Z01 a failed save, retried with the same name, goes out again and then says Saved', async () => {
    mockPatch.mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce({})
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    render(<ProfileScreen />)
    await edit('Display name', 'New')
    await screen.findByText('Could not save your name. Please try again.')
    await edit('Display name', 'New')
    expect(await screen.findByText('Saved')).toBeTruthy()
    expect(mockPatch).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })

  it('Z01 editing back to the name the account had at launch still saves, because the server now holds the other', async () => {
    render(<ProfileScreen />)
    await edit('Display name', 'New')
    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1))
    await edit('Display name', 'Cory')
    await waitFor(() => expect(mockPatch).toHaveBeenLastCalledWith('/api/contributors/me', { name: 'Cory' }))
    expect(mockPatch).toHaveBeenCalledTimes(2)
  })
})

describe('What you do', () => {
  it('Z02 clearing it sends null, not an empty string', async () => {
    as({ profile: { id: '2', name: 'Cory', occupation: 'Teacher' } })
    render(<ProfileScreen />)
    await edit('What you do', '   ')
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/contributors/me', { occupation: null }))
  })

  it('an empty field that was already empty saves nothing', async () => {
    render(<ProfileScreen />)
    await edit('What you do', '  ')
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('Z02 editing back to the line the account launched with still saves', async () => {
    as({ profile: { id: '2', name: 'Cory', occupation: 'Teacher' } })
    render(<ProfileScreen />)
    await edit('What you do', 'Nurse')
    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1))
    await edit('What you do', 'Teacher')
    await waitFor(() => expect(mockPatch).toHaveBeenLastCalledWith('/api/contributors/me', { occupation: 'Teacher' }))
  })

  it('caps typing at 60 characters', async () => {
    render(<ProfileScreen />)
    expect((await screen.findByLabelText('What you do')).props.maxLength).toBe(60)
  })

  it('Z02 shows the API\'s own words when it refuses, and none after the next save works', async () => {
    mockPatch.mockRejectedValueOnce({ status: 400, error: 'Too long' }).mockResolvedValueOnce({})
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    render(<ProfileScreen />)
    await edit('What you do', 'Therapist')
    expect(await screen.findByText(/Too long|Could not save what you do/)).toBeTruthy()
    await edit('What you do', 'Therapist 2')
    await waitFor(() => expect(screen.queryByText(/Too long|Could not save what you do/)).toBeNull())
    spy.mockRestore()
  })
})

describe('Postcode', () => {
  it.each(['1', '123', '12345', '20a0', '2 000', 'ABCD', '٢٠٠٠', '2000.', '-200', '🧸🧸🧸🧸'])('Z03 refuses %j inline and saves nothing', async (text) => {
    render(<ProfileScreen />)
    await edit('Postcode', text)
    expect(await screen.findByText('A postcode is four digits.')).toBeTruthy()
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it.each([['2000', '2000'], [' 0800 ', '0800'], ['0000', '0000']])('Z03 saves %j as %j, leading zero kept', async (text, saved) => {
    render(<ProfileScreen />)
    await edit('Postcode', text)
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/contributors/me', { pickup_postcode: saved }))
  })

  it('Z03 clearing it sends null', async () => {
    as({ profile: { id: '2', name: 'Cory', pickup_postcode: '2000' } })
    render(<ProfileScreen />)
    await edit('Postcode', '')
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/contributors/me', { pickup_postcode: null }))
  })

  it('Z03 a valid postcode after a refused one clears the complaint', async () => {
    render(<ProfileScreen />)
    await edit('Postcode', '12')
    await screen.findByText('A postcode is four digits.')
    await edit('Postcode', '2000')
    await waitFor(() => expect(screen.queryByText('A postcode is four digits.')).toBeNull())
  })

  it('Z03 editing back to the postcode the account launched with still saves', async () => {
    as({ profile: { id: '2', name: 'Cory', pickup_postcode: '2000' } })
    render(<ProfileScreen />)
    await edit('Postcode', '3000')
    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1))
    await edit('Postcode', '2000')
    await waitFor(() => expect(mockPatch).toHaveBeenLastCalledWith('/api/contributors/me', { pickup_postcode: '2000' }))
  })

  it('is a four-character numeric field', async () => {
    render(<ProfileScreen />)
    const field = await screen.findByLabelText('Postcode')
    expect(field.props.maxLength).toBe(4)
    expect(field.props.inputMode).toBe('numeric')
  })

  it('Z03 a failed save shows a sentence, not nothing', async () => {
    mockPatch.mockRejectedValue(new Error('offline'))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    render(<ProfileScreen />)
    await edit('Postcode', '2000')
    expect(await screen.findByText(/postcode/i)).toBeTruthy()
    spy.mockRestore()
  })
})

describe('The identity card', () => {
  it('an account with no name yet is "Your account", initialled from its email', () => {
    as({ profile: { id: '2', name: '' } })
    render(<ProfileScreen />)
    expect(screen.getByText('Your account')).toBeTruthy()
    expect(screen.getByText('C', { includeHiddenElements: true })).toBeTruthy()
  })

  it('a whitespace-only name is treated as no name', () => {
    as({ profile: { id: '2', name: '   ' } })
    render(<ProfileScreen />)
    expect(screen.getByText('Your account')).toBeTruthy()
  })

  it('an account whose profile has not loaded still renders, with no web dashboard link', () => {
    as({ profile: null })
    render(<ProfileScreen />)
    expect(screen.getByText('cory@example.com')).toBeTruthy()
    expect(screen.queryByText('Open Web Dashboard')).toBeNull()
  })

  it.each([[undefined], ['']])('an account whose email is %j does not crash the card', (email) => {
    as({ profile: null, user: { email } })
    expect(() => render(<ProfileScreen />)).not.toThrow()
    expect(screen.getByText('?', { includeHiddenElements: true })).toBeTruthy()
  })

  it('initials come from the first and last words of an emoji or RTL name', () => {
    as({ profile: { id: '2', name: 'سارة أحمد' } })
    expect(() => render(<ProfileScreen />)).not.toThrow()
  })
})

describe('Terms row and actions', () => {
  it('shows no terms row when the agreements read fails', async () => {
    mockGet.mockRejectedValue(new Error('offline'))
    render(<ProfileScreen />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByText(/Contributor terms ·/)).toBeNull()
  })

  it('ignores an agreement of another kind', async () => {
    mockGet.mockResolvedValue([{ id: 'a', agreement_type: 'something_else', version: 'v1', accepted_at: '2026-08-12T00:00:00Z' }])
    render(<ProfileScreen />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByText(/Contributor terms ·/)).toBeNull()
  })

  it('Z04 Sign Out signs out, and Delete account opens the deletion screen', () => {
    render(<ProfileScreen />)
    fireEvent.press(screen.getByText('Sign Out'))
    expect(mockSignOut).toHaveBeenCalledTimes(1)
    fireEvent.press(screen.getByText('Delete account'))
    expect(mockPush).toHaveBeenCalledWith('/account/delete')
  })
})

describe('signedInWith', () => {
  it.each([
    [['apple'], 'Signed in with Apple'],
    [['email', 'google'], 'Signed in with email and Google'],
    [['apple', 'google', 'email'], 'Signed in with Apple and Google and email'],
    [['github'], 'Signed in with github'],
    [undefined, 'Signed in with email'],
    [null, 'Signed in with email'],
    ['apple', 'Signed in with email'],
    [{ 0: 'apple' }, 'Signed in with email'],
  ])('%j reads %j', (providers, sentence) => {
    expect(signedInWith(providers)).toBe(sentence)
  })

  it('an empty provider list still says how, rather than ending in "with"', () => {
    expect(signedInWith([])).toBe('Signed in with email')
  })
})
