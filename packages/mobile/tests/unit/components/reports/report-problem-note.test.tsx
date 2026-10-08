import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ReportProblem } from '../../../../components/reports/report-problem'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPost = jest.fn().mockResolvedValue({})
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a) } }))

it('offers the note reasons and posts subject_kind note with the note id', async () => {
  render(<ReportProblem subjectKind="note" subjectId="n1" subjectLabel="Sam R's note on Light Touch Switch" />)
  fireEvent.press(screen.getByText('Report a problem'))
  expect(screen.getByText("About Sam R's note on Light Touch Switch. Goes to the SPLAT team only.")).toBeTruthy()
  expect(screen.queryByText('Didn’t show up')).toBeNull()
  fireEvent.press(screen.getByText('Wrong or missing info'))
  fireEvent.changeText(screen.getByLabelText('What happened?'), 'The tip is for a different switch.')
  fireEvent.press(screen.getByRole('button', { name: 'Send report' }))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/reports', expect.objectContaining({ subject_kind: 'note', subject_id: 'n1' })))
})
