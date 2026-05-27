import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditFilesSection } from '@/components/edit-files-section'
import { browserApiClient } from '@/lib/browser-api-client'

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

  it('Save button is disabled when no file is selected', () => {
    const { saveButton } = setup()
    expect(saveButton).toBeDisabled()
  })

  it('Save button is enabled after selecting a photo', () => {
    const { photoInput, saveButton } = setup()
    fireEvent.change(photoInput, {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    expect(saveButton).not.toBeDisabled()
  })

  it('Save button is enabled after selecting a PDF', () => {
    const { pdfInput, saveButton } = setup()
    fireEvent.change(pdfInput, {
      target: { files: [new File(['pdf'], 'tutorial.pdf', { type: 'application/pdf' })] },
    })
    expect(saveButton).not.toBeDisabled()
  })

  it('selecting a photo does not call postFormData', () => {
    const { photoInput } = setup()
    fireEvent.change(photoInput, {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    expect(mockPostFormData).not.toHaveBeenCalled()
  })

  it('selecting a PDF does not call postFormData', () => {
    const { pdfInput } = setup()
    fireEvent.change(pdfInput, {
      target: { files: [new File(['pdf'], 'tutorial.pdf', { type: 'application/pdf' })] },
    })
    expect(mockPostFormData).not.toHaveBeenCalled()
  })

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

  it('Save button is disabled again after a successful save', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new-photo.png' })
    const { photoInput, saveButton } = setup()
    fireEvent.change(photoInput, {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    fireEvent.click(saveButton)
    await waitFor(() => expect(saveButton).toBeDisabled())
  })
})
