import { render, screen } from '@testing-library/react-native'
import { ComingSoon } from '../../../components/coming-soon'

describe('ComingSoon', () => {
  it('renders the given label', () => {
    render(<ComingSoon label="Toy Scanner" />)
    expect(screen.getByText('Toy Scanner is coming soon.')).toBeTruthy()
  })
})
