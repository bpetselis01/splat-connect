import { render, screen, fireEvent } from '@testing-library/react-native'
import { ReportParticipant } from '../../../../components/challenges/report-participant'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a) } }))

it('shows the server sentence word for word and does not tell the screen', async () => {
  const onReported = jest.fn()
  mockPost.mockRejectedValue(new Error('POST failed with status 404: That person is not part of this challenge'))
  render(<ReportParticipant ideaId="c1" profileId="p1" name="Sam" onReported={onReported} />)
  fireEvent.press(screen.getByRole('button', { name: 'Report Sam' }))
  fireEvent.changeText(screen.getByLabelText('Why are you reporting them?'), 'Rude.')
  fireEvent.press(screen.getByRole('button', { name: 'Send report' }))
  expect(await screen.findByText('That person is not part of this challenge')).toBeTruthy()
  expect(onReported).not.toHaveBeenCalled()
})
