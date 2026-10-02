import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { PdfImportDraft } from '@splat-connect/types'
import { NewTutorialForm } from '@/components/new-tutorial-form'
import { PdfImportBanner } from '@/components/pdf-import-banner'
import { browserApiClient } from '@/lib/browser-api-client'

const push = vi.fn()
let search = new URLSearchParams()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useSearchParams: () => search }))
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { post: vi.fn(), postFormData: vi.fn(), get: vi.fn(), patch: vi.fn(), put: vi.fn() },
}))

const api = vi.mocked(browserApiClient)

const draft: PdfImportDraft = {
  title: 'Low Profile Switch',
  summary: 'A flat switch.',
  kind: 'assistive_tech',
  difficulty: null,
  build_minutes: 45,
  age_min: null,
  age_max: null,
  parts: [{ name: '12mm tactile switch', quantity: 1 }],
  tools: [{ name: 'Soldering iron' }],
  steps: [{ body: 'Cut the leads.' }, { title: 'Solder', body: 'Solder the joints.' }],
  print_settings: { infill_percent: 20 },
  warnings: ['Photos and diagrams inside the PDF are not copied — add them to the guide yourself.'],
  confidence: { title: 'high', summary: 'low', kind: 'high', parts: 'high', tools: 'high', steps: 'high', print_settings: 'medium' },
  page_count: 3,
}

async function readPdf() {
  render(<NewTutorialForm />)
  fireEvent.click(screen.getByRole('radio', { name: /Start from a PDF/ }))
  const file = new File(['%PDF-1.4'], 'switch.pdf', { type: 'application/pdf' })
  fireEvent.change(screen.getByLabelText('Your guide as a PDF'), { target: { files: [file] } })
  await screen.findByText(/What we found in switch.pdf/)
}

describe('Start from a PDF', () => {
  beforeEach(() => {
    push.mockClear()
    search = new URLSearchParams()
    for (const f of [api.post, api.get, api.patch, api.put, api.postFormData]) f.mockReset()
    api.post.mockResolvedValue({})
    api.get.mockResolvedValue({ updated_at: 'T1' })
    api.patch.mockResolvedValue({})
    api.put.mockResolvedValue({})
    api.postFormData.mockImplementation(async (path: string) =>
      path === '/api/tutorials/import-pdf' ? draft : { url: 'id/tutorial.pdf' }
    )
  })

  it('starts blank by default, so the existing form is unchanged', () => {
    render(<NewTutorialForm />)
    expect(screen.getByRole('radio', { name: /Start blank/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('Cover photo')).toBeInTheDocument()
  })

  it('shows what was found, with counts and warnings, before saving anything', async () => {
    await readPdf()
    expect(screen.getByText('— 1 part')).toBeInTheDocument()
    expect(screen.getByText('— 2 steps')).toBeInTheDocument()
    expect(screen.getByText('— Added to the description as a note')).toBeInTheDocument()
    expect(screen.getByText(/Photos and diagrams inside the PDF are not copied/)).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('Low Profile Switch')
    expect(screen.getByRole('radio', { name: 'Assistive tech' })).toHaveAttribute('aria-checked', 'true')
    expect(api.post).not.toHaveBeenCalled()
  })

  it('creates the guide, stores the PDF once, fills every section, and opens the editor', async () => {
    await readPdf()
    fireEvent.click(screen.getByRole('button', { name: /Create draft/ }))
    await waitFor(() => expect(push).toHaveBeenCalled())

    const [, create] = api.post.mock.calls[0] as [string, Record<string, unknown>]
    const id = create.id as string
    expect(create).toMatchObject({
      title: 'Low Profile Switch',
      kind: 'assistive_tech',
      difficulty: 'easy',
      description: 'A flat switch.\n\nPrint settings from the PDF: 20% infill.',
    })
    expect(api.post).toHaveBeenCalledWith(`/api/contributors/me/tutorials/${id}`, {})
    expect(api.postFormData).toHaveBeenCalledWith('/api/upload/pdf', expect.any(FormData))
    expect(api.patch).toHaveBeenCalledWith(`/api/tutorials/${id}`, {
      tutorial_pdf_url: 'id/tutorial.pdf',
      build_minutes: 45,
      updated_at: 'T1',
    })
    expect(api.post).toHaveBeenCalledWith(`/api/tutorials/${id}/parts`, {
      parts: [{ name: '12mm tactile switch', quantity: 1, is_optional: false, buy_links: [] }],
    })
    expect(api.post).toHaveBeenCalledWith(`/api/tutorials/${id}/tools`, {
      tools: [{ name: 'Soldering iron', is_optional: false, buy_links: [] }],
    })
    expect(api.put).toHaveBeenCalledWith(`/api/tutorials/${id}/steps`, { steps: draft.steps })
    expect(push).toHaveBeenCalledWith(`/tutorials/${id}/edit?step=files&created=1&from=pdf`)
  })

  it('skips the steps with a note when the steps endpoint is not there yet', async () => {
    api.put.mockRejectedValue(Object.assign(new Error('API PUT failed with status 404'), { status: 404 }))
    await readPdf()
    fireEvent.click(screen.getByRole('button', { name: /Create draft/ }))
    await waitFor(() => expect(push).toHaveBeenCalled())
    expect(push.mock.calls[0][0]).toMatch(/&from=pdf&steps=later$/)
  })

  it('shows the API’s reason when the PDF cannot be read', async () => {
    api.postFormData.mockRejectedValue(new Error('API POST /api/tutorials/import-pdf failed with status 415: That file is not a PDF.'))
    render(<NewTutorialForm />)
    fireEvent.click(screen.getByRole('radio', { name: /Start from a PDF/ }))
    fireEvent.change(screen.getByLabelText('Your guide as a PDF'), {
      target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] },
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('That file is not a PDF.')
  })
})

describe('PdfImportBanner', () => {
  it('asks the author to check every section, and says what was not saved', () => {
    search = new URLSearchParams('step=files&from=pdf&steps=later&missed=parts')
    render(<PdfImportBanner />)
    expect(screen.getByText('Filled in from your PDF — check every section before you submit.')).toBeInTheDocument()
    expect(screen.getByText(/steps found in your PDF could not be saved yet/)).toBeInTheDocument()
    expect(screen.getByText(/Could not save the parts/)).toBeInTheDocument()
  })

  it('is absent on an ordinary visit', () => {
    search = new URLSearchParams('step=files')
    const { container } = render(<PdfImportBanner />)
    expect(container).toBeEmptyDOMElement()
  })
})
