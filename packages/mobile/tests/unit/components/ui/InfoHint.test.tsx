// journeys: T20
import { fireEvent, render, screen } from '@testing-library/react-native'
import { InfoHint } from '../../../../components/ui/InfoHint'

it('opens a card with the explanation and closes with Got it', () => {
  render(<InfoHint title="Works with">The switches this build accepts.</InfoHint>)
  expect(screen.queryByTestId('info-hint-card')).toBeNull()
  fireEvent.press(screen.getByLabelText('About Works with'))
  expect(screen.getByTestId('info-hint-card')).toBeTruthy()
  expect(screen.getByText('The switches this build accepts.')).toBeTruthy()
  fireEvent.press(screen.getByText('Got it'))
  expect(screen.queryByTestId('info-hint-card')).toBeNull()
})
