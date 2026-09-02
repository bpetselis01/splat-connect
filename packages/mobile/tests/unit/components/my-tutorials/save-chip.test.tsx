import { render, screen } from '@testing-library/react-native'
import { SaveChip } from '../../../../components/my-tutorials/sections/save-chip'

const mockDraft = { saveState: 'idle' as string }
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => mockDraft }))

it('says a write is in flight', () => {
  mockDraft.saveState = 'saving'
  render(<SaveChip />)
  expect(screen.getByText('Saving...')).toBeTruthy()
})

it('says a write landed', () => {
  mockDraft.saveState = 'saved'
  render(<SaveChip />)
  expect(screen.getByText('Saved')).toBeTruthy()
})

it('says nothing at rest, so an untouched screen makes no claim', () => {
  // The regression: one provider serves all seven editor screens, so a chip
  // left reading Saved followed the contributor onto the next screen and
  // reported a write they had not made there.
  mockDraft.saveState = 'idle'
  render(<SaveChip />)
  expect(screen.queryByTestId('save-chip')).toBeNull()
})

it('leaves the error to the section’s own ErrorRow rather than saying it twice', () => {
  mockDraft.saveState = 'error'
  render(<SaveChip />)
  expect(screen.queryByTestId('save-chip')).toBeNull()
})
