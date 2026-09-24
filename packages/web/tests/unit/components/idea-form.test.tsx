import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IdeaForm } from '@/components/idea-form'
import { browserApiClient } from '@/lib/browser-api-client'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))

describe('IdeaForm', () => {
  it('asks for every field the reviewer needs', () => {
    render(<IdeaForm />)
    for (const label of [/^title$/i, /^summary$/i, /full description/i, /intended use/i, /primary user/i]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
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
      [/full description/i, 'D'],
      [/intended use/i, 'U'],
      [/primary user/i, 'P'],
    ] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    }
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))
    await waitFor(() =>
      expect(browserApiClient.post).toHaveBeenCalledWith('/api/ideas', expect.objectContaining({ kind: 'question' }))
    )
  })
})
