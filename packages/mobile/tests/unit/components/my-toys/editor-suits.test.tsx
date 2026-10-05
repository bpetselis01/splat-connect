// packages/mobile/tests/unit/components/my-toys/editor-suits.test.tsx
import { Alert } from 'react-native'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { Editor } from '../../../../components/my-toys/editor'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockBack = jest.fn()
const mockDismissTo = jest.fn()
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: mockPush, dismissTo: mockDismissTo }) }))

// The editor pulls ErrorRow in from components/auth-screen, which imports
// useAuth from lib/auth-context — and that module's real implementation
// reaches all the way to the live supabase client. Mocking auth-context here
// (unused by the editor itself) keeps that import inert, same as the
// tutorial editor's own test.
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPatch = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}))

const mockUploadFile = jest.fn()
jest.mock('../../../../lib/upload', () => ({ uploadFile: (...a: unknown[]) => mockUploadFile(...a) }))

const mockRequestCameraPermissions = jest.fn()
const mockRequestMediaLibraryPermissions = jest.fn()
const mockLaunchCamera = jest.fn()
const mockLaunchLibrary = jest.fn()
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: (...a: unknown[]) => mockRequestCameraPermissions(...a),
  requestMediaLibraryPermissionsAsync: (...a: unknown[]) => mockRequestMediaLibraryPermissions(...a),
  launchCameraAsync: (...a: unknown[]) => mockLaunchCamera(...a),
  launchImageLibraryAsync: (...a: unknown[]) => mockLaunchLibrary(...a),
}))

const mockUseCapabilities = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => mockUseCapabilities(),
}))

function caps(over: object) {
  return {
    caps: {
      profile: { id: 'viewer1', name: 'Viewer', role: 'contributor' },
      isAdmin: false,
      ledOrgs: [],
      unread: { tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 0 },
      exchangeActions: 0,
      ...over,
    },
    loading: false,
    refresh: jest.fn(),
  }
}

const toy = (over: object) => ({
  id: 'toy1',
  owner_id: 'viewer1',
  owner_org_id: null,
  quantity: 1,
  name: 'Bubble machine',
  description: null,
  condition: 5,
  switch_adapted: false,
  photo_urls: [],
  cover_photo_url: null,
  switch_photo_url: null,
  status: 'draft',
  offer_type: null,
  created_at: '',
  updated_at: '',
  ...over,
})

// Routes each GET to the fixture for its own endpoint, so a toy fetch and a
// transactions fetch fired from the same effect never collide.
function mockGetRouting(toys: object[], transactions: object[] = []) {
  mockGet.mockImplementation((path: string) => {
    if (path === '/api/toys') return Promise.resolve(toys)
    if (path === '/api/toy-transactions') return Promise.resolve(transactions)
    if (path === '/api/public/tutorials') return Promise.resolve([{ id: 'g1', title: 'Bubble Blower', status: 'approved' }])
    if (path === '/api/toys/inventory') return Promise.resolve([])
    return Promise.reject(new Error(`unexpected GET ${path}`))
  })
}


describe('Editor - who it suits', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseCapabilities.mockReturnValue(caps({}))
  })

  async function open(over: object = {}) {
    mockGetRouting([toy(over)])
    render(<Editor id="toy1" />)
    await screen.findByRole('tab', { name: 'Details' })
  }

  it('starts from the stored answers and sends chips and filled ranges with Save details', async () => {
    await open({ hands: ['left'], fit: { reach_cm: [10, 20] } })
    expect(screen.getByLabelText('Reach from seated (cm) from').props.value).toBe('10')
    mockPatch.mockResolvedValue(toy({}))
    fireEvent.press(screen.getByText('Lever'))
    fireEvent.changeText(screen.getByLabelText('Hand width (mm) from'), '60')
    fireEvent.changeText(screen.getByLabelText('Hand width (mm) to'), '80')
    fireEvent.press(screen.getByLabelText('Save details'))
    await waitFor(() => expect(mockPatch).toHaveBeenCalled())
    expect(mockPatch.mock.calls[0][1]).toMatchObject({
      movement: ['lever'],
      hands: ['left'],
      play: null,
      fit: { palm_width_mm: [60, 80], reach_cm: [10, 20] },
    })
  })

  it('sends null for everything left empty', async () => {
    await open()
    mockPatch.mockResolvedValue(toy({}))
    fireEvent.press(screen.getByLabelText('Save details'))
    await waitFor(() => expect(mockPatch).toHaveBeenCalled())
    expect(mockPatch.mock.calls[0][1]).toMatchObject({ movement: null, hands: null, play: null, fit: null })
  })

  it('refuses a bad range locally, without calling the API', async () => {
    await open()
    fireEvent.changeText(screen.getByLabelText('Hand width (mm) from'), '90')
    fireEvent.changeText(screen.getByLabelText('Hand width (mm) to'), '80')
    fireEvent.press(screen.getByLabelText('Save details'))
    expect(await screen.findByText(/smallest first/)).toBeTruthy()
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('shows the API sentence when it refuses the range', async () => {
    await open()
    mockPatch.mockRejectedValue(new Error('PATCH /api/toys/toy1 failed with status 400: Reach from seated (cm): a range from 5 to 90, smallest first.'))
    fireEvent.press(screen.getByLabelText('Save details'))
    expect(await screen.findByText('Reach from seated (cm): a range from 5 to 90, smallest first.')).toBeTruthy()
  })
})
