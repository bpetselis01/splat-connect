// packages/mobile/tests/unit/components/my-tutorials/editor.test.tsx
import { Alert } from 'react-native'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { Editor } from '../../../../components/my-tutorials/editor'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockBack = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: jest.fn() }) }))

// The editor pulls ErrorRow in from components/auth-screen, which imports
// useAuth from lib/auth-context — and that module's real implementation
// reaches all the way to the live supabase client. Mocking auth-context here
// (unused by the editor itself) is what keeps that import inert, same as
// guides-new.test.tsx does for the same transitive reason.
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

// The editor imports the real supabase client directly (for the PDF preview's
// signed-URL flow) — same reason components/home/detail-screen.tsx's own test
// mocks it: the real module reads env vars that don't exist under Jest.
jest.mock('../../../../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: jest.fn() }) } },
}))

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

const mockGetDocumentAsync = jest.fn()
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...a: unknown[]) => mockGetDocumentAsync(...a),
}))

const draft = (over: object) => ({
  id: 't1', title: 'Bubble machine switch', description: null, difficulty: 'easy', kind: 'toy_adaptation',
  status: 'draft', tutorial_pdf_url: null, toy_photo_url: null, rejection_note: null,
  created_at: '', updated_at: '2026-08-30T00:00:00.000Z', reviewed_at: null, reviewed_by: null,
  reviewed_for_org_id: null, parts: [], tools: [], stl_files: [], tutorial_recommendations: [],
  tutorial_contributors: [], ...over,
})

// Routes /orgs (the review step's backing fetch) to its own resolved value so
// it never collides with the tutorial-shaped one every other GET returns.
const mockGetRoutingOrgsTo = (orgs: unknown[], tutorial: object) => {
  mockGet.mockImplementation((path: string) => Promise.resolve(path.endsWith('/orgs') ? orgs : tutorial))
}

