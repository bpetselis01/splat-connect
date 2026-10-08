import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { ReportProblem } from '../../../../components/reports/report-problem'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a) } }))

beforeEach(() => {
  jest.clearAllMocks()
  mockPost.mockResolvedValue({})
})

const open = (props: Partial<React.ComponentProps<typeof ReportProblem>> = {}) => {
  render(<ReportProblem subjectKind="toy" subjectId="t1" subjectLabel="Drum" {...props} />)
  fireEvent.press(screen.getByRole('button', { name: 'Report a problem' }))
}
const send = () => screen.getByRole('button', { name: 'Send report' })
const write = (t: string) => fireEvent.changeText(screen.getByLabelText('What happened?'), t)
const pick = (name: string) => fireEvent.press(screen.getByRole('radio', { name }))

describe('ReportProblem validation', () => {
  it('Send is off until there is both a reason and some words', () => {
    open()
    expect(send()).toBeDisabled()
    pick('Safety concern')
    expect(send()).toBeDisabled()
    write('Hot.')
    expect(send()).not.toBeDisabled()
  })

  it.each([['spaces', '    '], ['newlines and tabs', '\n\t\n'], ['empty', '']])(
    'whitespace-only text (%s) cannot be sent', (_l, t) => {
      open()
      pick('Behaviour')
      write(t)
      expect(send()).toBeDisabled()
      fireEvent.press(send())
      expect(mockPost).not.toHaveBeenCalled()
    })

  it('clearing the text again disables Send', () => {
    open()
    pick('Behaviour'); write('x'); write('')
    expect(send()).toBeDisabled()
  })
})

describe('ReportProblem sends the right thing', () => {
  it.each([
    ['Arrived broken', 'arrived_broken'], ['Didn’t show up', 'no_show'], ['Safety concern', 'safety'],
    ['Wrong or missing info', 'wrong_info'], ['Behaviour', 'conduct'], ['Something else', 'other'],
  ])('the %s chip files category %s', async (label, category) => {
    open({ subjectKind: 'exchange' })
    pick(label); write('Details')
    fireEvent.press(send())
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/reports', expect.objectContaining({ category })))
  })

  it('changing your mind about the reason sends the last one picked', async () => {
    open()
    pick('Behaviour'); pick('Something else'); write('x')
    fireEvent.press(send())
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/reports', expect.objectContaining({ category: 'other' })))
  })

  it('a null subject id (a report about nothing in particular) is sent as null', async () => {
    open({ subjectId: null })
    pick('Behaviour'); write('x')
    fireEvent.press(send())
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/reports', expect.objectContaining({ subject_id: null })))
  })

  it.each<[string, string]>([...NAMES.map((c): [string, string] => [c.label, c.value]), ['20000 characters', 'y'.repeat(20000)]])(
    'carries %s through verbatim', async (_l, text) => {
      open()
      pick('Behaviour'); write(text)
      fireEvent.press(send())
      await waitFor(() => expect(mockPost).toHaveBeenCalled())
      expect(mockPost.mock.calls[0][1].body).toBe(text)
    })

  it('a label with quotes and angle brackets is shown as text and sent as-is', async () => {
    const label = '"Drum" <b>&</b> 🧸'
    open({ subjectLabel: label })
    expect(screen.getByText(`About ${label}. Goes to the SPLAT team only.`)).toBeTruthy()
    pick('Behaviour'); write('x')
    fireEvent.press(send())
    await waitFor(() => expect(mockPost.mock.calls[0][1].subject_label).toBe(label))
  })
})

