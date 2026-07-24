import { render, screen } from '@testing-library/react-native'
import { DifficultyBadge } from '../../../components/difficulty-badge'

describe('DifficultyBadge', () => {
  it.each(['easy', 'medium', 'hard'] as const)('renders the %s label in title case', (difficulty) => {
    render(<DifficultyBadge difficulty={difficulty} />)
    expect(screen.getByText(difficulty.charAt(0).toUpperCase() + difficulty.slice(1))).toBeTruthy()
  })
})
