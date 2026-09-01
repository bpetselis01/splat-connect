// packages/mobile/tests/unit/components/toys/request-block.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import type { Toy, ToyWithOwner } from '@splat-connect/types'
import { RequestBlock } from '../../../../components/toys/request-block'

// Ionicons loads its font asynchronously and setStates after the test ends;
// stub it to a host string so there's no act() warning noise, same as the
// rest of the suite.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

// RequestBlock pulls ErrorRow in from components/auth-screen, which imports
// useAuth from lib/auth-context — and that module's real implementation
// reaches all the way to the live supabase client. Mocking auth-context here
// (unused by RequestBlock itself) is what keeps that import inert, same as
// editor.test.tsx does for the same transitive reason.
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { post: (...a: unknown[]) => mockPost(...a) },
}))

const toy = (over: Partial<ToyWithOwner>): ToyWithOwner => ({
  id: 'toy1',
  owner_id: 'owner1',
  owner_org_id: null,
  quantity: 1,
  name: 'Bubble machine',
  description: null,
  condition: 8,
  switch_adapted: false,
  cover_photo_url: null,
  switch_photo_urls: [],
  status: 'published',
  offer_type: 'both',
  created_at: '',
  updated_at: '',
  profiles: { name: 'Jamie' },
  organizations: null,
  ...over,
})

const myToy = (over: Partial<Toy>): Toy => ({
  id: 'mine1',
  owner_id: 'u1',
  owner_org_id: null,
  quantity: 1,
  name: 'Switch car',
  description: null,
  condition: 6,
  switch_adapted: false,
  cover_photo_url: null,
  switch_photo_urls: [],
  status: 'published',
  offer_type: null,
  created_at: '',
  updated_at: '',
  ...over,
})

const mockOnStarted = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
})

