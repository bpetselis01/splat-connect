import { render, screen, fireEvent } from '@testing-library/react-native'
import { PicksRow } from '../../../../components/guides/picks-row'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const pick = (id: string, title: string) => ({
  position: 0,
  tutorials: {
    id,
    title,
    kind: 'toy_adaptation' as const,
    difficulty: 'easy' as const,
    photo_urls: [],
    toy_photo_url: null,
    status: 'approved' as const, maturity: 'complete' as const },
})

it('renders up to three titles and fires onOpen on press', () => {
  const onOpen = jest.fn()
  const recs = [
    pick('1', 'Switch Car'),
    pick('2', 'Big Button Blaster'),
    pick('3', 'Rolling Ramp'),
    pick('4', 'Fourth Pick'),
  ]
  render(<PicksRow recommendations={recs} firstName="Sam" onOpen={onOpen} />)

  expect(screen.getByText('Switch Car')).toBeTruthy()
  expect(screen.getByText('Big Button Blaster')).toBeTruthy()
  expect(screen.getByText('Rolling Ramp')).toBeTruthy()
  expect(screen.queryByText('Fourth Pick')).toBeNull()
  expect(screen.getByText("ALSO WORTH A LOOK · SAM'S PICKS")).toBeTruthy()

  fireEvent.press(screen.getByText('Switch Car'))
  expect(onOpen).toHaveBeenCalledWith('1')
})
