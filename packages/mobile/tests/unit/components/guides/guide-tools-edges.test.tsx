import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { GuideTools } from '../../../../components/guides/guide-tools'
import { useGatherTicks } from '../../../../lib/guide-progress'

// The screen owns the ticks (useGatherTicks); this stands in for it.
function Tools({ tools }: { tools: React.ComponentProps<typeof GuideTools>['tools'] }) {
  const g = useGatherTicks('g', [], tools)
  return <GuideTools tools={tools} ticks={g.tools} />
}

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
const mockGetItem = jest.fn()
const mockSetItem = jest.fn()
jest.mock('../../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({ getItem: (...a: unknown[]) => mockGetItem(...a), setItem: (...a: unknown[]) => mockSetItem(...a), removeItem: jest.fn() }),
}))

const tool = (n: number, over: object = {}) => ({ id: `t${n}`, tutorial_id: 'g', name: `Tool ${n}`, is_optional: false, buy_links: [], note: null, get_by: null, ...over })

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockGetItem.mockResolvedValue(null)
  mockSetItem.mockResolvedValue(undefined)
})
afterEach(() => jest.restoreAllMocks())

it('says No tools listed and hides the count for a guide with none', () => {
  render(<Tools tools={[]} />)
  expect(screen.getByText('No tools listed.')).toBeTruthy()
  expect(screen.queryByText(/already yours/)).toBeNull()
})

it('marks an optional tool in its name', () => {
  render(<Tools tools={[tool(1, { is_optional: true })]} />)
  expect(screen.getByText('Tool 1 (optional)')).toBeTruthy()
})

it('un-ticks a tool on a second tap', async () => {
  render(<Tools tools={[tool(1)]} />)
  fireEvent.press(await screen.findByLabelText('I already have Tool 1'))
  fireEvent.press(screen.getByLabelText('I do not have Tool 1'))
  expect(screen.getByText('0 of 1 already yours')).toBeTruthy()
  expect(mockSetItem).toHaveBeenLastCalledWith('guide-tools.g.signed-out', '[]')
})

it('restores tools saved on the device, ignoring ones the guide dropped', async () => {
  mockGetItem.mockResolvedValue('["t1","removed"]')
  render(<Tools tools={[tool(1), tool(2)]} />)
  expect(await screen.findByText('1 of 2 already yours')).toBeTruthy()
  expect(mockGetItem).toHaveBeenCalledWith('guide-tools.g.signed-out')
})

it('keeps tool ticks apart from step ticks for the same guide', async () => {
  render(<Tools tools={[tool(1)]} />)
  await waitFor(() => expect(mockGetItem).toHaveBeenCalled())
  expect(mockGetItem).not.toHaveBeenCalledWith('guide-steps.g.signed-out')
})

it('counts 80 tools and ticks the last', async () => {
  render(<Tools tools={Array.from({ length: 80 }, (_, i) => tool(i + 1))} />)
  fireEvent.press(await screen.findByLabelText('I already have Tool 80'))
  expect(screen.getByText('1 of 80 already yours')).toBeTruthy()
})

it('shows a long, emoji, markup tool name and note as written, with a get-by tag', async () => {
  const name = `🧸 <Drill> & "bit" ${'x'.repeat(200)}`
  render(<Tools tools={[tool(1, { name, note: "Don't <force> it", get_by: 'buy' })]} />)
  expect(await screen.findByText(name)).toBeTruthy()
  expect(screen.getByText("Don't <force> it")).toBeTruthy()
})

it('still ticks in memory when the device store refuses', async () => {
  mockGetItem.mockRejectedValue(new Error('locked'))
  mockSetItem.mockRejectedValue(new Error('locked'))
  render(<Tools tools={[tool(1)]} />)
  fireEvent.press(await screen.findByLabelText('I already have Tool 1'))
  await waitFor(() => expect(mockSetItem).toHaveBeenCalled())
  expect(screen.getByText('1 of 1 already yours')).toBeTruthy()
})
