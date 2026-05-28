import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import UploadPage from '@/app/upload/page'

vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    postFormData: vi.fn(),
  },
}))

vi.mock('@/components/file-drop-zone', () => ({
  FileDropZone: ({
    onChange,
    name,
    currentFileLabel,
  }: {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    name: string
    currentFileLabel?: string
  }) => (
    <>
      <input data-testid={`filedrop-${name}`} type="file" onChange={onChange} />
      {currentFileLabel && <span>{currentFileLabel}</span>}
    </>
  ),
}))

vi.mock('@/components/buy-links-input', () => ({
  BuyLinksInput: () => null,
}))

import { browserApiClient } from '@/lib/browser-api-client'

async function advanceToStep(to: number) {
  if (to >= 2) {
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. fisher-price piano/i), {
      target: { value: 'My Tutorial' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^easy$/i }))
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => expect(screen.getByText(/step 2 of 6/i)).toBeInTheDocument())
  }
  if (to >= 3) {
    vi.mocked(browserApiClient.postFormData)
      .mockResolvedValueOnce({ url: 'https://example.com/tutorial.pdf' } as any)
      .mockResolvedValueOnce({ url: 'https://example.com/photo.jpg' } as any)
    fireEvent.change(screen.getByTestId('filedrop-tutorial_pdf'), {
      target: { files: [new File(['pdf'], 'tutorial.pdf', { type: 'application/pdf' })] },
    })
    await waitFor(() => expect(screen.getByText(/pdf uploaded/i)).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('filedrop-toy_photo'), {
      target: { files: [new File(['img'], 'photo.jpg', { type: 'image/jpeg' })] },
    })
    await waitFor(() => expect(screen.getByText(/photo uploaded/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => expect(screen.getByText(/step 3 of 6/i)).toBeInTheDocument())
  }
  if (to >= 4) {
    fireEvent.click(screen.getByRole('button', { name: /\+ add part/i }))
    fireEvent.change(screen.getByPlaceholderText(/part name \*/i), {
      target: { value: 'Screw' },
    })
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => expect(screen.getByText(/step 4 of 6/i)).toBeInTheDocument())
  }
  if (to >= 5) {
    fireEvent.click(screen.getByRole('button', { name: /\+ add tool/i }))
    fireEvent.change(screen.getByPlaceholderText(/tool name \*/i), {
      target: { value: 'Screwdriver' },
    })
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => expect(screen.getByText(/step 5 of 6/i)).toBeInTheDocument())
  }
  if (to >= 6) {
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => expect(screen.getByText(/step 6 of 6/i)).toBeInTheDocument())
  }
}

