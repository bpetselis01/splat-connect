import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ToyPhotosSection } from '@/components/toy-photos-section'
import { browserApiClient } from '@/lib/browser-api-client'
import { ToastProvider } from '@/components/toast'

vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { postFormData: vi.fn() },
}))

const mockPostFormData = vi.mocked(browserApiClient.postFormData)

function setup(
  overrides: Partial<{
    coverPhotoUrl: string | null
    switchAdapted: boolean
    switchPhotoUrls: string[]
    onSave: ReturnType<typeof vi.fn>
    onRemoveSwitchPhoto: ReturnType<typeof vi.fn>
  }> = {}
) {
  const onSave = overrides.onSave ?? vi.fn().mockResolvedValue(undefined)
  const onRemoveSwitchPhoto = overrides.onRemoveSwitchPhoto ?? vi.fn().mockResolvedValue(undefined)
  const result = render(
    <ToyPhotosSection
      toyId="toy-1"
      coverPhotoUrl={overrides.coverPhotoUrl ?? 'https://example.com/cover.jpg'}
      switchAdapted={overrides.switchAdapted ?? false}
      switchPhotoUrls={overrides.switchPhotoUrls ?? []}
      onSave={onSave}
      onRemoveSwitchPhoto={onRemoveSwitchPhoto}
    />
  )
  const coverInput = result.container.querySelector('input[name="toy_cover_photo"]') as HTMLInputElement
  const saveButton = screen.getByRole('button', { name: 'Save photos' })
  return { ...result, coverInput, saveButton, onSave, onRemoveSwitchPhoto }
}

describe('ToyPhotosSection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Save button is disabled with no pending changes', () => {
    const { saveButton } = setup()
    expect(saveButton).toBeDisabled()
  })

  it('Save button is enabled after selecting a cover photo', () => {
    const { coverInput, saveButton } = setup()
    fireEvent.change(coverInput, {
      target: { files: [new File(['img'], 'cover.png', { type: 'image/png' })] },
    })
    expect(saveButton).not.toBeDisabled()
  })

  it('selecting a cover photo does not call postFormData', () => {
    const { coverInput } = setup()
    fireEvent.change(coverInput, {
      target: { files: [new File(['img'], 'cover.png', { type: 'image/png' })] },
    })
    expect(mockPostFormData).not.toHaveBeenCalled()
  })

  it('clicking Save after selecting a cover photo uploads to /api/upload/toy-cover', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new-cover.png' })
    const { coverInput, saveButton } = setup()
    fireEvent.change(coverInput, {
      target: { files: [new File(['img'], 'cover.png', { type: 'image/png' })] },
    })
    fireEvent.click(saveButton)
    await waitFor(() => expect(mockPostFormData).toHaveBeenCalledTimes(1))
    const [calledPath] = mockPostFormData.mock.calls[0] as [string, FormData]
    expect(calledPath).toBe('/api/upload/toy-cover')
  })

  it('calls onSave with the new cover url, preserving the existing switch photos', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new-cover.png' })
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { coverInput, saveButton } = setup({
      switchAdapted: true,
      switchPhotoUrls: ['https://x/switch-1.jpg'],
      onSave,
    })
    fireEvent.change(coverInput, {
      target: { files: [new File(['img'], 'cover.png', { type: 'image/png' })] },
    })
    fireEvent.click(saveButton)
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith({
      cover_photo_url: 'https://example.com/new-cover.png',
      switch_adapted: true,
      switch_photo_urls: ['https://x/switch-1.jpg'],
    })
  })

  it('shows the switch photo gallery only when switch-adapted is checked', () => {
    setup({ switchAdapted: false })
    expect(screen.queryByText('Switch photos')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Switch-adapted'))
    expect(screen.getByText('Switch photos')).toBeInTheDocument()
  })

  it('checking switch-adapted alone enables Save', () => {
    const { saveButton } = setup({ switchAdapted: false })
    fireEvent.click(screen.getByLabelText('Switch-adapted'))
    expect(saveButton).not.toBeDisabled()
  })

  it('removing an existing switch photo calls onRemoveSwitchPhoto immediately, without Save', async () => {
    const onRemoveSwitchPhoto = vi.fn().mockResolvedValue(undefined)
    setup({ switchAdapted: true, switchPhotoUrls: ['https://x/switch-1.jpg'], onRemoveSwitchPhoto })
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(onRemoveSwitchPhoto).toHaveBeenCalledWith('https://x/switch-1.jpg'))
    expect(mockPostFormData).not.toHaveBeenCalled()
  })

  it('Save button is disabled again after a successful save', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new-cover.png' })
    const { coverInput, saveButton } = setup()
    fireEvent.change(coverInput, {
      target: { files: [new File(['img'], 'cover.png', { type: 'image/png' })] },
    })
    fireEvent.click(saveButton)
    await waitFor(() => expect(saveButton).toBeDisabled())
  })

  it('fires the shared toast with "Photos saved" after a successful save', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new-cover.png' })
    render(
      <ToastProvider>
        <ToyPhotosSection
          toyId="toy-1"
          coverPhotoUrl={null}
          switchAdapted={false}
          switchPhotoUrls={[]}
          onSave={vi.fn().mockResolvedValue(undefined)}
          onRemoveSwitchPhoto={vi.fn().mockResolvedValue(undefined)}
        />
      </ToastProvider>
    )
    const coverInput = screen.getByLabelText(/cover photo/i, { selector: 'input' })
    fireEvent.change(coverInput, {
      target: { files: [new File(['img'], 'cover.png', { type: 'image/png' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save photos' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Photos saved'))
  })
})
