import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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

function setup(
  overrides: Partial<{
    coverPhotoUrl: string | null
    switchAdapted: boolean
    switchPhotoUrls: string[]
    onSave: ReturnType<typeof vi.fn>
  }> = {}
) {
  const onSave = overrides.onSave ?? vi.fn().mockResolvedValue(undefined)
  // `in`, not `??`: a test that means "this toy has no cover photo" passes null
  // explicitly, and ?? would hand it the default url instead.
  const coverPhotoUrl =
    'coverPhotoUrl' in overrides ? overrides.coverPhotoUrl! : 'https://example.com/cover.jpg'
  const result = render(
    <ToyPhotosSection
      toyId="toy-1"
      coverPhotoUrl={coverPhotoUrl}
      switchAdapted={overrides.switchAdapted ?? false}
      switchPhotoUrls={overrides.switchPhotoUrls ?? []}
      onSave={onSave}
    />
  )
  const coverInput = result.container.querySelector('input[name="toy_cover_photo"]') as HTMLInputElement
  const switchInput = () =>
    result.container.querySelector('input[name="toy_switch_photo"]') as HTMLInputElement
  const saveButton = screen.getByRole('button', { name: 'Save photos' })
  return { ...result, coverInput, switchInput, saveButton, onSave }
}

const imageFile = (name: string) => new File(['img'], name, { type: 'image/png' })

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

  it('shows the switch photo dropzone only when switch-adapted is checked', () => {
    setup({ switchAdapted: false })
    expect(screen.queryByText('Switch photo')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Switch-adapted'))
    expect(screen.getByText('Switch photo')).toBeInTheDocument()
  })

  it('explains what switch-adapted means and what ticking it will require', () => {
    setup({ switchAdapted: false })
    expect(screen.getByText(/a switch photo before you can publish/i)).toBeInTheDocument()
  })

  it('styles the switch-adapted tick with the shared checkbox class', () => {
    setup({ switchAdapted: false })
    expect(screen.getByLabelText('Switch-adapted')).toHaveClass('field-check')
  })

  it('checking switch-adapted alone enables Save', () => {
    const { saveButton } = setup({ switchAdapted: false })
    fireEvent.click(screen.getByLabelText('Switch-adapted'))
    expect(saveButton).not.toBeDisabled()
  })

  it('never shows the raw switch photo url, nor a Remove button beside it', () => {
    setup({ switchAdapted: true, switchPhotoUrls: ['https://x/switch-1.jpg'] })
    expect(screen.queryByText('https://x/switch-1.jpg')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  // Tests: an existing switch photo is shown, not just described
  // How:   asserts both the picture and the shortened label
  // Chain: the label used to carry the whole message because the picture lived in a
  //        dialog behind a button. It shows in place now, so the words only have to
  //        say what pressing Choose file will do to it
  // Scoped to the switch dropzone: the default toy has a cover photo too, and
  // both dropzones now carry the same short "On file" line under their own
  // heading and their own thumbnail. Which file it refers to is answered by
  // where it sits, so the assertion has to ask the same way.
  const switchZone = (switchInput: () => HTMLInputElement) =>
    within(switchInput().closest('.dropzone') as HTMLElement)

  it('shows the switch photo already on file, as the cover dropzone does', () => {
    const { switchInput } = setup({ switchAdapted: true, switchPhotoUrls: ['https://x/switch-1.jpg'] })
    const zone = switchZone(switchInput)
    expect(zone.getByAltText('Switch Photo currently on file')).toHaveAttribute(
      'src',
      'https://x/switch-1.jpg'
    )
    expect(zone.getByText('On file — upload to replace')).toBeInTheDocument()
  })

  it('says nothing is on file when the toy has no switch photo yet', () => {
    const { switchInput } = setup({ switchAdapted: true, switchPhotoUrls: [] })
    const zone = switchZone(switchInput)
    expect(zone.queryByText(/on file/i)).toBeNull()
    expect(zone.queryByAltText(/currently on file/i)).toBeNull()
  })

  it('uploading a switch photo replaces the existing one rather than appending', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/switch-new.png' })
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { switchInput, saveButton } = setup({
      switchAdapted: true,
      switchPhotoUrls: ['https://x/switch-old.jpg'],
      onSave,
    })

    fireEvent.change(switchInput(), { target: { files: [imageFile('switch.png')] } })
    fireEvent.click(saveButton)

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ switch_photo_urls: ['https://example.com/switch-new.png'] })
    )
  })

  it('uploads the switch photo to /api/upload/toy-switch-photo', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/switch-new.png' })
    const { switchInput, saveButton } = setup({ switchAdapted: true })

    fireEvent.change(switchInput(), { target: { files: [imageFile('switch.png')] } })
    fireEvent.click(saveButton)

    await waitFor(() => expect(mockPostFormData).toHaveBeenCalledTimes(1))
    expect(mockPostFormData.mock.calls[0][0]).toBe('/api/upload/toy-switch-photo')
  })

  it('only accepts one switch photo at a time', () => {
    const { switchInput } = setup({ switchAdapted: true })
    expect(switchInput().multiple).toBe(false)
  })

  // Tests: both photos on file are visible without opening anything
  // How:   asserts each dropzone renders its own current image
  // Chain: this was a "View uploaded photos" button opening a dialog of the same two
  //        pictures. A modal for looking at your own upload is a lot of machinery for
  //        a question best answered where it is asked — and with the button gone, the
  //        right of the action row is where the way onward stands
  it('shows both photos already uploaded, with nothing to open', () => {
    setup({ coverPhotoUrl: 'https://x/cover.jpg', switchAdapted: true, switchPhotoUrls: ['https://x/switch-1.jpg'] })
    expect(screen.getByAltText('Cover Photo currently on file')).toHaveAttribute('src', 'https://x/cover.jpg')
    expect(screen.getByAltText('Switch Photo currently on file')).toHaveAttribute('src', 'https://x/switch-1.jpg')
    expect(screen.queryByRole('button', { name: /view uploaded photos/i })).toBeNull()
  })

  it('shows no photo at all when nothing has been uploaded', () => {
    setup({ coverPhotoUrl: null, switchPhotoUrls: [] })
    expect(screen.queryByAltText(/currently on file/i)).toBeNull()
  })

  it('saves in accent, the same warm variant Details and Review use', () => {
    const { saveButton } = setup()
    expect(saveButton).toHaveClass('btn', 'btn-accent')
    expect(saveButton).not.toHaveClass('btn-sm')
  })

  // Tests: Save sits in the shared panel action row
  // How:   asserts the row wrapping Save is .panel-actions, not a local flex box
  // Chain: every panel in all three editors ends in this row now, so the way onward
  //        stands in the same place on each of them. A panel that kept its own
  //        hand-rolled row would be the one where Next went missing
  it('puts Save in the shared action row every panel ends with', () => {
    const { container, saveButton } = setup()
    const row = container.querySelector('.panel-actions') as HTMLElement
    expect(row).not.toBeNull()
    expect(row.querySelector('.panel-actions-lead')).toContainElement(saveButton)
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
