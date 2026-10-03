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
  created_at: '', updated_at: '', reviewed_at: null, reviewed_by: null, reviewed_for_org_id: null,
  // /mine embeds ids of these, which a draft row's progress count reads.
  parts: [], tools: [], stl_files: [], steps: [], ...over,
})

describe('MyTutorialsListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows a published guide’s views and who backs it', async () => {
    mockGet.mockResolvedValue([
      tutorial({ id: 'l', title: 'Light-up drum', status: 'approved', view_count: 2100, tutorial_orgs: [{ id: 'b', status: 'accepted', org_id: 'o', requested_at: '', organizations: { id: 'o', name: 'Northside Therapy' } }] }),
      tutorial({ id: 'r', title: 'Remote car', status: 'approved', view_count: 890, tutorial_orgs: [] }),
    ])
    render(<MyTutorialsListScreen />)
    expect(await screen.findByText('2.1k views · Northside Therapy')).toBeTruthy()
    expect(screen.getByText('890 views')).toBeTruthy()
  })

  it('tells the author how their guide’s prints fitted', async () => {
    mockGet.mockResolvedValue([
      tutorial({ id: 'l', status: 'approved', view_count: 890, tutorial_orgs: [], print_fit_stats: { fitted: 12, fit_answers: 14 } }),
    ])
    render(<MyTutorialsListScreen />)
    expect(await screen.findByText('890 views · 12 of 14 prints fitted')).toBeTruthy()
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

  it('says how far a draft has got, and who is holding a submitted one', async () => {
    mockGet.mockResolvedValue([
      tutorial({ id: 'd', title: 'Bubble blower', status: 'draft', build_minutes: 30, parts: [{ id: 'p' }], tools: [{ id: 't' }], stl_files: [], steps: [] }),
      tutorial({
        id: 'w', title: 'Vibrating cushion', status: 'pending',
        tutorial_orgs: [{ id: 'b', status: 'pending', org_id: 'o', requested_at: '2026-08-28T02:00:00Z', organizations: { id: 'o', name: 'Northside Therapy' } }],
      }),
    ])
    render(<MyTutorialsListScreen />)
    expect(await screen.findByText('Draft · 4 of 6 sections done')).toBeTruthy()
    expect(screen.getByText('With Northside Therapy since 28 Aug')).toBeTruthy()
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
