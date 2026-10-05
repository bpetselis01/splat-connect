// The Map tab with MapCanvas stubbed: pins are buttons named by suburb, so the
// screen's own state (chips, filters, sheet, list) is what is under test.
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react-native'
import type { MapPlace } from '@splat-connect/types'
import MapTab from '../../../app/(tabs)/map'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
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
        <Pressable key={p.suburb} accessibilityRole="button" accessibilityLabel={`pin ${p.suburb}`} onPress={() => onSelect(`${p.suburb}|${p.state}`)}>
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
  mockGet.mockResolvedValue(PLACES)
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
  expect(screen.getByText('your postcode')).toBeTruthy()
  fireEvent.press(screen.getByText('Bubble machine'))
  expect(mockPush).toHaveBeenCalledWith('/toy-library/t1')
  fireEvent.press(screen.getByRole('button', { name: 'Close' }))
  expect(screen.queryByText('Bubble machine')).toBeNull()
})

it('an organisation row shows its street address', async () => {
  render(<MapTab />)
  fireEvent.press(await screen.findByRole('button', { name: 'pin Chatswood' }))
  expect(screen.getByText('Organisation · 1 Victoria Ave')).toBeTruthy()
})

it('a layer chip hides that kind, and a suburb left empty loses its pin', async () => {
  render(<MapTab />)
  await screen.findByRole('button', { name: 'pin Chatswood' })
  fireEvent.press(screen.getByText('Organisations'))
  expect(screen.queryByRole('button', { name: 'pin Chatswood' })).toBeNull()
  expect(screen.getByRole('button', { name: 'pin Leichhardt' })).toBeTruthy()
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

it('search narrows to a suburb or a matching title', async () => {
  render(<MapTab />)
  await screen.findByRole('button', { name: 'pin Leichhardt' })
  fireEvent.changeText(screen.getByLabelText('Search suburbs and places'), 'prusa')
  expect(screen.queryByRole('button', { name: 'pin Chatswood' })).toBeNull()
  expect(within(screen.getByRole('button', { name: 'pin Leichhardt' })).getByText('1')).toBeTruthy()
})

it('a failed load says so and retries', async () => {
  mockGet.mockRejectedValueOnce(new Error('offline'))
  render(<MapTab />)
  expect(await screen.findByText('Could not load the map.')).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('button', { name: 'pin Leichhardt' })).toBeTruthy()
})
