// The Map tab with MapCanvas stubbed: pins are buttons named by suburb, so the
// screen's own state (chips, filters, sheet, list) is what is under test.
// journeys: Q11 Q12
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react-native'
import type { MapPlace } from '@splat-connect/types'
import MapTab from '../../../app/(tabs)/map'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockPush = jest.fn()
let mockBlur: (() => void) | undefined
let mockParams: { kind?: string } = {}
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ push: mockPush }),
    useLocalSearchParams: () => mockParams,
    // Focus runs the effect; mockBlur stands in for leaving the tab.
    useFocusEffect: (effect: () => (() => void) | undefined) => useEffect(() => { mockBlur = effect() ?? undefined }, [effect]),
  }
})
let mockPostcode: string | null = '2040'
jest.mock('../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { pickup_postcode: mockPostcode } }, loading: false }),
}))
jest.mock('../../../components/map/MapCanvas', () => ({
  MapCanvas: ({ places, onSelect }: { places: MapPlace[]; onSelect: (place: string, item?: string) => void }) => {
    const { Pressable, Text, View } = jest.requireActual('react-native')
    return (
    <View testID="map">
      {places.map((p) => (
        <Pressable key={p.suburb} accessibilityRole="button" accessibilityLabel={`pin ${p.suburb}`} onPress={() => onSelect(`${p.lat},${p.lng}`)}>
          <Text>{p.items.length}</Text>
        </Pressable>
      ))}
    </View>
    )
  },
}))

const PLACES: MapPlace[] = [
  {
    suburb: 'Leichhardt', state: 'NSW', lat: -33.88, lng: 151.15, km: 0, address: null,
    items: [
      { kind: 'printer', id: 'p1', title: 'Hannah’s Prusa', meta: 'PLA, PETG', materials: ['PLA', 'PETG'] },
      { kind: 'toy', id: 't1', title: 'Bubble machine', meta: 'A family' },
    ],
  },
  {
    suburb: 'Chatswood', state: 'NSW', lat: -33.79, lng: 151.18, km: 11, address: '1 Victoria Ave',
    items: [{ kind: 'org', id: 'o1', title: 'North Shore Makers', meta: null }],
  },
]

beforeEach(() => {
  jest.clearAllMocks()
  mockPostcode = '2040'
  mockParams = {}
  mockGet.mockResolvedValue(PLACES)
})

it('?kind=printer opens with only the Printers layer picked', async () => {
  mockParams = { kind: 'printer' }
  render(<MapTab />)
  expect(await screen.findByRole('button', { name: 'pin Leichhardt' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'pin Chatswood' })).toBeNull()
})

it('an unknown ?kind is ignored and every layer shows', async () => {
  mockParams = { kind: 'nonsense' }
  render(<MapTab />)
  expect(await screen.findByRole('button', { name: 'pin Chatswood' })).toBeTruthy()
})

it('loads places near the viewer and draws a pin per suburb', async () => {
  render(<MapTab />)
  expect(await screen.findByRole('button', { name: 'pin Leichhardt' })).toBeTruthy()
  expect(mockGet).toHaveBeenCalledWith('/api/public/map?near=2040')
  expect(screen.getByPlaceholderText('Near 2040 · 3 places')).toBeTruthy()
})

it('without a postcode it asks for the whole map and offers no distance filter', async () => {
  mockPostcode = null
  render(<MapTab />)
  await screen.findByRole('button', { name: 'pin Leichhardt' })
  expect(mockGet).toHaveBeenCalledWith('/api/public/map')
  fireEvent.press(screen.getByRole('button', { name: 'Filters' }))
  expect(screen.queryByText(/Distance from/)).toBeNull()
})

it('tapping a pin opens its sheet, and a row opens the item', async () => {
  render(<MapTab />)
  fireEvent.press(await screen.findByRole('button', { name: 'pin Leichhardt' }))
  expect(screen.getByText(/NSW · your postcode/)).toBeTruthy()
  fireEvent.press(screen.getByText('Bubble machine'))
  expect(mockPush).toHaveBeenCalledWith('/toy-library/t1')
  fireEvent.press(screen.getByRole('button', { name: 'Close' }))
  expect(screen.queryByText('Bubble machine')).toBeNull()
})

it('an organisation row shows its street address', async () => {
  render(<MapTab />)
  fireEvent.press(await screen.findByRole('button', { name: 'pin Chatswood' }))
  expect(screen.getByText('1 Victoria Ave')).toBeTruthy()
  expect(screen.getByText('Organisation')).toBeTruthy()
})

