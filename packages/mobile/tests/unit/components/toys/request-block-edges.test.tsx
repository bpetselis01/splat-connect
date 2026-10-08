// Asking for a toy: double taps, refused requests, and a toy list that changes
// shape. The ordinary copy and offer_type gating live in request-block.test.tsx.
// journeys: Y06
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import type { Toy, ToyWithOwner } from '@splat-connect/types'
import { RequestBlock } from '../../../../components/toys/request-block'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a) } }))

const toy = (over: Partial<ToyWithOwner> = {}): ToyWithOwner =>
  ({ id: 'toy1', owner_id: 'owner1', owner_org_id: null, quantity: 1, name: 'Bubble machine', condition: 8, switch_adapted: false,
    photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'published', offer_type: 'both', created_at: '', updated_at: '',
    profiles: { name: 'Jamie' }, organizations: null, ...over }) as unknown as ToyWithOwner
const mine = (id: string, name: string): Toy =>
  ({ id, owner_id: 'u1', owner_org_id: null, quantity: 1, name, condition: 6, switch_adapted: false, photo_urls: [], cover_photo_url: null,
    switch_photo_url: null, status: 'published', offer_type: null, created_at: '', updated_at: '' }) as unknown as Toy
const block = (over: Partial<React.ComponentProps<typeof RequestBlock>> = {}) => (
  <RequestBlock toy={toy()} myToys={[mine('m1', 'Switch car')]} myToysLoaded myToysError={null} onStarted={jest.fn()} {...over} />
)

beforeEach(() => jest.clearAllMocks())

describe('asking to collect', () => {
  it('sends one request when Ask to collect it is pressed twice before the answer', async () => {
    const onStarted = jest.fn()
    let resolve!: (v: object) => void
    mockPost.mockReturnValue(new Promise((r) => (resolve = r)))
    render(block({ onStarted }))
    fireEvent.press(screen.getByText('Ask to collect it'))
    fireEvent.press(screen.getByText('Ask to collect it'))
    expect(mockPost).toHaveBeenCalledTimes(1)
    await act(async () => resolve({ id: 'tx9' }))
    expect(onStarted).toHaveBeenCalledTimes(1)
    expect(onStarted).toHaveBeenCalledWith('tx9')
  })

  it('lets the family try again after a failed request, and starts the thread when it works', async () => {
    const onStarted = jest.fn()
    mockPost.mockRejectedValueOnce(new Error('API POST /x failed with status 500')).mockResolvedValueOnce({ id: 'tx9' })
    render(block({ onStarted }))
    fireEvent.press(screen.getByText('Ask to collect it'))
    expect(await screen.findByText('Could not start this request. Please try again.')).toBeTruthy()
    fireEvent.press(screen.getByText('Ask to collect it'))
    await waitFor(() => expect(onStarted).toHaveBeenCalledWith('tx9'))
    expect(screen.queryByText('Could not start this request. Please try again.')).toBeNull()
  })

  it.each([
    ['a paused toy', 'API POST /x failed with status 409: This toy is not taking requests right now', 'This toy is not taking requests right now'],
    ['an offer type the toy does not take', 'API POST /x failed with status 400: This toy is not offered for that request type', 'This toy is not offered for that request type'],
    ['an offered toy already in an exchange', 'API POST /x failed with status 409: That toy is already offered in another open exchange', 'That toy is already offered in another open exchange'],
  ])('tells the family why when the API refuses %s', async (_what, thrown, shown) => {
    mockPost.mockRejectedValue(new Error(thrown))
    render(block())
    fireEvent.press(screen.getByText('Ask to collect it'))
    expect(await screen.findByText(shown)).toBeTruthy()
  })

  it('says the phone is offline when the request never leaves it', async () => {
    mockPost.mockRejectedValue(new TypeError('Network request failed'))
    render(block())
    fireEvent.press(screen.getByText('Ask to collect it'))
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy()
  })

  it('asks the family to wait when the API rate-limits the request', async () => {
    mockPost.mockRejectedValue(new Error('API POST /x failed with status 429'))
    render(block())
    fireEvent.press(screen.getByText('Ask to collect it'))
    expect(await screen.findByText('Too many tries. Wait a minute and try again.')).toBeTruthy()
  })
})

