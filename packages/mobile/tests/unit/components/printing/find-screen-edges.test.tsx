// Find a printer: empty and failing lists, every filter on its own and
// stacked, the three-pick cap from the screen's side, and odd printer names.
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { FindPrinterScreen } from '../../../../components/printing/find-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
const mockCaps: { profile: Record<string, unknown>; ledOrgs: Array<{ id: string }> } = { profile: { id: 'me' }, ledOrgs: [] }
let mockCapsLoading = false
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: mockCaps, loading: mockCapsLoading }),
}))

const printer = (id: string, over: object = {}) => ({
  id,
  owner_id: `owner-${id}`,
  owner_org_id: null,
  owner_name: `Maker ${id.toUpperCase()}`,
  org_name: null,
  name: 'Prusa',
  materials: ['PETG'],
  bed_x: 220,
  bed_y: 220,
  bed_z: 220,
  accepting: true,
  capacity: 2,
  open_jobs: 0,
  suburb: null,
  state: null,
  ...over,
})
const GUIDE = {
  id: 'g1',
  title: 'Switch mount',
  stl_files: [{ id: 's1', filename: 'mount.stl', print_minutes: 60, filament_grams: 10, material: 'PETG' }],
}

type Serve = { printers?: unknown[]; guide?: unknown }
function serve({ printers = [printer('a'), printer('b')], guide = GUIDE }: Serve = {}) {
  mockGet.mockImplementation((path: string) =>
    path.startsWith('/api/printers') ? Promise.resolve(printers) : Promise.resolve(guide)
  )
}

beforeEach(() => {
  mockGet.mockReset()
  mockPush.mockReset()
  mockCapsLoading = false
  mockCaps.profile = { id: 'me' }
  mockCaps.ledOrgs = []
  jest.spyOn(console, 'error').mockImplementation(() => {})
  serve()
})
afterEach(() => jest.restoreAllMocks())

describe('failing and empty lists', () => {
  it('says printers could not load when the printer read fails', async () => {
    mockGet.mockImplementation((path: string) =>
      path.startsWith('/api/printers') ? Promise.reject(new Error('Network request failed')) : Promise.resolve(GUIDE)
    )
    render(<FindPrinterScreen guideId="g1" />)
    expect(await screen.findByText("Couldn't load printers.")).toBeTruthy()
  })

  it('says the same when the guide read fails, rather than showing printers with nothing to send', async () => {
    mockGet.mockImplementation((path: string) =>
      path.startsWith('/api/printers') ? Promise.resolve([printer('a')]) : Promise.reject(new Error('failed with status 404: Not found'))
    )
    render(<FindPrinterScreen guideId="gone" />)
    expect(await screen.findByText("Couldn't load printers.")).toBeTruthy()
    expect(screen.queryByText('Maker A')).toBeNull()
  })

  it('says nobody has listed a printer when the list is empty, with no filter to clear', async () => {
    serve({ printers: [] })
    render(<FindPrinterScreen guideId="g1" />)
    expect(await screen.findByText('Nobody has listed a printer yet')).toBeTruthy()
    expect(screen.queryByText('Clear filters')).toBeNull()
    expect(screen.getByText('0 printers')).toBeTruthy()
  })

  it('says nobody has listed one when the only printer is the viewer’s own', async () => {
    serve({ printers: [printer('mine', { owner_id: 'me' })] })
    render(<FindPrinterScreen guideId="g1" />)
    expect(await screen.findByText('Nobody has listed a printer yet')).toBeTruthy()
  })

  it('hides a machine of an organisation the viewer leads', async () => {
    mockCaps.ledOrgs = [{ id: 'org1' }]
    serve({ printers: [printer('club', { owner_id: null, owner_org_id: 'org1', org_name: 'Club' }), printer('b')] })
    render(<FindPrinterScreen guideId="g1" />)
    expect(await screen.findByText('Maker B')).toBeTruthy()
    expect(screen.queryByText('Club')).toBeNull()
  })

  it('counts one printer in the singular', async () => {
    serve({ printers: [printer('a')] })
    render(<FindPrinterScreen guideId="g1" />)
    expect(await screen.findByText('1 printer')).toBeTruthy()
  })

  it('shows a skeleton, not the empty state, while the read is in flight', () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    render(<FindPrinterScreen guideId="g1" />)
    expect(screen.queryByText('Nobody has listed a printer yet')).toBeNull()
    expect(screen.queryByText("Couldn't load printers.")).toBeNull()
  })
})

