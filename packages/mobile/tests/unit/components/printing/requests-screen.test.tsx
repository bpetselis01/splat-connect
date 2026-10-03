// My print requests: one row per request, live first, only the viewer's own.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { PrintRequestsScreen } from '../../../../components/printing/requests-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []), useRouter: () => ({ push: mockPush }) }
})
let mockCaps: { profile: { id: string } } | null = { profile: { id: 'family' } }
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: mockCaps }) }))

const DAY = 864e5
const row = (id: string, over: object = {}) => ({
  id,
  type: 'print',
  status: 'requested',
  requester_id: 'family',
  print_group_id: `grp-${id}`,
  print_group_size: 1,
  tutorial_title: `Guide ${id}`,
  other_party_name: 'Tom B.',
  print_files: [{ id: 's', filename: 'a.stl', quantity: 1 }],
  printing_started_at: null,
  ready_at: null,
  created_at: new Date().toISOString(),
  ...over,
})
const serve = (rows: unknown[]) => mockGet.mockResolvedValue(rows)

beforeEach(() => {
  mockGet.mockReset()
  mockPush.mockReset()
  mockCaps = { profile: { id: 'family' } }
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

it('shows only where to start when the family has asked nobody yet', async () => {
  serve([])
  render(<PrintRequestsScreen />)
  expect(await screen.findByText('New request')).toBeTruthy()
  expect(screen.queryByLabelText(/, Requested$/)).toBeNull()
})

it('says the list could not load when the read fails, and shows no rows', async () => {
  mockGet.mockRejectedValue(new Error('Network request failed'))
  render(<PrintRequestsScreen />)
  expect(await screen.findByText("Couldn't load your print requests.")).toBeTruthy()
  expect(screen.queryByText('New request')).toBeNull()
})

it('leaves out donations, builds, and prints that other people asked for', async () => {
  serve([
    row('mine'),
    row('donation', { type: 'donation' }),
    row('build', { type: 'build' }),
    row('theirs', { requester_id: 'someone-else' }),
  ])
  render(<PrintRequestsScreen />)
  expect(await screen.findByText('Guide mine')).toBeTruthy()
  for (const hidden of ['donation', 'build', 'theirs']) expect(screen.queryByText(`Guide ${hidden}`)).toBeNull()
})

it('folds a request sent to three printers into one row that says so', async () => {
  serve([row('a', { print_group_id: 'g', print_group_size: 3 }), row('b', { print_group_id: 'g', print_group_size: 3 }), row('c', { print_group_id: 'g', print_group_size: 3 })])
  render(<PrintRequestsScreen />)
  expect(await screen.findByText(/3 printers asked/)).toBeTruthy()
  expect(screen.getAllByLabelText(/Guide .*, Requested/)).toHaveLength(1)
})

it('names the printer once one has taken the request', async () => {
  serve([
    row('a', { print_group_id: 'g', status: 'withdrawn', other_party_name: 'Ann' }),
    row('b', { print_group_id: 'g', status: 'accepted', other_party_name: 'Tom B.' }),
  ])
  render(<PrintRequestsScreen />)
  expect(await screen.findByText(/Tom B\./)).toBeTruthy()
  expect(screen.queryByText(/Ann/)).toBeNull()
  expect(screen.queryByText(/printers asked/)).toBeNull()
})

it('puts live requests above finished ones, keeping the API order inside each half', async () => {
  serve([
    row('done1', { status: 'completed' }),
    row('live1'),
    row('declined', { status: 'rejected' }),
    row('live2', { status: 'accepted' }),
  ])
  render(<PrintRequestsScreen />)
  await screen.findByText('Guide live1')
  const titles = screen.getAllByText(/^Guide /).map((n) => n.props.children)
  expect(titles).toEqual(['Guide live1', 'Guide live2', 'Guide done1', 'Guide declined'])
})

it('counts parts by quantity and says "1 part" for one', async () => {
  serve([
    row('one'),
    row('many', { print_files: [{ id: 'a', filename: 'a.stl', quantity: 3 }, { id: 'b', filename: 'b.stl', quantity: 2 }] }),
    row('none', { print_files: undefined }),
  ])
  render(<PrintRequestsScreen />)
  expect(await screen.findByText(/^1 part · /)).toBeTruthy()
  expect(screen.getByText(/^5 parts · /)).toBeTruthy()
  expect(screen.getByText(/^0 parts · /)).toBeTruthy()
})

it('marks an unanswered request older than a week as Expired and not live', async () => {
  serve([row('old', { created_at: new Date(Date.now() - 8 * DAY).toISOString() }), row('fresh', { status: 'accepted' })])
  render(<PrintRequestsScreen />)
  await screen.findByText('Guide old')
  expect(screen.getByLabelText('Guide old, Expired')).toBeTruthy()
  // Expired is not live, so it sits under the accepted one even though it came first.
  const titles = screen.getAllByText(/^Guide /).map((n) => n.props.children)
  expect(titles).toEqual(['Guide fresh', 'Guide old'])
})

it('labels each stage in the words of the job page', async () => {
  serve([
    row('asked'),
    row('accepted', { status: 'accepted' }),
    row('printing', { status: 'accepted', printing_started_at: 'x' }),
    row('ready', { status: 'accepted', printing_started_at: 'x', ready_at: 'y' }),
    row('collected', { status: 'completed' }),
    row('declined', { status: 'rejected' }),
    row('withdrawn', { status: 'withdrawn' }),
  ])
  render(<PrintRequestsScreen />)
  await screen.findByText('Guide asked')
  for (const [id, label] of [
    ['asked', 'Requested'],
    ['accepted', 'Accepted'],
    ['printing', 'Printing'],
    ['ready', 'Ready for pickup'],
    ['collected', 'Collected'],
    ['declined', 'Declined'],
    ['withdrawn', 'Withdrawn'],
  ]) {
    expect(screen.getByLabelText(`Guide ${id}, ${label}`)).toBeTruthy()
  }
})

it('titles a request whose guide was deleted "A print job"', async () => {
  serve([row('x', { tutorial_title: null })])
  render(<PrintRequestsScreen />)
  expect(await screen.findByLabelText('A print job, Requested')).toBeTruthy()
})

it.each(NAMES)('shows a guide titled with $label as typed', async ({ value }) => {
  serve([row('x', { tutorial_title: value })])
  render(<PrintRequestsScreen />)
  expect(await screen.findByText(value)).toBeTruthy()
})

it('opens the job on tap, and Find a guide from the New request row', async () => {
  serve([row('j7')])
  render(<PrintRequestsScreen />)
  fireEvent.press(await screen.findByLabelText('Guide j7, Requested'))
  expect(mockPush).toHaveBeenCalledWith('/printing/jobs/j7')
  fireEvent.press(screen.getByText('New request'))
  expect(mockPush).toHaveBeenCalledWith('/guides')
})

it('shows a skeleton and no empty state until the profile is known', async () => {
  mockCaps = null
  serve([row('a')])
  render(<PrintRequestsScreen />)
  expect(screen.queryByText('New request')).toBeNull()
})
