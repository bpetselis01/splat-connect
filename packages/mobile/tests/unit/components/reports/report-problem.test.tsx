import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ReportProblem } from '../../../../components/reports/report-problem'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a) } }))

beforeEach(() => {
  jest.clearAllMocks()
  mockPost.mockResolvedValue({})
})

describe('ReportProblem', () => {
  it('reports an exchange, says who with, and asks before it says OK to contact', async () => {
    render(<ReportProblem subjectKind="exchange" subjectId="tx1" subjectLabel="Drum — exchange with Northside" item="this exchange" who="Northside" />)
    fireEvent.press(screen.getByRole('button', { name: 'Report a problem' }))
    expect(screen.getByText('About this exchange · with Northside. Goes to the SPLAT team only.')).toBeTruthy()
    fireEvent.press(screen.getByRole('radio', { name: 'Didn’t show up' }))
    fireEvent.changeText(screen.getByLabelText('What happened?'), 'Nobody came.')
    // On by default, as the board draws it; the reporter can say no.
    fireEvent.press(screen.getByRole('checkbox', { name: /OK to contact me about this/ }))
    fireEvent.press(screen.getByRole('button', { name: 'Send report' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/reports', {
        subject_kind: 'exchange',
        subject_id: 'tx1',
        subject_label: 'Drum — exchange with Northside',
        category: 'no_show',
        body: 'Nobody came.',
        ok_to_contact: false,
      })
    )
  })

  it('falls back to the label when the board gives no item, and sends OK to contact when left on', async () => {
    render(<ReportProblem subjectKind="toy" subjectId="t1" subjectLabel="Bubble machine" />)
    fireEvent.press(screen.getByRole('button', { name: 'Report a problem' }))
    expect(screen.getByText('About Bubble machine. Goes to the SPLAT team only.')).toBeTruthy()
    fireEvent.press(screen.getByRole('radio', { name: 'Safety concern' }))
    fireEvent.changeText(screen.getByLabelText('What happened?'), 'Gets warm.')
    fireEvent.press(screen.getByRole('button', { name: 'Send report' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/reports', expect.objectContaining({ ok_to_contact: true })))
  })
})
