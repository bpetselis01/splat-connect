// The contributor's recycling screen under awkward input and failure: weights,
// notes, a second tap, a refused booking, empty and one-row lists.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { DECLARATION_VERSION, RECYCLING_DECLARATION } from '@splat-connect/types'
import { RecyclingScreen } from '../../../../components/recycling/recycling-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []), useRouter: () => ({ push: jest.fn() }) }
})
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { id: 'me' }, ledOrgs: [] }, loading: false, refresh: jest.fn() }),
}))
let mockPermission = true
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: () => Promise.resolve({ granted: mockPermission }),
  launchImageLibraryAsync: () => Promise.resolve({ canceled: true }),
}))
jest.mock('../../../../lib/upload', () => ({ uploadFile: jest.fn() }))

const ORG = (over: object = {}) => ({
  id: 'north', name: 'Northside Therapy', status: 'active', suburb: 'Crows Nest', state: 'NSW',
  recycling_materials: ['PLA', 'PETG'], recycling_note: null, recycling_machines: [], recycling_forms: [],
  recycling_min_kg: null, recycling_max_kg: null, recycling_turnaround: null, recycling_gives: 'credit',
  recycling_hours: null, recycling_door: null, ...over,
})
const DROP = (over: object = {}) => ({
  id: 'd1', org_id: 'north', contributor_id: 'me', material: 'PLA', estimated_grams: 2000, status: 'booked',
  weighed_grams: null, credit_grams: null, created_at: '2026-09-01T00:00:00Z', ...over,
})
function serve({ orgs = [ORG()], mine = [] as object[], credit = [] as object[] } = {}) {
  mockGet.mockImplementation((path: string) =>
    path === '/api/public/organizations' ? Promise.resolve(orgs)
      : path === '/api/organizations/recycling/mine' ? Promise.resolve(mine)
      : path === '/api/organizations/recycling/credit' ? Promise.resolve(credit)
      : Promise.reject(new Error('unexpected ' + path))
  )
}
const WEIGHT = 'How much, roughly, in kilograms'
async function openForm(orgName = 'Northside Therapy') {
  render(<RecyclingScreen />)
  fireEvent.press(await screen.findByLabelText(`Book a drop-off at ${orgName}`))
}
const tickAll = () => RECYCLING_DECLARATION.forEach((l) => fireEvent.press(screen.getByLabelText(l)))
const book = () => screen.getByLabelText('Book the drop-off')

beforeEach(() => {
  jest.clearAllMocks()
  mockPermission = true
  serve()
  mockPost.mockResolvedValue({})
})

describe('the list with little or nothing in it', () => {
  it('says nothing is booked yet and nobody takes plastic, with zero kilos and zero credit', async () => {
    serve({ orgs: [], mine: [], credit: [] })
    render(<RecyclingScreen />)
    expect(await screen.findByText('Nothing yet. Two kilos is the smallest useful drop.')).toBeTruthy()
    expect(screen.getByText(/No organisation is taking plastic right now/)).toBeTruthy()
    expect(screen.getByText('0 g of print credit unspent')).toBeTruthy()
    expect(screen.getByText('First drop').props).toBeTruthy()
    expect(screen.getByText('0.1 kg to go')).toBeTruthy()
  })

  it('sums credit held at several organisations into one figure', async () => {
    serve({ credit: [{ org_id: 'a', grams: 1500, weighed_grams: 2000 }, { org_id: 'b', grams: 2500, weighed_grams: 3000 }, { org_id: 'c', grams: 0, weighed_grams: 2000 }] })
    render(<RecyclingScreen />)
    expect(await screen.findByText('4,000 g of print credit unspent')).toBeTruthy()
  })

  it('draws one organisation with its single polymer', async () => {
    serve({ orgs: [ORG({ recycling_materials: ['PP'] })] })
    render(<RecyclingScreen />)
    expect(await screen.findByText('PP')).toBeTruthy()
  })

  it('shows a received drop with no credit recorded as a dash, never undefined or NaN', async () => {
    serve({ mine: [DROP({ status: 'received', weighed_grams: 2500, credit_grams: null })] })
    render(<RecyclingScreen />)
    expect(await screen.findByText('2.5 kg PLA')).toBeTruthy()
    expect(screen.queryByText(/NaN|undefined|null/)).toBeNull()
  })

  it('offers Try again after the lists fail, then draws them', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockGet.mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline'))
    render(<RecyclingScreen />)
    expect(await screen.findByText("Couldn't load recycling — try again.")).toBeTruthy()
    serve({ orgs: [ORG()] })
    fireEvent.press(screen.getByText('Try again'))
    expect(await screen.findByText('Northside Therapy')).toBeTruthy()
  })

  it.each(NAMES.filter((n) => !/spaces/.test(n.label)))('draws an organisation named with $label text', async ({ value }) => {
    serve({ orgs: [ORG({ name: value })] })
    render(<RecyclingScreen />)
    expect(await screen.findByText(value)).toBeTruthy()
    expect(screen.getByLabelText(`Book a drop-off at ${value}`)).toBeTruthy()
  })
})

