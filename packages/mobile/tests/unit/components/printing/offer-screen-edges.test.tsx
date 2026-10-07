// Print for others: the three tabs at their edges — empty, failing, racing
// printers, a printer with no saved address, and every write's failure path.
// journeys: R14 R16
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { PrintForOthersScreen } from '../../../../components/printing/offer-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
jest.mock('expo-image-picker', () => ({}))

const mockSubmit = jest.fn()
const mockReady = jest.fn()
const mockStart = jest.fn()
jest.mock('../../../../components/printing/actions', () => ({
  ...jest.requireActual('../../../../components/printing/actions'),
  submitTestPrint: (...a: unknown[]) => mockSubmit(...a),
  markReady: (...a: unknown[]) => mockReady(...a),
  startPrint: (...a: unknown[]) => mockStart(...a),
}))

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPatch = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
  },
}))
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []), useRouter: () => ({ push: mockPush }) }
})
let mockProfile: Record<string, unknown> = { id: 'me' }
let mockCaps: unknown = null
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: mockCaps }) }))

const DAY = 864e5
const machine = (id: string, over: object = {}) => ({
  id,
  name: id,
  owner_id: 'me',
  owner_org_id: null,
  org_name: null,
  materials: ['PETG'],
  bed_x: 220,
  accepting: true,
  capacity: 2,
  open_jobs: 0,
  notes: null,
  ...over,
})
const orgMachine = (id: string, over: object = {}) => machine(id, { owner_id: null, owner_org_id: 'org', org_name: 'Library', ...over })
const tx = (id: string, over: object = {}) => ({
  id,
  type: 'print',
  status: 'requested',
  printer_id: 'Ender',
  owner_id: 'me',
  owner_org_id: null,
  requester_id: 'family',
  print_group_id: `g-${id}`,
  print_group_size: 1,
  tutorial_title: `Guide ${id}`,
  other_party_name: 'Fran',
  requester_suburb: 'Newtown',
  print_delivery: 'collect',
  print_colour: 'Any colour',
  print_note: null,
  print_files: [{ id: 's1', filename: 'm.stl', quantity: 1, material: 'PETG', print_minutes: 60, filament_grams: 10 }],
  printing_started_at: null,
  ready_at: null,
  owner_code: null,
  blocked_by_rival_accept: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...over,
})

function serve(printers: unknown[], jobs: unknown[]) {
  mockGet.mockImplementation((path: string) =>
    path === '/api/printers/mine' ? Promise.resolve(printers) : path === '/api/toy-transactions' ? Promise.resolve(jobs) : Promise.reject(new Error('n/a ' + path))
  )
}

beforeEach(() => {
  for (const m of [mockGet, mockPost, mockPatch, mockSubmit, mockReady, mockStart, mockPush]) m.mockReset()
  mockPost.mockResolvedValue({})
  mockPatch.mockResolvedValue({})
  mockStart.mockResolvedValue({})
  mockProfile = { id: 'me' }
  mockCaps = { profile: mockProfile, ledOrgs: [{ id: 'org', name: 'Library' }] }
  jest.spyOn(console, 'error').mockImplementation(() => {})
  serve([machine('Ender')], [tx('a')])
})
afterEach(() => jest.restoreAllMocks())

const setProfile = (p: Record<string, unknown>) => {
  mockProfile = { id: 'me', ...p }
  mockCaps = { profile: mockProfile, ledOrgs: [{ id: 'org', name: 'Library' }] }
}

