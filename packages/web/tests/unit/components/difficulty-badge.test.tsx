import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DifficultyBadge } from '@/components/difficulty-badge'

describe('DifficultyBadge', () => {
  // Tests: DifficultyBadge renders the text "easy" when difficulty="easy" is passed
  // How:   renders <DifficultyBadge difficulty="easy" />; checks text "easy" is in the document
  // Chain: the badge appears on TutorialCard in the library → users can scan difficulty levels
  //        at a glance when browsing available tutorials
  it('renders easy badge', () => {
    render(<DifficultyBadge difficulty="easy" />)
    expect(screen.getByText(/easy/i)).toBeInTheDocument()
  })

  // Tests: DifficultyBadge renders "medium" for the medium difficulty level
  // How:   renders <DifficultyBadge difficulty="medium" />; checks text "medium" is present
  // Chain: medium difficulty tutorials display the correct label in the library and on the
  //        tutorial detail page header
  it('renders medium badge', () => {
    render(<DifficultyBadge difficulty="medium" />)
    expect(screen.getByText(/medium/i)).toBeInTheDocument()
  })

  // Tests: DifficultyBadge renders "hard" for the hard difficulty level
  // How:   renders <DifficultyBadge difficulty="hard" />; checks text "hard" is present
  // Chain: hard difficulty tutorials are clearly labelled → users can self-select appropriate
  //        projects based on their skill level before starting
  it('renders hard badge', () => {
    render(<DifficultyBadge difficulty="hard" />)
    expect(screen.getByText(/hard/i)).toBeInTheDocument()
  })
})
