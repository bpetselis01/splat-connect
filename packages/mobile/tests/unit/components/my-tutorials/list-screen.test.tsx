// packages/mobile/tests/unit/components/my-tutorials/list-screen.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { MyTutorialsListScreen } from '../../../../components/my-tutorials/list-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))

const mockPush = jest.fn()
// useFocusEffect fires on navigation focus, which a unit render has no
// navigator to simulate — standing in with a plain mount-time useEffect is
// enough to exercise the refetch-on-focus wiring itself.
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
  }
})

const tutorial = (over: object) => ({
  id: 't1', title: 'Bubble machine switch', description: null, difficulty: 'easy', kind: 'toy_adaptation',
  status: 'draft', tutorial_pdf_url: null, photo_urls: [], toy_photo_url: null, rejection_note: null,
  created_at: '', updated_at: '', reviewed_at: null, reviewed_by: null, reviewed_for_org_id: null, ...over,
})

describe('MyTutorialsListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('lists the caller\'s tutorials with their status, and pushes to the editor on tap', async () => {
    mockGet.mockResolvedValue([tutorial({ id: 't1', title: 'Bubble machine switch', status: 'draft' })])
    render(<MyTutorialsListScreen />)

    expect(await screen.findByText('Bubble machine switch')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/tutorials/mine')
    // Once as the filter's "Draft" option, once as the row's pill.
    expect(screen.getAllByText('Draft')).toHaveLength(2)

    fireEvent.press(screen.getByText('Bubble machine switch'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/tutorials/[id]', params: { id: 't1' } })
  })

  it('shows the rejection note in a note box under a rejected row', async () => {
    mockGet.mockResolvedValue([
      tutorial({ id: 't2', title: 'Head switch arm', status: 'rejected', rejection_note: 'Needs a clearer photo.' }),
    ])
    render(<MyTutorialsListScreen />)

    expect(await screen.findByText('Head switch arm')).toBeTruthy()
    expect(screen.getByText('Needs a clearer photo.')).toBeTruthy()
  })

  it('counts each stage in the filter, and narrows to the one picked', async () => {
    mockGet.mockResolvedValue([
      tutorial({ id: 't1', title: 'Drum', status: 'approved' }),
      tutorial({ id: 't2', title: 'Fan', status: 'rejected' }),
      tutorial({ id: 't3', title: 'Cushion', status: 'pending' }),
      tutorial({ id: 't4', title: 'Bubbles', status: 'draft' }),
      tutorial({ id: 't5', title: 'Car', status: 'approved' }),
    ])
    render(<MyTutorialsListScreen />)
    await screen.findByText('Drum')
    expect(screen.getByLabelText('All, 5')).toBeTruthy()
    expect(screen.getByLabelText('Needs you, 1')).toBeTruthy()
    expect(screen.getByLabelText('Live, 2')).toBeTruthy()
    expect(screen.getByLabelText('Waiting, 1')).toBeTruthy()
    expect(screen.getByLabelText('Draft, 1')).toBeTruthy()

    fireEvent.press(screen.getByLabelText('Live, 2'))
    expect(screen.getByText('Drum')).toBeTruthy()
    expect(screen.getByText('Car')).toBeTruthy()
    expect(screen.queryByText('Fan')).toBeNull()
  })

  it('links to Add a tutorial, and shows the web-editing footnote', async () => {
    mockGet.mockResolvedValue([tutorial({ id: 't1', title: 'Bubble machine switch' })])
    render(<MyTutorialsListScreen />)

    expect(await screen.findByText('Bubble machine switch')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('+ Add a tutorial'))
    expect(mockPush).toHaveBeenCalledWith('/guides/new')
    expect(screen.getByText('Collaborators and recommendations are edited on the web for now.')).toBeTruthy()
  })

  it('invites the first guide when there are none yet', async () => {
    mockGet.mockResolvedValue([])
    render(<MyTutorialsListScreen />)
    expect(await screen.findByText(/first/i)).toBeTruthy()
  })
})