describe('empty and failing', () => {
  it('says the printers could not load when the first read fails', async () => {
    mockGet.mockRejectedValue(new Error('Network request failed'))
    render(<PrintForOthersScreen />)
    expect(await screen.findByText("Couldn't load your printers.")).toBeTruthy()
  })

  it('shows a skeleton until the profile has loaded', () => {
    mockCaps = null
    render(<PrintForOthersScreen />)
    expect(screen.queryByText('Nothing waiting')).toBeNull()
  })

  it('says nothing is waiting and nothing is live for a printer with no jobs, and still offers Add a printer', async () => {
    serve([machine('Ender')], [])
    render(<PrintForOthersScreen />)
    expect(await screen.findByText('Nothing waiting')).toBeTruthy()
    fireEvent.press(screen.getByRole('tab', { name: 'Jobs' }))
    expect(screen.getByText('No live jobs')).toBeTruthy()
    fireEvent.press(screen.getByRole('tab', { name: 'My printers' }))
    fireEvent.press(screen.getByText('Add a printer'))
    expect(mockPush).toHaveBeenCalledWith('/print-for-others/add')
  })

  it('shows only the Add a printer button for someone with no printers', async () => {
    serve([], [])
    render(<PrintForOthersScreen />)
    fireEvent.press(await screen.findByRole('tab', { name: 'My printers' }))
    expect(screen.getByText('Add a printer')).toBeTruthy()
    expect(screen.getByText('Going away?')).toBeTruthy()
  })

  it('puts the count on the tab that has jobs, and none on the ones that do not', async () => {
    serve([machine('Ender')], [tx('a'), tx('b'), tx('c', { status: 'accepted' })])
    render(<PrintForOthersScreen />)
    expect(await screen.findByRole('tab', { name: 'Requests, 2' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Jobs, 1' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'My printers' })).toBeTruthy()
  })

  it('leaves out jobs on other people’s machines, donations, and jobs with no machine yet', async () => {
    serve(
      [machine('Ender')],
      [tx('mine'), tx('elsewhere', { printer_id: 'Stranger' }), tx('toy', { type: 'donation' }), tx('nomachine', { printer_id: null })]
    )
    render(<PrintForOthersScreen />)
    expect(await screen.findByText('Guide mine')).toBeTruthy()
    for (const hidden of ['elsewhere', 'toy', 'nomachine']) expect(screen.queryByText(`Guide ${hidden}`)).toBeNull()
  })
})

describe('accepting as a person', () => {
  it('sends the saved pickup address straight away', async () => {
    setProfile({ pickup_line1: '1 Rail St', pickup_suburb: 'Newtown', pickup_state: 'NSW', pickup_postcode: '2042' })
    render(<PrintForOthersScreen />)
    fireEvent.press(await screen.findByText('Accept on Ender'))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/a/accept', {
        pickup_line1: '1 Rail St',
        pickup_suburb: 'Newtown',
        pickup_state: 'NSW',
        pickup_postcode: '2042',
      })
    )
  })

  it('asks for the address inline when the profile has none, and sends nothing on the first tap', async () => {
    render(<PrintForOthersScreen />)
    fireEvent.press(await screen.findByText('Accept on Ender'))
    expect(mockPost).not.toHaveBeenCalled()
    for (const label of ['Street address', 'Suburb', 'State', 'Postcode']) expect(screen.getByLabelText(label)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Accept on Ender' })).toBeDisabled()
  })

  it('keeps Accept off while any address field is empty or only spaces', async () => {
    render(<PrintForOthersScreen />)
    fireEvent.press(await screen.findByText('Accept on Ender'))
    fireEvent.changeText(screen.getByLabelText('Street address'), '1 Rail St')
    fireEvent.changeText(screen.getByLabelText('Suburb'), 'Newtown')
    fireEvent.changeText(screen.getByLabelText('State'), 'NSW')
    fireEvent.changeText(screen.getByLabelText('Postcode'), '   ')
    expect(screen.getByRole('button', { name: 'Accept on Ender' })).toBeDisabled()
    fireEvent.changeText(screen.getByLabelText('Postcode'), '2042')
    expect(screen.getByRole('button', { name: 'Accept on Ender' })).toBeEnabled()
  })

  it('sends the typed address and keeps the fields when the API refuses it', async () => {
    mockPost.mockRejectedValue(new Error('failed with status 400: Postcode is four digits.'))
    render(<PrintForOthersScreen />)
    fireEvent.press(await screen.findByText('Accept on Ender'))
    fireEvent.changeText(screen.getByLabelText('Street address'), "1 O'Rail <St> & Co")
    fireEvent.changeText(screen.getByLabelText('Suburb'), 'Newtown')
    fireEvent.changeText(screen.getByLabelText('State'), 'NSW')
    fireEvent.changeText(screen.getByLabelText('Postcode'), '20')
    fireEvent.press(screen.getByRole('button', { name: 'Accept on Ender' }))
    expect(await screen.findByText('Postcode is four digits.')).toBeTruthy()
    expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/a/accept', {
      pickup_line1: "1 O'Rail <St> & Co",
      pickup_suburb: 'Newtown',
      pickup_state: 'NSW',
      pickup_postcode: '20',
    })
    expect(screen.getByLabelText('Street address').props.value).toBe("1 O'Rail <St> & Co")
  })

  it('moves to the Jobs tab after a successful accept', async () => {
    setProfile({ pickup_line1: 'a', pickup_suburb: 'b', pickup_state: 'c', pickup_postcode: '2042' })
    render(<PrintForOthersScreen />)
    fireEvent.press(await screen.findByText('Accept on Ender'))
    serve([machine('Ender')], [tx('a', { status: 'accepted' })])
    expect(await screen.findByText('Started printing')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Jobs, 1' }).props.accessibilityState.selected).toBe(true)
  })

  it('posts one accept however many times it is tapped while it is in flight', async () => {
    setProfile({ pickup_line1: 'a', pickup_suburb: 'b', pickup_state: 'c', pickup_postcode: '2042' })
    let finish!: (v: object) => void
    mockPost.mockReturnValue(new Promise((r) => (finish = r)))
    render(<PrintForOthersScreen />)
    await screen.findByText('Accept on Ender')
    fireEvent.press(screen.getByRole('button', { name: 'Accept on Ender' }))
    fireEvent.press(screen.getByRole('button', { name: 'Accept on Ender' }))
    expect(mockPost).toHaveBeenCalledTimes(1)
    await act(async () => finish({}))
  })

  it('reloads after a refused accept, so a job another printer took drops out of Requests', async () => {
    setProfile({ pickup_line1: 'a', pickup_suburb: 'b', pickup_state: 'c', pickup_postcode: '2042' })
    mockPost.mockRejectedValue(new Error('failed with status 409: Another printer has already taken this job.'))
    render(<PrintForOthersScreen />)
    await screen.findByText('Accept on Ender')
    const reads = mockGet.mock.calls.length
    serve([machine('Ender')], [tx('a', { status: 'withdrawn' })])
    fireEvent.press(screen.getByText('Accept on Ender'))
    expect(await screen.findByText('Another printer has already taken this job.')).toBeTruthy()
    await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThan(reads))
    expect(await screen.findByText('Nothing waiting')).toBeTruthy()
  })

  it('disables Accept for a request a rival accept is already holding', async () => {
    serve([machine('Ender')], [tx('a', { blocked_by_rival_accept: true })])
    render(<PrintForOthersScreen />)
    expect(await screen.findByRole('button', { name: 'Accept on Ender' })).toBeDisabled()
  })
})