describe('filters', () => {
  const four = () => [
    printer('open'),
    printer('full', { open_jobs: 2 }),
    printer('paused', { accepting: false }),
    printer('pla', { materials: ['PLA'] }),
  ]

  it('Open now hides full and paused machines and keeps queued ones with a free slot', async () => {
    serve({ printers: [...four(), printer('queued', { open_jobs: 1 })] })
    render(<FindPrinterScreen guideId="g1" />)
    await screen.findByText('Maker OPEN')
    fireEvent.press(screen.getByText('Open now'))
    expect(screen.getByText('Maker OPEN')).toBeTruthy()
    expect(screen.getByText('Maker QUEUED')).toBeTruthy()
    expect(screen.queryByText('Maker FULL')).toBeNull()
    expect(screen.queryByText('Maker PAUSED')).toBeNull()
  })

  it('Has PETG keeps only machines with that material loaded', async () => {
    serve({ printers: four() })
    render(<FindPrinterScreen guideId="g1" />)
    await screen.findByText('Maker OPEN')
    fireEvent.press(screen.getByText('Has PETG'))
    expect(screen.queryByText('Maker PLA')).toBeNull()
    expect(screen.getByText('Maker OPEN')).toBeTruthy()
  })

  it('names the guide’s own material on the chip, defaulting to PETG when the guide has none', async () => {
    serve({ guide: { ...GUIDE, stl_files: [{ ...GUIDE.stl_files[0], material: 'TPU' }] } })
    const { unmount } = render(<FindPrinterScreen guideId="g1" />)
    expect(await screen.findByText('Has TPU')).toBeTruthy()
    unmount()
    serve({ guide: { ...GUIDE, stl_files: [{ ...GUIDE.stl_files[0], material: null }] } })
    render(<FindPrinterScreen guideId="g1" />)
    expect(await screen.findByText('Has PETG')).toBeTruthy()
  })

  it('defaults the material chip to PETG when browsing with no guide', async () => {
    render(<FindPrinterScreen />)
    expect(await screen.findByText('Has PETG')).toBeTruthy()
  })

  it('stacked filters that exclude everything say no printer matches, and Clear filters brings them all back', async () => {
    serve({ printers: four() })
    render(<FindPrinterScreen guideId="g1" />)
    await screen.findByText('Maker OPEN')
    fireEvent.press(screen.getByText('Verified'))
    fireEvent.press(screen.getByText('Open now'))
    expect(await screen.findByText('No printer matches')).toBeTruthy()
    expect(screen.getByText('0 printers')).toBeTruthy()
    fireEvent.press(screen.getByText('Clear filters'))
    expect(screen.getByText('4 printers')).toBeTruthy()
  })

  it('Within 10 km drops a printer with no distance as well as one that is far', async () => {
    mockCaps.profile = { id: 'me', pickup_postcode: '2000' }
    serve({ printers: [printer('near', { km: 3 }), printer('far', { km: 11 }), printer('unknown'), printer('edge', { km: 10 })] })
    render(<FindPrinterScreen guideId="g1" />)
    fireEvent.press(await screen.findByText('Within 10 km'))
    expect(screen.getByText('Maker NEAR')).toBeTruthy()
    expect(screen.getByText('Maker EDGE')).toBeTruthy()
    expect(screen.queryByText('Maker FAR')).toBeNull()
    expect(screen.queryByText('Maker UNKNOWN')).toBeNull()
  })

  it('shows no distance chip at all while the profile is still loading', async () => {
    mockCapsLoading = true
    render(<FindPrinterScreen guideId="g1" />)
    await screen.findByText('Maker A')
    expect(screen.queryByText('Add your postcode')).toBeNull()
    expect(screen.queryByText('Within 10 km')).toBeNull()
  })

  it('shows a printer at 0 km as 0 km, not as no distance', async () => {
    mockCaps.profile = { id: 'me', pickup_postcode: '2000' }
    serve({ printers: [printer('a', { km: 0 })] })
    render(<FindPrinterScreen guideId="g1" />)
    expect(await screen.findByText(/· 0 km/)).toBeTruthy()
  })
})