describe('RequestBlock', () => {
  it('shows the not-offered line and no buttons when offer_type is null', () => {
    render(<RequestBlock toy={toy({ offer_type: null })} myToys={[]} myToysLoaded={true} myToysError={null} onStarted={mockOnStarted} />)
    expect(screen.getByText('Not currently offered for donation or exchange.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Arrange pickup' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Arrange exchange' })).toBeNull()
  })

  it('shows the donation-only explainer and only the pickup button', () => {
    render(<RequestBlock toy={toy({ offer_type: 'donation' })} myToys={[]} myToysLoaded={true} myToysError={null} onStarted={mockOnStarted} />)
    expect(screen.getByText('Ask to collect this toy. This starts a conversation with the owner.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Arrange pickup' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Arrange exchange' })).toBeNull()
  })

  it('shows the exchange-only explainer and only the exchange button', () => {
    render(<RequestBlock toy={toy({ offer_type: 'exchange' })} myToys={[]} myToysLoaded={true} myToysError={null} onStarted={mockOnStarted} />)
    expect(screen.getByText('Offer one of your toys in exchange. This starts a conversation with the owner.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Arrange pickup' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Arrange exchange' })).toBeTruthy()
  })

  it('shows the combined explainer and both buttons when offer_type is both', () => {
    render(<RequestBlock toy={toy({ offer_type: 'both' })} myToys={[]} myToysLoaded={true} myToysError={null} onStarted={mockOnStarted} />)
    expect(
      screen.getByText(
        'Ask to collect this toy, or offer one of yours in exchange. Either way it starts a conversation with the owner.'
      )
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Arrange pickup' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Arrange exchange' })).toBeTruthy()
  })

  it('posts a donation request and calls onStarted with the transaction id', async () => {
    mockPost.mockResolvedValue({ id: 'tx1', toy_id: 'toy1', type: 'donation' })
    render(<RequestBlock toy={toy({ offer_type: 'donation' })} myToys={[]} myToysLoaded={true} myToysError={null} onStarted={mockOnStarted} />)
    fireEvent.press(screen.getByRole('button', { name: 'Arrange pickup' }))
    await waitFor(() => expect(mockOnStarted).toHaveBeenCalledWith('tx1'))
    expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions', { toy_id: 'toy1', type: 'donation' })
  })

  it('shows the add-a-toy error when Arrange exchange is pressed with no toys to offer', () => {
    render(<RequestBlock toy={toy({ offer_type: 'exchange' })} myToys={[]} myToysLoaded={true} myToysError={null} onStarted={mockOnStarted} />)
    fireEvent.press(screen.getByRole('button', { name: 'Arrange exchange' }))
    expect(screen.getByText('Add a toy to My Toys before you can offer an exchange.')).toBeTruthy()
    expect(screen.queryByText('Offer one of your toys')).toBeNull()
  })

  it('holds Arrange exchange disabled while the caller\'s own toys are still loading', () => {
    render(<RequestBlock toy={toy({ offer_type: 'exchange' })} myToys={[]} myToysLoaded={false} myToysError={null} onStarted={mockOnStarted} />)
    expect(screen.getByRole('button', { name: 'Arrange exchange' }).props.accessibilityState.disabled).toBe(true)
  })

  it('shows the load-failure copy, never the add-a-toy line, when the caller\'s own toys failed to load', () => {
    render(
      <RequestBlock
        toy={toy({ offer_type: 'exchange' })}
        myToys={[]}
        myToysLoaded={true}
        myToysError="Couldn't load your toys — try again."
        onStarted={mockOnStarted}
      />
    )
    fireEvent.press(screen.getByRole('button', { name: 'Arrange exchange' }))
    expect(screen.getByText("Couldn't load your toys — try again.")).toBeTruthy()
    expect(screen.queryByText('Add a toy to My Toys before you can offer an exchange.')).toBeNull()
    expect(screen.queryByText('Offer one of your toys')).toBeNull()
  })

  it('expands the chooser listing myToys, keeps Start exchange disabled until one is chosen, then posts the exchange body', async () => {
    mockPost.mockResolvedValue({ id: 'tx2', toy_id: 'toy1', type: 'exchange', offered_toy_id: 'mine1' })
    const myToys = [myToy({ id: 'mine1', name: 'Switch car' }), myToy({ id: 'mine2', name: 'Puzzle' })]
    render(<RequestBlock toy={toy({ offer_type: 'exchange' })} myToys={myToys} myToysLoaded={true} myToysError={null} onStarted={mockOnStarted} />)

    fireEvent.press(screen.getByRole('button', { name: 'Arrange exchange' }))
    expect(screen.getByText('Offer one of your toys')).toBeTruthy()
    expect(screen.getByText('Switch car')).toBeTruthy()
    expect(screen.getByText('Puzzle')).toBeTruthy()

    const startButton = screen.getByRole('button', { name: 'Start exchange' })
    expect(startButton.props.accessibilityState.disabled).toBe(true)

    fireEvent.press(screen.getByLabelText('Switch car'))
    // RN drops `disabled` from accessibilityState entirely when it's false
    // rather than keeping the explicit key, so this is "falsy", not "false".
    expect(screen.getByRole('button', { name: 'Start exchange' }).props.accessibilityState.disabled).toBeFalsy()

    fireEvent.press(screen.getByRole('button', { name: 'Start exchange' }))
    await waitFor(() => expect(mockOnStarted).toHaveBeenCalledWith('tx2'))
    expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions', {
      toy_id: 'toy1',
      type: 'exchange',
      offered_toy_id: 'mine1',
    })
  })

  it('shows a generic error when the request fails', async () => {
    mockPost.mockRejectedValue(new Error('API POST failed with status 500'))
    render(<RequestBlock toy={toy({ offer_type: 'donation' })} myToys={[]} myToysLoaded={true} myToysError={null} onStarted={mockOnStarted} />)
    fireEvent.press(screen.getByRole('button', { name: 'Arrange pickup' }))
    expect(await screen.findByText('Could not start this request. Please try again.')).toBeTruthy()
    expect(mockOnStarted).not.toHaveBeenCalled()
  })
})