describe('accepting as an organisation', () => {
  it('posts an empty body for an organisation with one machine, with no picker', async () => {
    serve([orgMachine('Bench')], [tx('a', { printer_id: 'Bench', owner_id: null, owner_org_id: 'org' })])
    render(<PrintForOthersScreen />)
    fireEvent.press(await screen.findByText('Accept on Bench'))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/a/accept', {}))
    expect(screen.queryByText('Print on')).toBeNull()
  })

  it('cannot choose a paused or full machine in the picker', async () => {
    serve(
      [orgMachine('Good'), orgMachine('Paused', { accepting: false }), orgMachine('Full', { open_jobs: 2 })],
      [tx('a', { printer_id: 'Good', owner_id: null, owner_org_id: 'org' })]
    )
    render(<PrintForOthersScreen />)
    await screen.findByText('Accept on Good')
    expect(screen.getAllByText('Paused').length).toBeGreaterThan(0)
    expect(screen.getByText('No free slot')).toBeTruthy()
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => r.props.accessibilityState.disabled)).toEqual([false, true, true])
  })

  it('accepts anyway on a machine missing the material, naming what is missing', async () => {
    serve(
      [orgMachine('Good'), orgMachine('PLA only', { materials: ['PLA'] })],
      [tx('a', { printer_id: 'Good', owner_id: null, owner_org_id: 'org' })]
    )
    render(<PrintForOthersScreen />)
    await screen.findByText('Accept on Good')
    fireEvent.press(screen.getByText('PLA only'))
    expect(screen.getByText('No PETG loaded')).toBeTruthy()
    expect(screen.getByText('This machine is missing something the guide asks for.')).toBeTruthy()
    fireEvent.press(screen.getByText('Accept anyway on PLA only'))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/a/accept', { printer_id: 'PLA only' }))
  })

  it('says it lands in the queue when the chosen machine fits', async () => {
    serve([orgMachine('A'), orgMachine('B')], [tx('a', { printer_id: 'A', owner_id: null, owner_org_id: 'org' })])
    render(<PrintForOthersScreen />)
    expect(await screen.findByText('Lands in this machine’s queue. Other leaders see which bench it is on.')).toBeTruthy()
  })

  it('shows the organisation’s other machines only for its own requests', async () => {
    serve(
      [orgMachine('A'), orgMachine('B'), machine('Mine')],
      [tx('a', { printer_id: 'Mine' })]
    )
    render(<PrintForOthersScreen />)
    await screen.findByText('Accept on Mine')
    expect(screen.queryByText('Print on')).toBeNull()
  })

  it('narrows to one organisation’s jobs, and lists that organisation’s machines only', async () => {
    serve(
      [orgMachine('Bench'), machine('Personal')],
      [tx('a', { printer_id: 'Bench', owner_id: null, owner_org_id: 'org' }), tx('b', { printer_id: 'Personal' })]
    )
    render(<PrintForOthersScreen orgId="org" />)
    expect(await screen.findByText('Guide a')).toBeTruthy()
    expect(screen.queryByText('Guide b')).toBeNull()
    fireEvent.press(screen.getByRole('tab', { name: 'My printers' }))
    expect(screen.getByText('Bench')).toBeTruthy()
    expect(screen.queryByText('Personal')).toBeNull()
  })
})

