// packages/mobile/tests/unit/app/guides-new.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import NewGuideRoute from '../../../app/(tabs)/guides/new'
import { useAuth } from '../../../lib/auth-context'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-1' }))

const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }))

const mockPost = jest.fn()
jest.mock('../../../lib/api-client', () => ({
  apiClient: { post: (...a: unknown[]) => mockPost(...a) },
}))

jest.mock('../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockAccept = jest.fn()

beforeEach(() => {
  mockPost.mockReset()
  mockReplace.mockReset()
  mockAccept.mockReset()
  ;(useAuth as jest.Mock).mockReturnValue({ acceptContributorTerms: mockAccept })
})

describe('NewGuideRoute', () => {
  it('disables Create draft until a title is entered', () => {
    render(<NewGuideRoute />)
    expect(screen.getByLabelText('Create draft').props.accessibilityState.disabled).toBe(true)
    fireEvent.changeText(screen.getByPlaceholderText('Title'), 'Bubble machine')
    expect(screen.getByLabelText('Create draft').props.accessibilityState.disabled).toBe(false)
  })

  it('posts the uuid, title and the default kind/difficulty, then replaces into the editor', async () => {
    mockPost.mockResolvedValue({ id: 'uuid-1' })
    render(<NewGuideRoute />)
    fireEvent.changeText(screen.getByPlaceholderText('Title'), 'Bubble machine')
    fireEvent.press(screen.getByLabelText('Create draft'))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/tutorials', {
        id: 'uuid-1',
        title: 'Bubble machine',
        difficulty: 'easy',
        kind: 'toy_adaptation',
      })
    )
    expect(mockReplace).toHaveBeenCalledWith('/tutorials/uuid-1')
  })

  it('posts the picked kind and difficulty when the chips are changed', async () => {
    mockPost.mockResolvedValue({ id: 'uuid-1' })
    render(<NewGuideRoute />)
    fireEvent.changeText(screen.getByPlaceholderText('Title'), 'Head switch arm')
    fireEvent.press(screen.getByLabelText('Assistive tech'))
    fireEvent.press(screen.getByLabelText('Hard'))
    fireEvent.press(screen.getByLabelText('Create draft'))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/tutorials', {
        id: 'uuid-1',
        title: 'Head switch arm',
        difficulty: 'hard',
        kind: 'assistive_tech',
      })
    )
  })

  it('reveals the terms gate on a 403, then accepts and retries the SAME id', async () => {
    mockPost
      .mockRejectedValueOnce(
        new Error(
          "API POST /api/tutorials failed with status 403: You must accept the contributor terms before contributing"
        )
      )
      .mockResolvedValueOnce({ id: 'uuid-1' })
    mockAccept.mockResolvedValue({ error: null })

    render(<NewGuideRoute />)
    fireEvent.changeText(screen.getByPlaceholderText('Title'), 'Bubble machine')
    fireEvent.press(screen.getByLabelText('Create draft'))

    expect(
      await screen.findByText('You must accept the contributor terms before contributing.')
    ).toBeTruthy()

    fireEvent.press(screen.getByTestId('new-guide-accept-terms'))
    fireEvent.press(screen.getByLabelText('Accept and continue'))

    await waitFor(() => expect(mockAccept).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2))
    // Both attempts carry the same id — a retry must not mint a second draft.
    expect(mockPost.mock.calls[0][1].id).toBe('uuid-1')
    expect(mockPost.mock.calls[1][1].id).toBe('uuid-1')
    expect(mockReplace).toHaveBeenCalledWith('/tutorials/uuid-1')
  })

  it('shows a generic error on a non-403 failure, without revealing the terms gate', async () => {
    mockPost.mockRejectedValue(new Error('API POST /api/tutorials failed with status 500'))
    render(<NewGuideRoute />)
    fireEvent.changeText(screen.getByPlaceholderText('Title'), 'Bubble machine')
    fireEvent.press(screen.getByLabelText('Create draft'))
    expect(await screen.findByText('Could not create this guide. Please try again.')).toBeTruthy()
    expect(screen.queryByText(/contributor terms/i)).toBeNull()
  })
})