describe('ReportProblem outcome', () => {
  it('a safety report promises a reply today, any other within two days', async () => {
    open()
    pick('Safety concern'); write('x')
    fireEvent.press(send())
    expect(await screen.findByText('Sent. Safety reports go to the top of the queue — expect a reply today.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Send report' })).toBeNull()
  })

  it('anything else says two days', async () => {
    open()
    pick('Behaviour'); write('x')
    fireEvent.press(send())
    expect(await screen.findByText('Sent to SPLAT. You will hear back within two days.')).toBeTruthy()
  })

  it.each([['network', new Error('Network request failed')], ['429', new Error('Request failed with status 429')], ['500', new Error('Request failed with status 500')]])(
    'a %s failure shows an alert, keeps what was typed and allows a retry', async (_l, err) => {
      mockPost.mockRejectedValueOnce(err)
      open()
      pick('Behaviour'); write('My long account')
      fireEvent.press(send())
      expect(await screen.findByText('Could not send that. Please try again.')).toBeTruthy()
      expect(screen.getByLabelText('What happened?').props.value).toBe('My long account')
      expect(send()).not.toBeDisabled()
      fireEvent.press(send())
      expect(await screen.findByText('Sent to SPLAT. You will hear back within two days.')).toBeTruthy()
      expect(mockPost).toHaveBeenCalledTimes(2)
    })

  it('a double tap on Send files one report', async () => {
    let resolve!: (v: unknown) => void
    mockPost.mockReturnValue(new Promise((r) => { resolve = r }))
    open()
    pick('Behaviour'); write('x')
    fireEvent.press(send()); fireEvent.press(send())
    await act(async () => { resolve({}) })
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('reopening after a sent report starts blank, with contact back on', async () => {
    open()
    pick('Behaviour'); write('first')
    fireEvent.press(send())
    await screen.findByText(/Sent to SPLAT/)
    fireEvent.press(screen.getByRole('button', { name: 'Done' }))
    fireEvent.press(screen.getByRole('button', { name: 'Report a problem' }))
    expect(screen.getByLabelText('What happened?').props.value).toBe('')
    expect(send()).toBeDisabled()
    expect(screen.queryByText(/Sent to SPLAT/)).toBeNull()
  })

  it('a failure message is cleared when the sheet is reopened', async () => {
    mockPost.mockRejectedValueOnce(new Error('x'))
    open()
    pick('Behaviour'); write('x')
    fireEvent.press(send())
    await screen.findByText('Could not send that. Please try again.')
    fireEvent.press(screen.getAllByRole('button', { name: 'Close' })[0])
    fireEvent.press(screen.getByRole('button', { name: 'Report a problem' }))
    expect(screen.queryByText('Could not send that. Please try again.')).toBeNull()
  })

  it('names who it is about only when told', () => {
    open({ item: 'this toy', who: 'Sam "Sparky" <Lee>' })
    expect(screen.getByText('About this toy · with Sam "Sparky" <Lee>. Goes to the SPLAT team only.')).toBeTruthy()
  })
})

describe('ReportProblem sheet', () => {
  it('closes when the dimmed page behind it is tapped, and from its ✕', () => {
    open()
    expect(screen.getByText('Tell SPLAT what happened')).toBeTruthy()
    fireEvent.press(screen.getAllByRole('button', { name: 'Close' })[0]) // the backdrop
    expect(screen.queryByText('Tell SPLAT what happened')).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'Report a problem' }))
    fireEvent.press(screen.getAllByRole('button', { name: 'Close' })[1]) // the ✕
    expect(screen.queryByText('Tell SPLAT what happened')).toBeNull()
  })

  it('offers a guide only the reasons that can happen to a guide', () => {
    open({ subjectKind: 'guide' })
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.queryByRole('radio', { name: 'Arrived broken' })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Didn’t show up' })).toBeNull()
    expect(screen.getByRole('radio', { name: 'Safety concern' })).toBeTruthy()
  })

  it('is a checkbox for OK to contact, ticked by default, and unticking sends false', async () => {
    open()
    const box = screen.getByRole('checkbox', { name: /OK to contact me about this/ })
    expect(box.props.accessibilityState.checked).toBe(true)
    fireEvent.press(box)
    expect(screen.getByRole('checkbox', { name: /OK to contact me about this/ }).props.accessibilityState.checked).toBe(false)
    pick('Safety concern'); write('Sharp edge')
    fireEvent.press(send())
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/reports', expect.objectContaining({ ok_to_contact: false })))
  })

  it('says what is missing while Send is not ready', () => {
    open()
    expect(screen.getByText('Pick what it is about, then say what happened.')).toBeTruthy()
    pick('Safety concern')
    expect(screen.getByText('Say what happened to send it.')).toBeTruthy()
  })
})
