import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ToyEditStepper } from '@/components/toy-edit-stepper'
import type { ToyStep } from '@/lib/toy-steps'

const replace = vi.fn()
let searchParamsValue = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/dashboard/toys/t1',
  useSearchParams: () => new URLSearchParams(searchParamsValue),
}))

function makeSteps(content: { details: ReactNode; photos: ReactNode; review: ReactNode }): ToyStep[] {
  return [
    { id: 'details', label: 'Details', status: 'done', content: content.details },
    { id: 'photos', label: 'Photos', status: 'attention', content: content.photos },
    { id: 'review', label: 'Review', status: 'neutral', content: content.review },
  ]
}

describe('ToyEditStepper', () => {
  beforeEach(() => {
    replace.mockClear()
    searchParamsValue = ''
  })

  it('shows the first step content by default', () => {
    render(
      <ToyEditStepper
        steps={makeSteps({
          details: <p>Details content</p>,
          photos: <p>Photos content</p>,
          review: <p>Review content</p>,
        })}
      />
    )
    expect(screen.getByText('Details content')).toBeInTheDocument()
    expect(screen.queryByText('Photos content')).toBeNull()
  })

  it('names each tab after its label alone, not the decorative status glyph', () => {
    render(
      <ToyEditStepper
        steps={makeSteps({
          details: <p>Details content</p>,
          photos: <p>Photos content</p>,
          review: <p>Review content</p>,
        })}
      />
    )
    expect(screen.getByRole('tab', { name: 'Photos' })).toBeInTheDocument()
  })

  it('switches content and writes ?step= when a pill is clicked', () => {
    render(
      <ToyEditStepper
        steps={makeSteps({
          details: <p>Details content</p>,
          photos: <p>Photos content</p>,
          review: <p>Review content</p>,
        })}
      />
    )
    fireEvent.click(screen.getByRole('tab', { name: /photos/i }))
    expect(screen.getByText('Photos content')).toBeInTheDocument()
    expect(replace).toHaveBeenCalledWith('/dashboard/toys/t1?step=photos', { scroll: false })
  })

  it('opens on the step named in ?step= on load', () => {
    searchParamsValue = 'step=review'
    render(
      <ToyEditStepper
        steps={makeSteps({
          details: <p>Details content</p>,
          photos: <p>Photos content</p>,
          review: <p>Review content</p>,
        })}
      />
    )
    expect(screen.getByText('Review content')).toBeInTheDocument()
  })

  it("renders each pill's status dot from the step status", () => {
    render(
      <ToyEditStepper
        steps={makeSteps({
          details: <p>Details content</p>,
          photos: <p>Photos content</p>,
          review: <p>Review content</p>,
        })}
      />
    )
    const photosTab = screen.getByRole('tab', { name: /photos/i })
    expect(photosTab.querySelector('[data-status="attention"]')).toHaveTextContent('!')
  })
})
