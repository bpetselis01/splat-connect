import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { EditStepper } from '@/components/edit-stepper'
import type { EditStep } from '@/lib/edit-steps'

const replace = vi.fn()
let searchParamsValue = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/tutorials/t1/edit',
  useSearchParams: () => new URLSearchParams(searchParamsValue),
}))

function makeSteps(content: { details: ReactNode; files: ReactNode }): EditStep[] {
  return [
    { id: 'details', label: 'Details', status: 'attention', content: content.details },
    { id: 'files', label: 'Files', status: 'done', content: content.files },
  ]
}

describe('EditStepper', () => {
  beforeEach(() => {
    replace.mockClear()
    searchParamsValue = ''
  })

  it('shows the first step content by default', () => {
    render(
      <EditStepper
        steps={makeSteps({ details: <p>Details content</p>, files: <p>Files content</p> })}
        tutorialStatus="draft"
        tutorialUpdatedAt="2026-08-01T00:00:00.000Z"
        missingFields={['Title']}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText('Details content')).toBeInTheDocument()
    expect(screen.queryByText('Files content')).toBeNull()
  })

  it('names each tab after its label alone, not the decorative status glyph', () => {
    render(
      <EditStepper
        steps={makeSteps({ details: <p>Details content</p>, files: <p>Files content</p> })}
        tutorialStatus="draft"
        tutorialUpdatedAt="2026-08-01T00:00:00.000Z"
        missingFields={[]}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByRole('tab', { name: 'Files' })).toBeInTheDocument()
  })

  it('switches content and writes ?step= when a pill is clicked', () => {
    render(
      <EditStepper
        steps={makeSteps({ details: <p>Details content</p>, files: <p>Files content</p> })}
        tutorialStatus="draft"
        tutorialUpdatedAt="2026-08-01T00:00:00.000Z"
        missingFields={[]}
        onSubmit={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('tab', { name: /files/i }))
    expect(screen.getByText('Files content')).toBeInTheDocument()
    expect(replace).toHaveBeenCalledWith('/tutorials/t1/edit?step=files', { scroll: false })
  })

  it('opens on the step named in ?step= on load', () => {
    searchParamsValue = 'step=files'
    render(
      <EditStepper
        steps={makeSteps({ details: <p>Details content</p>, files: <p>Files content</p> })}
        tutorialStatus="draft"
        tutorialUpdatedAt="2026-08-01T00:00:00.000Z"
        missingFields={[]}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText('Files content')).toBeInTheDocument()
  })

  it('disables submit and names the missing fields when required data is absent', () => {
    render(
      <EditStepper
        steps={makeSteps({ details: <p>Details content</p>, files: <p>Files content</p> })}
        tutorialStatus="draft"
        tutorialUpdatedAt="2026-08-01T00:00:00.000Z"
        missingFields={['Title', 'At least one part']}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText('Add Title, At least one part to submit')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit for review/i })).toBeDisabled()
  })

  it('enables submit and calls onSubmit when nothing is missing', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <EditStepper
        steps={makeSteps({ details: <p>Details content</p>, files: <p>Files content</p> })}
        tutorialStatus="draft"
        tutorialUpdatedAt="2026-08-01T00:00:00.000Z"
        missingFields={[]}
        onSubmit={onSubmit}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))
    expect(onSubmit).toHaveBeenCalled()
  })

  it('shows a quiet last-saved indicator instead of Submit when status is not draft', () => {
    render(
      <EditStepper
        steps={makeSteps({ details: <p>Details content</p>, files: <p>Files content</p> })}
        tutorialStatus="pending"
        tutorialUpdatedAt={new Date().toISOString()}
        missingFields={[]}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: /submit for review/i })).toBeNull()
    expect(screen.getByText(/last saved/i)).toBeInTheDocument()
  })
})
