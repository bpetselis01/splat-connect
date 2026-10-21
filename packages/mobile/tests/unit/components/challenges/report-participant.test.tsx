import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ReportParticipant } from '../../../../components/challenges/report-participant'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a) } }))

const onReported = jest.fn()
const open = () => {
  render(<ReportParticipant ideaId="c1" profileId="p1" name="Sam" onReported={onReported} />)
  fireEvent.press(screen.getByRole('button', { name: 'Report Sam' }))
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPost.mockResolvedValue({ reported: true })
})

describe('ReportParticipant', () => {
  it('says what happens, and will not send without a reason', () => {
    open()
    expect(screen.getByText("You won't see them here any more. SPLAT will look at it, and they won't see your name.")).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send report' }).props.accessibilityState.disabled).toBe(true)
    fireEvent.changeText(screen.getByLabelText('Why are you reporting them?'), '   ')
    expect(screen.getByRole('button', { name: 'Send report' }).props.accessibilityState.disabled).toBe(true)
  })

  it('C16 posts the trimmed reason against that person, then tells the screen', async () => {
    open()
    fireEvent.changeText(screen.getByLabelText('Why are you reporting them?'), '  Rude in the thread.  ')
    fireEvent.press(screen.getByRole('button', { name: 'Send report' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/ideas/c1/reports', { reported_profile_id: 'p1', reason: 'Rude in the thread.' }))
    await waitFor(() => expect(onReported).toHaveBeenCalled())
  })
})
