// The leader's weigh-in, where credit is minted. Every case here is a way the
// number typed could be wrong, or a button pressed twice, before a credit
// reaches a member's balance.
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { IntakeScreen } from '../../../../components/recycling/intake-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
const mockGet = jest.fn()
const mockPatch = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), patch: (...a: unknown[]) => mockPatch(...a) },
}))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []) }
})
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({
    caps: { profile: { id: 'lee', name: 'Lee' }, isAdmin: false, ledOrgs: [{ id: 'org1', name: 'N' }], unread: {}, exchangeActions: 0 },
    loading: false,
    refresh: jest.fn(),
  }),
}))

const ORG = { id: 'org1', name: 'N', recycling_materials: ['PLA'], recycling_note: null, recycling_machines: [], recycling_forms: [], recycling_min_kg: null, recycling_max_kg: null, recycling_turnaround: null, recycling_gives: 'credit', recycling_hours: null, recycling_door: null }
const drop = (over: object = {}) => ({
  id: 'd1', org_id: 'org1', contributor_id: 'tom', contributor_name: 'Tom Beattie', material: 'PLA', estimated_grams: 2600,
  condition_declared: true, declaration_version: 'v1-2026-09', photo_url: null, note: null, status: 'booked',
  weighed_grams: null, credit_grams: null, decided_by: null, created_at: '2026-09-20T00:00:00Z', updated_at: '2026-09-20T00:00:00Z', ...over,
})
const serve = (drops: object[], org: object = ORG) =>
  mockGet.mockImplementation((p: string) =>
    p === '/api/organizations/org1' ? Promise.resolve(org) : p === '/api/organizations/org1/recycling' ? Promise.resolve(drops) : Promise.reject(new Error('404'))
  )
const actual = () => screen.getByLabelText('Actual, in kilograms')
const creditBox = () => screen.getByLabelText('Credit, in grams')
const weigh = () => screen.getByLabelText("Weigh and credit Tom Beattie's drop-off")
const turnAway = () => screen.getByLabelText("Turn away Tom Beattie's drop-off as contaminated")

beforeEach(() => {
  jest.clearAllMocks()
  serve([drop()])
  mockPatch.mockResolvedValue({})
})

