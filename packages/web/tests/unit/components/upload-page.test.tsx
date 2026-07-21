import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import UploadPage from '@/app/upload/page'

// --- Mock strategy ---
// Four things are mocked: browserApiClient (all five methods as vi.fn()) intercepts all API
// calls without real HTTP; FileDropZone is replaced with a plain file input keyed by name so
// tests can trigger file selection without drag-and-drop; BuyLinksInput renders nothing to
// avoid rendering complexity; and crypto.randomUUID is spied on to always return 'test-id',
// making all API endpoint URL assertions deterministic. window.location is stubbed for the
// submit redirect. The advanceToStep(n) helper drives the wizard to any step by replaying
// the full interaction sequence for all preceding steps.
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

  // Tests: clicking Next on Step 1 for the first time POSTs a new tutorial draft and links the contributor
  // How:   fills in title and difficulty, clicks Next; waitFor checks post was called with /api/tutorials
  //        and /api/contributors/me/tutorials/test-id
  // Chain: the draft record is created in the DB with a deterministic ID → subsequent wizard
  //        steps PATCH the same record, and the link row connects the tutorial to the contributor's dashboard
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

  // Tests: navigating back to Step 1 and clicking Next again PATCHes the draft instead of POSTing a second time
  // How:   advances to Step 2, navigates back, clears mocks, clicks Next; verifies PATCH was called
  //        and POST /api/tutorials was not called again
  // Chain: the draftSaved flag prevents duplicate tutorial records in the DB → back-navigation
  //        is safe and the same draft ID is used throughout the entire wizard session
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

  // Tests: clicking Next on Step 2 PATCHes the tutorial record with the uploaded PDF and photo URLs
  // How:   advances to Step 2, uploads both files, clicks Next; checks PATCH called with both URLs
  // Chain: the file URLs are persisted on the tutorial record → Step 6 submit does not need to
  //        re-upload files, only PATCHing the status field to 'pending'
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

  // Tests: clicking Next on Step 3 sends the parts list to the API
  // How:   advances to Step 3, adds a part named 'Screw', clicks Next; checks POST called with parts array
  // Chain: the parts are saved to the DB as individual rows → the tutorial detail page can
  //        list the complete parts with quantities and buy links
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

  // Tests: clicking Next on Step 4 sends the tools list to the API
  // How:   advances to Step 4, adds a tool named 'Screwdriver', clicks Next; checks POST called with tools array
  // Chain: the tools are saved to the DB → the tutorial detail page can display the equipment
  //        list with optional buy links for each tool
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

  // Tests: clicking Next on Step 5 with a file uploaded sends the STL file list to the API
  // How:   advances to Step 5, drops a .stl file, clicks Next; checks POST called with stl_files array
  // Chain: the STL file URL and filename are saved to the DB → users can download the printable
  //        files from the tutorial detail page
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

  // Tests: clicking Next on Step 5 with no STL files does NOT call the stl-files endpoint
  // How:   advances to Step 5 without uploading anything, clicks Next; checks POST was not called
  //        with the stl-files endpoint
  // Chain: tutorials without printable parts skip the stl_files API call → no empty stl_files
  //        rows are created and the tutorial detail page shows no download section
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

  // Tests: clicking Submit on Step 6 only PATCHes status to 'pending' (no re-saving other data) then redirects
  // How:   advances to Step 6, clicks Submit; checks PATCH called exactly once with { status: 'pending' }
  //        and window.location.href is '/my-tutorials'
  // Chain: the tutorial enters the admin review queue → the contributor is redirected to their
  //        dashboard where they can see the tutorial listed as 'pending'
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

  // Tests: when an API call throws, the error message is displayed on screen
  // How:   mocks browserApiClient.post to reject with 'Server unavailable'; clicks Next;
  //        waitFor checks the error text appears in the document
  // Chain: the user sees a plain-English error rather than a silent failure or crash →
  //        they can retry the step or check their connection
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

  // Tests: while an API call is in flight the Next button shows "Saving..." and is disabled
  // How:   mocks post with a manually-controlled Promise; clicks Next; checks button is disabled
  //        and labelled "Saving…"; then resolves the Promise and waits for Step 2
  // Chain: the user cannot double-click and create duplicate API calls → only one in-flight
  //        request runs at a time for each wizard step
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

  // Tests: the Next button on Step 1 is disabled when the title field is empty (no API call made)
  // How:   renders without filling in the title; checks the Next button has the disabled attribute
  // Chain: the wizard is gated by canAdvanceFromStep validation → no POST is ever made with an
  //        empty title, preventing incomplete draft records from being created in the DB
  it('Next button is disabled when step 1 title is empty', () => {
    render(<UploadPage />)
    fireEvent.click(screen.getByRole('button', { name: /^easy$/i }))
    expect(screen.getByRole('button', { name: /next →/i })).toBeDisabled()
  })
})
