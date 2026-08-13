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

function renderStepper() {
  return render(
    <EditStepper
      steps={makeSteps({ details: <p>Details content</p>, files: <p>Files content</p> })}
    />
  )
}

describe('EditStepper', () => {
  beforeEach(() => {
    replace.mockClear()
    searchParamsValue = ''
  })

  it('shows the first step content by default', () => {
    renderStepper()
    expect(screen.getByText('Details content')).toBeInTheDocument()
    expect(screen.queryByText('Files content')).toBeNull()
  })

  it('names each tab after its label alone, not the decorative status glyph', () => {
    renderStepper()
    expect(screen.getByRole('tab', { name: 'Files' })).toBeInTheDocument()
  })

  it('switches content and writes ?step= when a pill is clicked', () => {
    renderStepper()
    fireEvent.click(screen.getByRole('tab', { name: /files/i }))
    expect(screen.getByText('Files content')).toBeInTheDocument()
    expect(replace).toHaveBeenCalledWith('/tutorials/t1/edit?step=files', { scroll: false })
  })

  it('opens on the step named in ?step= on load', () => {
    searchParamsValue = 'step=files'
    renderStepper()
    expect(screen.getByText('Files content')).toBeInTheDocument()
  })

  it('renders no submit bar of its own — that belongs to the Review step', () => {
    renderStepper()
    expect(screen.queryByRole('button', { name: /submit for review/i })).toBeNull()
    expect(document.querySelector('.sticky-submit-bar')).toBeNull()
  })
})
