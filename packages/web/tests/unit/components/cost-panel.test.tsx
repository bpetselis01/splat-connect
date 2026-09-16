import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CostPanel, dollarsToCents, type CostLine } from '@/components/cost-panel'

vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: {
    patch: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({
      id: 'new',
      description: 'Filament',
      amount_cents: 1210,
      claiming: true,
      settled_at: null,
      created_by: 'me',
    }),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    postFormData: vi.fn().mockResolvedValue({ receipt_path: 't1/r.png' }),
  },
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
      <CostPanel lines={[]} settlement={null} viewerOwes transactionId="t1" />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows what is outstanding, not what was ever agreed', () => {
    render(
      <CostPanel
        lines={[line(), line({ id: 'c2', amount_cents: 500, settled_at: '2026-09-05T00:00:00Z' })]}
        settlement={null}
        viewerOwes
        transactionId="t1"
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
        transactionId="t1"
      />
    )
    expect(screen.getByText('Box and bubble wrap')).toBeInTheDocument()
    expect(screen.getByText('Covering it')).toBeInTheDocument()
    // Nothing owed on the line, and nothing in the total either.
    expect(screen.getByTestId('cost-total')).toHaveTextContent('$0.00')
  })

  it('offers no settle control on a line nobody is claiming', () => {
    render(
      <CostPanel lines={[line({ claiming: false })]} settlement={null} viewerOwes transactionId="t1" />
    )
    expect(screen.queryByRole('button', { name: /settle/i })).not.toBeInTheDocument()
  })

  it('settles a line and moves the headline figure', async () => {
    render(<CostPanel lines={[line()]} settlement={null} viewerOwes transactionId="t1" />)
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
    render(<CostPanel lines={[line()]} settlement={null} viewerOwes transactionId="t1" />)

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
        settlement={{
          note: 'Express satchel so it lands before the weekend.',
          note_by: 'them',
          method: null,
          receipt_path: null,
        }}
        noteByName="Northside Therapy Collective"
        viewerId="me"
        viewerOwes
        transactionId="t1"
      />
    )
    const caption = screen.getByText(/Northside Therapy Collective/)
    expect(caption.tagName).toBe('FIGCAPTION')
    expect(caption.closest('figure')).toBeTruthy()
  })

  it('names the reader in the heading', () => {
    const { rerender } = render(<CostPanel lines={[line()]} settlement={null} viewerOwes transactionId="t1" />)
    expect(screen.getByText(/What the handover costs you/i)).toBeInTheDocument()

    rerender(
      <CostPanel lines={[line()]} settlement={null} viewerOwes={false} transactionId="t1" />
    )
    expect(screen.getByText(/What you asked back/i)).toBeInTheDocument()
  })
})

/*
 * Why a money parser gets its own test: `parseFloat('12.10') * 100` is
 * 1209.9999999999998. A cent lost to binary floating point in a figure two
 * families agreed between them is an argument, not a display bug.
 */
describe('dollarsToCents', () => {
  it('reads plain amounts exactly', () => {
    expect(dollarsToCents('12.10')).toBe(1210)
    expect(dollarsToCents('$12.5')).toBe(1250)
    expect(dollarsToCents(' 7 ')).toBe(700)
    expect(dollarsToCents('0')).toBe(0)
  })

  it('refuses anything that is not an amount', () => {
    expect(dollarsToCents('')).toBeNull()
    expect(dollarsToCents('-5')).toBeNull()
    expect(dollarsToCents('12.345')).toBeNull()
    expect(dollarsToCents('ten dollars')).toBeNull()
  })
})

describe('CostPanel edit mode', () => {
  /*
   * Why: the read-only panel renders nothing with no lines, because an empty
   * money panel is a worry with no object. A party who can add one needs the
   * shell anyway — otherwise there is nowhere to add the first cost from.
   */
  it('renders the shell with no lines when the viewer can add one', () => {
    render(
      <CostPanel lines={[]} settlement={null} viewerOwes transactionId="t1" viewerId="me" canEdit />
    )
    expect(screen.getByText(/Nobody has said this costs anything yet/i)).toBeInTheDocument()
  })

  it('posts a new line and moves the total without a round trip', async () => {
    render(
      <CostPanel lines={[]} settlement={null} viewerOwes transactionId="t1" viewerId="me" canEdit />
    )
    fireEvent.change(screen.getByLabelText('What it was for'), { target: { value: 'Filament' } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '12.10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add cost' }))

    await waitFor(() =>
      expect(browserApiClient.post).toHaveBeenCalledWith('/api/exchange-costs/t1', {
        description: 'Filament',
        amount_cents: 1210,
        claiming: true,
      })
    )
    await waitFor(() => expect(screen.getByTestId('cost-total')).toHaveTextContent('$12.10'))
  })

  /*
   * Why: 055's delete policy is `created_by = auth.uid()`. Offering remove on
   * somebody else's line is a control the database will refuse — a dead one.
   */
  it('offers remove only on the viewer\u2019s own lines', () => {
    render(
      <CostPanel
        lines={[
          line({ id: 'mine', description: 'Mine', created_by: 'me' }),
          line({ id: 'theirs', description: 'Theirs', created_by: 'them' }),
        ]}
        settlement={null}
        viewerOwes
        transactionId="t1"
        viewerId="me"
        canEdit
      />
    )
    expect(screen.getByRole('button', { name: 'Remove Mine' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove Theirs' })).toBeNull()
  })

  it('saves the note and the method as one settlement', async () => {
    render(
      <CostPanel
        lines={[line()]}
        settlement={null}
        viewerOwes
        transactionId="t1"
        viewerId="me"
        canEdit
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Add a note or receipt/i }))
    fireEvent.change(screen.getByLabelText('A note about the money'), {
      target: { value: 'Happy to wait.' },
    })
    fireEvent.change(screen.getByLabelText('How it changed hands'), {
      target: { value: 'Bank transfer' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(browserApiClient.put).toHaveBeenCalledWith('/api/exchange-costs/t1/settlement', {
        note: 'Happy to wait.',
        method: 'Bank transfer',
        receipt_path: null,
      })
    )
  })
})

/*
 * Why: the byline used to name the other party unconditionally, which put their
 * name under a note the reader had just written themselves.
 */
describe('the note byline', () => {
  it('names whoever wrote it, not whoever is on the other side', () => {
    const { unmount } = render(
      <CostPanel
        lines={[line()]}
        settlement={{ note: 'Sent it.', note_by: 'me', method: null, receipt_path: null }}
        noteByName="Ben Requester"
        viewerName="Ada Owner"
        viewerId="me"
        viewerOwes
        transactionId="t1"
      />
    )
    expect(screen.getByText(/Ada Owner/)).toBeInTheDocument()
    // A fresh mount, not a rerender: the panel snapshots the settlement into
    // state so that a save moves the byline without a round trip, and in the
    // app a different exchange is always a different mount.
    unmount()

    render(
      <CostPanel
        lines={[line()]}
        settlement={{ note: 'Sent it.', note_by: 'them', method: null, receipt_path: null }}
        noteByName="Ben Requester"
        viewerName="Ada Owner"
        viewerId="me"
        viewerOwes
        transactionId="t1"
      />
    )
    expect(screen.getByText(/Ben Requester/)).toBeInTheDocument()
  })
})
