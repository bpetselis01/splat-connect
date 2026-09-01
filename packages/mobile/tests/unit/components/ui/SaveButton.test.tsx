import { render, screen, fireEvent } from '@testing-library/react-native'
import { SaveButton } from '../../../../components/ui/SaveButton'

// Ionicons loads its font asynchronously and setStates after the test ends;
// stub it to a host string so there's no act() warning noise.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

it('reflects saved state and calls toggle', () => {
  const toggle = jest.fn()
  const saves: any = { isSaved: () => true, toggle, savedIds: { tutorials: [], toys: [], challenges: [] } }
  render(<SaveButton slug="tutorials" id="t1" saves={saves} />)
  const b = screen.getByLabelText('Saved')
  fireEvent.press(b)
  expect(toggle).toHaveBeenCalledWith('tutorials', 't1')
})