describe('offering an exchange', () => {
  async function choose(name = 'Switch car') {
    fireEvent.press(screen.getByText('Arrange exchange'))
    fireEvent.press(screen.getByRole('radio', { name }))
  }

  it('sends one exchange when Start exchange is pressed twice before the answer', async () => {
    mockPost.mockReturnValue(new Promise(() => {}))
    render(block())
    await choose()
    fireEvent.press(screen.getByText('Start exchange'))
    fireEvent.press(screen.getByText('Starting…'))
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions', { toy_id: 'toy1', type: 'exchange', offered_toy_id: 'm1' })
  })

  it('offers the toy chosen last when the family changes their mind', async () => {
    mockPost.mockResolvedValue({ id: 'tx9' })
    render(block({ myToys: [mine('m1', 'Switch car'), mine('m2', 'Drum')] }))
    await choose('Switch car')
    fireEvent.press(screen.getByRole('radio', { name: 'Drum' }))
    fireEvent.press(screen.getByText('Start exchange'))
    await waitFor(() => expect(mockPost.mock.calls[0][1].offered_toy_id).toBe('m2'))
  })

  it('shows the API reason when the offered toy is refused, and keeps the choice', async () => {
    mockPost.mockRejectedValue(new Error('API POST /x failed with status 400: Choose one of your own, active toys to offer'))
    render(block())
    await choose()
    fireEvent.press(screen.getByText('Start exchange'))
    expect(await screen.findByText('Choose one of your own, active toys to offer')).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Switch car' }).props.accessibilityState.selected).toBe(true)
  })

  it.each(NAMES.filter((n) => !/spaces/.test(n.label)))('draws an offered toy named with $label text', async ({ value }) => {
    render(block({ myToys: [mine('m1', value)] }))
    fireEvent.press(screen.getByText('Arrange exchange'))
    expect(screen.getByRole('radio', { name: value })).toBeTruthy()
  })

  it('draws a single toy to offer without selecting it for them', () => {
    render(block())
    fireEvent.press(screen.getByText('Arrange exchange'))
    expect(screen.getAllByRole('radio')).toHaveLength(1)
    expect(screen.getByText('Start exchange').props).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start exchange' }).props.accessibilityState.disabled).toBe(true)
  })

  it('draws a long list of toys to offer', () => {
    const many = Array.from({ length: 60 }, (_, i) => mine(`m${i}`, `Toy ${i}`))
    render(block({ myToys: many }))
    fireEvent.press(screen.getByText('Arrange exchange'))
    expect(screen.getAllByRole('radio')).toHaveLength(60)
  })

  it('names the load failure rather than asking for a toy when the family\'s own toys failed', () => {
    render(block({ myToys: [], myToysError: 'Could not load your toys.' }))
    fireEvent.press(screen.getByText('Arrange exchange'))
    expect(screen.getByText('Could not load your toys.')).toBeTruthy()
    expect(screen.queryByText(/Add a toy to My Toys/)).toBeNull()
    expect(mockPost).not.toHaveBeenCalled()
  })
})

describe('a toy that cannot be asked for', () => {
  it('shows no buttons on a paused toy even when it is offered', () => {
    render(block({ toy: toy({ paused_at: '2026-10-01T00:00:00Z' } as Partial<ToyWithOwner>) }))
    expect(screen.getByText('Not taking requests right now')).toBeTruthy()
    expect(screen.queryByText('Ask to collect it')).toBeNull()
    expect(screen.queryByText('Arrange exchange')).toBeNull()
  })
})
