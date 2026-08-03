import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditFilesSection } from '@/components/edit-files-section'
import { browserApiClient } from '@/lib/browser-api-client'
import { ToastProvider } from '@/components/toast'

// --- Mock strategy ---
// browserApiClient.postFormData is mocked via vi.mock so the component can be tested without
// real HTTP calls. The setup() helper renders the component with a default onSave spy and
// returns direct references to the photo input, PDF input, and Save button for convenient
// use in individual tests.
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { postFormData: vi.fn() },
}))

const mockPostFormData = vi.mocked(browserApiClient.postFormData)

function setup(onSave = vi.fn().mockResolvedValue(undefined)) {
  const result = render(
    <EditFilesSection
      tutorialId="tid-1"
      currentPhotoUrl="https://example.com/photo.jpg"
      currentPdfUrl="https://example.com/tutorial.pdf"
      onSave={onSave}
    />
  )
  const photoInput = result.container.querySelector('input[name="toy_photo"]') as HTMLInputElement
  const pdfInput = result.container.querySelector('input[name="tutorial_pdf"]') as HTMLInputElement
  const saveButton = screen.getByRole('button', { name: 'Save files' })
  return { ...result, photoInput, pdfInput, saveButton, onSave }
}

describe('EditFilesSection', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: the Save button is disabled when neither a photo nor a PDF has been selected
  // How:   calls setup() with no file interactions; checks saveButton has disabled attribute
  // Chain: prevents an empty save call → the component only calls postFormData when at least
  //        one file is queued, avoiding a wasted API call
  it('Save button is disabled when no file is selected', () => {
    const { saveButton } = setup()
    expect(saveButton).toBeDisabled()
  })

  // Tests: selecting a photo file enables the Save button
  // How:   fires change on photoInput with a PNG file; checks saveButton is not disabled
  // Chain: the save state tracks whether any new file is pending → users get clear visual
  //        feedback that their selection is ready to upload
  it('Save button is enabled after selecting a photo', () => {
    const { photoInput, saveButton } = setup()
    fireEvent.change(photoInput, {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    expect(saveButton).not.toBeDisabled()
  })

  // Tests: selecting a PDF file enables the Save button
  // How:   fires change on pdfInput with a PDF file; checks saveButton is not disabled
  // Chain: selecting either file type activates the Save path — the component tracks pending
  //        changes regardless of which file type was chosen
  it('Save button is enabled after selecting a PDF', () => {
    const { pdfInput, saveButton } = setup()
    fireEvent.change(pdfInput, {
      target: { files: [new File(['pdf'], 'tutorial.pdf', { type: 'application/pdf' })] },
    })
    expect(saveButton).not.toBeDisabled()
  })

  // Tests: file selection alone does not trigger an upload — it only queues the file
  // How:   fires change on photoInput; checks mockPostFormData was not called
  // Chain: uploads are deferred to the Save button click → the user can change their mind
  //        and select a different file without incurring an unnecessary upload
  it('selecting a photo does not call postFormData', () => {
    const { photoInput } = setup()
    fireEvent.change(photoInput, {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    expect(mockPostFormData).not.toHaveBeenCalled()
  })

  // Tests: selecting a PDF does not trigger an upload until Save is clicked
  // How:   fires change on pdfInput; checks mockPostFormData was not called
  // Chain: same deferred-upload pattern as photo → selection queues, Save executes the upload
  it('selecting a PDF does not call postFormData', () => {
    const { pdfInput } = setup()
    fireEvent.change(pdfInput, {
      target: { files: [new File(['pdf'], 'tutorial.pdf', { type: 'application/pdf' })] },
    })
    expect(mockPostFormData).not.toHaveBeenCalled()
  })

  // Tests: clicking Save after selecting a photo calls postFormData with the photo upload endpoint
  // How:   fires change then saveButton click; waitFor checks mockPostFormData was called with '/api/upload/photo'
  // Chain: the photo is uploaded to Supabase storage → the returned URL is passed to onSave,
  //        which PATCHes the tutorial record so the new photo appears on the tutorial page
  it('clicking Save after selecting photo calls postFormData with /api/upload/photo', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new-photo.png' })
    const { photoInput, saveButton } = setup()
    fireEvent.change(photoInput, {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    fireEvent.click(saveButton)
    await waitFor(() => expect(mockPostFormData).toHaveBeenCalledTimes(1))
    const [calledPath] = mockPostFormData.mock.calls[0] as [string, FormData]
    expect(calledPath).toBe('/api/upload/photo')
  })

  // Tests: clicking Save after selecting a PDF calls postFormData with the PDF upload endpoint
  // How:   fires change on pdfInput then saveButton click; checks path is '/api/upload/pdf'
  // Chain: the PDF is uploaded to Supabase storage → the returned URL is PATCHed onto the
  //        tutorial record so viewers can download the updated PDF
  it('clicking Save after selecting PDF calls postFormData with /api/upload/pdf', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new-tutorial.pdf' })
    const { pdfInput, saveButton } = setup()
    fireEvent.change(pdfInput, {
      target: { files: [new File(['pdf'], 'tutorial.pdf', { type: 'application/pdf' })] },
    })
    fireEvent.click(saveButton)
    await waitFor(() => expect(mockPostFormData).toHaveBeenCalledTimes(1))
    const [calledPath] = mockPostFormData.mock.calls[0] as [string, FormData]
    expect(calledPath).toBe('/api/upload/pdf')
  })

  // Tests: when both files are selected and Save is clicked, onSave is called with both returned URLs
  // How:   mockPostFormData returns two different URLs; fires both inputs then clicks Save;
  //        checks onSave was called with (photoUrl, pdfUrl)
  // Chain: the parent component patches the tutorial record with both URLs in one PATCH call →
  //        photo and PDF are updated atomically without needing two separate save cycles
  it('clicking Save with both files selected calls onSave with correct URLs', async () => {
    mockPostFormData
      .mockResolvedValueOnce({ url: 'https://example.com/new-photo.png' })
      .mockResolvedValueOnce({ url: 'https://example.com/new-tutorial.pdf' })
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { photoInput, pdfInput, saveButton } = setup(onSave)
    fireEvent.change(photoInput, {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    fireEvent.change(pdfInput, {
      target: { files: [new File(['pdf'], 'tutorial.pdf', { type: 'application/pdf' })] },
    })
    fireEvent.click(saveButton)
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith(
      'https://example.com/new-photo.png',
      'https://example.com/new-tutorial.pdf'
    )
  })

  // Tests: after a successful save the Save button becomes disabled again
  // How:   fires change + save; waitFor checks button returns to disabled state
  // Chain: the component resets to its "no pending changes" state after saving → the button
  //        signals there are no unsaved changes, preventing accidental double-saves
  it('Save button is disabled again after a successful save', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new-photo.png' })
    const { photoInput, saveButton } = setup()
    fireEvent.change(photoInput, {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    fireEvent.click(saveButton)
    await waitFor(() => expect(saveButton).toBeDisabled())
  })

  it('shows a "Last saved" line after a successful save', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new-photo.png' })
    const { photoInput } = setup()
    fireEvent.change(photoInput, {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save files' }))
    await waitFor(() => expect(screen.getByText(/last saved just now/i)).toBeInTheDocument())
  })

  it('fires the shared toast with "Files saved" after a successful save', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new-photo.png' })
    render(
      <ToastProvider>
        <EditFilesSection
          tutorialId="tid-1"
          currentPhotoUrl={null}
          currentPdfUrl={null}
          onSave={vi.fn().mockResolvedValue(undefined)}
        />
      </ToastProvider>
    )
    const photoInput = screen.getByLabelText(/toy photo/i, { selector: 'input' })
    fireEvent.change(photoInput, {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save files' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Files saved'))
  })
})