describe('UploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('test-id' as ReturnType<typeof crypto.randomUUID>)
    vi.stubGlobal('location', { href: '' })
    vi.mocked(browserApiClient.post).mockResolvedValue({} as any)
    vi.mocked(browserApiClient.patch).mockResolvedValue({} as any)
    vi.mocked(browserApiClient.postFormData).mockResolvedValue({ url: 'https://example.com/file' } as any)
  })

  it('Step 1 Next (first time): creates draft and links contributor', async () => {
    render(<UploadPage />)
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. fisher-price piano/i), {
      target: { value: 'My Tutorial' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^easy$/i }))
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => {
      expect(browserApiClient.post).toHaveBeenCalledWith(
        '/api/tutorials',
        expect.objectContaining({ id: 'test-id', title: 'My Tutorial', difficulty: 'easy' })
      )
      expect(browserApiClient.post).toHaveBeenCalledWith(
        '/api/contributors/me/tutorials/test-id',
        {}
      )
    })
    expect(screen.getByText(/step 2 of 6/i)).toBeInTheDocument()
  })

  it('Step 1 Next (second time): PATCHes instead of POSTing again', async () => {
    render(<UploadPage />)
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. fisher-price piano/i), {
      target: { value: 'My Tutorial' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^easy$/i }))
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => screen.getByText(/step 2 of 6/i))
    fireEvent.click(screen.getByRole('button', { name: /← back/i }))
    await waitFor(() => screen.getByText(/step 1 of 6/i))
    vi.clearAllMocks()
    vi.mocked(browserApiClient.patch).mockResolvedValue({} as any)
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => {
      expect(browserApiClient.patch).toHaveBeenCalledWith(
        '/api/tutorials/test-id',
        expect.objectContaining({ title: 'My Tutorial', difficulty: 'easy' })
      )
    })
    expect(browserApiClient.post).not.toHaveBeenCalledWith('/api/tutorials', expect.anything())
  })

  it('Step 2 Next: PATCHes tutorial with file URLs', async () => {
    render(<UploadPage />)
    await advanceToStep(2)
    vi.clearAllMocks()
    vi.mocked(browserApiClient.patch).mockResolvedValue({} as any)
    vi.mocked(browserApiClient.postFormData)
      .mockResolvedValueOnce({ url: 'https://example.com/tutorial.pdf' } as any)
      .mockResolvedValueOnce({ url: 'https://example.com/photo.jpg' } as any)
    fireEvent.change(screen.getByTestId('filedrop-tutorial_pdf'), {
      target: { files: [new File(['pdf'], 'tutorial.pdf', { type: 'application/pdf' })] },
    })
    await waitFor(() => screen.getByText(/pdf uploaded/i))
    fireEvent.change(screen.getByTestId('filedrop-toy_photo'), {
      target: { files: [new File(['img'], 'photo.jpg', { type: 'image/jpeg' })] },
    })
    await waitFor(() => screen.getByText(/photo uploaded/i))
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => {
      expect(browserApiClient.patch).toHaveBeenCalledWith(
        '/api/tutorials/test-id',
        expect.objectContaining({
          tutorial_pdf_url: 'https://example.com/tutorial.pdf',
          toy_photo_url: 'https://example.com/photo.jpg',
        })
      )
    })
  })

  it('Step 3 Next: POSTs parts', async () => {
    render(<UploadPage />)
    await advanceToStep(3)
    vi.clearAllMocks()
    vi.mocked(browserApiClient.post).mockResolvedValue({} as any)
    fireEvent.click(screen.getByRole('button', { name: /\+ add part/i }))
    fireEvent.change(screen.getByPlaceholderText(/part name \*/i), {
      target: { value: 'Screw' },
    })
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => {
      expect(browserApiClient.post).toHaveBeenCalledWith(
        '/api/tutorials/test-id/parts',
        expect.objectContaining({
          parts: expect.arrayContaining([expect.objectContaining({ name: 'Screw' })]),
        })
      )
    })
  })

  it('Step 4 Next: POSTs tools', async () => {
    render(<UploadPage />)
    await advanceToStep(4)
    vi.clearAllMocks()
    vi.mocked(browserApiClient.post).mockResolvedValue({} as any)
    fireEvent.click(screen.getByRole('button', { name: /\+ add tool/i }))
    fireEvent.change(screen.getByPlaceholderText(/tool name \*/i), {
      target: { value: 'Screwdriver' },
    })
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => {
      expect(browserApiClient.post).toHaveBeenCalledWith(
        '/api/tutorials/test-id/tools',
        expect.objectContaining({
          tools: expect.arrayContaining([expect.objectContaining({ name: 'Screwdriver' })]),
        })
      )
    })
  })

  it('Step 5 Next with STL files: POSTs stl-files', async () => {
    render(<UploadPage />)
    await advanceToStep(5)
    vi.clearAllMocks()
    vi.mocked(browserApiClient.post).mockResolvedValue({} as any)
    vi.mocked(browserApiClient.postFormData).mockResolvedValue({
      url: 'https://example.com/bracket.stl',
      filename: 'bracket.stl',
    } as any)
    fireEvent.change(screen.getByTestId('filedrop-stl_files'), {
      target: { files: [new File(['stl'], 'bracket.stl', { type: 'model/stl' })] },
    })
    await waitFor(() => expect(screen.getByText(/bracket\.stl/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => {
      expect(browserApiClient.post).toHaveBeenCalledWith(
        '/api/tutorials/test-id/stl-files',
        expect.objectContaining({
          stl_files: expect.arrayContaining([
            expect.objectContaining({ filename: 'bracket.stl' }),
          ]),
        })
      )
    })
  })

  it('Step 5 Next without STL files: does NOT call stl-files endpoint', async () => {
    render(<UploadPage />)
    await advanceToStep(5)
    vi.clearAllMocks()
    vi.mocked(browserApiClient.post).mockResolvedValue({} as any)
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => screen.getByText(/step 6 of 6/i))
    expect(browserApiClient.post).not.toHaveBeenCalledWith(
      '/api/tutorials/test-id/stl-files',
      expect.anything()
    )
  })

  it('Submit: only PATCHes status to pending then redirects', async () => {
    render(<UploadPage />)
    await advanceToStep(6)
    vi.clearAllMocks()
    vi.mocked(browserApiClient.patch).mockResolvedValue({} as any)
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))
    await waitFor(() => {
      expect(browserApiClient.patch).toHaveBeenCalledWith(
        '/api/tutorials/test-id',
        { status: 'pending' }
      )
      expect(browserApiClient.patch).toHaveBeenCalledTimes(1)
      expect(window.location.href).toBe('/my-tutorials')
    })
    expect(browserApiClient.post).not.toHaveBeenCalled()
  })

  it('shows error message when API call fails', async () => {
    vi.mocked(browserApiClient.post).mockRejectedValue(new Error('Server unavailable'))
    render(<UploadPage />)
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. fisher-price piano/i), {
      target: { value: 'My Tutorial' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^easy$/i }))
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() =>
      expect(screen.getByText(/server unavailable/i)).toBeInTheDocument()
    )
  })

  it('Next button shows "Saving…" and is disabled during API call', async () => {
    let resolvePost!: (v: unknown) => void
    vi.mocked(browserApiClient.post)
      .mockImplementationOnce(() => new Promise(r => { resolvePost = r }))
      .mockResolvedValue({} as any)
    render(<UploadPage />)
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. fisher-price piano/i), {
      target: { value: 'My Tutorial' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^easy$/i }))
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
    )
    act(() => resolvePost({ id: 'test-id' }))
    await waitFor(() => screen.getByText(/step 2 of 6/i))
  })

  it('Next button is disabled when step 1 title is empty', () => {
    render(<UploadPage />)
    fireEvent.click(screen.getByRole('button', { name: /^easy$/i }))
    expect(screen.getByRole('button', { name: /next →/i })).toBeDisabled()
  })
})
