// journeys: B04 G23 G25
import { useState } from 'react'
import { FlatList } from 'react-native'
import { render, screen, fireEvent, within } from '@testing-library/react-native'
import { StepPicker, CHIP_MAX } from '../../../../components/guides/step-picker'
import { CLEARANCE, paddingBottomOf } from '../../bottom-spacing'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('react-native-safe-area-context', () => require('../../bottom-spacing').insetMock())

const TITLES = ['Gather your parts', 'Sand the edges', 'Glue the frame', 'Clamp it', 'Let it dry', 'Drill the holes', 'Fit the wheels', 'Tighten every bolt']
const make = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, position: i + 1, title: i === 4 ? null : (TITLES[i] ?? (i === 16 ? 'Seal with varnish' : `Detail ${i + 1}`)) }))

function Harness({ n = 20, start, here, allowMissing, onChange }: { n?: number; start?: number | null; here?: number | null; allowMissing?: boolean; onChange?: (p: number | null) => void }) {
  const [v, setV] = useState<number | null | undefined>(start)
  return <StepPicker steps={make(n) as never} value={v} hereStep={here} eyebrow="Which step?" allowMissing={allowMissing} onChange={(p) => { setV(p); onChange?.(p) }} />
}

afterEach(() => jest.restoreAllMocks())
const field = (name: string) => screen.getByRole('button', { name })
const openList = () => fireEvent.press(screen.getByTestId('step-picker-field'))

it('keeps chips for five steps or fewer, with a Missing step chip', () => {
  const onChange = jest.fn()
  render(<Harness n={CHIP_MAX} onChange={onChange} />)
  expect(screen.queryByTestId('step-picker-field')).toBeNull()
  expect(screen.getByLabelText('Which step is it about?')).toBeTruthy()
  fireEvent.press(screen.getByText('Step 3'))
  expect(onChange).toHaveBeenLastCalledWith(3)
  expect(screen.getByLabelText('Step 3').props.accessibilityState.selected).toBe(true)
  fireEvent.press(screen.getByText('Missing step'))
  expect(onChange).toHaveBeenLastCalledWith(null)
})

it('chips drop Missing step when the caller does not allow it', () => {
  render(<Harness n={3} allowMissing={false} />)
  expect(screen.queryByText('Missing step')).toBeNull()
})

it('six steps is a field, not chips', () => {
  render(<Harness n={CHIP_MAX + 1} />)
  expect(screen.getByTestId('step-picker-field')).toBeTruthy()
  expect(screen.queryByText('Step 1')).toBeNull()
})

it('the field names the chosen step and the "you were here" tag has a text equivalent', () => {
  render(<Harness start={7} here={7} />)
  expect(field('Which step, 7. Fit the wheels, you were here')).toBeTruthy()
  expect(screen.getByText('You were here')).toBeTruthy()
  expect(screen.getByText('7. Fit the wheels')).toBeTruthy()
})

it('no tag and a plain label once a different step is chosen', () => {
  render(<Harness start={7} here={7} />)
  openList()
  fireEvent.press(screen.getByRole('button', { name: '8. Tighten every bolt' }))
  expect(field('Which step, 8. Tighten every bolt')).toBeTruthy()
  expect(screen.queryByText('You were here')).toBeNull()
})

it('nothing chosen reads as a prompt', () => {
  render(<Harness />)
  expect(field('Which step, Choose a step')).toBeTruthy()
})

it('opens the list with a labelled search, Missing step first, then every step; closes without changing', () => {
  const onChange = jest.fn()
  render(<Harness start={7} onChange={onChange} />)
  expect(screen.queryByTestId('step-list-sheet')).toBeNull()
  openList()
  expect(screen.getByTestId('step-list-sheet')).toBeTruthy()
  expect(screen.getByRole('header', { name: 'Which step?' })).toBeTruthy()
  expect(screen.getByLabelText('Search steps')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Missing step' })).toBeTruthy()
  expect(screen.getByText('Or a note on the whole guide')).toBeTruthy()
  expect(screen.getByRole('button', { name: '1. Gather your parts' })).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Close step list' }))
  expect(screen.queryByTestId('step-list-sheet')).toBeNull()
  expect(onChange).not.toHaveBeenCalled()
})

it('the backdrop closes the list too', () => {
  render(<Harness />)
  openList()
  fireEvent.press(screen.getByTestId('step-list-backdrop', { includeHiddenElements: true }))
  expect(screen.queryByTestId('step-list-sheet')).toBeNull()
})

it('marks the chosen row selected and the arrival row "you were here", and starts scrolled to the chosen step', () => {
  const scroll = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {})
  render(<Harness start={17} here={7} />)
  openList()
  expect(within(screen.getByTestId('step-list')).getByRole('button', { name: '17. Seal with varnish' }).props.accessibilityState.selected).toBe(true)
  expect(screen.getByRole('button', { name: '1. Gather your parts' }).props.accessibilityState.selected).toBe(false)
  expect(scroll).toHaveBeenCalledWith({ index: 17, animated: false }) // Missing step is row 0
  expect(screen.getByRole('button', { name: 'Missing step' })).toBeTruthy()
  scroll.mockRestore()
})