describe('cancelling a booking', () => {
  it('puts the list back from the server when the cancel is refused', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    serve({ mine: [DROP()] })
    mockPost.mockRejectedValue(new Error('API POST /x failed with status 409: Already received'))
    render(<RecyclingScreen />)
    fireEvent.press(await screen.findByLabelText('Cancel the PLA drop-off'))
    await waitFor(() => expect(mockGet.mock.calls.filter(([p]) => p === '/api/organizations/recycling/mine').length).toBeGreaterThan(1))
  })

  it('offers no cancel on a received, declined or cancelled drop-off', async () => {
    serve({ mine: [DROP({ id: 'a', status: 'received', weighed_grams: 2000, credit_grams: 1500 }), DROP({ id: 'b', status: 'declined' }), DROP({ id: 'c', status: 'cancelled' })] })
    render(<RecyclingScreen />)
    await screen.findByText('Credited')
    expect(screen.queryByLabelText(/^Cancel the/)).toBeNull()
  })
})

describe('the weight box', () => {
  it.each(['', '0', '1.999', '-3', '2,5', 'abc', '1e3', '2.5555', '٣'])('holds the booking for %j and shows no worth', async (typed) => {
    await openForm()
    fireEvent.changeText(screen.getByLabelText(WEIGHT), typed)
    tickAll()
    expect(book().props.accessibilityState.disabled).toBe(true)
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('takes exactly two kilos and shows three quarters of it as the estimate', async () => {
    await openForm()
    fireEvent.changeText(screen.getByLabelText(WEIGHT), '2')
    tickAll()
    expect(book().props.accessibilityState.disabled).toBe(false)
    expect(screen.getByText('1,500 g')).toBeTruthy()
  })

  it('rounds the estimate down to a whole gram', async () => {
    await openForm()
    fireEvent.changeText(screen.getByLabelText(WEIGHT), '2.003')
    expect(screen.getByText('1,502 g')).toBeTruthy()
  })

  it('says under two kilos in the hint for 1.5 kg', async () => {
    await openForm()
    fireEvent.changeText(screen.getByLabelText(WEIGHT), '1.5')
    expect(screen.getByText('Under the 2 kg minimum — hold on to it.')).toBeTruthy()
  })

  it('honours an organisation minimum above the platform floor, to the gram', async () => {
    serve({ orgs: [ORG({ recycling_min_kg: 2.5, recycling_max_kg: 8 })] })
    await openForm()
    fireEvent.changeText(screen.getByLabelText(WEIGHT), '2.499')
    tickAll()
    expect(book().props.accessibilityState.disabled).toBe(true)
    fireEvent.changeText(screen.getByLabelText(WEIGHT), '2.5')
    expect(book().props.accessibilityState.disabled).toBe(false)
  })

  it('takes exactly the organisation maximum and holds one gram over', async () => {
    serve({ orgs: [ORG({ recycling_max_kg: 8 })] })
    await openForm()
    tickAll()
    fireEvent.changeText(screen.getByLabelText(WEIGHT), '8')
    expect(book().props.accessibilityState.disabled).toBe(false)
    fireEvent.changeText(screen.getByLabelText(WEIGHT), '8.001')
    expect(book().props.accessibilityState.disabled).toBe(true)
  })
})

describe('booking', () => {
  async function ready(weight = '2.5') {
    await openForm()
    fireEvent.changeText(screen.getByLabelText(WEIGHT), weight)
    tickAll()
  }

  it('leaves out the photo and sends an empty note when neither was given', async () => {
    await ready()
    fireEvent.press(book())
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    const body = mockPost.mock.calls[0][1]
    expect(body).toEqual({ material: 'PLA', estimated_grams: 2500, condition_declared: true, declaration_version: DECLARATION_VERSION, note: '' })
    expect('photo_url' in body).toBe(false)
  })

  it('books once when the button is pressed twice before the answer', async () => {
    mockPost.mockReturnValue(new Promise(() => {}))
    await ready()
    fireEvent.press(book())
    fireEvent.press(book())
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it.each(NAMES.filter((n) => !/spaces|long/.test(n.label)).concat([{ label: 'quotes', value: `He said "<hi>" & 100% \\ it's` }]))(
    'sends a $label note as typed',
    async ({ value }) => {
      await ready()
      fireEvent.changeText(screen.getByLabelText('Anything they should know (optional)'), value)
      fireEvent.press(book())
      await waitFor(() => expect(mockPost.mock.calls[0][1].note).toBe(value))
    }
  )

  it('trims the note, and sends an all-spaces note as empty', async () => {
    await ready()
    fireEvent.changeText(screen.getByLabelText('Anything they should know (optional)'), '   \n  ')
    fireEvent.press(book())
    await waitFor(() => expect(mockPost.mock.calls[0][1].note).toBe(''))
  })

  it('shows the API reason and keeps the form filled in when the booking is refused', async () => {
    mockPost.mockRejectedValue(new Error('API POST /x failed with status 400: This declaration is out of date.'))
    await ready()
    fireEvent.press(book())
    expect(await screen.findByText('This declaration is out of date.')).toBeTruthy()
    expect(screen.getByLabelText(WEIGHT).props.value).toBe('2.5')
    expect(book().props.accessibilityState.disabled).toBeFalsy()
  })

  it('says the phone is offline, and lets it be tried again, when the request never leaves', async () => {
    mockPost.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce({})
    await ready()
    fireEvent.press(book())
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy()
    fireEvent.press(book())
    expect(await screen.findByText('Booked — Northside Therapy expects about 2.5 kg.')).toBeTruthy()
  })

  it('falls back to a plain line on a server error', async () => {
    mockPost.mockRejectedValue(new Error('API POST /x failed with status 500: pg: boom'))
    await ready()
    fireEvent.press(book())
    expect(await screen.findByText('That did not book. Try once more.')).toBeTruthy()
  })

  it('goes back to the list from the form without booking', async () => {
    await ready()
    fireEvent.press(screen.getByText('All organisations'))
    expect(await screen.findByLabelText('Book a drop-off at Northside Therapy')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('un-ticks a declaration line on a second tap and holds the booking again', async () => {
    await ready()
    fireEvent.press(screen.getByLabelText(RECYCLING_DECLARATION[0]))
    expect(book().props.accessibilityState.disabled).toBe(true)
    expect(screen.getByText('1 declaration line still to tick.')).toBeTruthy()
  })

  it('asks for photo access in words when it is refused', async () => {
    mockPermission = false
    await ready()
    fireEvent.press(screen.getByLabelText('Photo of the sorted plastic'))
    expect(await screen.findByText('Photo library access is needed to choose a photo.')).toBeTruthy()
  })

  it('does nothing, and shows no error, when the photo picker is cancelled', async () => {
    await ready()
    fireEvent.press(screen.getByLabelText('Photo of the sorted plastic'))
    await act(async () => {})
    expect(screen.queryByText(/Could not upload/)).toBeNull()
    expect(book().props.accessibilityState.disabled).toBe(false)
  })
})
