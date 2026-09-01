import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { DetailScreen } from '../../../../components/home/detail-screen'
import { apiClient } from '../../../../lib/api-client'

// Ionicons loads its font asynchronously and setStates after the test ends;
// stub it to a host string so there's no act() warning noise, same as
// library-screen.test.tsx. The Provenance chip and the placeholder photo icon
// are what pull in more Icon instances than this file had before Task 3.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: jest.fn() } }))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

const mockCreateSignedUrl = jest.fn()
jest.mock('../../../../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: (...a: unknown[]) => mockCreateSignedUrl(...a) }) } },
}))

const NO_SAVES = { tutorials: [], toys: [], challenges: [] }

const DETAIL = {
  id: '1',
  title: 'Build a Robot Arm',
  description: 'A fun beginner build.',
  difficulty: 'easy',
  kind: 'toy_adaptation',
  status: 'approved',
  // Object path (049), not a URL — the preview button signs it in-process.
  tutorial_pdf_url: '1/tutorial.pdf',
  toy_photo_url: null,
  rejection_note: null,
  created_at: '',
  reviewed_at: null,
  // Widened in Task 3 alongside the public embed's profile_id — provenance,
  // picks and the 3D-print placeholder all read one of these three.
  tutorial_contributors: [{ profile_id: 'c1', role: 'primary', profiles: { name: 'Sam T.' } }],
  tutorial_orgs: [],
  tutorial_recommendations: [],
  parts: [{ id: 'p1', tutorial_id: '1', name: 'Servo Motor', quantity: 2, is_optional: false, buy_links: [] }],
  tools: [{ id: 't1', tutorial_id: '1', name: 'Screwdriver', is_optional: false, buy_links: [] }],
  stl_files: [],
}

// The detail screen's own useSaves() fires a second, independent
// apiClient.get('/api/saves/ids') on mount — routed by path so a rejection
// aimed at the tutorial fetch doesn't also break the (silently-caught) saves
// fetch, same pattern as library-screen.test.tsx's mockEndpoints.
function mockEndpoints({
  detail = Promise.resolve(DETAIL),
  saves = Promise.resolve(NO_SAVES),
}: { detail?: Promise<unknown>; saves?: Promise<unknown> } = {}) {
  ;(apiClient.get as jest.Mock).mockImplementation((p: string) => (p === '/api/saves/ids' ? saves : detail))
}

describe('DetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEndpoints()
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://supabase.test/signed.pdf' }, error: null })
  })

  it('renders tutorial detail with parts and tools', async () => {
    render(<DetailScreen id="1" />)
    expect(await screen.findByText('Build a Robot Arm')).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledWith('/api/public/tutorials/1')
    expect(screen.getByText('Servo Motor × 2')).toBeTruthy()
    expect(screen.getByText('Screwdriver')).toBeTruthy()
  })

  it('shows an error message when apiClient.get rejects', async () => {
    mockEndpoints({ detail: Promise.reject(new Error('API GET failed with status 500')) })
    render(<DetailScreen id="1" />)
    expect(await screen.findByText("Couldn't load tutorial. Please try again.")).toBeTruthy()
  })

  it('signs the pdf path and pushes the preview route with the signed URL', async () => {
    render(<DetailScreen id="1" />)
    await screen.findByText('Build a Robot Arm')

    fireEvent.press(screen.getByText('Preview Tutorial'))

    await waitFor(() => expect(mockPush).toHaveBeenCalled())
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('1/tutorial.pdf', 60)
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/guides/[id]/preview',
      params: { id: '1', pdfUrl: 'https://supabase.test/signed.pdf' },
    })
  })

  it('pushes the preview route with an empty pdfUrl when signing fails', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: 'Object not found' } })
    render(<DetailScreen id="1" />)
    await screen.findByText('Build a Robot Arm')

    fireEvent.press(screen.getByText('Preview Tutorial'))

    await waitFor(() => expect(mockPush).toHaveBeenCalled())
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/guides/[id]/preview',
      params: { id: '1', pdfUrl: '' },
    })
  })

  it('shows the 3D-print placeholder, unpressable, for an assistive-tech guide', async () => {
    mockEndpoints({ detail: Promise.resolve({ ...DETAIL, kind: 'assistive_tech' }) })
    render(<DetailScreen id="1" />)
    await screen.findByText('Build a Robot Arm')

    expect(screen.getByText('Request this 3D print')).toBeTruthy()
    expect(screen.getByText('SOON')).toBeTruthy()

    mockPush.mockClear()
    fireEvent.press(screen.getByText('Request this 3D print'))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('has no 3D-print placeholder for a toy-adaptation guide', async () => {
    render(<DetailScreen id="1" />)
    await screen.findByText('Build a Robot Arm')

    expect(screen.queryByText('Request this 3D print')).toBeNull()
  })
})
