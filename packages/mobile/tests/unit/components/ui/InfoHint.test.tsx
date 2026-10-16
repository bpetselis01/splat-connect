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

describe('open card', () => {
  const open = () => {
    render(<InfoHint title="Works with">The switches this build accepts.</InfoHint>)
    fireEvent.press(screen.getByLabelText('About Works with'))
  }

  it('closes when the backdrop is pressed', () => {
    open()
    fireEvent.press(screen.getByLabelText('Close'))
    expect(screen.queryByTestId('info-hint-card')).toBeNull()
  })

  it('stays open when the body text is pressed', () => {
    open()
    fireEvent.press(screen.getByText('The switches this build accepts.'))
    expect(screen.getByTestId('info-hint-card')).toBeTruthy()
  })

  it('exposes the title as a header and Got it as a button', () => {
    open()
    expect(screen.getByRole('header', { name: 'Works with' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy()
  })
})
