import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CostPanel, type CostLine } from '@/components/cost-panel'

vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { patch: vi.fn().mockResolvedValue({}) },
}))
import { browserApiClient } from '@/lib/browser-api-client'

const line = (over: Partial<CostLine> = {}): CostLine => ({
  id: 'c1',
  description: 'Postage satchel, 3 kg',
  amount_cents: 1060,
  claiming: true,
  settled_at: null,
  ...over,
})

beforeEach(() => vi.clearAllMocks())

describe('CostPanel', () => {
  /*
   * Why: no lines means nobody has said this costs anything. An empty money
   * panel is a worry with no object — the honest render is nothing at all.
   */
  it('renders nothing when no cost has been recorded', () => {
    const { container } = render(
      <CostPanel lines={[]} settlement={null} viewerOwes />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows what is outstanding, not what was ever agreed', () => {
    render(
      <CostPanel
        lines={[line(), line({ id: 'c2', amount_cents: 500, settled_at: '2026-09-05T00:00:00Z' })]}
        settlement={null}
        viewerOwes
      />
    )
    // 1060 outstanding; the settled 500 is history. Queried by testid because
    // the same figure also appears on its own line in the breakdown.
    expect(screen.getByTestId('cost-total')).toHaveTextContent('$10.60')
  })

  /*
   * Why: this is what 056's flag is for. A covered line records that somebody
   * absorbed a cost, which is a different fact from no cost existing — hiding
   * it would turn a generous act into a blank.
   */
  it('lists a covered line at nothing owed, rather than hiding it', () => {
    render(
      <CostPanel
        lines={[line({ id: 'c3', description: 'Box and bubble wrap', amount_cents: 300, claiming: false })]}
        settlement={null}
        viewerOwes
      />
    )
    expect(screen.getByText('Box and bubble wrap')).toBeInTheDocument()
    expect(screen.getByText('Covering it')).toBeInTheDocument()
    // Nothing owed on the line, and nothing in the total either.
    expect(screen.getByTestId('cost-total')).toHaveTextContent('$0.00')
  })

  it('offers no settle control on a line nobody is claiming', () => {
    render(
      <CostPanel lines={[line({ claiming: false })]} settlement={null} viewerOwes />
    )
    expect(screen.queryByRole('button', { name: /settle/i })).not.toBeInTheDocument()
  })

  it('settles a line and moves the headline figure', async () => {
    render(<CostPanel lines={[line()]} settlement={null} viewerOwes />)
    expect(screen.getByTestId('cost-total')).toHaveTextContent('$10.60')

    fireEvent.click(screen.getByRole('button', { name: 'Mark settled' }))

    await waitFor(() => expect(screen.getByTestId('cost-total')).toHaveTextContent('$0.00'))
    expect(browserApiClient.patch).toHaveBeenCalledWith('/api/exchange-costs/c1/settle', {
      settled: true,
    })
    // The button, specifically. The headline chip also reads "Settled" once
    // nothing is outstanding, which is the state this click just produced.
    expect(screen.getByRole('button', { name: 'Settled' })).toBeInTheDocument()
  })

  /*
   * Why: somebody who just pressed "settled" on money they paid needs to know
   * it did not take. Silently reverting reads as the click not registering.
   */
  it('says so when settling fails, rather than reverting quietly', async () => {
    vi.mocked(browserApiClient.patch).mockRejectedValueOnce(new Error('offline'))
    render(<CostPanel lines={[line()]} settlement={null} viewerOwes />)

    fireEvent.click(screen.getByRole('button', { name: 'Mark settled' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/did not save/i))
    // And the figure did not move, because nothing was recorded.
    expect(screen.getByTestId('cost-total')).toHaveTextContent('$10.60')
  })

  /*
   * Why: §6 — a quote gets a glyph and a byline, never a left-border accent bar.
   */
  it('attributes the note rather than floating it', () => {
    render(
      <CostPanel
        lines={[line()]}
        settlement={{ note: 'Express satchel so it lands before the weekend.', method: null, receipt_path: null }}
        noteByName="Northside Therapy Collective"
        viewerOwes
      />
    )
    const caption = screen.getByText(/Northside Therapy Collective/)
    expect(caption.tagName).toBe('FIGCAPTION')
    expect(caption.closest('figure')).toBeTruthy()
  })

  it('names the reader in the heading', () => {
    const { rerender } = render(<CostPanel lines={[line()]} settlement={null} viewerOwes />)
    expect(screen.getByText(/What the handover costs you/i)).toBeInTheDocument()

    rerender(<CostPanel lines={[line()]} settlement={null} viewerOwes={false} />)
    expect(screen.getByText(/What you asked back/i)).toBeInTheDocument()
  })
})
