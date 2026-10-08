// Request a print: the guard rails around the form — what disables Send, what
// is sent for each outlier input, and what the family sees when the API says no.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { RequestPrintScreen } from '../../../../components/printing/request-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }) }))

const part = (id: string, over: object = {}) => ({
  id,
  filename: `${id}.stl`,
  print_minutes: 60,
  filament_grams: 10,
  material: 'PETG',
  ...over,
})
const GUIDE = { id: 'g1', title: 'Switch mount',
  customization_fields: [
    { key: 'mount', label: 'Mount needed', kind: 'choice', options: ['Tray clamp', 'Floor stand'] },
    { key: 'reach', label: 'Reach', kind: 'number', unit: 'mm', min: 100, max: 600 },
  ],
  stl_files: [part('s1'), part('s2', { filament_grams: 4, print_minutes: 20 })] }
const PRINTER = { id: 'p1', owner_id: 'o1', owner_org_id: null, owner_name: 'Tom B.', org_name: null, filament_cents_per_g: null }

type Serve = { guide?: unknown; printers?: unknown; credit?: unknown }
function serve({ guide = GUIDE, printers = [PRINTER], credit = [] }: Serve = {}) {
  mockGet.mockImplementation((path: string) =>
    path === '/api/printers'
      ? Promise.resolve(printers)
      : path === '/api/organizations/recycling/credit'
        ? Promise.resolve(credit)
        : Promise.resolve(guide)
  )
}
const ok = new Error('failed with status 400: Pick at least one part.')

beforeEach(() => {
  mockGet.mockReset()
  mockPost.mockReset()
  mockReplace.mockReset()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  serve()
})

afterEach(() => jest.restoreAllMocks())

const agree = () => fireEvent.press(screen.getByRole('checkbox', { name: /I understand/ }))
const send = () => fireEvent.press(screen.getByText('Send request'))
const sent = () => mockPost.mock.calls[0]![1]

describe('loading', () => {
  it('says the guide could not load when the guide read fails, offline or not', async () => {
    mockGet.mockImplementation(() => Promise.reject(new Error('Network request failed')))
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    expect(await screen.findByText("Couldn't load this guide.")).toBeTruthy()
    expect(screen.queryByText('Send request')).toBeNull()
  })

  it('says the same when the printer list read fails', async () => {
    mockGet.mockImplementation((path: string) => (path === '/api/printers' ? Promise.reject(new Error('boom')) : Promise.resolve(GUIDE)))
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    expect(await screen.findByText("Couldn't load this guide.")).toBeTruthy()
  })

  it('still shows the form when only the recycling credit read fails', async () => {
    mockGet.mockImplementation((path: string) =>
      path === '/api/organizations/recycling/credit'
        ? Promise.reject(new Error('403'))
        : Promise.resolve(path === '/api/printers' ? [PRINTER] : GUIDE)
    )
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    expect(await screen.findByText('Send request')).toBeTruthy()
    expect(screen.queryByText(/of your credit at/)).toBeNull()
  })

  it('names only the printers that were picked, not every printer there is', async () => {
    serve({ printers: [PRINTER, { ...PRINTER, id: 'p2', owner_name: 'Ann' }] })
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    expect(await screen.findByText('Tom B.')).toBeTruthy()
    expect(screen.queryByText('Ann')).toBeNull()
  })

  it('falls back to "A contributor" for a printer whose owner has no readable name', async () => {
    serve({ printers: [{ ...PRINTER, owner_name: null }] })
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    expect(await screen.findByText('A contributor')).toBeTruthy()
  })

  it.each(NAMES)('shows a printer called $label verbatim', async ({ value }) => {
    serve({ printers: [{ ...PRINTER, owner_name: value }] })
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    expect(await screen.findByText(value)).toBeTruthy()
  })
})

