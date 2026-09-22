import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import Adaptation101 from '@/app/learn/toy-adaptation-101/page'
import SwitchTypes from '@/app/learn/switch-types/page'
import ChoosingAToy from '@/app/learn/choosing-a-toy/page'
import ToolsAndMaterials from '@/app/learn/tools-and-materials/page'
import SafetyAndCleaning from '@/app/learn/safety-and-cleaning/page'
// Moved out of Learn on 2026-08-20 when 3D printing became a product pillar.
// Still a long-form article, so it keeps the shared assertions below.
import PrintingBasics from '@/app/printing/basics/page'

/**
 * The lesson body, not the page.
 *
 * Five of these six render inside components/learn-shell.tsx, whose outline
 * lists every lesson in the course — so an unscoped query for "3.5 mm" matches
 * the sidebar as well as the prose. The shell labels its own column "Lesson";
 * the sixth (printing basics) is not in the course and has no shell, so it
 * falls back to the whole render.
 */
function body() {
  const region = screen.queryByRole('region', { name: 'Lesson' })
  return region ? within(region) : screen
}

const articles: Array<[string, () => ReactElement]> = [
  ['Toy adaptation 101', Adaptation101],
  ['Switch types explained', SwitchTypes],
  ['Choosing a toy to adapt', ChoosingAToy],
  ['Tools and materials', ToolsAndMaterials],
  ['Safe handling', SafetyAndCleaning],
  ['Printing basics', PrintingBasics],
]

describe('long-form articles', () => {
  it.each(articles)('%s has a matching h1', (title, Page) => {
    render(<Page />)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  })

  // A table caption counts: Tools and materials leads on two captioned kit
  // tables, as the board draws it, and only then a closing h2.
  it.each(articles)('%s has at least two sections', (_t, Page) => {
    const { container } = render(<Page />)
    expect(container.querySelectorAll('h2, caption').length).toBeGreaterThanOrEqual(2)
  })

  // Route A of the two ways in is the battery interrupter, named as a heading
  // so a reader scanning for it lands on it.
  it('explains the battery interrupter, which is the core idea of the whole site', () => {
    render(<Adaptation101 />)
    expect(body().getByRole('heading', { name: /the battery interrupter/i })).toBeInTheDocument()
    expect(body().getAllByText(/3\.5\s?mm/i).length).toBeGreaterThan(0)
  })

  it('names the four switch families', () => {
    render(<SwitchTypes />)
    for (const name of ['Big button', 'Lever', 'Proximity', 'Grasp / squeeze']) {
      expect(body().getByRole('heading', { name })).toBeInTheDocument()
    }
  })

  it('rules out toys a switch cannot work, where the choice is being made', () => {
    render(<ChoosingAToy />)
    expect(body().getByText(/sealed rechargeable battery/i)).toBeInTheDocument()
    expect(body().getByText(/mains power/i)).toBeInTheDocument()
  })

  // The one non-negotiable in the course leads the safety lesson.
  it('leads the safety lesson on button cells', () => {
    render(<SafetyAndCleaning />)
    expect(body().getByText(/button cells are the one non-negotiable/i)).toBeInTheDocument()
    expect(body().getByRole('link', { name: 'safety page' })).toHaveAttribute('href', '/safety')
  })
})
