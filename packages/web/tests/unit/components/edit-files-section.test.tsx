import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditFilesSection } from '@/components/edit-files-section'
import { browserApiClient } from '@/lib/browser-api-client'
import { ToastProvider } from '@/components/toast'

// --- Mock strategy ---
// browserApiClient.postFormData is mocked via vi.mock so the component can be tested without
// real HTTP calls. The setup() helper renders the component with default spies and returns
// direct references to the add-photo input, the PDF input, and the Save button.
//
// The two files on this step no longer save the same way, and that is what most of these
// assert: the PDF is held until Save (picking one must not upload it), while a photo is a
// gallery entry and saves as it is added. The tile behaviour itself belongs to PhotoTiles
// and is tested in photo-tiles.test.tsx.
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { postFormData: vi.fn() },
}))

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const mockPostFormData = vi.mocked(browserApiClient.postFormData)

function setup(
  onSave = vi.fn().mockResolvedValue(undefined),
  onSavePhotos = vi.fn().mockResolvedValue(undefined),
  photoUrls: string[] = ['https://example.com/photo.jpg']
) {
  const result = render(
    <ToastProvider>
      <EditFilesSection
        tutorialId="tid-1"
        photoUrls={photoUrls}
        currentPdfUrl="https://example.com/tutorial.pdf"
        onSavePhotos={onSavePhotos}
        onSave={onSave}
      />
    </ToastProvider>
  )
  const photoInput = () => result.container.querySelector('#guide-add-photo') as HTMLInputElement
  const pdfInput = result.container.querySelector('input[name="tutorial_pdf"]') as HTMLInputElement
  const saveButton = screen.getByRole('button', { name: 'Save files' })
  return { ...result, photoInput, pdfInput, saveButton, onSave, onSavePhotos }
}

const png = () => new File(['img'], 'photo.png', { type: 'image/png' })
const pdf = () => new File(['pdf'], 'tutorial.pdf', { type: 'application/pdf' })

describe('EditFilesSection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Save button is disabled when no PDF is selected', () => {
    const { saveButton } = setup()
    expect(saveButton).toBeDisabled()
  })

  it('Save button is enabled after selecting a PDF', () => {
    const { pdfInput, saveButton } = setup()
    fireEvent.change(pdfInput, { target: { files: [pdf()] } })
    expect(saveButton).not.toBeDisabled()
  })

  // Tests: picking a PDF still queues rather than uploads
  // How:   fires change on pdfInput; checks postFormData was not called
  // Chain: the original reason for the deferred upload — a file reaching storage
  //        before the person committed to it — is unchanged for the PDF
  it('selecting a PDF does not call postFormData', () => {
    const { pdfInput } = setup()
    fireEvent.change(pdfInput, { target: { files: [pdf()] } })
    expect(mockPostFormData).not.toHaveBeenCalled()
  })

  it('clicking Save after selecting a PDF uploads it to /api/upload/pdf', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new-tutorial.pdf' })
    const { pdfInput, saveButton, onSave } = setup()
    fireEvent.change(pdfInput, { target: { files: [pdf()] } })
    fireEvent.click(saveButton)
    await waitFor(() => expect(mockPostFormData).toHaveBeenCalledOnce())
    expect(mockPostFormData.mock.calls[0][0]).toBe('/api/upload/pdf')
    expect(onSave).toHaveBeenCalledWith('https://example.com/new-tutorial.pdf')
  })

  // Tests: a photo does NOT wait for Save
  // How:   picks a photo without touching Save; checks it uploaded and persisted
  // Chain: a tile is the commitment, and × is how it is taken back — which also
  //        deletes the object, so nothing lingers that the author removed
  it('adding a photo uploads and saves it without clicking Save', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new-photo.png' })
    const { photoInput, onSavePhotos } = setup()
    fireEvent.change(photoInput(), { target: { files: [png()] } })
    await waitFor(() => expect(mockPostFormData).toHaveBeenCalledOnce())
    expect(mockPostFormData.mock.calls[0][0]).toBe('/api/upload/photo')
    expect(onSavePhotos).toHaveBeenCalledWith([
      'https://example.com/photo.jpg',
      'https://example.com/new-photo.png',
    ])
  })

  // Tests: a photo appends rather than replacing the one already there
  // How:   the guide already holds a photo; checks both survive the save
  // Chain: /photo used to delete every file in the folder first, which is what
  //        held a guide to one photo
  it('appends to the photos already on the guide', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/second.png' })
    const { photoInput, onSavePhotos } = setup(undefined, undefined, [
      'https://example.com/first.png',
    ])
    fireEvent.change(photoInput(), { target: { files: [png()] } })
    await waitFor(() =>
      expect(onSavePhotos).toHaveBeenCalledWith([
        'https://example.com/first.png',
        'https://example.com/second.png',
      ])
    )
  })

  it('the guide has no switch column — there is no switch to picture', () => {
    setup()
    expect(screen.queryByLabelText('Shows the switch')).toBeNull()
  })

  it('Save button is disabled again after a successful save', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new-tutorial.pdf' })
    const { pdfInput, saveButton } = setup()
    fireEvent.change(pdfInput, { target: { files: [pdf()] } })
    fireEvent.click(saveButton)
    await waitFor(() => expect(saveButton).toBeDisabled())
  })

  it('fires the shared toast with "Files saved" after a successful save', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new-tutorial.pdf' })
    const { pdfInput, saveButton } = setup()
    fireEvent.change(pdfInput, { target: { files: [pdf()] } })
    fireEvent.click(saveButton)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Files saved'))
  })
})
