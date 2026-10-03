// Adding a toy with awkward names and quantities, a second tap, and refusals.
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import NewToyRoute from '../../../app/(my)/toys/new'
import { NAMES } from '../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockReplace = jest.fn()
let mockParams: { org?: string } = {}
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }), useLocalSearchParams: () => mockParams }))
let mockLedOrgs: { id: string; name: string }[] = []
jest.mock('../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: { ledOrgs: mockLedOrgs } }) }))
const mockPost = jest.fn()
jest.mock('../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a) } }))
jest.mock('../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const create = () => screen.getByLabelText('Create')
const name = (t: string) => fireEvent.changeText(screen.getByPlaceholderText('Name'), t)

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = {}
  mockLedOrgs = []
  mockPost.mockResolvedValue({ id: 'toy1' })
})

describe('the name', () => {
  it.each(['', ' ', '\n\t  '])('holds Create for a name of %j', (typed) => {
    render(<NewToyRoute />)
    name(typed)
    expect(create().props.accessibilityState.disabled).toBe(true)
    fireEvent.press(create())
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('sends the name without the spaces around it', async () => {
    render(<NewToyRoute />)
    name('  Bubble machine \n')
    fireEvent.press(create())
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toys', { name: 'Bubble machine', condition: 5 }))
  })

  it.each(NAMES.filter((n) => !/spaces/.test(n.label)))('sends a name with $label text as typed', async ({ value }) => {
    render(<NewToyRoute />)
    name(value)
    fireEvent.press(create())
    await waitFor(() => expect(mockPost.mock.calls[0][1].name).toBe(value))
  })
})

describe('the quantity an organisation holds', () => {
  beforeEach(() => {
    mockLedOrgs = [{ id: 'org1', name: 'Toy Shed' }]
    mockParams = { org: 'org1' }
  })
  const qty = (t: string) => fireEvent.changeText(screen.getByLabelText('How many do you hold'), t)

  it.each([
    ['', ''],
    ['0', '0'],
    ['-4', '4'],
    ['2.5', '25'],
    ['1e3', '13'],
    ['abc', ''],
    ['٣', ''],
  ])('keeps only the digits of a quantity typed as %j', (typed, kept) => {
    render(<NewToyRoute />)
    qty(typed)
    expect(screen.getByLabelText('How many do you hold').props.value).toBe(kept)
  })

  it.each(['', '0', '000', 'abc'])('holds Create for a quantity of %j', (typed) => {
    render(<NewToyRoute />)
    name('Drum')
    qty(typed)
    expect(create().props.accessibilityState.disabled).toBe(true)
  })

  it('takes a quantity of exactly one and sends a padded one as its number', async () => {
    render(<NewToyRoute />)
    name('Drum')
    qty('1')
    expect(create().props.accessibilityState.disabled).toBe(false)
    qty('007')
    fireEvent.press(create())
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toys', { name: 'Drum', condition: 5, owner_org_id: 'org1', quantity: 7 }))
  })

  it('sends a huge quantity as a number and shows the API reason when it is refused', async () => {
    mockPost.mockRejectedValue(new Error('API POST /api/toys failed with status 400: Quantity must be a whole number, 1 or more'))
    render(<NewToyRoute />)
    name('Drum')
    qty('99999999999999999999')
    fireEvent.press(create())
    expect(await screen.findByText('Quantity must be a whole number, 1 or more')).toBeTruthy()
  })

  it('ignores an org id in the link that the caller does not lead', () => {
    mockParams = { org: 'someone-elses' }
    render(<NewToyRoute />)
    expect(screen.queryByLabelText('How many do you hold')).toBeNull()
  })
})

describe('creating', () => {
  it('creates once when Create is pressed twice before the answer', async () => {
    mockPost.mockReturnValue(new Promise(() => {}))
    render(<NewToyRoute />)
    name('Drum')
    fireEvent.press(create())
    fireEvent.press(create())
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it.each([1, 10])('creates with condition %i', async (c) => {
    render(<NewToyRoute />)
    name('Drum')
    fireEvent.press(screen.getByLabelText(String(c)))
    fireEvent.press(create())
    await waitFor(() => expect(mockPost.mock.calls[0][1].condition).toBe(c))
  })

  it('shows the API reason when the create is refused, keeps the name, and goes nowhere', async () => {
    mockPost.mockRejectedValue(new Error('API POST /api/toys failed with status 403: You do not lead that organisation'))
    render(<NewToyRoute />)
    name('Drum')
    fireEvent.press(create())
    expect(await screen.findByText('You do not lead that organisation')).toBeTruthy()
    expect(screen.getByPlaceholderText('Name').props.value).toBe('Drum')
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('says the phone is offline, and lets the family try again', async () => {
    mockPost.mockRejectedValueOnce(new TypeError('Network request failed'))
    render(<NewToyRoute />)
    name('Drum')
    fireEvent.press(create())
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy()
    fireEvent.press(create())
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/toys/toy1/edit'))
  })

  it('falls back to a plain sentence on a server error', async () => {
    mockPost.mockRejectedValue(new Error('API POST /api/toys failed with status 500: pg boom'))
    render(<NewToyRoute />)
    name('Drum')
    fireEvent.press(create())
    expect(await screen.findByText('Could not create this toy. Please try again.')).toBeTruthy()
  })
})
