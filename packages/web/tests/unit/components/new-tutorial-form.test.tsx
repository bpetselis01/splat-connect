import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NewTutorialForm } from '@/components/new-tutorial-form'
import { browserApiClient } from '@/lib/browser-api-client'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { post: vi.fn(), postFormData: vi.fn(), get: vi.fn(), patch: vi.fn() },
}))

const mockPost = vi.mocked(browserApiClient.post)

function fillAndSubmit(title = 'Sensory light box') {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: title } })
  fireEvent.click(screen.getByRole('button', { name: /Create draft/ }))
}

describe('NewTutorialForm', () => {
  beforeEach(() => {
    push.mockClear()
    mockPost.mockReset().mockResolvedValue({})
  })

  it('creates the draft and links the contributor to it', async () => {
    render(<NewTutorialForm kind="toy_adaptation" />)
    fillAndSubmit()

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2))
    const [createPath, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>]
    expect(createPath).toBe('/api/tutorials')
    expect(body).toMatchObject({ title: 'Sensory light box', difficulty: 'easy', description: null, kind: 'toy_adaptation' })
    expect(mockPost.mock.calls[1][0]).toBe(`/api/contributors/me/tutorials/${body.id}`)
  })

  it('generates the id itself, which is what makes the create retry-safe', async () => {
    render(<NewTutorialForm kind="toy_adaptation" />)
    fillAndSubmit()

    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    const body = mockPost.mock.calls[0][1] as { id: string }
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('hands over to the editor on the Files step', async () => {
    render(<NewTutorialForm kind="toy_adaptation" />)
    fillAndSubmit()

    await waitFor(() => expect(push).toHaveBeenCalled())
    // created=1 is what lets the editor announce the handover; without it the
    // redirect changes almost nothing on screen and reads as being thrown
    // somewhere else.
    expect(push.mock.calls[0][0]).toMatch(
      /^\/tutorials\/[0-9a-f-]{36}\/edit\?step=files&created=1$/
    )
  })

  it('sends the chosen kind from the radio cards', async () => {
    render(<NewTutorialForm />)
    fireEvent.click(screen.getByRole('radio', { name: /Assistive tech/ }))
    fillAndSubmit()

    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost.mock.calls[0][1]).toMatchObject({ kind: 'assistive_tech' })
  })

  it('uploads a chosen cover once the draft exists, then saves it as the first photo', async () => {
    vi.mocked(browserApiClient.postFormData).mockResolvedValue({ url: 'https://x/cover.jpg' })
    vi.mocked(browserApiClient.get).mockResolvedValue({ updated_at: 'T1' })
    vi.mocked(browserApiClient.patch).mockResolvedValue({})
    render(<NewTutorialForm kind="toy_adaptation" />)
    const file = new File(['x'], 'toy.jpg', { type: 'image/jpeg' })
    globalThis.URL.createObjectURL ??= () => 'blob:x'
    globalThis.URL.revokeObjectURL ??= () => {}
    fireEvent.change(screen.getByLabelText('Cover photo'), { target: { files: [file] } })
    fillAndSubmit()

    await waitFor(() => expect(push).toHaveBeenCalled())
    const id = (mockPost.mock.calls[0][1] as { id: string }).id
    expect(browserApiClient.patch).toHaveBeenCalledWith(`/api/tutorials/${id}`, {
      photo_urls: ['https://x/cover.jpg'],
      updated_at: 'T1',
    })
  })

  it('sends the chosen difficulty and an empty description as null', async () => {
    render(<NewTutorialForm kind="toy_adaptation" />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Kazoo' } })
    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: 'hard' } })
    fireEvent.click(screen.getByRole('button', { name: /Create draft/ }))

    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost.mock.calls[0][1]).toMatchObject({ difficulty: 'hard', description: null })
  })

  // No contributor-terms case here: middleware turns /upload away before this
  // renders, and POST /api/tutorials refuses too. The redirect is asserted in
  // tests/e2e/contributor/upload-flow.spec.ts.

  it('reports a failed create and stays put instead of redirecting', async () => {
    mockPost.mockRejectedValue(new Error('boom'))
    render(<NewTutorialForm kind="toy_adaptation" />)
    fillAndSubmit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create this tutorial')
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Create draft/ })).not.toBeDisabled()
  })
})
