import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IdeaForm } from '@/components/idea-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))

describe('IdeaForm', () => {
  it('asks for every field the reviewer needs', () => {
    render(<IdeaForm />)
    for (const label of [/idea name/i, /one sentence/i, /full description/i, /intended use/i, /primary user/i]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })

  it('offers the three ways to stay involved', () => {
    render(<IdeaForm />)
    expect(screen.getByLabelText(/clarification/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/co-design/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/user testing/i)).toBeInTheDocument()
  })
})
