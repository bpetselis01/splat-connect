// "Also worth a look" with nothing to pick, a fourth pick, a second tap and a
// failed save. Ordinary journeys: picks-editor.test.tsx.
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { PicksEditor } from '../../../../components/my-toys/picks-editor'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
const mockPatch = jest.fn()
const mockPut = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { patch: (...a: unknown[]) => mockPatch(...a), put: (...a: unknown[]) => mockPut(...a) } }))

const toy = (over: object = {}) => ({
  id: 't1', owner_id: 'me', owner_org_id: null, quantity: 1, name: 'Drum', description: null, condition: 8, switch_adapted: false,
  photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'published', offer_type: 'donation', created_at: '', updated_at: '', ...over,
}) as never
const picked = (extra: object = {}) => toy({ picks_mode: 'picked', toy_picks: [], ...extra })
const guides = [{ id: 'g1', title: 'Switch mount' }, { id: 'g2', title: 'Big button' }]

beforeEach(() => jest.clearAllMocks())

it('offers nothing to pick, and still saves an empty list, when there are no other toys or guides', async () => {
  mockPut.mockResolvedValue({})
  render(<PicksEditor toy={picked()} ownToys={[]} guides={[]} onSaved={jest.fn()} />)
  fireEvent.press(screen.getByText('Save picks'))
  await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/api/toys/t1/picks', { picks: [] }))
})

it('ignores a fourth pick, and lets one go and another take its place', async () => {
  mockPut.mockResolvedValue({})
  const many = [{ id: 'g1', title: 'One' }, { id: 'g2', title: 'Two' }, { id: 'g3', title: 'Three' }, { id: 'g4', title: 'Four' }]
  render(<PicksEditor toy={picked()} ownToys={[]} guides={many} onSaved={jest.fn()} />)
  for (const t of ['One', 'Two', 'Three', 'Four']) fireEvent.press(screen.getByText(t))
  fireEvent.press(screen.getByText('Two'))
  fireEvent.press(screen.getByText('Four'))
  fireEvent.press(screen.getByText('Save picks'))
  await waitFor(() => expect(mockPut).toHaveBeenCalled())
  expect(mockPut.mock.calls[0][1].picks.map((p: { entity_id: string }) => p.entity_id)).toEqual(['g1', 'g3', 'g4'])
})

it('starts from the picks already saved, in their order', async () => {
  mockPut.mockResolvedValue({})
  const t = picked({ toy_picks: [{ position: 1, entity_type: 'tutorial', entity_id: 'g2' }, { position: 2, entity_type: 'tutorial', entity_id: 'g1' }] })
  render(<PicksEditor toy={t} ownToys={[]} guides={guides} onSaved={jest.fn()} />)
  fireEvent.press(screen.getByText('Save picks'))
  await waitFor(() => expect(mockPut.mock.calls[0][1].picks.map((p: { entity_id: string }) => p.entity_id)).toEqual(['g2', 'g1']))
})

it('saves once when Save picks is pressed twice before the answer', () => {
  mockPut.mockReturnValue(new Promise(() => {}))
  render(<PicksEditor toy={picked()} ownToys={[]} guides={guides} onSaved={jest.fn()} />)
  fireEvent.press(screen.getByText('Save picks'))
  fireEvent.press(screen.getByText('Save picks'))
  expect(mockPut).toHaveBeenCalledTimes(1)
})

it('shows the API reason, keeps the picks, and does not report a save when the save is refused', async () => {
  mockPut.mockRejectedValue(new Error('API PUT /x failed with status 400: A pick must be one of your listed toys or an approved guide'))
  const onSaved = jest.fn()
  render(<PicksEditor toy={picked()} ownToys={[]} guides={guides} onSaved={onSaved} />)
  fireEvent.press(screen.getByText('Switch mount'))
  fireEvent.press(screen.getByText('Save picks'))
  expect(await screen.findByText('A pick must be one of your listed toys or an approved guide')).toBeTruthy()
  expect(onSaved).not.toHaveBeenCalled()
  fireEvent.press(screen.getByText('Save picks'))
  await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(2))
  expect(mockPut.mock.calls[1][1].picks).toHaveLength(1)
})

it('says the phone is offline, and falls back to a plain line on a server error', async () => {
  mockPut.mockRejectedValueOnce(new TypeError('Network request failed')).mockRejectedValueOnce(new Error('API PUT /x failed with status 500: pg'))
  render(<PicksEditor toy={picked()} ownToys={[]} guides={guides} onSaved={jest.fn()} />)
  fireEvent.press(screen.getByText('Save picks'))
  expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy()
  fireEvent.press(screen.getByText('Save picks'))
  expect(await screen.findByText('Could not save your picks. Please try again.')).toBeTruthy()
})

it('keeps the mode where it was when switching it fails, and says why', async () => {
  mockPatch.mockRejectedValue(new Error('API PATCH /x failed with status 409: Publish the toy first'))
  const onSaved = jest.fn()
  render(<PicksEditor toy={toy({ picks_mode: 'auto' })} ownToys={[]} guides={[]} onSaved={onSaved} />)
  fireEvent.press(screen.getByText('Hand-picked'))
  expect(await screen.findByText('Publish the toy first')).toBeTruthy()
  expect(onSaved).not.toHaveBeenCalled()
  expect(screen.queryByText('Save picks')).toBeNull()
})

it.each(NAMES.filter((n) => !/spaces|long/.test(n.label)))('draws a guide titled with $label text as a chip', (n) => {
  render(<PicksEditor toy={picked()} ownToys={[]} guides={[{ id: 'g1', title: n.value }]} onSaved={jest.fn()} />)
  expect(screen.getByText(n.value)).toBeTruthy()
})
