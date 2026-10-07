// journeys: X10 X11
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { CostPanel } from '../../../../components/exchanges/cost-panel'

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
  id: 'l1', description: 'Switch jack and cable', amount_cents: 650, claiming: true,
  payer_id: 'fam', payee_id: 'maker', settled_at: null, created_by: 'maker', ...over,
})
const serve = (lines: object[]) => mockGet.mockResolvedValue({ lines, settlement: null })
const maker = (title = 'Parts you bought for this build') => (
  <CostPanel transactionId="b1" viewerId="maker" mode="edit" title={title} />
)

beforeEach(() => jest.clearAllMocks())

describe('the maker', () => {
  it('says the costs did not load, rather than that nothing is listed', async () => {
    mockGet.mockRejectedValue(new Error('network'))
    render(maker())
    expect(await screen.findByText('Could not load the costs. Check your connection and try again.')).toBeTruthy()
    expect(screen.queryByText(/Nothing listed/)).toBeNull()
    expect(screen.queryByText('Nothing asked back')).toBeNull()
    expect(screen.queryByText('Add a line')).toBeNull()
  })

  it('adds a line the family is asked to pay back', async () => {
    serve([])
    mockPost.mockResolvedValue(line())
    render(maker())
    expect(await screen.findByText('Nothing listed — add a line for anything you paid for, even if you plan to cover it.')).toBeTruthy()
    fireEvent.changeText(screen.getByLabelText('What the money went on'), 'Switch jack and cable')
    fireEvent.changeText(screen.getByLabelText('Amount in dollars'), '6.50')
    fireEvent.press(screen.getByText('Add a line'))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/exchange-costs/b1', { description: 'Switch jack and cable', amount_cents: 650, claiming: true })
    )
    expect(await screen.findByText('Asking back')).toBeTruthy()
    expect(screen.getAllByText('$6.50').length).toBeGreaterThan(0)
    // The family settles (spec), never the maker.
    expect(screen.queryByText('Mark as settled')).toBeNull()
  })

  it('records a cost they cover', async () => {
    serve([])
    mockPost.mockResolvedValue(line({ claiming: false, amount_cents: 400 }))
    render(maker())
    fireEvent.changeText(await screen.findByLabelText('What the money went on'), 'Batteries')
    fireEvent.changeText(screen.getByLabelText('Amount in dollars'), '4')
    fireEvent.press(screen.getByRole('radio', { name: 'Covering it' }))
    fireEvent.press(screen.getByText('Add a line'))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/exchange-costs/b1', { description: 'Batteries', amount_cents: 400, claiming: false })
    )
    expect(await screen.findByText('Nothing asked back')).toBeTruthy()
  })

  it('refuses an amount that is not dollars, and sends nothing', async () => {
    serve([])
    render(maker())
    fireEvent.changeText(await screen.findByLabelText('Amount in dollars'), '6.5.0')
    fireEvent.press(screen.getByText('Add a line'))
    expect(screen.getByText('The amount is dollars, like 6.50.')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it("removes their own line and never the family's", async () => {
    serve([line(), line({ id: 'l2', description: 'Their bus fare', created_by: 'fam', payer_id: 'maker', payee_id: 'fam' })])
    mockDelete.mockResolvedValue({ id: 'l1' })
    render(maker())
    await screen.findByText('Their bus fare')
    expect(screen.getAllByLabelText('Remove this line')).toHaveLength(1)
    fireEvent.press(screen.getByLabelText('Remove this line'))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/exchange-costs/l1'))
    await waitFor(() => expect(screen.queryByText('Switch jack and cable')).toBeNull())
  })
})

describe('the family', () => {
  const family = () => (
    <CostPanel transactionId="b1" viewerId="fam" mode="settle" title="What this build costs you" hint="Tom gives the time and the tools free — these are the parts they bought." />
  )

  it('sees what they pay back and marks it settled', async () => {
    serve([line()])
    mockPatch.mockResolvedValue({ id: 'l1', settled_at: '2026-10-01T00:00:00Z', settled_by: 'fam' })
    render(family())
    expect(await screen.findByText('You pay back')).toBeTruthy()
    expect(screen.getByText('Tap only once the money has actually changed hands.')).toBeTruthy()
    fireEvent.press(screen.getByText('Mark as settled'))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/exchange-costs/l1/settle', { settled: true }))
    expect(await screen.findByText('Marked as settled')).toBeTruthy()
  })

  it('settles only the lines they pay, not one the maker owes them', async () => {
    serve([line(), line({ id: 'l2', description: 'Their bus fare', created_by: 'fam', payer_id: 'maker', payee_id: 'fam', amount_cents: 300 })])
    mockPatch.mockResolvedValue({ id: 'l1', settled_at: '2026-10-01T00:00:00Z', settled_by: 'fam' })
    render(family())
    expect(await screen.findByText('You pay back')).toBeTruthy()
    // The line and the total: what the maker owes back is never netted off.
    expect(screen.getAllByText('$6.50')).toHaveLength(2)
    fireEvent.press(screen.getByText('Mark as settled'))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1))
    expect(mockPatch).toHaveBeenCalledWith('/api/exchange-costs/l1/settle', { settled: true })
  })

  it('has nothing to pay, and nothing to settle, when every line is covered', async () => {
    serve([line({ claiming: false, amount_cents: 400 })])
    render(family())
    expect(await screen.findByText('Nothing to pay')).toBeTruthy()
    expect(screen.queryByText('Mark as settled')).toBeNull()
  })
})

describe('read-only, on an exchange', () => {
  it('draws nothing when there are no lines', async () => {
    serve([])
    render(<CostPanel transactionId="tx1" viewerId="fam" mode="read" title="What the handover costs you" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByText('What the handover costs you')).toBeNull()
  })
})