describe('Editor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('marks Files attention and Details done for a draft missing a pdf and a photo', async () => {
    mockGet.mockResolvedValue(draft({ parts: [{ id: 'p1' }], tools: [{ id: 'to1' }] }))
    render(<Editor id="t1" />)

    expect(await screen.findByRole('tab', { name: 'Details' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Details' }).props.accessibilityState.selected).toBe(true)
    expect(screen.getByTestId('step-pill-check-details', { includeHiddenElements: true })).toBeTruthy()
    expect(screen.getByTestId('step-pill-dot-files', { includeHiddenElements: true })).toBeTruthy()
  })

  it('saves the four detail fields on Save details, and updates local state from the response', async () => {
    mockGet.mockResolvedValue(draft({}))
    mockPatch.mockResolvedValue(draft({ title: 'New title', difficulty: 'hard', kind: 'assistive_tech' }))
    render(<Editor id="t1" />)

    await screen.findByPlaceholderText('Title')
    fireEvent.changeText(screen.getByPlaceholderText('Title'), 'New title')
    fireEvent.press(screen.getByLabelText('Hard'))
    fireEvent.press(screen.getByLabelText('Assistive tech'))
    fireEvent.press(screen.getByLabelText('Save details'))

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith(
        '/api/tutorials/t1',
        expect.objectContaining({
          title: 'New title',
          description: null,
          difficulty: 'hard',
          kind: 'assistive_tech',
        })
      )
    )
    // The STL pill only appears once the kind is actually assistive_tech —
    // proof the save response, not just the local chip state, drove the redraw.
    expect(await screen.findByRole('tab', { name: 'STL' })).toBeTruthy()
  })

  it('shows the rejection note in an apricot note box', async () => {
    mockGet.mockResolvedValue(draft({ status: 'rejected', rejection_note: 'Blurry photo.' }))
    render(<Editor id="t1" />)
    expect(await screen.findByText('Blurry photo.')).toBeTruthy()
  })

  it('shows the pending banner, naming who is reviewing it and defaulting to SPLAT', async () => {
    mockGet.mockResolvedValue(draft({ status: 'pending', reviewed_for: null }))
    render(<Editor id="t1" />)
    expect(
      await screen.findByText('With SPLAT for review. You can still make changes.')
    ).toBeTruthy()
  })

  it('names the reviewing organisation when reviewed_for is set', async () => {
    mockGet.mockResolvedValue(draft({ status: 'pending', reviewed_for: { name: 'Riverside Therapy' } }))
    render(<Editor id="t1" />)
    expect(
      await screen.findByText('With Riverside Therapy for review. You can still make changes.')
    ).toBeTruthy()
  })

  describe('requeue on save', () => {
    it('PATCHes status: pending when Save details is pressed on an approved guide', async () => {
      mockGet.mockResolvedValue(draft({ status: 'approved' }))
      mockPatch.mockResolvedValue(draft({ status: 'pending' }))
      render(<Editor id="t1" />)

      await screen.findByPlaceholderText('Title')
      fireEvent.press(screen.getByLabelText('Save details'))

      await waitFor(() =>
        expect(mockPatch).toHaveBeenCalledWith(
          '/api/tutorials/t1',
          expect.objectContaining({ status: 'pending' })
        )
      )
    })

    it('leaves status off the PATCH when Save details is pressed on a draft', async () => {
      mockGet.mockResolvedValue(draft({}))
      mockPatch.mockResolvedValue(draft({}))
      render(<Editor id="t1" />)

      await screen.findByPlaceholderText('Title')
      fireEvent.press(screen.getByLabelText('Save details'))

      await waitFor(() => expect(mockPatch).toHaveBeenCalled())
      expect(mockPatch.mock.calls[0][1]).not.toHaveProperty('status')
    })
  })

  it('deletes the guide after the confirm alert, and goes back', async () => {
    mockGet.mockResolvedValue(draft({}))
    mockDelete.mockResolvedValue(null)
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Delete')?.onPress?.()
    })

    render(<Editor id="t1" />)
    await screen.findByLabelText('Delete guide')
    fireEvent.press(screen.getByLabelText('Delete guide'))

    expect(alertSpy).toHaveBeenCalled()
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/tutorials/t1'))
    expect(mockBack).toHaveBeenCalled()
  })

  it('leaves the guide alone when the delete alert is cancelled', async () => {
    mockGet.mockResolvedValue(draft({}))
    jest.spyOn(Alert, 'alert').mockImplementation(() => {})

    render(<Editor id="t1" />)
    await screen.findByLabelText('Delete guide')
    fireEvent.press(screen.getByLabelText('Delete guide'))

    expect(mockDelete).not.toHaveBeenCalled()
    expect(mockBack).not.toHaveBeenCalled()
  })

  describe('Parts and Tools', () => {
    it('adds a part row and saves the replace-set with the typed name and quantity, leaving the existing row\'s buy_links untouched', async () => {
      mockGet.mockResolvedValue(
        draft({
          parts: [{ id: 'p1', name: 'Switch', quantity: 2, is_optional: false, buy_links: [{ label: 'Amazon', url: 'https://a.test' }] }],
        })
      )
      mockPost.mockResolvedValue([])
      render(<Editor id="t1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'Parts' }))

      fireEvent.press(screen.getByLabelText('+ Add a part'))
      fireEvent.changeText(screen.getByLabelText('Part 2 name'), 'Micro switch')
      fireEvent.press(screen.getByLabelText('Increase quantity for part 2'))
      fireEvent.press(screen.getByLabelText('Save parts'))

      await waitFor(() =>
        expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/parts', {
          parts: [
            { name: 'Switch', quantity: 2, is_optional: false, buy_links: [{ label: 'Amazon', url: 'https://a.test' }] },
            { name: 'Micro switch', quantity: 2, is_optional: false, buy_links: [] },
          ],
        })
      )
    })

    it('disables Save parts while a row has a blank name', async () => {
      mockGet.mockResolvedValue(draft({}))
      render(<Editor id="t1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'Parts' }))

      fireEvent.press(screen.getByLabelText('+ Add a part'))
      expect(screen.getByLabelText('Save parts').props.accessibilityState.disabled).toBe(true)

      fireEvent.changeText(screen.getByLabelText('Part 1 name'), 'Micro switch')
      expect(screen.getByLabelText('Save parts').props.accessibilityState.disabled).toBe(false)
    })

    it('saves the tools replace-set with no quantity field', async () => {
      mockGet.mockResolvedValue(draft({ tools: [{ id: 'to1', name: 'Screwdriver', is_optional: true, buy_links: [] }] }))
      mockPost.mockResolvedValue([])
      render(<Editor id="t1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'Tools' }))
      fireEvent.press(screen.getByLabelText('Save tools'))

      await waitFor(() =>
        expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/tools', {
          tools: [{ name: 'Screwdriver', is_optional: true, buy_links: [] }],
        })
      )
    })
  })

  describe('Files', () => {
    it('picks a PDF, uploads it, then PATCHes tutorial_pdf_url with the returned path', async () => {
      mockGet.mockResolvedValue(draft({}))
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://guide.pdf', name: 'guide.pdf', mimeType: 'application/pdf' }],
      })
      mockUploadFile.mockResolvedValue({ url: 't1/tutorial.pdf' })
      mockPatch.mockResolvedValue(draft({ tutorial_pdf_url: 't1/tutorial.pdf' }))
      render(<Editor id="t1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'Files' }))
      fireEvent.press(screen.getByLabelText('Choose PDF from Files'))

      await waitFor(() =>
        expect(mockUploadFile).toHaveBeenCalledWith('/api/upload/pdf', 't1', {
          uri: 'file://guide.pdf',
          name: 'guide.pdf',
          mimeType: 'application/pdf',
        })
      )
      await waitFor(() =>
        expect(mockPatch).toHaveBeenCalledWith('/api/tutorials/t1', {
          tutorial_pdf_url: 't1/tutorial.pdf',
          updated_at: '2026-08-30T00:00:00.000Z',
        })
      )
    })

    it('takes a photo, uploads it, then PATCHes toy_photo_url with the returned url', async () => {
      mockGet.mockResolvedValue(draft({}))
      mockRequestCameraPermissions.mockResolvedValue({ granted: true })
      mockLaunchCamera.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://photo.jpg', fileName: 'photo.jpg', mimeType: 'image/jpeg' }],
      })
      mockUploadFile.mockResolvedValue({ url: 'https://cdn.test/photo.jpg' })
      mockPatch.mockResolvedValue(draft({ toy_photo_url: 'https://cdn.test/photo.jpg' }))
      render(<Editor id="t1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'Files' }))
      fireEvent.press(screen.getByLabelText('Take a photo'))

      await waitFor(() =>
        expect(mockLaunchCamera).toHaveBeenCalledWith({ quality: 0.7 })
      )
      await waitFor(() =>
        expect(mockUploadFile).toHaveBeenCalledWith('/api/upload/photo', 't1', {
          uri: 'file://photo.jpg',
          name: 'photo.jpg',
          mimeType: 'image/jpeg',
        })
      )
      await waitFor(() =>
        expect(mockPatch).toHaveBeenCalledWith('/api/tutorials/t1', {
          toy_photo_url: 'https://cdn.test/photo.jpg',
          updated_at: '2026-08-30T00:00:00.000Z',
        })
      )
    })

    it('surfaces a denied camera permission as an inline error instead of a silent no-op', async () => {
      mockGet.mockResolvedValue(draft({}))
      mockRequestCameraPermissions.mockResolvedValue({ granted: false })
      render(<Editor id="t1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'Files' }))
      fireEvent.press(screen.getByLabelText('Take a photo'))

      expect(await screen.findByText('Camera access is needed to take a photo.')).toBeTruthy()
      expect(mockLaunchCamera).not.toHaveBeenCalled()
      expect(mockUploadFile).not.toHaveBeenCalled()
    })
  })

  describe('STL', () => {
    it('rejects a picked file that is not a .stl, with an inline error and no upload', async () => {
      mockGet.mockResolvedValue(draft({ kind: 'assistive_tech', stl_files: [] }))
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://model.obj', name: 'model.obj', mimeType: 'model/obj' }],
      })
      render(<Editor id="t1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'STL' }))
      fireEvent.press(screen.getByLabelText('Choose STL from Files'))

      expect(await screen.findByText('Please choose a .stl file.')).toBeTruthy()
      expect(mockUploadFile).not.toHaveBeenCalled()
    })

    it('uploads a valid .stl file and registers it through the stl-files replace-set, keeping the existing row', async () => {
      mockGet.mockResolvedValue(
        draft({ kind: 'assistive_tech', stl_files: [{ id: 's1', filename: 'base.stl', file_url: 't1/base.stl' }] })
      )
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://arm.stl', name: 'arm.stl', mimeType: 'model/stl' }],
      })
      mockUploadFile.mockResolvedValue({ url: 't1/arm.stl', filename: 'arm.stl' })
      mockPost.mockResolvedValue([
        { id: 's1', filename: 'base.stl', file_url: 't1/base.stl' },
        { id: 's2', filename: 'arm.stl', file_url: 't1/arm.stl' },
      ])
      render(<Editor id="t1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'STL' }))
      fireEvent.press(screen.getByLabelText('Choose STL from Files'))

      await waitFor(() =>
        expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/stl-files', {
          stl_files: [
            { filename: 'base.stl', file_url: 't1/base.stl' },
            { filename: 'arm.stl', file_url: 't1/arm.stl' },
          ],
        })
      )
    })
  })

  describe('Review', () => {
    it('disables Submit for review while gaps remain, and lists what is still needed', async () => {
      mockGetRoutingOrgsTo([], draft({}))
      render(<Editor id="t1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'Review' }))

      expect(await screen.findByText(/^Still needed:/)).toBeTruthy()
      await waitFor(() =>
        expect(screen.getByLabelText('Submit for review').props.accessibilityState.disabled).toBe(true)
      )
    })

    it('submits a gapless draft for review with a PATCH to status pending', async () => {
      const complete = draft({
        tutorial_pdf_url: 't1/tutorial.pdf',
        toy_photo_url: 'https://cdn.test/photo.jpg',
        parts: [{ id: 'p1', name: 'Switch', quantity: 1, is_optional: false, buy_links: [] }],
        tools: [{ id: 'to1', name: 'Screwdriver', is_optional: false, buy_links: [] }],
      })
      mockGetRoutingOrgsTo([], complete)
      mockPatch.mockResolvedValue(complete)
      render(<Editor id="t1" />)

      await screen.findByRole('tab', { name: 'Details' })
      fireEvent.press(screen.getByRole('tab', { name: 'Review' }))

      await waitFor(() =>
        expect(screen.getByLabelText('Submit for review').props.accessibilityState.disabled).toBe(false)
      )
      fireEvent.press(screen.getByLabelText('Submit for review'))

      await waitFor(() =>
        expect(mockPatch).toHaveBeenCalledWith('/api/tutorials/t1', {
          status: 'pending',
          updated_at: '2026-08-30T00:00:00.000Z',
        })
      )
    })
  })
})