describe('declining', () => {
  it('offers each of the four reasons and sends the one tapped', async () => {
    render(<PrintForOthersScreen />)
    fireEvent.press(await screen.findByText('Decline…'))
    for (const reason of ['No PETG on hand', 'Too big for my bed', 'Away for a while', 'Too many jobs already']) {
      expect(screen.getByText(reason)).toBeTruthy()
    }
    fireEvent.press(screen.getByText('Away for a while'))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/a/reject', { reason: 'Away for a while' }))
  })

  it('hides the reasons again on a second tap of Decline', async () => {
    render(<PrintForOthersScreen />)
    fireEvent.press(await screen.findByText('Decline…'))
    fireEvent.press(screen.getByText('Decline…'))
    expect(screen.queryByText('Why? (goes to the requester)')).toBeNull()
  })

  it('shows the API’s sentence when declining is refused', async () => {
    mockPost.mockRejectedValue(new Error('failed with status 409: Already answered.'))
    render(<PrintForOthersScreen />)
    fireEvent.press(await screen.findByText('Decline…'))
    fireEvent.press(screen.getByText('No PETG on hand'))
    expect(await screen.findByText('Already answered.')).toBeTruthy()
  })

  it('shows the offline message when declining cannot reach the API', async () => {
    mockPost.mockRejectedValue(new Error('Network request failed'))
    render(<PrintForOthersScreen />)
    fireEvent.press(await screen.findByText('Decline…'))
    fireEvent.press(screen.getByText('No PETG on hand'))
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy()
  })
})