it('a row is announced as its title, detail and distance', async () => {
  render(<MapTab />)
  fireEvent.press(await screen.findByRole('button', { name: 'pin Leichhardt' }))
  expect(screen.getByRole('button', { name: 'Bubble machine, Toy · A family, here' })).toBeTruthy()
})

it('a chip shows only its kind; more chips add kinds; unpicking the last shows everything', async () => {
  render(<MapTab />)
  await screen.findByRole('button', { name: 'pin Chatswood' })
  fireEvent.press(screen.getByRole('button', { name: 'Organisations' }))
  expect(screen.getByRole('button', { name: 'Organisations' }).props.accessibilityState).toMatchObject({ selected: true })
  expect(screen.getByRole('button', { name: 'pin Chatswood' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'pin Leichhardt' })).toBeNull()

  fireEvent.press(screen.getByRole('button', { name: 'Printers' }))
  expect(screen.getByRole('button', { name: 'pin Leichhardt' })).toBeTruthy()

  fireEvent.press(screen.getByRole('button', { name: 'Printers' }))
  fireEvent.press(screen.getByRole('button', { name: 'Organisations' }))
  expect(screen.getByRole('button', { name: 'pin Leichhardt' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'pin Chatswood' })).toBeTruthy()
})

it('the List button shows every place nearest first, grouped by distance, and Map goes back', async () => {
  render(<MapTab />)
  await screen.findByRole('button', { name: 'pin Leichhardt' })
  fireEvent.press(screen.getByRole('button', { name: 'List' }))
  expect(screen.getByText('Within 2 km')).toBeTruthy()
  expect(screen.getByText('Further out')).toBeTruthy()
  expect(screen.getByText('North Shore Makers')).toBeTruthy()
  expect(screen.queryByTestId('map')).toBeNull()
  fireEvent.press(screen.getByRole('button', { name: 'Map' }))
  expect(screen.getByTestId('map')).toBeTruthy()
})

it('filters apply only on Show places, and the button counts them', async () => {
  render(<MapTab />)
  await screen.findByRole('button', { name: 'pin Chatswood' })
  fireEvent.press(screen.getByRole('button', { name: 'Filters' }))
  fireEvent.press(screen.getByText('5 km'))
  expect(screen.getByRole('button', { name: 'pin Chatswood' })).toBeTruthy()
  fireEvent.press(screen.getByText('Show places'))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'pin Chatswood' })).toBeNull())
  expect(screen.getByRole('button', { name: 'Filters, 1 on' })).toBeTruthy()
})

it('the filter button turns into a close button while the sheet is open, and closing drops unapplied choices', async () => {
  render(<MapTab />)
  await screen.findByRole('button', { name: 'pin Chatswood' })
  fireEvent.press(screen.getByRole('button', { name: 'Filters' }))
  expect(screen.getByText('Show places')).toBeTruthy()
  fireEvent.press(screen.getByText('5 km'))
  // Both the backdrop and the button close; the button is the one in the top bar.
  const close = screen.getAllByRole('button', { name: 'Close filters' })
  fireEvent.press(close[close.length - 1])
  await waitFor(() => expect(screen.queryByText('Show places')).toBeNull())
  expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'pin Chatswood' })).toBeTruthy()
})

it('search narrows to a suburb or a matching title', async () => {
  render(<MapTab />)
  await screen.findByRole('button', { name: 'pin Leichhardt' })
  fireEvent.changeText(screen.getByLabelText('Search suburbs and places'), 'prusa')
  expect(screen.queryByRole('button', { name: 'pin Chatswood' })).toBeNull()
  expect(within(screen.getByRole('button', { name: 'pin Leichhardt' })).getByText('1')).toBeTruthy()
})

it('leaving the tab clears the search, so every place shows when you come back', async () => {
  render(<MapTab />)
  await screen.findByRole('button', { name: 'pin Leichhardt' })
  fireEvent.changeText(screen.getByLabelText('Search suburbs and places'), 'prusa')
  expect(screen.queryByRole('button', { name: 'pin Chatswood' })).toBeNull()
  act(() => mockBlur?.())
  expect(screen.getByLabelText('Search suburbs and places').props.value).toBe('')
  expect(screen.getByRole('button', { name: 'pin Chatswood' })).toBeTruthy()
})

it('a failed load says so and retries', async () => {
  mockGet.mockRejectedValueOnce(new Error('offline'))
  render(<MapTab />)
  expect(await screen.findByText('Could not load the map.')).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('button', { name: 'pin Leichhardt' })).toBeTruthy()
})
