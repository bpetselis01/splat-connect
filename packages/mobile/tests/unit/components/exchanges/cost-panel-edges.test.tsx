// What the cost panel does with odd amounts, odd descriptions, a second tap and
// a failed save. The ordinary journeys live in cost-panel.test.tsx.
// journeys: X12
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { CostPanel } from '../../../../components/exchanges/cost-panel'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPatch = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}))

const line = (over: object = {}) => ({
  id: 'l1', description: 'Switch jack', amount_cents: 650, claiming: true,
  payer_id: 'fam', payee_id: 'maker', settled_at: null, created_by: 'maker', ...over,
})
const serve = (lines: object[]) => mockGet.mockResolvedValue({ lines, settlement: null })
const maker = () => <CostPanel transactionId="b1" viewerId="maker" mode="edit" title="Parts" />
const family = () => <CostPanel transactionId="b1" viewerId="fam" mode="settle" title="Costs" />
const fill = async (what: string, amount: string) => {
  fireEvent.changeText(await screen.findByLabelText('What the money went on'), what)
  fireEvent.changeText(screen.getByLabelText('Amount in dollars'), amount)
}
const add = () => fireEvent.press(screen.getByText('Add a line'))

beforeEach(() => {
  jest.clearAllMocks()
  serve([])
})

describe('amounts the maker types', () => {
  it.each([
    ['$6.50', 650],
    [' 6.5 ', 650],
    ['0.01', 1],
    ['1000000', 100_000_000],
    ['12.10', 1210],
  ])('sends %j as %i cents', async (typed, cents) => {
    mockPost.mockResolvedValue(line({ amount_cents: cents }))
    render(maker())
    await fill('Parts', typed)
    add()
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/exchange-costs/b1', { description: 'Parts', amount_cents: cents, claiming: true }))
  })

  it.each(['-5', '-0.01', '1,000', '6.505', 'abc', '1e2', '٥', '$$5', '9999999999'])('refuses %j before any request is made', async (typed) => {
    render(maker())
    await fill('Parts', typed)
    add()
    expect(screen.getByText('The amount is dollars, like 6.50.')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Amount in dollars').props.value).toBe(typed)
  })

  it('clears the amount error once a good amount goes through', async () => {
    mockPost.mockResolvedValue(line())
    render(maker())
    await fill('Parts', 'abc')
    add()
    expect(screen.getByText('The amount is dollars, like 6.50.')).toBeTruthy()
    fireEvent.changeText(screen.getByLabelText('Amount in dollars'), '6.50')
    add()
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText('The amount is dollars, like 6.50.')).toBeNull())
  })

  it('shows the API reason, and keeps the fields, when a claimed line is worth nothing', async () => {
    mockPost.mockRejectedValue(new Error('API POST /x failed with status 400: A cost you are claiming back has to be more than nothing.'))
    render(maker())
    await fill('Parts', '0')
    add()
    expect(await screen.findByText('A cost you are claiming back has to be more than nothing.')).toBeTruthy()
    expect(screen.getByLabelText('What the money went on').props.value).toBe('Parts')
    expect(screen.getByLabelText('Amount in dollars').props.value).toBe('0')
    expect(screen.getByText('Nothing asked back')).toBeTruthy()
  })

  it('records a covered line left at no amount as zero cents', async () => {
    mockPost.mockResolvedValue(line({ claiming: false, amount_cents: 0 }))
    render(maker())
    await fill('Postage', '')
    fireEvent.press(screen.getByRole('radio', { name: 'Covering it' }))
    add()
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/exchange-costs/b1', { description: 'Postage', amount_cents: 0, claiming: false })
    )
  })
})

describe('descriptions the maker types', () => {
  it.each([...NAMES.filter((n) => !/spaces/.test(n.label)), { label: 'quotes', value: `"5" & <6> 100% \\n` }])(
    'sends and draws $label text exactly',
    async ({ value }) => {
      mockPost.mockResolvedValue(line({ description: value }))
      render(maker())
      await fill(value, '2')
      add()
      await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/exchange-costs/b1', { description: value, amount_cents: 200, claiming: true }))
      expect(await screen.findByText(value)).toBeTruthy()
    }
  )

  it('trims the description before it is sent', async () => {
    mockPost.mockResolvedValue(line())
    render(maker())
    await fill('  Switch jack \n', '2')
    add()
    await waitFor(() => expect(mockPost.mock.calls[0][1].description).toBe('Switch jack'))
  })

  it('shows the API reason when the description is empty', async () => {
    mockPost.mockRejectedValue(new Error('API POST /x failed with status 400: Say what the cost is for, in 200 characters or fewer.'))
    render(maker())
    await fill('   ', '2')
    add()
    expect(await screen.findByText('Say what the cost is for, in 200 characters or fewer.')).toBeTruthy()
    expect(screen.getByText('Nothing asked back')).toBeTruthy()
  })
})