it('does not scroll when nothing is chosen, and the here row says so', () => {
  const scroll = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {})
  render(<Harness here={1} />)
  openList()
  expect(scroll).not.toHaveBeenCalled()
  scroll.mockRestore()
  expect(screen.getByRole('button', { name: '1. Gather your parts, you were here' })).toBeTruthy()
})

it('filters by number: "1" keeps 1 and 10 to 19, not 2 or 21 (even when a title has a 1 in it)', () => {
  render(<Harness n={21} />)
  openList()
  fireEvent.changeText(screen.getByLabelText('Search steps'), '1')
  expect(screen.getByRole('button', { name: '1. Gather your parts' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '17. Seal with varnish' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '2. Sand the edges' })).toBeNull()
  expect(screen.queryByRole('button', { name: '21. Detail 21' })).toBeNull()
  fireEvent.changeText(screen.getByLabelText('Search steps'), '17')
  expect(screen.getAllByRole('button', { name: /^\d+\. / })).toHaveLength(1)
})

it('filters by word, ignoring case and padding', () => {
  render(<Harness />)
  openList()
  fireEvent.changeText(screen.getByLabelText('Search steps'), '  VARNISH ')
  expect(screen.getByRole('button', { name: '17. Seal with varnish' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '1. Gather your parts' })).toBeNull()
})

it('an untitled step is findable and readable', () => {
  render(<Harness />)
  openList()
  expect(screen.getByRole('button', { name: '5. Untitled step' })).toBeTruthy()
})

it('no match says so and still offers Missing step', () => {
  render(<Harness />)
  openList()
  fireEvent.changeText(screen.getByLabelText('Search steps'), 'zebra')
  expect(screen.getByText('No step matches "zebra"')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Missing step' })).toBeTruthy()
  expect(screen.queryAllByRole('button', { name: /^\d+\. / })).toHaveLength(0)
})

it('picking a searched step sets it and closes the list', () => {
  const onChange = jest.fn()
  render(<Harness onChange={onChange} />)
  openList()
  fireEvent.changeText(screen.getByLabelText('Search steps'), '17')
  fireEvent.press(screen.getByRole('button', { name: '17. Seal with varnish' }))
  expect(onChange).toHaveBeenCalledWith(17)
  expect(screen.queryByTestId('step-list-sheet')).toBeNull()
  expect(field('Which step, 17. Seal with varnish')).toBeTruthy()
})

it('Missing step picks the existing null value', () => {
  const onChange = jest.fn()
  render(<Harness start={3} onChange={onChange} />)
  openList()
  fireEvent.press(screen.getByRole('button', { name: 'Missing step' }))
  expect(onChange).toHaveBeenCalledWith(null)
  expect(field('Which step, Missing step')).toBeTruthy()
})

it('the search starts empty on every open', () => {
  render(<Harness />)
  openList()
  fireEvent.changeText(screen.getByLabelText('Search steps'), 'zebra')
  fireEvent.press(screen.getByRole('button', { name: 'Close step list' }))
  openList()
  expect(screen.getByLabelText('Search steps').props.value).toBe('')
})

it('without allowMissing there is no Missing step row', () => {
  render(<Harness allowMissing={false} />)
  openList()
  expect(screen.queryByRole('button', { name: 'Missing step' })).toBeNull()
})

it('the list clears the home indicator and keeps taps alive over the keyboard', () => {
  render(<Harness />)
  openList()
  const list = screen.UNSAFE_getByType(FlatList)
  expect(paddingBottomOf(list, 'contentContainerStyle')).toBe(CLEARANCE)
  expect(list.props.keyboardShouldPersistTaps).toBe('handled')
  expect(within(screen.getByTestId('step-list-sheet')).getByLabelText('Search steps')).toBeTruthy()
})
