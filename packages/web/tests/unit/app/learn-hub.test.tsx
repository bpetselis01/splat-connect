import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LearnPage from '@/app/learn/page'
import { UNITS, LESSONS, COURSE_HOURS } from '@/lib/learn-course'

/**
 * The hub became a COURSE home on 2026-09-17. It was a grid of six standalone
 * articles; the artboard's Learn section is six units in an order that teaches,
 * and half the lessons are procedures that only make sense after the one before
 * them. These assertions moved with it — "start here" and "going deeper" were
 * the old grouping and no longer exist.
 */
describe('Learn course home', () => {
  it('links every lesson in the course exactly once', () => {
    render(<LearnPage />)
    for (const lesson of LESSONS) {
      expect(
        screen.getAllByRole('link', { name: new RegExp(lesson.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).length,
        lesson.title
      ).toBeGreaterThanOrEqual(1)
    }
  })

  it('lays the six units out in order', () => {
    render(<LearnPage />)
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
    for (const unit of UNITS) {
      expect(headings).toContain(unit.title)
    }
  })

  // Tests: the one control somebody coming back on a second evening needs
  // Chain: a grid of nineteen links is not an answer to "where was I". With no
  //        progress stored the label is the first-run one
  it('offers a single way back in', () => {
    render(<LearnPage />)
    expect(screen.getByRole('link', { name: /start the course/i })).toHaveAttribute(
      'href',
      `/learn/${LESSONS[0].slug}`
    )
  })

  it('states the size of the course before somebody starts it', () => {
    render(<LearnPage />)
    expect(screen.getByText(`${LESSONS.length} lessons`)).toBeInTheDocument()
    expect(screen.getByText(`About ${COURSE_HOURS} hours`)).toBeInTheDocument()
  })

  it('sends someone who wants a specific toy to the Guides catalogue instead', () => {
    render(<LearnPage />)
    expect(screen.getByRole('link', { name: /browse the guides/i })).toHaveAttribute(
      'href',
      '/library'
    )
  })
})
