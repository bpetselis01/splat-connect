// packages/mobile/tests/unit/components/my-toys/editor.test.tsx
import { Alert } from 'react-native'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { Editor } from '../../../../components/my-toys/editor'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockBack = jest.fn()
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: mockPush }) }))

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
      unread: { tutorials: 0, exchanges: 0, challenges: 0, total: 0 },
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
  cover_photo_url: null,
  switch_photo_urls: [],
  status: 'draft',
  offer_type: null,
  created_at: '',
  updated_at: '',
  ...over,
})

const tx = (over: object) => ({
  id: 'tx1',
  toy_id: 'toy1',
  offered_toy_id: null,
  type: 'donation',
  status: 'requested',
  requester_id: 'requester1',
  owner_id: 'viewer1',
  owner_org_id: null,
  owner_code: null,
  requester_code: null,
  owner_confirmed_at: null,
  requester_confirmed_at: null,
  pickup_line1: null,
  pickup_suburb: null,
  pickup_state: null,
  pickup_postcode: null,
  pickup_instructions: null,
  created_at: '',
  updated_at: '',
  toy_name: 'Bubble machine',
  offered_toy_name: null,
  other_party_name: 'A family',
  acting_for_org_name: null,
  blocked_by_rival_accept: false,
  last_message: null,
  ...over,
})

// Routes each GET to the fixture for its own endpoint, so a toy fetch and a
// transactions fetch fired from the same effect never collide.
function mockGetRouting(toys: object[], transactions: object[] = []) {
  mockGet.mockImplementation((path: string) => {
    if (path === '/api/toys') return Promise.resolve(toys)
    if (path === '/api/toy-transactions') return Promise.resolve(transactions)
    return Promise.reject(new Error(`unexpected GET ${path}`))
  })
}

