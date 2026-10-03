// Add a printer: what disables Add, what each outlier rate does, and what is
// written for each choice (owner, bed, pickup, materials).
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { AddPrinterScreen } from '../../../../components/printing/add-printer-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a) } }))
const mockBack = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: jest.fn() }) }))
let mockCaps: unknown
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: mockCaps }) }))

const PROFILE = { id: 'me', pickup_suburb: 'Newtown', pickup_state: 'NSW', pickup_postcode: '2042' }

beforeEach(() => {
  mockPost.mockReset().mockResolvedValue({})
  mockBack.mockReset()
  mockCaps = { profile: PROFILE, ledOrgs: [] }
})

const name = (v: string) => fireEvent.changeText(screen.getByLabelText('Make and model'), v)
const rate = (v: string) => fireEvent.changeText(screen.getByLabelText('Dollars per gram'), v)
const add = () => fireEvent.press(screen.getByText('Add printer'))
const body = () => mockPost.mock.calls[0]![1]

describe('when Add is available', () => {
  it('is off for an empty name and for a name of only spaces or newlines', () => {
    render(<AddPrinterScreen />)
    expect(screen.getByRole('button', { name: 'Add printer' })).toBeDisabled()
    name('     ')
    expect(screen.getByRole('button', { name: 'Add printer' })).toBeDisabled()
    name('\n\t')
    expect(screen.getByRole('button', { name: 'Add printer' })).toBeDisabled()
    add()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('is off once every material is unticked, and back on when one returns', () => {
    render(<AddPrinterScreen />)
    name('Ender')
    fireEvent.press(screen.getByText('PETG'))
    expect(screen.getByRole('button', { name: 'Add printer' })).toBeDisabled()
    fireEvent.press(screen.getByText('PLA'))
    expect(screen.getByRole('button', { name: 'Add printer' })).toBeEnabled()
  })

  it('limits the name to 80 characters and the cost note to 500, as the API does', () => {
    render(<AddPrinterScreen />)
    expect(screen.getByLabelText('Make and model').props.maxLength).toBe(80)
    expect(screen.getByLabelText('Why these costs').props.maxLength).toBe(500)
  })
})

describe('what is sent', () => {
  it('sends the defaults: PETG, a 220 mm cube, porch pickup, no rate, no owner organisation, and the profile’s place', async () => {
    render(<AddPrinterScreen />)
    name('Ender 3')
    add()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost).toHaveBeenCalledWith('/api/printers', {
      name: 'Ender 3',
      materials: ['PETG'],
      bed_x: 220,
      bed_y: 220,
      bed_z: 220,
      suburb: 'Newtown',
      state: 'NSW',
      postcode: '2042',
      notes: 'Porch pickup — They collect from your door, by arrangement',
      filament_cents_per_g: null,
      rate_note: null,
    })
    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('sends the materials in the order they were ticked, without the one that was unticked', async () => {
    render(<AddPrinterScreen />)
    name('Ender')
    fireEvent.press(screen.getByText('TPU'))
    fireEvent.press(screen.getByText('ABS'))
    fireEvent.press(screen.getByText('PETG'))
    add()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().materials).toEqual(['TPU', 'ABS'])
  })

  it.each([
    ['Small', 180],
    ['Standard', 220],
    ['Large', 256],
    ['Extra large', 300],
  ])('sends a %s bed as a %i mm cube', async (title, mm) => {
    render(<AddPrinterScreen />)
    name('Ender')
    fireEvent.press(screen.getByLabelText(new RegExp(`^${title},`)))
    add()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect([body().bed_x, body().bed_y, body().bed_z]).toEqual([mm, mm, mm])
  })

  it.each([
    ['Meet somewhere public', 'Meet somewhere public — A library or café you pick'],
    ['Post it', 'Post it — You post it and the family covers the satchel'],
  ])('writes the %s pickup into the printer’s notes', async (title, notes) => {
    render(<AddPrinterScreen />)
    name('Ender')
    fireEvent.press(screen.getByLabelText(new RegExp(`^${title},`)))
    add()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().notes).toBe(notes)
  })

  it('sends a name trimmed of the spaces around it', async () => {
    render(<AddPrinterScreen />)
    name('  Bambu P1S  ')
    add()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().name).toBe('Bambu P1S')
  })

  it.each(NAMES.filter((n) => n.label !== 'very long' && n.value.trim() === n.value))('sends a name with $label exactly as typed', async ({ value }) => {
    render(<AddPrinterScreen />)
    name(value)
    add()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().name).toBe(value)
  })

  it('sends an empty place, not "undefined", when the profile has no pickup place yet', async () => {
    mockCaps = { profile: { id: 'me' }, ledOrgs: [] }
    render(<AddPrinterScreen />)
    name('Ender')
    add()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect([body().suburb, body().state, body().postcode]).toEqual(['', '', ''])
  })

  it('still renders and sends before the profile has loaded', async () => {
    mockCaps = null
    render(<AddPrinterScreen />)
    name('Ender')
    add()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().postcode).toBe('')
  })

  it('offers the whose-machine choice only to a leader, and sends the organisation chosen', async () => {
    const { unmount } = render(<AddPrinterScreen />)
    expect(screen.queryByText('Whose machine')).toBeNull()
    unmount()
    mockCaps = { profile: PROFILE, ledOrgs: [{ id: 'org1', name: 'Library' }, { id: 'org2', name: 'Shed' }] }
    render(<AddPrinterScreen />)
    expect(screen.getByText('Whose machine')).toBeTruthy()
    name('Bench')
    fireEvent.press(screen.getByText('Shed'))
    add()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().owner_org_id).toBe('org2')
  })

  it('sends no owner organisation after choosing an organisation and then Mine again', async () => {
    mockCaps = { profile: PROFILE, ledOrgs: [{ id: 'org1', name: 'Library' }] }
    render(<AddPrinterScreen />)
    name('Bench')
    fireEvent.press(screen.getByText('Library'))
    fireEvent.press(screen.getByText('Mine'))
    add()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body()).not.toHaveProperty('owner_org_id')
  })
})

