import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ToyPhotosSection } from '@/components/toy-photos-section'
import { browserApiClient } from '@/lib/browser-api-client'
import { ToastProvider } from '@/components/toast'

vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { postFormData: vi.fn() },
}))

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const mockPostFormData = vi.mocked(browserApiClient.postFormData)

/**
 * The tile behaviour itself — ★, ×, the switch radio, the cap — belongs to
 * PhotoTiles and is tested in photo-tiles.test.tsx. What is left here is what
 * this component adds: the toy's upload endpoint, and the switch-adapted
 * checkbox, which is the one thing on this step that is a claim rather than a
 * file and so still has a Save button.
 */
function setup(
  overrides: Partial<{
    photoUrls: string[]
    switchAdapted: boolean
    switchPhotoUrl: string | null
    onSave: ReturnType<typeof vi.fn>
  }> = {}
) {
  const onSave = overrides.onSave ?? vi.fn().mockResolvedValue(undefined)
  const result = render(
    <ToastProvider>
      <ToyPhotosSection
        toyId="toy-1"
        photoUrls={overrides.photoUrls ?? ['https://example.com/cover.jpg']}
        switchAdapted={overrides.switchAdapted ?? false}
        switchPhotoUrl={overrides.switchPhotoUrl ?? null}
        onSave={onSave}
      />
    </ToastProvider>
  )
  const addInput = () => result.container.querySelector('#toy-add-photo') as HTMLInputElement
  const checkbox = () => screen.getByLabelText('Switch-adapted')
  const saveButton = () => screen.getByRole('button', { name: 'Save' })
  return { ...result, addInput, checkbox, saveButton, onSave }
}

describe('ToyPhotosSection', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: a photo goes to the toy bucket's route, with the toy id attached
  // How:   picks a file; checks the endpoint and the toyId field of the form
  // Chain: /toy-cover and /toy-switch-photo were two routes because this step
  //        had two upload boxes; one box means one route
  it('uploads through /api/upload/toy-photo with the toy id', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new.png' })
    const { addInput, onSave } = setup()
    fireEvent.change(addInput(), {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    await waitFor(() => expect(mockPostFormData).toHaveBeenCalledOnce())
    const [path, form] = mockPostFormData.mock.calls[0]
    expect(path).toBe('/api/upload/toy-photo')
    expect((form as FormData).get('toyId')).toBe('toy-1')
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          photo_urls: ['https://example.com/cover.jpg', 'https://example.com/new.png'],
        })
      )
    )
  })

  it('Save is disabled until the switch-adapted checkbox actually changes', () => {
    const { checkbox, saveButton } = setup()
    expect(saveButton()).toBeDisabled()
    fireEvent.click(checkbox())
    expect(saveButton()).not.toBeDisabled()
  })

  it('saves switch-adapted on its own, without touching the photos', async () => {
    const { checkbox, saveButton, onSave } = setup()
    fireEvent.click(checkbox())
    fireEvent.click(saveButton())
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ switch_adapted: true }))
  })

  // Tests: the switch column appears on the tiles so one can be tagged
  // How:   renders switch-adapted with two photos; checks a radio per photo
  // Chain: publishing a switch-adapted toy needs switch_photo_url set, and this
  //        is the only place it can be
  it('offers a switch radio on every photo', () => {
    setup({
      photoUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
      switchAdapted: true,
    })
    expect(screen.getAllByLabelText('Shows the switch')).toHaveLength(2)
  })
})