describe('Editor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseCapabilities.mockReturnValue(caps({}))
  })

  it('fetches the collection and picks the row by id — toys.ts has no single-row GET', async () => {
    mockGetRouting([toy({ id: 'other' }), toy({})])
    render(<Editor id="toy1" />)

    expect(await screen.findByRole('tab', { name: 'Details' })).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/toys')
    expect(mockGet).toHaveBeenCalledWith('/api/toy-transactions')
  })

  it('marks Photos attention and Details done while the cover photo is missing', async () => {
    mockGetRouting([toy({})])
    render(<Editor id="toy1" />)

    expect(await screen.findByRole('tab', { name: 'Details' })).toBeTruthy()
    expect(screen.getByTestId('step-pill-check-details', { includeHiddenElements: true })).toBeTruthy()
    expect(screen.getByTestId('step-pill-dot-photos', { includeHiddenElements: true })).toBeTruthy()
  })

  it('saves the four detail fields on Save details, and updates local state from the response', async () => {
    mockGetRouting([toy({})])
    mockPatch.mockResolvedValue(toy({ name: 'New name', condition: 9, switch_adapted: true }))
    render(<Editor id="toy1" />)

    await screen.findByPlaceholderText('Name')
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'New name')
    fireEvent.press(screen.getByLabelText('9'))
    fireEvent(screen.getByTestId('switch-adapted-switch'), 'valueChange', true)
    fireEvent.press(screen.getByLabelText('Save details'))

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/api/toys/toy1', {
        name: 'New name',
        description: null,
        condition: 9,
        switch_adapted: true,
      })
    )
  })

  describe('Photos', () => {
    it('takes a cover photo, uploads with the toyId field, then PATCHes cover_photo_url', async () => {
      mockGetRouting([toy({})])
      mockRequestCameraPermissions.mockResolvedValue({ granted: true })
      mockLaunchCamera.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://cover.jpg', fileName: 'cover.jpg', mimeType: 'image/jpeg' }],
      })
      mockUploadFile.mockResolvedValue({ url: 'toy1/cover.jpg' })
      mockPatch.mockResolvedValue(toy({ cover_photo_url: 'toy1/cover.jpg' }))
      render(<Editor id="toy1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'Photos' }))
      fireEvent.press(screen.getByLabelText('Take a cover photo'))

      await waitFor(() =>
        expect(mockUploadFile).toHaveBeenCalledWith(
          '/api/upload/toy-cover',
          'toy1',
          { uri: 'file://cover.jpg', name: 'cover.jpg', mimeType: 'image/jpeg' },
          'toyId'
        )
      )
      await waitFor(() =>
        expect(mockPatch).toHaveBeenCalledWith('/api/toys/toy1', { cover_photo_url: 'toy1/cover.jpg' })
      )
    })

    it('does not offer switch photo tiles until switch-adapted is on', async () => {
      mockGetRouting([toy({ switch_adapted: false })])
      render(<Editor id="toy1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'Photos' }))
      expect(screen.queryByText('Switch photos')).toBeNull()
    })

    it('gates the switch section on the saved toy.switch_adapted, not the unsaved Details toggle', async () => {
      mockGetRouting([toy({ switch_adapted: false })])
      mockPatch.mockResolvedValue(toy({ switch_adapted: true }))
      render(<Editor id="toy1" />)

      // Flip the toggle in Details, but never press Save details.
      await screen.findByPlaceholderText('Name')
      fireEvent(screen.getByTestId('switch-adapted-switch'), 'valueChange', true)

      fireEvent.press(screen.getByRole('tab', { name: 'Photos' }))
      expect(screen.queryByText('Switch photos')).toBeNull()

      // Now actually save — the server's response is what should open the
      // section, not the local draft that already said true a moment ago.
      fireEvent.press(screen.getByRole('tab', { name: 'Details' }))
      fireEvent.press(screen.getByLabelText('Save details'))
      await waitFor(() => expect(mockPatch).toHaveBeenCalled())

      fireEvent.press(screen.getByRole('tab', { name: 'Photos' }))
      expect(await screen.findByText('Switch photos')).toBeTruthy()
    })

    it('appends the new url to the existing switch_photo_urls on a switch photo upload', async () => {
      mockGetRouting([toy({ switch_adapted: true, switch_photo_urls: ['toy1/switch-a.jpg'] })])
      mockRequestMediaLibraryPermissions.mockResolvedValue({ granted: true })
      mockLaunchLibrary.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://switch-b.jpg', fileName: 'switch-b.jpg', mimeType: 'image/jpeg' }],
      })
      mockUploadFile.mockResolvedValue({ url: 'toy1/switch-b.jpg' })
      mockPatch.mockResolvedValue(
        toy({ switch_adapted: true, switch_photo_urls: ['toy1/switch-a.jpg', 'toy1/switch-b.jpg'] })
      )
      render(<Editor id="toy1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'Photos' }))
      fireEvent.press(screen.getByLabelText('Choose switch photo from library'))

      await waitFor(() =>
        expect(mockPatch).toHaveBeenCalledWith('/api/toys/toy1', {
          switch_photo_urls: ['toy1/switch-a.jpg', 'toy1/switch-b.jpg'],
        })
      )
    })

    it('surfaces a denied camera permission as an inline error instead of a silent no-op', async () => {
      mockGetRouting([toy({})])
      mockRequestCameraPermissions.mockResolvedValue({ granted: false })
      render(<Editor id="toy1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'Photos' }))
      fireEvent.press(screen.getByLabelText('Take a cover photo'))

      expect(await screen.findByText('Camera access is needed to take a photo.')).toBeTruthy()
      expect(mockUploadFile).not.toHaveBeenCalled()
    })
  })

  describe('Review', () => {
    it('PATCHes offer_type immediately when an offer chip is pressed', async () => {
      mockGetRouting([toy({})])
      mockPatch.mockResolvedValue(toy({ offer_type: 'exchange' }))
      render(<Editor id="toy1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'Review' }))
      fireEvent.press(screen.getByLabelText('Exchange'))

      await waitFor(() =>
        expect(mockPatch).toHaveBeenCalledWith('/api/toys/toy1', { offer_type: 'exchange' })
      )
    })

    it('surfaces a failed offer_type PATCH through an error row instead of dropping it silently', async () => {
      mockGetRouting([toy({})])
      mockPatch.mockRejectedValue(new Error('API PATCH failed with status 500'))
      render(<Editor id="toy1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'Review' }))
      fireEvent.press(screen.getByLabelText('Exchange'))

      expect(await screen.findByText('Could not save that. Please try again.')).toBeTruthy()
    })

    it('disables Publish while gaps remain, and lists what is still needed', async () => {
      mockGetRouting([toy({})])
      render(<Editor id="toy1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'Review' }))

      expect(await screen.findByText(/^Still needed:/)).toBeTruthy()
      expect(screen.getByLabelText('Publish to the Toy Library').props.accessibilityState.disabled).toBe(true)
    })

    it('publishes a gapless draft with a PATCH to /publish, and shows the published state', async () => {
      const gapless = toy({ cover_photo_url: 'toy1/cover.jpg', offer_type: 'donation' })
      mockGetRouting([gapless])
      mockPatch.mockResolvedValue({ ...gapless, status: 'published' })
      render(<Editor id="toy1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'Review' }))

      const publishButton = await screen.findByLabelText('Publish to the Toy Library')
      expect(publishButton.props.accessibilityState.disabled).toBe(false)
      fireEvent.press(publishButton)

      await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/toys/toy1/publish', {}))
      expect(await screen.findByText('✓ Published · in the Toy Library')).toBeTruthy()
    })

    it('shows no "Take off the shelf" control — the API has no unpublish route', async () => {
      const published = toy({
        cover_photo_url: 'toy1/cover.jpg',
        offer_type: 'donation',
        status: 'published',
      })
      mockGetRouting([published])
      render(<Editor id="toy1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'Review' }))
      await screen.findByText('✓ Published · in the Toy Library')

      expect(screen.queryByText(/Take off the shelf/i)).toBeNull()
    })

    it('shows the offers row only for an owner-side requested transaction on this toy', async () => {
      mockGetRouting(
        [toy({})],
        [
          tx({ id: 'tx1' }),
          // A different toy's request must not count toward this row.
          tx({ id: 'tx2', toy_id: 'other-toy' }),
          // The requester side of a transaction on this toy: not this owner's to answer.
          tx({ id: 'tx3', owner_id: 'someone-else', requester_id: 'viewer1' }),
        ]
      )
      render(<Editor id="toy1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'Review' }))

      expect(await screen.findByText('1 offer on this toy · Waiting on you')).toBeTruthy()
    })

    it('omits the offers row when no owner-side requested transaction exists for this toy', async () => {
      mockGetRouting([toy({})], [])
      render(<Editor id="toy1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'Review' }))

      await screen.findByText(/^Still needed:/)
      expect(screen.queryByText(/offer(s)? on this toy/)).toBeNull()
    })

    it('pushes to /exchanges?toy=<id> when the offers row is pressed', async () => {
      mockGetRouting([toy({})], [tx({})])
      render(<Editor id="toy1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'Review' }))
      fireEvent.press(await screen.findByText('1 offer on this toy · Waiting on you'))

      expect(mockPush).toHaveBeenCalledWith('/exchanges?toy=toy1')
    })
  })

  describe('Delete', () => {
    it('deletes the toy after the confirm alert, and goes back', async () => {
      mockGetRouting([toy({})])
      mockDelete.mockResolvedValue(null)
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
        buttons?.find((b) => b.text === 'Delete')?.onPress?.()
      })

      render(<Editor id="toy1" />)
      await screen.findByLabelText('Delete toy')
      fireEvent.press(screen.getByLabelText('Delete toy'))

      expect(alertSpy).toHaveBeenCalled()
      await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/toys/toy1'))
      expect(mockBack).toHaveBeenCalled()
    })

    it('surfaces a failed delete instead of silently staying put', async () => {
      mockGetRouting([toy({})])
      mockDelete.mockRejectedValue(new Error('API DELETE failed with status 500'))
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
        buttons?.find((b) => b.text === 'Delete')?.onPress?.()
      })

      render(<Editor id="toy1" />)
      await screen.findByLabelText('Delete toy')
      fireEvent.press(screen.getByLabelText('Delete toy'))

      await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/toys/toy1'))
      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Could not delete this toy', 'Please try again.'))
      expect(mockBack).not.toHaveBeenCalled()
    })

    it('leaves the toy alone when the delete alert is cancelled', async () => {
      mockGetRouting([toy({})])
      jest.spyOn(Alert, 'alert').mockImplementation(() => {})

      render(<Editor id="toy1" />)
      await screen.findByLabelText('Delete toy')
      fireEvent.press(screen.getByLabelText('Delete toy'))

      expect(mockDelete).not.toHaveBeenCalled()
      expect(mockBack).not.toHaveBeenCalled()
    })
  })
})