describe('the filament rate', () => {
  it.each([
    ['0.12', 12],
    ['0.1', 10],
    ['1', 100],
    ['12.5', 1250],
    ['0', 0],
    ['0.00', 0],
    ['$0.12', 12],
    [' 0.12 ', 12],
    ['1000', 100_000],
  ])('sends %p as %i cents', async (typed, cents) => {
    render(<AddPrinterScreen />)
    name('Ender')
    rate(typed)
    add()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().filament_cents_per_g).toBe(cents)
  })

  it.each([
    ['whitespace only', '   '],
    ['empty', ''],
  ])('sends %s as no rate (free), not as an error', async (_l, typed) => {
    render(<AddPrinterScreen />)
    name('Ender')
    rate(typed)
    add()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().filament_cents_per_g).toBeNull()
  })

  it.each([
    ['negative', '-0.12'],
    ['three decimals', '0.125'],
    ['exponent', '1e3'],
    ['NaN', 'NaN'],
    ['Infinity', 'Infinity'],
    ['comma decimal', '0,12'],
    ['no leading digit', '.12'],
    ['a unit', '0.12/g'],
    ['text', 'free'],
    ['emoji', '💸'],
    ['ten digits', '1000000000'],
  ])('refuses %s before any request, and says what is wanted', (_l, typed) => {
    render(<AddPrinterScreen />)
    name('Ender')
    rate(typed)
    add()
    expect(screen.getByText('Filament cost is dollars per gram, like 0.12.')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('shows the API’s ceiling sentence for a rate over $1000 a gram, and keeps the form', async () => {
    mockPost.mockRejectedValue(new Error('failed with status 400: Filament cost is whole cents per gram, up to $1000.'))
    render(<AddPrinterScreen />)
    name('Ender')
    rate('1000.01')
    add()
    expect(await screen.findByText('Filament cost is whole cents per gram, up to $1000.')).toBeTruthy()
    expect(body().filament_cents_per_g).toBe(100_001)
    expect(mockBack).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Dollars per gram').props.value).toBe('1000.01')
  })

  it('says nothing is listed only while the rate box is empty', () => {
    render(<AddPrinterScreen />)
    const line = 'Nothing listed — your card will say you cover everything yourself.'
    expect(screen.getByText(line)).toBeTruthy()
    rate('0.12')
    expect(screen.queryByText(line)).toBeNull()
    rate('  ')
    expect(screen.getByText(line)).toBeTruthy()
  })

  it('sends the cost note trimmed, and null for a blank one', async () => {
    render(<AddPrinterScreen />)
    name('Ender')
    fireEvent.changeText(screen.getByLabelText('Why these costs'), '  spool cost  ')
    add()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(body().rate_note).toBe('spool cost')
  })

  it('clears a rate error once the rate is fixed and Add succeeds', async () => {
    render(<AddPrinterScreen />)
    name('Ender')
    rate('abc')
    add()
    expect(screen.getByText('Filament cost is dollars per gram, like 0.12.')).toBeTruthy()
    rate('0.12')
    add()
    await waitFor(() => expect(mockBack).toHaveBeenCalled())
    expect(screen.queryByText('Filament cost is dollars per gram, like 0.12.')).toBeNull()
  })
})

describe('saving', () => {
  it('posts once however many times Add is tapped while it is in flight, then goes back once', async () => {
    let finish!: (v: object) => void
    mockPost.mockReturnValue(new Promise((r) => (finish = r)))
    render(<AddPrinterScreen />)
    name('Ender')
    fireEvent.press(screen.getByRole('button', { name: 'Add printer' }))
    fireEvent.press(screen.getByRole('button', { name: 'Add printer' }))
    expect(mockPost).toHaveBeenCalledTimes(1)
    await act(async () => finish({}))
    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a 400 shows the API sentence', new Error('failed with status 400: Postcode is four digits.'), 'Postcode is four digits.'],
    ['a 403 shows the API sentence', new Error('failed with status 403: Only a leader can add a printer for an organisation.'), 'Only a leader can add a printer for an organisation.'],
    ['a 429 shows the API sentence', new Error('failed with status 429: Slow down.'), 'Slow down.'],
    ['a 500 keeps the generic apology', new Error('failed with status 500: boom'), 'That did not save. Check your connection and try again.'],
    ['offline says so', new Error('Network request failed'), "You're offline. Check your connection and try again."],
  ])('%s, and does not go back', async (_l, failure, message) => {
    mockPost.mockRejectedValue(failure)
    render(<AddPrinterScreen />)
    name('Ender')
    add()
    expect(await screen.findByText(message)).toBeTruthy()
    expect(mockBack).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Add printer' })).toBeEnabled()
  })

  it('keeps what was typed after a failure and sends it again on retry', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network request failed'))
    render(<AddPrinterScreen />)
    name('Ender')
    rate('0.2')
    add()
    await screen.findByText("You're offline. Check your connection and try again.")
    add()
    await waitFor(() => expect(mockBack).toHaveBeenCalled())
    expect(mockPost).toHaveBeenCalledTimes(2)
    expect(mockPost.mock.calls[1]![1]).toMatchObject({ name: 'Ender', filament_cents_per_g: 20 })
    expect(screen.queryByText("You're offline. Check your connection and try again.")).toBeNull()
  })
})
