import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import Adaptation101 from '@/app/learn/toy-adaptation-101/page'
import SwitchTypes from '@/app/learn/switch-types/page'
import ChoosingAToy from '@/app/learn/choosing-a-toy/page'
import ToolsAndMaterials from '@/app/learn/tools-and-materials/page'
import SafetyAndCleaning from '@/app/learn/safety-and-cleaning/page'
import PrintingBasics from '@/app/learn/3d-printing-basics/page'

const articles: Array<[string, () => ReactElement]> = [
  ['Toy adaptation 101', Adaptation101],
  ['Switch types explained', SwitchTypes],
  ['Choosing a toy to adapt', ChoosingAToy],
  ['Tools and materials', ToolsAndMaterials],
  ['Safety and cleaning', SafetyAndCleaning],
  ['3D printing basics', PrintingBasics],
]

describe('Learn articles', () => {
  it.each(articles)('%s has a matching h1', (title, Page) => {
    render(<Page />)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  })

  it.each(articles)('%s has at least two sections', (_t, Page) => {
    const { container } = render(<Page />)
    expect(container.querySelectorAll('h2').length).toBeGreaterThanOrEqual(2)
  })

  // Exact count, not just >0: "battery interrupter" is the heading of its
  // own section and is also bolded as the defined term in the body, so both
  // legitimately match. A count that shifts is a deliberate copy change,
  // not a silent regression (see trust-pages.test.tsx for the same shape).
  it('explains the battery interrupter, which is the core idea of the whole site', () => {
    render(<Adaptation101 />)
    expect(screen.getAllByText(/battery interrupter/i)).toHaveLength(2)
    expect(screen.getByText(/3\.5\s?mm/i)).toBeInTheDocument()
  })

  // Exact counts, not just >0: each family's heading names it once, and
  // "button" and "grasp" are also used in that section's own body copy
  // (activation force; grasp reflex), so those two legitimately match twice
  // while lever and proximity match once.
  it('names the four switch families', () => {
    render(<SwitchTypes />)
    expect(screen.getAllByText(/button/i)).toHaveLength(2)
    expect(screen.getAllByText(/lever/i)).toHaveLength(1)
    expect(screen.getAllByText(/proximity/i)).toHaveLength(1)
    expect(screen.getAllByText(/grasp/i)).toHaveLength(2)
  })

  it('warns against mains-powered toys where the choice is being made', () => {
    render(<ChoosingAToy />)
    expect(screen.getByText(/mains/i)).toBeInTheDocument()
  })

  it('points back to the safety page from the safety article', () => {
    render(<SafetyAndCleaning />)
    expect(screen.getByRole('link', { name: /safety/i })).toHaveAttribute('href', '/safety')
  })
})
