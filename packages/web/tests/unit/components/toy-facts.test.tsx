import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ToyFacts, ToySignInGate } from '@/components/toy-facts'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/toy-library/t1' }))
const post = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: (...a: unknown[]) => post(...a) } }))

const { ReportLink } = await import('@/components/report-link')

const blank = { age_min: null, age_max: null, batteries: null, switch_fitting: null, volume: null, guide: null }

describe('ToyFacts', () => {
  it('draws the filled-in facts in the board order and the Built from card', () => {
    render(
      <ToyFacts
        toy={{ ...blank, age_min: 2, age_max: 6, volume: 'Loud, half-taped', guide: { id: 'g1', title: 'Guide C' } }}
      />
    )
    const terms = screen.getAllByRole('term').map((t) => t.textContent)
    expect(terms).toEqual(['Ages it suits', 'Volume'])
    expect(screen.getByText('2–6')).toBeInTheDocument()
    expect(screen.getByText('Built from Guide C')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the guide' })).toHaveAttribute('href', '/tutorials/g1')
  })

  it('draws nothing for a toy with no facts and no guide', () => {
    const { container } = render(<ToyFacts toy={blank} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('ToySignInGate', () => {
  it('lists what signing in unlocks and comes back to the toy', () => {
    render(<ToySignInGate toyId="t1" />)
    for (const s of ['What is in the box', 'Condition & safety', 'Handover', 'Ask or swap']) {
      expect(screen.getByText(s)).toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: 'Sign in to unlock' })).toHaveAttribute(
      'href',
      '/login?next=%2Ftoy-library%2Ft1'
    )
  })
})

describe('ReportLink', () => {
  beforeEach(() => {
    push.mockReset()
    post.mockReset().mockResolvedValue({})
  })

  it('sends a signed-out visitor to sign in', () => {
    render(<ReportLink subjectKind="toy" subjectId="t1" subjectLabel="Plush dog" who="Family 3" signedIn={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Report this listing/ }))
    expect(push).toHaveBeenCalledWith('/login?next=%2Ftoy-library%2Ft1')
  })

  it('files a toy report with the picked reason', async () => {
    render(<ReportLink subjectKind="toy" subjectId="t1" subjectLabel="Plush dog" who="Family 3" signedIn />)
    fireEvent.click(screen.getByRole('button', { name: /Report this listing/ }))
    const send = screen.getByRole('button', { name: /Send to SPLAT/ })
    expect(send).toBeDisabled()

    fireEvent.click(screen.getByRole('radio', { name: /Safety concern/ }))
    fireEvent.change(screen.getByPlaceholderText(/What you expected/), { target: { value: 'Loose battery cover' } })
    fireEvent.click(send)

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/reports', {
        subject_kind: 'toy',
        subject_id: 't1',
        subject_label: 'Plush dog',
        category: 'safety',
        body: 'Loose battery cover',
        ok_to_contact: true,
      })
    )
    expect(await screen.findByRole('status')).toHaveTextContent(/Safety reports go to the top/)
  })
})
