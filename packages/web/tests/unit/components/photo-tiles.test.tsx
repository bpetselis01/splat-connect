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

  // A draft may legitimately hold none, but once there is one it stays: the
  // api refuses the save, and a × that only fails when pressed teaches nothing.
  it('will not let the last photo be removed', async () => {
    const { onSave } = setup({ urls: [A] })
    const remove = screen.getByRole('button', { name: /Remove photo 1/ })
    expect(remove).toBeDisabled()
    fireEvent.click(remove)
    await waitFor(() => expect(onSave).not.toHaveBeenCalled())
  })

  it('says why the last photo cannot be removed', () => {
    setup({ urls: [A] })
    expect(screen.getByText(/Add another photo before you can remove this one/)).toBeInTheDocument()
  })

  it('allows removal again as soon as there are two', () => {
    setup({ urls: [A, B] })
    expect(screen.getByRole('button', { name: 'Remove photo 1' })).not.toBeDisabled()
    expect(screen.queryByText(/before you can remove this one/)).toBeNull()
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

  // Tests: a dropped file goes through the same upload-then-save path as one
  //        picked from the box
  // How:   fires a drop carrying one file on the tile block
  // Chain: the two dropzones PhotoTiles replaced both took a drop, and the
  //        rewrite dropped the handler without meaning to
  it('uploads a dropped file', async () => {
    const { container, onSave, upload } = setup()
    fireEvent.drop(container.firstChild as Element, { dataTransfer: { files: [png()] } })
    await waitFor(() => expect(upload).toHaveBeenCalledOnce())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ photo_urls: [A, B, C] }))
  })

  // Tests: several files in one drop are all added, in one save
  // How:   drops three onto a row of two; the cap is five
  // Chain: one save rather than three keeps photo_urls[0] — and so every card's
  //        cover — from changing twice on the way to its final value
  it('adds every dropped file in a single save', async () => {
    const upload = vi
      .fn()
      .mockResolvedValueOnce('u1')
      .mockResolvedValueOnce('u2')
      .mockResolvedValueOnce('u3')
    const { container, onSave } = setup({ upload })
    fireEvent.drop(container.firstChild as Element, {
      dataTransfer: { files: [png(), png(), png()] },
    })
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(3))
    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ photo_urls: [A, B, 'u1', 'u2', 'u3'] })
    )
  })

  // Tests: a drop past the cap uploads only what there is room for
  // How:   drops three onto a row of four
  // Chain: the api counts photo_urls *before* each upload, so an unsaved batch
  //        still reads as the old count — every one of the three would pass
  //        that check and the objects would be written before the save failed
  it('takes only as many dropped files as there are free slots', async () => {
    const upload = vi.fn().mockResolvedValue('u1')
    const { container, onSave } = setup({ urls: [A, B, C, 'd'], upload })
    fireEvent.drop(container.firstChild as Element, {
      dataTransfer: { files: [png(), png(), png()] },
    })
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect(upload).toHaveBeenCalledOnce()
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ photo_urls: [A, B, C, 'd', 'u1'] })
    )
  })

  // Tests: photos that did upload are saved even when a later one fails
  // How:   two files, the second rejects; checks the first is still saved
  // Chain: the object is in the bucket the moment upload() resolves — leaving
  //        it out of photo_urls orphans it there with nothing pointing at it
  it('saves the photos that uploaded before one of them failed', async () => {
    const upload = vi
      .fn()
      .mockResolvedValueOnce('u1')
      .mockRejectedValueOnce(new Error('That photo is 18.2 MB'))
    const { container, onSave } = setup({ upload })
    fireEvent.drop(container.firstChild as Element, { dataTransfer: { files: [png(), png()] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('That photo is 18.2 MB')
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ photo_urls: [A, B, 'u1'] }))
  })
})
