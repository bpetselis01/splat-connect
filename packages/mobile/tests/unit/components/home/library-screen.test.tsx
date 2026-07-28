// packages/mobile/tests/unit/components/home/library-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { LibraryScreen } from '../../../../components/home/library-screen'
import { apiClient } from '../../../../lib/api-client'

jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: jest.fn() } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const TUTORIALS = [
  { id: '1', title: 'Build a Robot Arm', description: null, difficulty: 'easy', status: 'approved', tutorial_pdf_url: null, toy_photo_url: null, rejection_note: null, created_at: '', reviewed_at: null },
  { id: '2', title: 'Advanced Gearbox', description: null, difficulty: 'hard', status: 'approved', tutorial_pdf_url: null, toy_photo_url: null, rejection_note: null, created_at: '', reviewed_at: null },
]

describe('LibraryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(apiClient.get as jest.Mock).mockResolvedValue(TUTORIALS)
  })

  it('renders tutorial titles from the public tutorials endpoint', async () => {
    render(<LibraryScreen />)
    expect(await screen.findByText('Build a Robot Arm')).toBeTruthy()
    expect(screen.getByText('Advanced Gearbox')).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledWith('/api/public/tutorials')
  })

  it('filters the list by search text', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Build a Robot Arm')
    fireEvent.changeText(screen.getByPlaceholderText('Search tutorials'), 'gearbox')
    expect(screen.queryByText('Build a Robot Arm')).toBeNull()
    expect(screen.getByText('Advanced Gearbox')).toBeTruthy()
  })

  it('matches search against the description, not only the title', async () => {
    ;(apiClient.get as jest.Mock).mockResolvedValue([
      { ...TUTORIALS[0], description: 'A switch-adapted spinning top' },
      TUTORIALS[1],
    ])
    render(<LibraryScreen />)
    await screen.findByText('Build a Robot Arm')
    fireEvent.changeText(screen.getByPlaceholderText('Search tutorials'), 'spinning')
    expect(screen.getByText('Build a Robot Arm')).toBeTruthy()
    expect(screen.queryByText('Advanced Gearbox')).toBeNull()
  })

  it('refetches with a difficulty filter when a chip is pressed', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Build a Robot Arm')
    fireEvent.press(screen.getByRole('button', { name: 'Hard' }))
    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith('/api/public/tutorials?difficulty=hard')
    )
  })

  it('shows an error message when apiClient.get rejects', async () => {
    ;(apiClient.get as jest.Mock).mockRejectedValue(new Error('API GET failed with status 500'))
    render(<LibraryScreen />)
    expect(await screen.findByText("Couldn't load tutorials. Pull to retry.")).toBeTruthy()
  })
})