describe('what a request card says', () => {
  it('says a family with no suburb is "a family", and "will collect" or "wants it posted"', async () => {
    serve([machine('Ender')], [tx('a', { requester_suburb: null }), tx('b', { print_delivery: 'post' })])
    render(<PrintForOthersScreen />)
    expect(await screen.findByText(/^From a family · will collect$/)).toBeTruthy()
    expect(screen.getByText(/^From a family in Newtown · wants it posted$/)).toBeTruthy()
  })

  it('names a chosen colour but not "Any colour"', async () => {
    serve([machine('Ender')], [tx('a', { print_colour: 'Blue' }), tx('b')])
    render(<PrintForOthersScreen />)
    expect(await screen.findByText(/will collect · Blue$/)).toBeTruthy()
    expect(screen.queryByText(/Any colour/)).toBeNull()
  })

  it.each(NAMES)('quotes a family note with $label as typed', async ({ value }) => {
    serve([machine('Ender')], [tx('a', { print_note: value })])
    render(<PrintForOthersScreen />)
    expect(await screen.findByText(`“${value}”`)).toBeTruthy()
  })

  it('shows no note line when the family left none', async () => {
    render(<PrintForOthersScreen />)
    await screen.findByText('Accept on Ender')
    expect(screen.queryByText(/^“/)).toBeNull()
  })

  it('says only you were asked for a request sent to one printer', async () => {
    render(<PrintForOthersScreen />)
    expect(await screen.findByText(/^Only you were asked\. Settings from the guide: PETG\.$/)).toBeTruthy()
  })

  it('leaves the material out of the settings line when the parts name none', async () => {
    serve([machine('Ender')], [tx('a', { print_files: [{ id: 's', filename: 'x.stl', quantity: 2, material: null, print_minutes: null, filament_grams: null }] })])
    render(<PrintForOthersScreen />)
    expect(await screen.findByText(/^Only you were asked\. Settings from the guide\.$/)).toBeTruthy()
    expect(screen.getByText('2 parts')).toBeTruthy()
  })

  it('shows the guide’s own print settings when the list carries them', async () => {
    serve([machine('Ender')], [tx('a', { tutorial_print_settings: { layer_height_mm: 0.2, infill_percent: 20, material: 'PETG' } })])
    render(<PrintForOthersScreen />)
    expect(await screen.findByText(/0\.2 mm/)).toBeTruthy()
  })
})

describe('the Jobs tab', () => {
  const open = async () => {
    render(<PrintForOthersScreen />)
    fireEvent.press(await screen.findByRole('tab', { name: /^Jobs/ }))
  }

  it('starts an accepted job, and refreshes it to the printing step', async () => {
    serve([machine('Ender')], [tx('a', { status: 'accepted' })])
    await open()
    serve([machine('Ender')], [tx('a', { status: 'accepted', printing_started_at: 'x' })])
    fireEvent.press(screen.getByText('Started printing'))
    await waitFor(() => expect(mockStart).toHaveBeenCalledWith('a'))
    expect(await screen.findByText('Mark ready for pickup')).toBeTruthy()
  })

  it('posts the ready photo for a printing job, and does nothing more when the picker is cancelled', async () => {
    serve([machine('Ender')], [tx('a', { status: 'accepted', printing_started_at: 'x' })])
    mockReady.mockResolvedValue(null)
    await open()
    fireEvent.press(screen.getByText('Mark ready for pickup'))
    await waitFor(() => expect(mockReady).toHaveBeenCalledWith('a'))
    expect(screen.getByText('Mark ready for pickup')).toBeTruthy()
  })

  it('shows the photo-library refusal as a sentence', async () => {
    serve([machine('Ender')], [tx('a', { status: 'accepted', printing_started_at: 'x' })])
    mockReady.mockRejectedValue(new Error('failed with status 400: Photo library access is needed to post the photo.'))
    await open()
    fireEvent.press(screen.getByText('Mark ready for pickup'))
    expect(await screen.findByText('Photo library access is needed to post the photo.')).toBeTruthy()
  })

  it('shows a ready job as waiting for pickup with the printer’s code, and opens it', async () => {
    serve([machine('Ender')], [tx('a', { status: 'accepted', printing_started_at: 'x', ready_at: 'y', owner_code: '424242' })])
    await open()
    expect(screen.getByText('Waiting for pickup.')).toBeTruthy()
    expect(screen.getByText(/\(424242\)/)).toBeTruthy()
    fireEvent.press(screen.getByText('Open the job'))
    expect(mockPush).toHaveBeenCalledWith('/printing/jobs/a')
  })

  it('leaves the code out of the line when the list did not carry one', async () => {
    serve([machine('Ender')], [tx('a', { status: 'accepted', printing_started_at: 'x', ready_at: 'y', owner_code: null })])
    await open()
    expect(screen.queryByText(/\(\d+\)/)).toBeNull()
  })

  it('lists finished jobs under Done, expired ones too, and opens one on tap', async () => {
    serve(
      [machine('Ender')],
      [
        tx('collected', { status: 'completed' }),
        tx('declined', { status: 'rejected' }),
        tx('withdrawn', { status: 'withdrawn' }),
        tx('lapsed', { created_at: new Date(Date.now() - 9 * DAY).toISOString() }),
      ]
    )
    await open()
    expect(screen.getByText('No live jobs')).toBeTruthy()
    expect(screen.getByText('Done')).toBeTruthy()
    for (const label of ['Collected', 'Declined', 'Withdrawn', 'Expired']) expect(screen.getByText(label)).toBeTruthy()
    fireEvent.press(screen.getByText('Guide collected'))
    expect(mockPush).toHaveBeenCalledWith('/printing/jobs/collected')
  })

  it('names the machine a live job is on', async () => {
    serve([machine('Ender')], [tx('a', { status: 'accepted' })])
    await open()
    expect(screen.getByText('On Ender')).toBeTruthy()
    expect(screen.getByText(/^1 part · for Fran$/)).toBeTruthy()
  })
})

