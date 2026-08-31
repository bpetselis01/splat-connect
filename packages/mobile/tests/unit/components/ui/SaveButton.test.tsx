import { render, screen, fireEvent } from '@testing-library/react-native'
import { SaveButton } from '../../../../components/ui/SaveButton'

it('reflects saved state and calls toggle', () => {
  const toggle = jest.fn()
  const saves: any = { isSaved: () => true, toggle, savedIds: { tutorials: [], toys: [], challenges: [] } }
  render(<SaveButton slug="tutorials" id="t1" saves={saves} />)
  const b = screen.getByLabelText('Saved')
  fireEvent.press(b)
  expect(toggle).toHaveBeenCalledWith('tutorials', 't1')
})