describe('taps and failures', () => {
  it('adds the line once when Add a line is pressed twice before the answer', async () => {
    let resolve!: (l: object) => void
    mockPost.mockReturnValue(new Promise((r) => (resolve = r)))
    render(maker())
    await fill('Parts', '2')
    add()
    add()
    expect(mockPost).toHaveBeenCalledTimes(1)
    await act(async () => resolve(line()))
    expect(screen.getAllByText('Switch jack')).toHaveLength(1)
  })

  it('keeps the typed line when the connection drops, and says the phone is offline', async () => {
    mockPost.mockRejectedValue(new TypeError('Network request failed'))
    render(maker())
    await fill('Parts', '2')
    add()
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy()
    expect(screen.getByLabelText('Amount in dollars').props.value).toBe('2')
    expect(screen.getAllByText('Nothing listed — add a line for anything you paid for, even if you plan to cover it.')).toHaveLength(1)
  })

  it('falls back to a plain sentence on a server error', async () => {
    mockPost.mockRejectedValue(new Error('API POST /x failed with status 500: duplicate key value violates'))
    render(maker())
    await fill('Parts', '2')
    add()
    expect(await screen.findByText('Could not add that line. Please try again.')).toBeTruthy()
  })

  it('keeps the line on screen when removing it fails', async () => {
    serve([line()])
    mockDelete.mockRejectedValue(new Error('API DELETE /x failed with status 500'))
    render(maker())
    fireEvent.press(await screen.findByLabelText('Remove this line'))
    expect(await screen.findByText('Could not remove that line. Please try again.')).toBeTruthy()
    expect(screen.getByText('Switch jack')).toBeTruthy()
  })

  it('removes the line once when the bin is pressed twice', async () => {
    serve([line()])
    mockDelete.mockReturnValue(new Promise(() => {}))
    render(maker())
    const bin = await screen.findByLabelText('Remove this line')
    fireEvent.press(bin)
    fireEvent.press(bin)
    expect(mockDelete).toHaveBeenCalledTimes(1)
  })

  it('asks back for the sum of several lines, in cents', async () => {
    serve([line({ id: 'a', amount_cents: 1 }), line({ id: 'b', amount_cents: 10 }), line({ id: 'c', amount_cents: 1999 })])
    render(maker())
    expect(await screen.findByText('Asking back')).toBeTruthy()
    expect(screen.getByText('$20.10')).toBeTruthy()
  })
})

describe('settling', () => {
  it('stays unsettled when the settle request fails, and says so', async () => {
    serve([line()])
    mockPatch.mockRejectedValue(new Error('API PATCH /x failed with status 500'))
    render(family())
    fireEvent.press(await screen.findByText('Mark as settled'))
    expect(await screen.findByText('Could not save that. Please try again.')).toBeTruthy()
    expect(screen.getByText('Mark as settled')).toBeTruthy()
  })

  it('un-settles an early mark with settled:false', async () => {
    serve([line({ settled_at: '2026-10-01T00:00:00Z' })])
    mockPatch.mockResolvedValue({ id: 'l1', settled_at: null })
    render(family())
    fireEvent.press(await screen.findByText('Marked as settled'))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/exchange-costs/l1/settle', { settled: false }))
    expect(await screen.findByText('Mark as settled')).toBeTruthy()
  })

  it('settles several lines each once, and not one that is already settled', async () => {
    serve([
      line({ id: 'a' }),
      line({ id: 'b', amount_cents: 200 }),
      line({ id: 'c', amount_cents: 300, settled_at: '2026-10-01T00:00:00Z' }),
    ])
    mockPatch.mockImplementation((path: string) => Promise.resolve({ id: path.split('/')[3], settled_at: '2026-10-02T00:00:00Z' }))
    render(family())
    fireEvent.press(await screen.findByText('Mark as settled'))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2))
    expect(mockPatch.mock.calls.map((c) => c[0]).sort()).toEqual(['/api/exchange-costs/a/settle', '/api/exchange-costs/b/settle'])
    expect(await screen.findByText('Marked as settled')).toBeTruthy()
  })

  it('settles once when Mark as settled is pressed twice before the answer', async () => {
    serve([line()])
    mockPatch.mockReturnValue(new Promise(() => {}))
    render(family())
    const btn = await screen.findByText('Mark as settled')
    fireEvent.press(btn)
    fireEvent.press(btn)
    expect(mockPatch).toHaveBeenCalledTimes(1)
  })

  it('shows what is owed in cents without netting the maker\'s own line', async () => {
    serve([line({ amount_cents: 1210 }), line({ id: 'x', payer_id: 'maker', payee_id: 'fam', amount_cents: 1210, created_by: 'fam' })])
    render(family())
    expect(await screen.findByText('You pay back')).toBeTruthy()
    expect(screen.getAllByText('$12.10').length).toBeGreaterThan(1)
  })
})

describe('read-only cards', () => {
  const read = (v = 'fam') => <CostPanel transactionId="tx1" viewerId={v} mode="read" title="What the handover costs you" />

  it('charges a covered line as $0.00 to the reader', async () => {
    serve([line({ claiming: false, amount_cents: 400 })])
    render(read())
    expect(await screen.findByText('$0.00')).toBeTruthy()
    expect(screen.queryByText('$4.00')).toBeNull()
    expect(screen.queryByText('You pay back')).toBeNull()
  })

  it('says what the other side pays back to the viewer who is owed', async () => {
    serve([line()])
    render(read('maker'))
    expect(await screen.findByText('They pay you back')).toBeTruthy()
  })

  it('shows the settlement method when the API sends one', async () => {
    mockGet.mockResolvedValue({ lines: [line()], settlement: { method: 'Bank transfer — "ref" & <1>' } })
    render(read())
    expect(await screen.findByText('Bank transfer — "ref" & <1>')).toBeTruthy()
  })

  it('says the costs did not load, rather than drawing nothing, when the read fails', async () => {
    mockGet.mockRejectedValue(new Error('offline'))
    render(read())
    expect(await screen.findByText('Could not load the costs. Check your connection and try again.')).toBeTruthy()
    expect(screen.queryByText('You pay back')).toBeNull()
  })
})