describe('My printers', () => {
  const open = async () => {
    render(<PrintForOthersScreen />)
    fireEvent.press(await screen.findByRole('tab', { name: 'My printers' }))
  }

  it('pauses an open printer and opens a paused one, by what it is now', async () => {
    serve([machine('Open'), machine('Shut', { accepting: false })], [])
    await open()
    fireEvent.press(screen.getByText('Pause'))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/printers/Open', { accepting: false }))
    fireEvent.press(screen.getByText('Open to requests'))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/printers/Shut', { accepting: true }))
  })

  it('shows the API’s sentence when pausing is refused', async () => {
    serve([machine('Open')], [])
    mockPatch.mockRejectedValue(new Error('failed with status 403: Not your printer.'))
    await open()
    fireEvent.press(screen.getByText('Pause'))
    expect(await screen.findByText('Not your printer.')).toBeTruthy()
  })

  it('shows capacity, bed and materials, with "full" at capacity', async () => {
    serve([machine('Busy', { open_jobs: 2, bed_x: 256, materials: ['PETG', 'TPU'] })], [])
    await open()
    expect(screen.getByText('256 mm bed · 2 of 2 · full')).toBeTruthy()
    expect(screen.getByText('Materials: PETG, TPU')).toBeTruthy()
  })

  it('prefixes an organisation’s machine with the organisation', async () => {
    serve([orgMachine('Bench', { open_jobs: 1 })], [])
    await open()
    expect(screen.getByText('Library · 220 mm bed · 1 of 2 used')).toBeTruthy()
  })

  it('shows a verified printer with the seal and no Get verified', async () => {
    serve([machine('Seal', { verified: true })], [])
    await open()
    expect(screen.getByText('Verified')).toBeTruthy()
    expect(screen.queryByText('Get verified')).toBeNull()
  })

  it('offers Get verified to a printer with no test print, and not while one is waiting', async () => {
    serve([machine('Fresh'), machine('Waiting', { test_print: { verdict: null, note: null, submitted_at: '' } })], [])
    await open()
    expect(screen.getAllByText('Get verified')).toHaveLength(1)
  })

  it('does nothing visible when the printer backs out of the test-print picker', async () => {
    serve([machine('Fresh')], [])
    mockSubmit.mockResolvedValue(null)
    await open()
    fireEvent.press(screen.getByText('Get verified'))
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith('Fresh'))
    expect(screen.getByText('Get verified')).toBeTruthy()
  })

  it('shows the photo-library refusal when submitting a test print', async () => {
    serve([machine('Fresh')], [])
    mockSubmit.mockRejectedValue(new Error('failed with status 400: Photo library access is needed to post the photo.'))
    await open()
    fireEvent.press(screen.getByText('Get verified'))
    expect(await screen.findByText('Photo library access is needed to post the photo.')).toBeTruthy()
  })

  it.each(NAMES)('shows a printer called $label and its notes as typed', async ({ value }) => {
    serve([machine('Fresh', { name: value, notes: value })], [])
    await open()
    expect(screen.getAllByText(value).length).toBeGreaterThan(0)
  })
})
