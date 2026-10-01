import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IdeaForm } from '@/components/idea-form'
import { browserApiClient } from '@/lib/browser-api-client'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn(), postFormData: vi.fn() } }))

describe('IdeaForm', () => {
  it('asks for a title, a summary and why it matters — and nothing the board dropped', () => {
    render(<IdeaForm />)
    for (const label of [/^title$/i, /^summary$/i, /why it matters/i]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.queryByLabelText(/intended use/i)).toBeNull()
    expect(screen.queryByLabelText(/primary user/i)).toBeNull()
  })

  it('offers the three ways to stay involved', () => {
    render(<IdeaForm />)
    expect(screen.getByLabelText(/clarification/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/co-design/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/user testing/i)).toBeInTheDocument()
  })

  // 078: the author says which kind it is; the API refuses to graduate a question.
  it('files a question when that tile is picked', async () => {
    render(<IdeaForm />)
    fireEvent.click(screen.getByLabelText(/a question for the community/i))
    for (const [label, value] of [
      [/your question/i, 'Glue?'],
      [/^summary$/i, 'S'],
    ] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    }
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))
    await waitFor(() =>
      expect(browserApiClient.post).toHaveBeenCalledWith('/api/ideas', expect.objectContaining({ kind: 'question' }))
    )
  })

  // 106: uploaded before the idea exists; the idea carries the path, the preview the url.
  it('uploads a photo, shows it, and sends its path with the idea', async () => {
    vi.mocked(browserApiClient.postFormData).mockResolvedValue({ path: 'ideas/u/a.png', url: 'https://x/ideas/u/a.png' })
    render(<IdeaForm />)
    fireEvent.change(screen.getByLabelText(/drop a photo of the toy/i), {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    })
    await waitFor(() =>
      expect(browserApiClient.postFormData).toHaveBeenCalledWith('/api/upload/idea-photo', expect.any(FormData))
    )
    expect(await screen.findByRole('img', { name: /your photo/i })).toHaveAttribute('src', 'https://x/ideas/u/a.png')
    fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: 'T' } })
    fireEvent.change(screen.getByLabelText(/^summary$/i), { target: { value: 'S' } })
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))
    await waitFor(() =>
      expect(browserApiClient.post).toHaveBeenCalledWith('/api/ideas', expect.objectContaining({ photo_path: 'ideas/u/a.png' }))
    )
  })

  it('says so when the photo does not upload', async () => {
    vi.mocked(browserApiClient.postFormData).mockRejectedValue(new Error('nope'))
    render(<IdeaForm />)
    fireEvent.change(screen.getByLabelText(/drop a photo of the toy/i), {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    })
    expect(await screen.findByText('Could not upload the photo. Please try again.')).toBeInTheDocument()
  })

  it('sends no photo when none is added', async () => {
    vi.mocked(browserApiClient.post).mockClear()
    render(<IdeaForm />)
    fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: 'T' } })
    fireEvent.change(screen.getByLabelText(/^summary$/i), { target: { value: 'S' } })
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))
    await waitFor(() =>
      expect(browserApiClient.post).toHaveBeenCalledWith('/api/ideas', expect.objectContaining({ photo_path: null }))
    )
  })
})
