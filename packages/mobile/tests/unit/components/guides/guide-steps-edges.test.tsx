import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import { GuideSteps } from '../../../../components/guides/guide-steps'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGetItem = jest.fn()
const mockSetItem = jest.fn()
jest.mock('../../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({ getItem: (...a: unknown[]) => mockGetItem(...a), setItem: (...a: unknown[]) => mockSetItem(...a), removeItem: jest.fn() }),
}))

const step = (n: number, over: object = {}) => ({ id: `s${n}`, tutorial_id: 'g', position: n, title: `Title ${n}`, body: `Body ${n}`, photo_url: null, ...over })
const many = (n: number) => Array.from({ length: n }, (_, i) => step(i + 1))
const done = (n: number) => <Text>{`All ${n} done`}</Text>

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockGetItem.mockResolvedValue(null)
  mockSetItem.mockResolvedValue(undefined)
})
afterEach(() => jest.restoreAllMocks())

it('shows 0 of 0 and never the completion for a guide with no steps', async () => {
  render(<GuideSteps tutorialId="g" steps={[]} completion={done} />)
  expect(await screen.findByText('0 of 0 steps done')).toBeTruthy()
  expect(screen.getByText('0%')).toBeTruthy()
  expect(screen.queryByText(/All \d+ done/)).toBeNull()
})

it('completes a one-step guide with a single tap', async () => {
  render(<GuideSteps tutorialId="g" steps={many(1)} completion={done} />)
  fireEvent.press(await screen.findByLabelText('Mark step 1 done'))
  expect(screen.getByText('100%')).toBeTruthy()
  expect(screen.getByText('All 1 done')).toBeTruthy()
  expect(screen.queryByText(/Pick up at/)).toBeNull()
})

it('un-ticks a step on a second tap and withdraws the completion', async () => {
  render(<GuideSteps tutorialId="g" steps={many(1)} completion={done} />)
  fireEvent.press(await screen.findByLabelText('Mark step 1 done'))
  fireEvent.press(screen.getByLabelText('Mark step 1 as not done'))
  expect(screen.queryByText('All 1 done')).toBeNull()
  expect(screen.getByText('0 of 1 steps done')).toBeTruthy()
})

it('restores ticks saved on the device and saves new ones under this guide’s key', async () => {
  mockGetItem.mockResolvedValue('["s1"]')
  render(<GuideSteps tutorialId="g" steps={many(3)} completion={done} />)
  expect(await screen.findByText('1 of 3 steps done')).toBeTruthy()
  expect(mockGetItem).toHaveBeenCalledWith('guide-steps.g')
  fireEvent.press(screen.getByLabelText('Mark step 2 done'))
  expect(mockSetItem).toHaveBeenLastCalledWith('guide-steps.g', '["s1","s2"]')
})

it('ignores a stored tick for a step the guide no longer has, so it cannot fake completion', async () => {
  mockGetItem.mockResolvedValue('["gone","s1"]')
  render(<GuideSteps tutorialId="g" steps={many(2)} completion={done} />)
  expect(await screen.findByText('1 of 2 steps done')).toBeTruthy()
  expect(screen.queryByText('All 2 done')).toBeNull()
})

it('keeps two steps that share a position ticking independently', async () => {
  const dup = [step(1, { id: 'a', body: 'first' }), step(1, { id: 'b', body: 'second' })]
  render(<GuideSteps tutorialId="g" steps={dup} completion={done} />)
  fireEvent.press((await screen.findAllByLabelText('Mark step 1 done'))[0])
  expect(screen.getByText('1 of 2 steps done')).toBeTruthy()
  expect(screen.getAllByLabelText('Mark step 1 done')).toHaveLength(1)
})

it('points at the first untouched step, and drops the dash when it has no title', async () => {
  render(<GuideSteps tutorialId="g" steps={[step(1), step(2, { title: null }), step(3)]} completion={done} />)
  fireEvent.press(await screen.findByLabelText('Mark step 1 done'))
  expect(screen.getByText('Pick up at step 2')).toBeTruthy()
})

it('renders 150 steps and ticks the last one', async () => {
  render(<GuideSteps tutorialId="g" steps={many(150)} completion={done} />)
  fireEvent.press(await screen.findByLabelText('Mark step 150 done'))
  expect(screen.getByText('1 of 150 steps done')).toBeTruthy()
  expect(screen.getByText('1%')).toBeTruthy()
})

it('shows emoji, markup and very long step text as it was written', async () => {
  const body = `🧸 <b>"Twist"</b> & 'pull' ${'x'.repeat(4000)}`
  render(<GuideSteps tutorialId="g" steps={[step(1, { title: '⚠️ <Careful> & "slow"', body })]} completion={done} />)
  expect(await screen.findByText('⚠️ <Careful> & "slow"')).toBeTruthy()
  expect(screen.getByText(body)).toBeTruthy()
})

it('gives a step photo the step’s number and title as its name', async () => {
  render(<GuideSteps tutorialId="g" steps={[step(1, { photo_url: 'p.jpg' }), step(2, { title: null, photo_url: 'q.jpg' })]} completion={done} />)
  expect(await screen.findByLabelText('Step 1: Title 1')).toBeTruthy()
  expect(screen.getByLabelText('Step 2')).toBeTruthy()
})

it('shows each community extra with who pinned and who suggested it', async () => {
  render(
    <GuideSteps
      tutorialId="g"
      steps={many(1)}
      completion={done}
      extras={[
        { no: 2, body: 'First extra', by: 'Priya', pinnedBy: 'Sam' },
        { no: 3, body: 'Second extra', by: 'سارة', pinnedBy: 'Deleted member' },
      ]}
    />
  )
  expect(await screen.findByText('Pinned by Deleted member · suggested by سارة')).toBeTruthy()
  expect(screen.getAllByText('Added by the community')).toHaveLength(2)
})

it('still ticks in memory when the device refuses both the read and the write', async () => {
  mockGetItem.mockRejectedValue(new Error('locked'))
  mockSetItem.mockRejectedValue(new Error('locked'))
  render(<GuideSteps tutorialId="g" steps={many(2)} completion={done} />)
  fireEvent.press(await screen.findByLabelText('Mark step 1 done'))
  await waitFor(() => expect(mockSetItem).toHaveBeenCalled())
  expect(screen.getByText('1 of 2 steps done')).toBeTruthy()
})

it('keeps one guide’s ticks apart from another’s', async () => {
  const { rerender } = render(<GuideSteps tutorialId="g1" steps={many(2)} completion={done} />)
  await screen.findByText('0 of 2 steps done')
  expect(mockGetItem).toHaveBeenCalledWith('guide-steps.g1')
  rerender(<GuideSteps tutorialId="g2" steps={many(2)} completion={done} />)
  await waitFor(() => expect(mockGetItem).toHaveBeenCalledWith('guide-steps.g2'))
})
