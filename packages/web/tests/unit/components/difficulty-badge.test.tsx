import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DifficultyBadge } from '@/components/difficulty-badge'

describe('DifficultyBadge', () => {
  it('renders easy badge', () => {
    render(<DifficultyBadge difficulty="easy" />)
    expect(screen.getByText(/easy/i)).toBeInTheDocument()
  })

  it('renders medium badge', () => {
    render(<DifficultyBadge difficulty="medium" />)
    expect(screen.getByText(/medium/i)).toBeInTheDocument()
  })

  it('renders hard badge', () => {
    render(<DifficultyBadge difficulty="hard" />)
    expect(screen.getByText(/hard/i)).toBeInTheDocument()
  })
})
