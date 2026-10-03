import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToBeCompleted } from '@/components/to-be-completed'

describe('ToBeCompleted', () => {
  it('says To be completed with the one-line reason', () => {
    render(<ToBeCompleted>Names are coming.</ToBeCompleted>)
    expect(screen.getByText('To be completed')).toBeInTheDocument()
    expect(screen.getByText('Names are coming.')).toBeInTheDocument()
  })
  it('names what is missing when given a subject', () => {
    render(<ToBeCompleted subject="Our team">Names are coming.</ToBeCompleted>)
    expect(screen.getByRole('heading', { name: 'Our team' })).toBeInTheDocument()
  })
})
