import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import { GuideSteps } from '../../../../components/guides/guide-steps'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockSetItem = jest.fn().mockResolvedValue(undefined)
jest.mock('../../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({ getItem: jest.fn().mockResolvedValue(null), setItem: (...a: unknown[]) => mockSetItem(...a), removeItem: jest.fn() }),
}))

const steps = [
  { id: 'a', tutorial_id: 'g', position: 1, title: 'Open the battery bay', body: 'One screw.', photo_url: null },
  { id: 'b', tutorial_id: 'g', position: 2, title: 'Slide the interrupter in', body: 'Copper side down.', photo_url: null },
]

it('ticks steps, shows progress and where to pick up, and resets', async () => {
  render(<GuideSteps tutorialId="g" steps={steps} completion={(n) => <Text>{`All ${n} steps done`}</Text>} />)
  expect(await screen.findByText('0 of 2 steps done')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Mark step 1 done'))
  expect(screen.getByText('50%')).toBeTruthy()
  expect(screen.getByText('Pick up at step 2 — Slide the interrupter in')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Mark step 2 done'))
  expect(screen.getByText('All 2 steps done')).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Reset' }))
  expect(screen.getByText('Step progress cleared')).toBeTruthy()
  await waitFor(() => expect(screen.getByText('0 of 2 steps done')).toBeTruthy())
})

it('labels steps with their notes and adds pinned missing steps at the end', async () => {
  render(
    <GuideSteps
      tutorialId="g"
      steps={steps}
      completion={() => null}
      noteLabels={new Map([[1, '1 pinned revision · 2 notes']])}
      extras={[{ no: 3, body: 'Test the switch first.', by: 'Priya', pinnedBy: 'Sam' }]}
    />
  )
  expect(await screen.findByText('1 pinned revision · 2 notes')).toBeTruthy()
  expect(screen.getByText('Added by the community')).toBeTruthy()
  expect(screen.getByText('Pinned by Sam · suggested by Priya')).toBeTruthy()
})
