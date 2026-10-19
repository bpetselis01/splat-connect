import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { PrintAtEventScreen } from '../../../../components/events/print-at-event-screen'
import { event } from './event-fixtures'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))
const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) } }))
const mockReplace = jest.fn()
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ replace: mockReplace, push: mockPush }), useFocusEffect: (e: () => void) => useEffect(e, []) }
})

const SAVED = [
  { id: 'g1', title: 'Light-up penguin', author_name: 'Priya' },
  { id: 'g2', title: 'Switch mount', author_name: null },
]
const GUIDE = { id: 'g1', title: 'Light-up penguin', stl_files: [{ id: 'f1', filename: 'body.stl' }, { id: 'f2', filename: 'wing.stl' }] }

function serve({ ev = {}, saved = SAVED }: { ev?: Record<string, unknown>; saved?: unknown[] } = {}) {
  mockGet.mockImplementation((path: string) => {
    if (path.startsWith('/api/public/events/')) return Promise.resolve(event({ prints_parts: true, part_sets_max: 3, ...ev }))
    if (path === '/api/saves/tutorials') return Promise.resolve(saved)
    if (path === '/api/public/tutorials/g1') return Promise.resolve(GUIDE)
    return Promise.reject(new Error(`unexpected ${path}`))
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPost.mockResolvedValue({ id: 't1' })
  serve()
})

describe('PrintAtEventScreen', () => {
  it('lists the saved guides, then the picked guide\'s parts with all ticked', async () => {
    render(<PrintAtEventScreen id="e1" />)
    fireEvent.press(await screen.findByRole('radio', { name: 'Light-up penguin' }))
    expect(await screen.findByRole('checkbox', { name: 'Include body.stl' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Include wing.stl', checked: true })).toBeTruthy()
    expect(screen.getByText('by Priya')).toBeTruthy()
  })

  it('V17 sends the guide, the ticked parts, the sets and the note, then goes to My events', async () => {
    render(<PrintAtEventScreen id="e1" />)
    fireEvent.press(await screen.findByRole('radio', { name: 'Light-up penguin' }))
    await screen.findByRole('checkbox', { name: 'Include body.stl' })
    fireEvent.press(screen.getByRole('checkbox', { name: 'Include wing.stl' }))
    fireEvent.press(screen.getByRole('button', { name: 'More sets' }))
    fireEvent.changeText(screen.getByLabelText('Note to the host'), 'Blue if you can')
    fireEvent.press(screen.getByRole('button', { name: 'Send request' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/print-at-event', {
        event_id: 'e1', tutorial_id: 'g1', stl_file_ids: ['f1'], part_sets: 2, note: 'Blue if you can',
      }),
    )
    expect(mockReplace).toHaveBeenCalledWith('/events')
  })

  it('sets stop at the host\'s limit', async () => {
    render(<PrintAtEventScreen id="e1" />)
    fireEvent.press(await screen.findByRole('radio', { name: 'Light-up penguin' }))
    await screen.findByRole('checkbox', { name: 'Include body.stl' })
    const more = screen.getByRole('button', { name: 'More sets' })
    fireEvent.press(more)
    fireEvent.press(more)
    fireEvent.press(more)
    expect(screen.getByText('3 sets')).toBeTruthy()
    expect(screen.getByText('The host has room for up to 3.')).toBeTruthy()
  })

  it('shows the server\'s no-parts sentence word for word', async () => {
    mockPost.mockRejectedValue(new Error('Request failed with status 400: Tick at least one part to print.'))
    render(<PrintAtEventScreen id="e1" />)
    fireEvent.press(await screen.findByRole('radio', { name: 'Light-up penguin' }))
    await screen.findByRole('checkbox', { name: 'Include body.stl' })
    fireEvent.press(screen.getByRole('checkbox', { name: 'Include body.stl' }))
    fireEvent.press(screen.getByRole('checkbox', { name: 'Include wing.stl' }))
    fireEvent.press(screen.getByRole('button', { name: 'Send request' }))
    expect(await screen.findByText('Tick at least one part to print.')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('shows the already-open sentence', async () => {
    mockPost.mockRejectedValue(new Error('Request failed with status 409: You already have a part request open with this host'))
    render(<PrintAtEventScreen id="e1" />)
    fireEvent.press(await screen.findByRole('radio', { name: 'Light-up penguin' }))
    await screen.findByRole('checkbox', { name: 'Include body.stl' })
    fireEvent.press(screen.getByRole('button', { name: 'Send request' }))
    expect(await screen.findByText('You already have a part request open with this host')).toBeTruthy()
  })

  it('Send request waits for a guide', async () => {
    render(<PrintAtEventScreen id="e1" />)
    await screen.findByRole('radio', { name: 'Light-up penguin' })
    fireEvent.press(screen.getByRole('button', { name: 'Send request' }))
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('an event that does not print parts offers nothing to send', async () => {
    serve({ ev: { prints_parts: false } })
    render(<PrintAtEventScreen id="e1" />)
    expect(await screen.findByText('This host is not printing parts before the day.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Send request' })).toBeNull()
  })

  it('V18 with nothing saved it says to save a guide first and links to Guides', async () => {
    serve({ saved: [] })
    render(<PrintAtEventScreen id="e1" />)
    expect(await screen.findByText('Save a guide first.')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Browse guides' }))
    expect(mockPush).toHaveBeenCalledWith('/guides')
  })
})
