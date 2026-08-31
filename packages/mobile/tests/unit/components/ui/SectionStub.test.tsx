import { render, screen } from '@testing-library/react-native'
import { SectionStub } from '../../../../components/ui/SectionStub'

it('shows its blurb and no promise of a date (title comes from the native header)', () => {
  render(<SectionStub title="Toy Library" blurb="Adapted toys that families and organisations are giving away." />)
  expect(screen.getByText(/giving away/)).toBeTruthy()
  expect(screen.queryByText(/coming soon/i)).toBeNull()
})
