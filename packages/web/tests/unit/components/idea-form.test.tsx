import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IdeaForm } from '@/components/idea-form'
import { browserApiClient } from '@/lib/browser-api-client'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
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
  it('WI12 uploads a photo, shows it, and sends its path with the idea', async () => {
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

  it('WI12 says so when the photo does not upload', async () => {
    vi.mocked(browserApiClient.postFormData).mockRejectedValue(new Error('nope'))
    render(<IdeaForm />)
    fireEvent.change(screen.getByLabelText(/drop a photo of the toy/i), {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    })
    expect(await screen.findByText('Could not upload the photo. Please try again.')).toBeInTheDocument()
  })

  it('WI11 posts the typed idea with no photo and opens My challenges', async () => {
    vi.mocked(browserApiClient.post).mockClear()
    push.mockClear()
    render(<IdeaForm />)
    fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: 'T' } })
    fireEvent.change(screen.getByLabelText(/^summary$/i), { target: { value: 'S' } })
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))
    await waitFor(() =>
      expect(browserApiClient.post).toHaveBeenCalledWith('/api/ideas', {
        title: 'T',
        summary: 'S',
        description: null,
        kind: 'challenge',
        contact_prefs: [],
        photo_path: null,
        anonymous: false,
      })
    )
    expect(push).toHaveBeenCalledWith('/dashboard/challenges')
  })

  it('WI11 asks for a title and a summary before posting anything', async () => {
    vi.mocked(browserApiClient.post).mockClear()
    render(<IdeaForm />)
    fireEvent.submit(screen.getByLabelText(/^title$/i).closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent('A title and a summary are required.')
    expect(browserApiClient.post).not.toHaveBeenCalled()
  })

  it('starts from the idea it revises, photo included', async () => {
    render(
      <IdeaForm
        initial={{
          id: 'i1', author_id: 'a', title: 'Old', summary: 'Sum', description: 'Why', intended_use: null, primary_user: null,
          contact_prefs: ['co_design'], status: 'rejected', review_note: 'No', tutorial_id: null, created_at: '', updated_at: '',
          photo_path: 'ideas/a/p.png', photo_url: 'https://example.test/p.png',
        }}
      />
    )
    expect(screen.getByLabelText(/^title$/i)).toHaveValue('Old')
    expect(screen.getByLabelText(/why it matters/i)).toHaveValue('Why')
    fireEvent.submit(screen.getByLabelText(/^title$/i).closest('form')!)
    await waitFor(() =>
      expect(browserApiClient.post).toHaveBeenCalledWith(
        '/api/ideas',
        expect.objectContaining({ title: 'Old', contact_prefs: ['co_design'], photo_path: 'ideas/a/p.png' })
      )
    )
  })

  it('posts anonymously when the box is ticked', async () => {
    render(<IdeaForm />)
    fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: 'T' } })
    fireEvent.change(screen.getByLabelText(/^summary$/i), { target: { value: 'S' } })
    fireEvent.click(screen.getByLabelText('Post this anonymously. Your name will not appear on the challenge.'))
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))
    await waitFor(() => expect(browserApiClient.post).toHaveBeenCalledWith('/api/ideas', expect.objectContaining({ anonymous: true })))
  })
})