describe('the weight and credit boxes', () => {
  it.each(['', '0', 'abc', '-3', '2,6', '1.949', '٣', '1e3'])('hold Weigh and credit for a weight of %j and send nothing', async (typed) => {
    render(<IntakeScreen />)
    await screen.findByText('Tom Beattie')
    fireEvent.changeText(actual(), typed)
    expect(weigh().props.accessibilityState.disabled).toBe(true)
    fireEvent.press(weigh())
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it.each(['-1', '1.5', '1,500', 'abc', '', '  ', '1e3'])('hold Weigh and credit for a credit of %j', async (typed) => {
    render(<IntakeScreen />)
    await screen.findByText('Tom Beattie')
    fireEvent.changeText(actual(), '3')
    fireEvent.changeText(creditBox(), typed)
    expect(screen.getByText('Enter the credit in whole grams.')).toBeTruthy()
    expect(weigh().props.accessibilityState.disabled).toBe(true)
  })

  it('L13 credits exactly the rounded weight, and sends it as whole grams', async () => {
    render(<IntakeScreen />)
    await screen.findByText('Tom Beattie')
    fireEvent.changeText(actual(), '3.04')
    fireEvent.changeText(creditBox(), '3000')
    fireEvent.press(weigh())
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/organizations/org1/recycling/d1', { status: 'received', weighed_grams: 3000, credit_grams: 3000 }))
  })

  it('L13 credits nothing when the leader types zero, and sends that zero', async () => {
    render(<IntakeScreen />)
    await screen.findByText('Tom Beattie')
    fireEvent.changeText(actual(), '3')
    fireEvent.changeText(creditBox(), '0')
    fireEvent.press(weigh())
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/organizations/org1/recycling/d1', { status: 'received', weighed_grams: 3000, credit_grams: 0 }))
  })

  it('L13 refuses one gram more than the weight', async () => {
    render(<IntakeScreen />)
    await screen.findByText('Tom Beattie')
    fireEvent.changeText(actual(), '3')
    fireEvent.changeText(creditBox(), '3001')
    expect(screen.getByText('Credit cannot be more than what was weighed.')).toBeTruthy()
    fireEvent.press(weigh())
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('shows no credit and a prompt again after the weight is cleared', async () => {
    render(<IntakeScreen />)
    await screen.findByText('Tom Beattie')
    fireEvent.changeText(actual(), '3')
    expect(creditBox().props.value).toBe('2250')
    fireEvent.changeText(actual(), '')
    expect(creditBox().props.value).toBe('')
    expect(screen.getByText('Weigh it to see the credit')).toBeTruthy()
  })
})

describe('deciding twice', () => {
  it('L13 sends one weigh-in when Weigh and credit is pressed twice before the answer', async () => {
    mockPatch.mockReturnValue(new Promise(() => {}))
    render(<IntakeScreen />)
    await screen.findByText('Tom Beattie')
    fireEvent.changeText(actual(), '3')
    fireEvent.press(weigh())
    fireEvent.press(weigh())
    expect(mockPatch).toHaveBeenCalledTimes(1)
  })

  it('L14 sends one turn-away when Contaminated is pressed twice', async () => {
    mockPatch.mockReturnValue(new Promise(() => {}))
    render(<IntakeScreen />)
    await screen.findByText('Tom Beattie')
    fireEvent.press(turnAway())
    fireEvent.press(turnAway())
    expect(mockPatch).toHaveBeenCalledTimes(1)
  })

  it('L14 does not send a weight with a turn-away even when one was typed', async () => {
    render(<IntakeScreen />)
    await screen.findByText('Tom Beattie')
    fireEvent.changeText(actual(), '3')
    fireEvent.press(turnAway())
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/organizations/org1/recycling/d1', { status: 'declined' }))
  })

  it('L13 reloads the queue after a weigh-in so the row moves to Weighed in', async () => {
    render(<IntakeScreen />)
    await screen.findByText('Tom Beattie')
    serve([drop({ status: 'received', weighed_grams: 3000, credit_grams: 2250 })])
    fireEvent.changeText(actual(), '3')
    fireEvent.press(weigh())
    expect(await screen.findByText('Weighed 3.0 kg · credited 2,250 g · PLA')).toBeTruthy()
    expect(screen.queryByLabelText(/Weigh and credit/)).toBeNull()
  })
})

describe('a refused or lost weigh-in', () => {
  it('L13 shows the API reason, keeps the typed numbers and re-enables the button', async () => {
    mockPatch.mockRejectedValue(new Error('API PATCH /x failed with status 400: Credit cannot be more than what was weighed.'))
    render(<IntakeScreen />)
    await screen.findByText('Tom Beattie')
    fireEvent.changeText(actual(), '3')
    fireEvent.changeText(creditBox(), '2000')
    fireEvent.press(weigh())
    expect((await screen.findAllByText('Credit cannot be more than what was weighed.')).length).toBeGreaterThan(0)
    expect(actual().props.value).toBe('3')
    expect(creditBox().props.value).toBe('2000')
    expect(weigh().props.accessibilityState.disabled).toBeFalsy()
  })

  it('says offline, and lets the leader press again, when the request never leaves', async () => {
    mockPatch.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce({})
    render(<IntakeScreen />)
    await screen.findByText('Tom Beattie')
    fireEvent.changeText(actual(), '3')
    fireEvent.press(weigh())
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy()
    fireEvent.press(weigh())
    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2))
  })

  it('says the leader is rate limited on a 429', async () => {
    mockPatch.mockRejectedValue(new Error('API PATCH /x failed with status 429'))
    render(<IntakeScreen />)
    await screen.findByText('Tom Beattie')
    fireEvent.press(turnAway())
    expect(await screen.findByText('Too many tries. Wait a minute and try again.')).toBeTruthy()
  })

  it('falls back to a plain line on a server error', async () => {
    mockPatch.mockRejectedValue(new Error('API PATCH /x failed with status 500: pg: boom'))
    render(<IntakeScreen />)
    await screen.findByText('Tom Beattie')
    fireEvent.press(turnAway())
    expect(await screen.findByText('That did not save. Check your connection and try again.')).toBeTruthy()
  })
})

describe('the queue', () => {
  it('keeps two booked rows apart, so typing in one does not touch the other', async () => {
    serve([drop({ id: 'a', contributor_id: 'u1', contributor_name: 'Amy' }), drop({ id: 'b', contributor_id: 'u2', contributor_name: 'Bo' })])
    render(<IntakeScreen />)
    await screen.findByText('Amy')
    const [first, second] = screen.getAllByLabelText('Actual, in kilograms')
    fireEvent.changeText(first, '4')
    expect(screen.getAllByLabelText('Actual, in kilograms')[1].props.value).toBe('')
    expect(screen.getAllByLabelText('Credit, in grams')[0].props.value).toBe('3000')
    expect(screen.getAllByLabelText('Credit, in grams')[1].props.value).toBe('')
    expect(second).toBeTruthy()
  })

  it('shows Booked in (0) and nothing to decide for an empty queue', async () => {
    serve([])
    render(<IntakeScreen />)
    expect(await screen.findByText('Booked in (0)')).toBeTruthy()
    expect(screen.getByText('Nothing booked in right now.')).toBeTruthy()
    expect(screen.queryByText('Weighed in')).toBeNull()
  })

  it.each(NAMES.filter((n) => !/spaces/.test(n.label)))('names a contributor with $label text on the row and in the button label', async ({ value }) => {
    serve([drop({ contributor_name: value })])
    render(<IntakeScreen />)
    expect(await screen.findByText(value)).toBeTruthy()
    expect(screen.getByLabelText(`Weigh and credit ${value}'s drop-off`)).toBeTruthy()
  })

  it('draws a booked note with markup in it as plain text', async () => {
    serve([drop({ note: '<script>alert(1)</script> & "sorted"' })])
    render(<IntakeScreen />)
    expect(await screen.findByText('<script>alert(1)</script> & "sorted"')).toBeTruthy()
  })

  it('shows a received row with no weights as its declared weight rather than NaN', async () => {
    serve([drop({ status: 'received', weighed_grams: null, credit_grams: null })])
    render(<IntakeScreen />)
    expect(await screen.findByText('2.6 kg declared · PLA')).toBeTruthy()
  })

  it('offers Try again when the queue cannot be read, then shows it', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockGet.mockRejectedValue(new Error('offline'))
    render(<IntakeScreen />)
    expect(await screen.findByText("Couldn't load your intake — try again.")).toBeTruthy()
    serve([drop()])
    fireEvent.press(screen.getByText('Try again'))
    expect(await screen.findByText('Tom Beattie')).toBeTruthy()
  })
})

describe('what you can take', () => {
  const save = () => fireEvent.press(screen.getByLabelText('Save what you take'))

  it.each(['1.55', 'abc', '-2', '1,5', '12345'])('refuses a maximum of %j and sends nothing', async (typed) => {
    serve([])
    render(<IntakeScreen />)
    fireEvent.changeText(await screen.findByLabelText('Maximum'), typed)
    save()
    expect(await screen.findByText('Per drop is between 2 and 1000 kg, to one decimal place.')).toBeTruthy()
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('sends a blank minimum and maximum as null, and one decimal as a number', async () => {
    serve([])
    render(<IntakeScreen />)
    fireEvent.changeText(await screen.findByLabelText('Minimum'), '2.5')
    fireEvent.changeText(screen.getByLabelText('Maximum'), '  ')
    save()
    await waitFor(() => expect(mockPatch).toHaveBeenCalled())
    expect(mockPatch.mock.calls[0][1]).toMatchObject({ recycling_min_kg: 2.5, recycling_max_kg: null })
  })

  it('sends special characters in the door and note as typed', async () => {
    serve([])
    render(<IntakeScreen />)
    fireEvent.changeText(await screen.findByLabelText('Which door'), `Rear "gate" & <side> 李雷 🧸`)
    save()
    await waitFor(() => expect(mockPatch.mock.calls[0][1].recycling_door).toBe(`Rear "gate" & <side> 李雷 🧸`))
  })

  it('shows the API reason when the profile save is refused, and a saved line when it works', async () => {
    serve([])
    mockPatch.mockRejectedValueOnce(new Error('API PATCH /x failed with status 400: The minimum cannot be above the maximum.')).mockResolvedValueOnce({})
    render(<IntakeScreen />)
    await screen.findByLabelText('Maximum')
    save()
    expect(await screen.findByText('The minimum cannot be above the maximum.')).toBeTruthy()
    save()
    expect(await screen.findByText('Saved — contributors see this now.')).toBeTruthy()
  })

  it('un-ticks a polymer the organisation already publishes, even one that is not a print material', async () => {
    serve([], { ...ORG, recycling_materials: ['HDPE'] })
    render(<IntakeScreen />)
    fireEvent.press(await screen.findByLabelText('HDPE'))
    save()
    await waitFor(() => expect(mockPatch.mock.calls[0][1].recycling_materials).toEqual([]))
  })
})
