// packages/mobile/tests/unit/app/toys-new.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import NewToyRoute from '../../../app/(my)/toys/new'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }))

const mockPost = jest.fn()
jest.mock('../../../lib/api-client', () => ({
  apiClient: { post: (...a: unknown[]) => mockPost(...a) },
}))

// ErrorRow is pulled in from components/auth-screen, which imports useAuth
// from lib/auth-context — and that module's real implementation reaches all
// the way to the live supabase client. Mocking auth-context here (unused by
// this screen itself) is what keeps that import inert, same as
// toy-detail-screen.test.tsx.
jest.mock('../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('NewToyRoute', () => {
  it('disables Create until a name is entered', () => {
    render(<NewToyRoute />)
    expect(screen.getByLabelText('Create').props.accessibilityState.disabled).toBe(true)
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Bubble machine')
    expect(screen.getByLabelText('Create').props.accessibilityState.disabled).toBe(false)
  })

  it('defaults condition to 5, and posts the name and condition on Create', async () => {
    mockPost.mockResolvedValue({ id: 'toy1' })
    render(<NewToyRoute />)
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Bubble machine')
    fireEvent.press(screen.getByLabelText('Create'))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/toys', { name: 'Bubble machine', condition: 5 })
    )
  })

  it('posts the picked condition chip', async () => {
    mockPost.mockResolvedValue({ id: 'toy1' })
    render(<NewToyRoute />)
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Bubble machine')
    fireEvent.press(screen.getByLabelText('8'))
    fireEvent.press(screen.getByLabelText('Create'))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/toys', { name: 'Bubble machine', condition: 8 })
    )
  })

  it('replaces into the new toy on success', async () => {
    mockPost.mockResolvedValue({ id: 'toy1' })
    render(<NewToyRoute />)
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Bubble machine')
    fireEvent.press(screen.getByLabelText('Create'))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/toys/toy1'))
  })

  it('shows an error and stays put when the create fails', async () => {
    mockPost.mockRejectedValue(new Error('API POST /api/toys failed with status 500'))
    render(<NewToyRoute />)
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Bubble machine')
    fireEvent.press(screen.getByLabelText('Create'))
    expect(await screen.findByText('Could not create this toy. Please try again.')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
