import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PhotoTiles } from '@/components/photo-tiles'
import { ToastProvider } from '@/components/toast'

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const A = 'https://example.com/a.jpg'
const B = 'https://example.com/b.jpg'
const C = 'https://example.com/c.jpg'

function setup(
  props: Partial<{
    urls: string[]
    switchUrl: string | null | undefined
    upload: ReturnType<typeof vi.fn>
    onSave: ReturnType<typeof vi.fn>
  }> = {}
) {
  const onSave = props.onSave ?? vi.fn().mockResolvedValue(undefined)
  const upload = props.upload ?? vi.fn().mockResolvedValue(C)
  const result = render(
    <ToastProvider>
      <PhotoTiles
        idPrefix="t"
        urls={props.urls ?? [A, B]}
        // `in`, not `??`: undefined is meaningful here — it turns the switch
        // column off — so a test that omits it must not be handed a default.
        {...('switchUrl' in props ? { switchUrl: props.switchUrl } : {})}
        upload={upload}
        onSave={onSave}
      />
    </ToastProvider>
  )
  const addInput = () => result.container.querySelector('#t-add-photo') as HTMLInputElement
  return { ...result, onSave, upload, addInput }
}

const png = () => new File(['img'], 'photo.png', { type: 'image/png' })

describe('PhotoTiles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks only the first photo as the cover', () => {
    setup()
    expect(screen.getByText('Cover')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Make photo 1 the cover' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Make photo 2 the cover' })).toBeInTheDocument()
  })

  // Tests: ★ moves a photo to the front without disturbing the rest
  // How:   promotes the second of three; checks the saved order
  // Chain: photo_urls[0] is what the database generates cover_photo_url from,
  //        so this is how every card and search result changes picture
  it('promotes a photo to the front, keeping the others in order', async () => {
    const { onSave } = setup({ urls: [A, B, C] })
    fireEvent.click(screen.getByRole('button', { name: 'Make photo 2 the cover' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ photo_urls: [B, A, C] }))
    )
  })

  it('removes a photo', async () => {
    const { onSave } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 1' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ photo_urls: [B] }))
    )
  })

  // Tests: removing the tagged photo clears the tag in the same save
  // How:   B is the switch shot; removes B; checks switch_photo_url went null
  // Chain: 053's toys_switch_photo_member rejects a pointer outside the array,
  //        so leaving it set would make the save fail rather than merely lie
  it('clears the switch tag when the tagged photo is removed', async () => {
    const { onSave } = setup({ switchUrl: B })
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 2' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ photo_urls: [A], switch_photo_url: null })
    )
  })

  it('keeps the switch tag when a different photo is removed', async () => {
    const { onSave } = setup({ urls: [A, B, C], switchUrl: B })
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 3' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ photo_urls: [A, B], switch_photo_url: B })
    )
  })

  it('tags a photo as showing the switch', async () => {
    const { onSave } = setup({ switchUrl: null })
    fireEvent.click(screen.getAllByLabelText('Shows the switch')[1])
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ photo_urls: [A, B], switch_photo_url: B })
    )
  })

  // A guide has no switch to picture, so the column is absent rather than empty.
  it('omits the switch column entirely when switchUrl is not given', () => {
    setup()
    expect(screen.queryByLabelText('Shows the switch')).toBeNull()
  })

  it('uploads the picked file, then saves it onto the end', async () => {
    const { onSave, upload, addInput } = setup()
    fireEvent.change(addInput(), { target: { files: [png()] } })
    await waitFor(() => expect(upload).toHaveBeenCalledOnce())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ photo_urls: [A, B, C] }))
  })

  // Tests: the Add tile disappears at the cap rather than failing on click
  // How:   renders five photos; checks the input is gone
  // Chain: the api returns a 400 at six and 053's check constraint rejects it,
  //        but neither should be how someone finds out they are full
  it('hides the add control once five photos are present', () => {
    const { addInput } = setup({ urls: [A, B, C, 'd', 'e'] })
    expect(addInput()).toBeNull()
    expect(screen.getByRole('button', { name: 'Remove photo 5' })).toBeInTheDocument()
  })

  it('shows the count against the cap', () => {
    setup()
    expect(screen.getByText('2/5')).toBeInTheDocument()
  })

  it('surfaces an upload failure instead of silently dropping the photo', async () => {
    const upload = vi.fn().mockRejectedValue(new Error('That photo is 18.2 MB'))
    const { onSave, addInput } = setup({ upload })
    fireEvent.change(addInput(), { target: { files: [png()] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('That photo is 18.2 MB')
    expect(onSave).not.toHaveBeenCalled()
  })

  // Picking the same file twice in a row fires no change event unless the input
  // is cleared, which reads as "the second one didn't upload".
  it('clears the file input so the same file can be picked again', async () => {
    const { upload, addInput } = setup()
    fireEvent.change(addInput(), { target: { files: [png()] } })
    await waitFor(() => expect(upload).toHaveBeenCalledOnce())
    expect(addInput().value).toBe('')
  })
})