describe('picking', () => {
  const many = () => ['a', 'b', 'c', 'd'].map((id) => printer(id))

  it('unpicking one of three frees the fourth', async () => {
    serve({ printers: many() })
    render(<FindPrinterScreen guideId="g1" />)
    await screen.findByText('Maker A')
    for (const id of ['A', 'B', 'C']) fireEvent.press(screen.getByLabelText(`Pick Maker ${id}`))
    expect(screen.getByLabelText('Pick Maker D')).toBeDisabled()
    fireEvent.press(screen.getByLabelText('Unpick Maker B'))
    expect(screen.getByLabelText('Pick Maker D')).toBeEnabled()
    fireEvent.press(screen.getByLabelText('Pick Maker D'))
    fireEvent.press(screen.getByText('Ask 3 printers'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/printing/request', params: { guide: 'g1', printers: 'a,c,d' } })
  })

  it('cannot pick a full or paused printer, and says so on the pill', async () => {
    serve({ printers: [printer('full', { open_jobs: 2 }), printer('paused', { accepting: false })] })
    render(<FindPrinterScreen guideId="g1" />)
    await screen.findByText('Maker FULL')
    expect(screen.getByLabelText('Pick Maker FULL')).toBeDisabled()
    expect(screen.getByLabelText('Pick Maker PAUSED')).toBeDisabled()
    expect(screen.getByText('Full')).toBeTruthy()
    expect(screen.getByText('Paused')).toBeTruthy()
  })

  it('keeps the continue button off until something is picked, and goes nowhere when pressed', async () => {
    render(<FindPrinterScreen guideId="g1" />)
    await screen.findByText('Maker A')
    expect(screen.getByRole('button', { name: 'Pick a printer to continue' })).toBeDisabled()
    fireEvent.press(screen.getByText('Pick a printer to continue'))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('goes back to the disabled button after the only pick is undone', async () => {
    render(<FindPrinterScreen guideId="g1" />)
    fireEvent.press(await screen.findByLabelText('Pick Maker A'))
    expect(screen.getByText('Ask 1 printer')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Unpick Maker A'))
    expect(screen.getByRole('button', { name: 'Pick a printer to continue' })).toBeDisabled()
  })

  it('offers no Pick and no continue button for a guide with no printable parts', async () => {
    serve({ guide: { ...GUIDE, stl_files: [] } })
    render(<FindPrinterScreen guideId="g1" />)
    await screen.findByText('Maker A')
    expect(screen.queryByLabelText('Pick Maker A')).toBeNull()
    expect(screen.queryByText('Pick a printer to continue')).toBeNull()
  })

  it('sends the guide id and printer ids in the route params for any characters in the ids', async () => {
    serve({ printers: [printer('a b')], guide: { ...GUIDE, id: 'g 1&x' } })
    render(<FindPrinterScreen guideId="g 1&x" />)
    fireEvent.press(await screen.findByLabelText('Pick Maker A B'))
    fireEvent.press(screen.getByText('Ask 1 printer'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/printing/request', params: { guide: 'g 1&x', printers: 'a b' } })
  })
})

describe('preselecting for an organisation', () => {
  const org = (id: string, over: object = {}) => printer(id, { owner_id: null, owner_org_id: 'org1', org_name: 'Shed', ...over })

  it('preselects no more than three of the organisation’s machines', async () => {
    serve({ printers: ['a', 'b', 'c', 'd', 'e'].map((id) => org(id)) })
    render(<FindPrinterScreen guideId="g1" printWith="org1" />)
    expect(await screen.findByText('Ask 3 printers')).toBeTruthy()
  })

  it('preselects nothing when the organisation has no open machine that fits, and still lists the rest', async () => {
    serve({ printers: [org('a', { accepting: false }), org('b', { open_jobs: 2 }), printer('c')] })
    render(<FindPrinterScreen guideId="g1" printWith="org1" />)
    await screen.findByText('Maker C')
    expect(screen.getByText('Pick a printer to continue')).toBeTruthy()
  })

  it('skips a machine of the organisation whose bed is too small for the parts', async () => {
    serve({
      printers: [org('small', { bed_x: 100, bed_y: 100, bed_z: 100 }), org('big')],
      guide: { ...GUIDE, stl_files: [{ ...GUIDE.stl_files[0], size_x_mm: 150, size_y_mm: 150, size_z_mm: 50 }] },
    })
    render(<FindPrinterScreen guideId="g1" printWith="org1" />)
    fireEvent.press(await screen.findByText('Ask 1 printer'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/printing/request', params: { guide: 'g1', printers: 'big' } })
  })

  it('does not preselect when the screen was opened without a guide', async () => {
    serve({ printers: [org('a')] })
    render(<FindPrinterScreen printWith="org1" />)
    await screen.findByText('Every request starts from a guide')
    expect(screen.queryByText(/^Ask \d/)).toBeNull()
  })
})

describe('what a printer card says', () => {
  it.each(NAMES)('shows an owner called $label without breaking the card', async ({ value }) => {
    serve({ printers: [printer('a', { owner_name: value })] })
    render(<FindPrinterScreen guideId="g1" />)
    expect(await screen.findByText(value)).toBeTruthy()
    expect(screen.getByLabelText(`Pick ${value}`)).toBeTruthy()
  })

  it('draws a whole emoji as the initial rather than half of one', async () => {
    serve({ printers: [printer('a', { owner_name: '🧸 Bears' })] })
    render(<FindPrinterScreen guideId="g1" />)
    await screen.findByText('🧸 Bears')
    expect(screen.getByText('🧸B')).toBeTruthy()
  })

  it('prefers the organisation name, then the owner, then "A contributor"', async () => {
    serve({
      printers: [
        printer('a', { org_name: 'Library', owner_name: 'Ann' }),
        printer('b', { owner_name: null, org_name: null }),
      ],
    })
    render(<FindPrinterScreen guideId="g1" />)
    expect(await screen.findByText('Library')).toBeTruthy()
    expect(screen.queryByText('Ann')).toBeNull()
    expect(screen.getByText('A contributor')).toBeTruthy()
  })

  it('marks organisations and contributors, and joins suburb and state', async () => {
    serve({
      printers: [
        printer('a', { owner_id: null, owner_org_id: 'o', org_name: 'Library', suburb: 'Newtown', state: 'NSW' }),
        printer('b', { suburb: 'Fitzroy', state: null }),
      ],
    })
    render(<FindPrinterScreen guideId="g1" />)
    expect(await screen.findByText('Organisation · Newtown NSW · Prusa')).toBeTruthy()
    expect(screen.getByText('Contributor · Fitzroy · Prusa')).toBeTruthy()
  })

  it('lists every material and the bed size as tags', async () => {
    serve({ printers: [printer('a', { materials: ['PETG', 'TPU'], bed_x: 256 })] })
    render(<FindPrinterScreen guideId="g1" />)
    await screen.findByText('Maker A')
    for (const tag of ['PETG', 'TPU', '256 mm']) expect(screen.getAllByText(tag).length).toBeGreaterThan(0)
  })
})

describe('the guide card', () => {
  it('says "1 part" for one part and leaves out figures the guide never gave', async () => {
    serve({ guide: { ...GUIDE, stl_files: [{ id: 's1', filename: 'x.stl', print_minutes: null, filament_grams: null, material: null }] } })
    render(<FindPrinterScreen guideId="g1" />)
    expect(await screen.findByText('1 part · filament only')).toBeTruthy()
  })

  it('says "3 parts" and the combined figures', async () => {
    const stl = (id: string) => ({ id, filename: `${id}.stl`, print_minutes: 60, filament_grams: 10, material: 'PETG' })
    serve({ guide: { ...GUIDE, stl_files: [stl('a'), stl('b'), stl('c')] } })
    render(<FindPrinterScreen guideId="g1" />)
    expect(await screen.findByText('3 parts · about 3 h · ~30 g PETG · filament only')).toBeTruthy()
  })

  it('opens the printing basics from the footer link', async () => {
    render(<FindPrinterScreen guideId="g1" />)
    fireEvent.press(await screen.findByLabelText(/New to printing\?/))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/printing/basics'))
  })
})
