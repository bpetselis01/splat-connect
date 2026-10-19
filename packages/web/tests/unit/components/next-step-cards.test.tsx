import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BuildNextStep } from '@/components/build-next-step'
import { PrintNextStep } from '@/components/print-next-step'
import { detail } from '../fixtures/transactions'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
const post = vi.fn()
const postFormData = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: {
    post: (...a: unknown[]) => post(...a),
    postFormData: (...a: unknown[]) => postFormData(...a),
  },
}))

const photo = () => new File(['x'], 'shot.jpg', { type: 'image/jpeg' })
const build = (o = {}) => detail({ type: 'build', toy_id: null, status: 'accepted', ...o })
const print = (o = {}) => detail({ type: 'print', toy_id: null, status: 'accepted', ...o })

beforeEach(() => {
  vi.clearAllMocks()
  post.mockResolvedValue({})
  postFormData.mockResolvedValue({})
})

describe('BuildNextStep', () => {
  it('WX20 posts the maker’s photo to working-shot and refreshes the thread', async () => {
    render(<BuildNextStep tx={build({ id: 'b1' })} viewerIsMaker />)
    expect(screen.getByText('Build it, then post a working shot')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Working shot'), { target: { files: [photo()] } })

    await waitFor(() => expect(postFormData).toHaveBeenCalledOnce())
    const [path, form] = postFormData.mock.calls[0]
    expect(path).toBe('/api/toy-transactions/b1/working-shot')
    expect((form as FormData).get('file')).toBeInstanceOf(File)
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('WX20 says the photo did not upload, and does not refresh, when the post fails', async () => {
    postFormData.mockRejectedValue(new Error('413'))
    render(<BuildNextStep tx={build()} viewerIsMaker />)
    fireEvent.change(screen.getByLabelText('Working shot'), { target: { files: [photo()] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('That photo did not upload. Check the file and try again.')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('WX21 lets the family approve the shot, which posts approve-work', async () => {
    render(<BuildNextStep tx={build({ id: 'b1', working_photo_url: 'b1/shot.jpg' })} viewerIsMaker={false} />)
    expect(screen.getByText('Check the working shot')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Looks right — arrange the handover' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/toy-transactions/b1/approve-work', {}))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('WX21 offers the maker no approve button, and the family none before a shot exists', () => {
    const { unmount } = render(<BuildNextStep tx={build({ working_photo_url: 'b1/shot.jpg' })} viewerIsMaker />)
    expect(screen.queryByRole('button', { name: /Looks right/ })).toBeNull()
    unmount()
    render(<BuildNextStep tx={build()} viewerIsMaker={false} />)
    expect(screen.getByText('They are building it')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Looks right/ })).toBeNull()
  })
})

describe('PrintNextStep', () => {
  it('WR17 starts the job with print-started when the printer says it is on the bed', async () => {
    render(<PrintNextStep tx={print({ id: 'p1' })} viewerIsPrinter />)
    expect(screen.getByText('Start it when the bed is free')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'It is on the bed' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/toy-transactions/p1/print-started', {}))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('WR18 posts the printer’s photo to print-ready once the job has started', async () => {
    render(<PrintNextStep tx={print({ id: 'p1', printing_started_at: '2026-08-02T00:00:00Z' })} viewerIsPrinter />)
    expect(screen.getByText('Post a photo when it comes off')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Photo of the finished parts'), { target: { files: [photo()] } })

    await waitFor(() => expect(postFormData).toHaveBeenCalledOnce())
    expect(postFormData.mock.calls[0][0]).toBe('/api/toy-transactions/p1/print-ready')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('WR17 WR18 give the family a card and no button at any stage', () => {
    const { unmount } = render(<PrintNextStep tx={print()} viewerIsPrinter={false} />)
    expect(screen.queryByRole('button')).toBeNull()
    unmount()
    render(<PrintNextStep tx={print({ printing_started_at: '2026-08-02T00:00:00Z' })} viewerIsPrinter={false} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('It is on the bed')).toBeInTheDocument()
  })
})