describe('when Send is available', () => {
  it('is disabled until the agree line is ticked, and again when it is unticked', async () => {
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    await screen.findByText('Send request')
    expect(screen.getByRole('button', { name: 'Send request' })).toBeDisabled()
    agree()
    expect(screen.getByRole('button', { name: 'Send request' })).toBeEnabled()
    agree()
    expect(screen.getByRole('button', { name: 'Send request' })).toBeDisabled()
    fireEvent.press(screen.getByRole('button', { name: 'Send request' }))
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('is disabled when every part is unticked', async () => {
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    fireEvent.press(await screen.findByLabelText('Include s1.stl'))
    fireEvent.press(screen.getByLabelText('Include s2.stl'))
    agree()
    expect(screen.getByText('0 of 2 parts')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send request' })).toBeDisabled()
  })

  it('is disabled for a guide with no printable parts', async () => {
    serve({ guide: { ...GUIDE, stl_files: [] } })
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    await screen.findByText('Send request')
    agree()
    expect(screen.getByText('0 of 0 parts')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send request' })).toBeDisabled()
  })

  it('is disabled when no printer id came in the route', async () => {
    render(<RequestPrintScreen guideId="g1" printerIds={[]} />)
    await screen.findByText('Send request')
    agree()
    expect(screen.getByRole('button', { name: 'Send request' })).toBeDisabled()
  })
})

describe('parts and quantity', () => {
  it('leaves an unticked part out of what is sent', async () => {
    mockPost.mockResolvedValue({ id: 'j1' })
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    fireEvent.press(await screen.findByLabelText('Include s2.stl'))
    agree()
    send()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(sent().files).toEqual([{ stl_file_id: 's1', quantity: 1 }])
  })

  it('cannot go below one: Fewer is disabled at 1 and a press does nothing', async () => {
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    const fewer = await screen.findByLabelText('Fewer s1.stl')
    expect(fewer).toBeDisabled()
    fireEvent.press(fewer)
    expect(screen.getAllByText('×1')).toHaveLength(2)
  })

  it('stops at twenty, the most the API accepts', async () => {
    mockPost.mockResolvedValue({ id: 'j1' })
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    const more = await screen.findByLabelText('More s1.stl')
    for (let i = 0; i < 25; i++) fireEvent.press(more)
    expect(screen.getByText('×20')).toBeTruthy()
    expect(screen.getByLabelText('More s1.stl')).toBeDisabled()
    agree()
    send()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(sent().files[0]).toEqual({ stl_file_id: 's1', quantity: 20 })
  })

  it('keeps the quantity of a part through unticking and ticking it again', async () => {
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    fireEvent.press(await screen.findByLabelText('More s1.stl'))
    fireEvent.press(screen.getByLabelText('Include s1.stl'))
    expect(screen.getByLabelText('More s1.stl')).toBeDisabled()
    fireEvent.press(screen.getByLabelText('Include s1.stl'))
    expect(screen.getByText('×2')).toBeTruthy()
  })

  it('totals parts and print time over what is ticked, times the quantity', async () => {
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    fireEvent.press(await screen.findByLabelText('More s2.stl'))
    // 60 + 2 x 20 minutes; 10 + 2 x 4 grams.
    expect(screen.getByText('2 of 2 parts · about 1 h 40 · ~18 g PETG')).toBeTruthy()
  })
})

describe('what it costs', () => {
  const rate = (cents: number | null) => serve({ printers: [{ ...PRINTER, filament_cents_per_g: cents }] })

  it('falls back to the plain line for a zero rate rather than promising $0.00', async () => {
    rate(0)
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    expect(await screen.findByText('I understand I cover the filament, and that I settle it with the printer, not through SPLAT.')).toBeTruthy()
  })

  it('falls back to the plain line when a part has no grams', async () => {
    serve({ printers: [{ ...PRINTER, filament_cents_per_g: 10 }], guide: { ...GUIDE, stl_files: [part('s1', { filament_grams: null })] } })
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    expect(await screen.findByText(/^I understand I cover the filament, and that/)).toBeTruthy()
  })

  it('drops an unticked part from the estimate', async () => {
    rate(10)
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    expect(await screen.findByText(/about \$1\.40 at/)).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Include s2.stl'))
    expect(screen.getByText(/about \$1\.00 at/)).toBeTruthy()
  })

  it('shows a single figure when two printers declare the same rate', async () => {
    serve({ printers: [{ ...PRINTER, filament_cents_per_g: 10 }, { ...PRINTER, id: 'p2', filament_cents_per_g: 10 }] })
    render(<RequestPrintScreen guideId="g1" printerIds={['p1', 'p2']} />)
    expect(await screen.findByText(/about \$1\.40 at/)).toBeTruthy()
    expect(screen.queryByText(/\$1\.40–\$/)).toBeNull()
  })

  it('writes a rate of one cent a gram to the cent', async () => {
    rate(1)
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    expect(await screen.findByText(/about \$0\.14 at/)).toBeTruthy()
  })

  it('writes a four-figure estimate with a thousands separator', async () => {
    serve({ printers: [{ ...PRINTER, filament_cents_per_g: 100_000 }] })
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    // 14 g at $1000 a gram.
    expect(await screen.findByText(/about \$14,000\.00 at/)).toBeTruthy()
  })
})

describe('what is sent', () => {
  beforeEach(() => mockPost.mockResolvedValue({ id: 'j9' }))

  it('sends the printers, the guide, the default colour and collect, and goes to the new job', async () => {
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    await screen.findByText('Send request')
    agree()
    send()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/printing/jobs/j9'))
    expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/print', {
      printer_ids: ['p1'],
      tutorial_id: 'g1',
      files: [
        { stl_file_id: 's1', quantity: 1 },
        { stl_file_id: 's2', quantity: 1 },
      ],
      note: undefined,
      colour: 'Any colour',
      delivery: 'collect',
    })
  })

  it('sends the colour and delivery that were chosen', async () => {
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    fireEvent.press(await screen.findByText('Black'))
    fireEvent.press(screen.getByLabelText('Post it to me'))
    agree()
    send()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(sent()).toMatchObject({ colour: 'Black', delivery: 'post' })
  })

  it('drops a number that was typed and then cleared', async () => {
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    const reach = await screen.findByLabelText('Reach')
    fireEvent.changeText(reach, '300')
    fireEvent.changeText(reach, ' ')
    agree()
    send()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(sent()).not.toHaveProperty('fit_notes')
  })

  it('sends no fit_notes when none were answered, and drops one tapped twice', async () => {
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    fireEvent.press(await screen.findByText('Floor stand'))
    fireEvent.press(screen.getByText('Floor stand'))
    agree()
    send()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(sent()).not.toHaveProperty('fit_notes')
  })

  it('keeps only the last answer to a customization question', async () => {
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    fireEvent.press(await screen.findByText('Tray clamp'))
    fireEvent.press(screen.getByText('Floor stand'))
    agree()
    send()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(sent().fit_notes).toEqual({ mount: 'Floor stand' })
  })

  it('sends a note trimmed, and none for a whitespace-only one', async () => {
    const { unmount } = render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    fireEvent.changeText(await screen.findByLabelText('Note to the printer'), '   ')
    agree()
    send()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(sent().note).toBeUndefined()
    unmount()
    mockPost.mockClear()
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    fireEvent.changeText(await screen.findByLabelText('Note to the printer'), '  22 mm rail  ')
    agree()
    send()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(sent().note).toBe('22 mm rail')
  })

  it.each(NAMES.filter((n) => n.value.trim() === n.value))('sends a note with $label exactly as typed', async ({ value }) => {
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    fireEvent.changeText(await screen.findByLabelText('Note to the printer'), value)
    agree()
    send()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(sent().note).toBe(value)
  })

  it('caps the note field at the 1000 characters the API allows', async () => {
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    expect((await screen.findByLabelText('Note to the printer')).props.maxLength).toBe(1000)
  })

  it('sends every picked printer, in the order picked', async () => {
    serve({ printers: [PRINTER, { ...PRINTER, id: 'p2' }, { ...PRINTER, id: 'p3' }] })
    render(<RequestPrintScreen guideId="g1" printerIds={['p3', 'p1', 'p2']} />)
    await screen.findByText('Send request')
    agree()
    send()
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(sent().printer_ids).toEqual(['p3', 'p1', 'p2'])
  })
})

describe('sending', () => {
  it('posts once however many times Send is tapped while it is in flight', async () => {
    let resolve!: (v: { id: string }) => void
    mockPost.mockReturnValue(new Promise((r) => (resolve = r)))
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    await screen.findByText('Send request')
    agree()
    fireEvent.press(screen.getByRole('button', { name: 'Send request' }))
    fireEvent.press(screen.getByRole('button', { name: 'Send request' }))
    fireEvent.press(screen.getByRole('button', { name: 'Send request' }))
    expect(mockPost).toHaveBeenCalledTimes(1)
    await act(async () => resolve({ id: 'j1' }))
    expect(mockReplace).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a 400 shows the API sentence', new Error('failed with status 400: Pick at least one part.'), 'Pick at least one part.'],
    ['a 409 shows the API sentence', new Error('failed with status 409: You already asked this printer.'), 'You already asked this printer.'],
    ['a 429 shows the API sentence', new Error('failed with status 429: Slow down.'), 'Slow down.'],
    ['a 500 keeps the generic apology', new Error('failed with status 500: relation "x" does not exist'), 'That did not send. Check your connection and try again.'],
    ['offline says so', new Error('Network request failed'), "You're offline. Check your connection and try again."],
    ['a non-Error rejection keeps the generic apology', 'boom', 'That did not send. Check your connection and try again.'],
  ])('%s', async (_label, failure, message) => {
    mockPost.mockRejectedValue(failure)
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    await screen.findByText('Send request')
    agree()
    send()
    expect(await screen.findByText(message)).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('lets the family fix the form and send again after a refusal, and clears the error', async () => {
    mockPost.mockRejectedValueOnce(ok).mockResolvedValueOnce({ id: 'j2' })
    render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
    await screen.findByText('Send request')
    agree()
    send()
    await screen.findByText('Pick at least one part.')
    expect(screen.getByRole('button', { name: 'Send request' })).toBeEnabled()
    send()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/printing/jobs/j2'))
    expect(screen.queryByText('Pick at least one part.')).toBeNull()
  })
})
