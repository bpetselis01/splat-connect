// packages/mobile/tests/unit/components/my-tutorials/editor.test.tsx
import { Alert } from 'react-native'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { Editor } from '../../../../components/my-tutorials/editor'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockBack = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }))

// The editor pulls ErrorRow in from components/auth-screen, which imports
// useAuth from lib/auth-context — and that module's real implementation
// reaches all the way to the live supabase client. Mocking auth-context here
// (unused by the editor itself) is what keeps that import inert, same as
// guides-new.test.tsx does for the same transitive reason.
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockGet = jest.fn()
const mockPatch = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}))

const draft = (over: object) => ({
  id: 't1', title: 'Bubble machine switch', description: null, difficulty: 'easy', kind: 'toy_adaptation',
  status: 'draft', tutorial_pdf_url: null, toy_photo_url: null, rejection_note: null,
  created_at: '', updated_at: '2026-08-30T00:00:00.000Z', reviewed_at: null, reviewed_by: null,
  reviewed_for_org_id: null, parts: [], tools: [], stl_files: [], tutorial_recommendations: [],
  tutorial_contributors: [], ...over,
})

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
      await screen.findByText('With SPLAT for review. Saving any change pulls it back to draft.')
    ).toBeTruthy()
  })

  it('names the reviewing organisation when reviewed_for is set', async () => {
    mockGet.mockResolvedValue(draft({ status: 'pending', reviewed_for: { name: 'Riverside Therapy' } }))
    render(<Editor id="t1" />)
    expect(
      await screen.findByText('With Riverside Therapy for review. Saving any change pulls it back to draft.')
    ).toBeTruthy()
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

  it('renders a static heading and gap status for steps beyond Details, never "coming in the next commit"', async () => {
    mockGet.mockResolvedValue(draft({}))
    render(<Editor id="t1" />)
    await screen.findByRole('tab', { name: 'Details' })

    fireEvent.press(screen.getByRole('tab', { name: 'Parts' }))
    // Both the pill label and the step's own heading say "Parts".
    expect(screen.getAllByText('Parts').length).toBe(2)
    expect(screen.getByText(/needs attention/i)).toBeTruthy()
    expect(screen.queryByText(/coming in the next commit/i)).toBeNull()
  })
})
