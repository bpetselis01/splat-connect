// packages/mobile/tests/unit/app/toys-new.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import NewToyRoute from '../../../app/(my)/toys/new'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockReplace = jest.fn()
let mockParams: { org?: string } = {}
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}))

let mockLedOrgs: { id: string; name: string }[] = []
jest.mock('../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { ledOrgs: mockLedOrgs } }),
}))

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
  mockParams = {}
  mockLedOrgs = []
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

  it('asks no owner question of someone who leads no organisation', () => {
    render(<NewToyRoute />)
    expect(screen.queryByText('Who holds this toy')).toBeNull()
  })

  it('arrives from inventory holding the org, and posts owner and quantity', async () => {
    mockLedOrgs = [{ id: 'org1', name: 'Toy Shed' }]
    mockParams = { org: 'org1' }
    mockPost.mockResolvedValue({ id: 'toy1' })
    render(<NewToyRoute />)
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Bubble machine')
    fireEvent.changeText(screen.getByLabelText('How many do you hold'), '5')
    fireEvent.press(screen.getByLabelText('Create'))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/toys', {
        name: 'Bubble machine',
        condition: 5,
        owner_org_id: 'org1',
        quantity: 5,
      })
    )
  })

  it('lets a leader switch back to a personal toy, which carries no stock', async () => {
    mockLedOrgs = [{ id: 'org1', name: 'Toy Shed' }]
    mockParams = { org: 'org1' }
    mockPost.mockResolvedValue({ id: 'toy1' })
    render(<NewToyRoute />)
    fireEvent.press(screen.getByLabelText('Me'))
    expect(screen.queryByLabelText('How many do you hold')).toBeNull()
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Bubble machine')
    fireEvent.press(screen.getByLabelText('Create'))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/toys', { name: 'Bubble machine', condition: 5 })
    )
  })
})
