import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ChildEditStepper } from '@/components/child-edit-stepper'
import type { ChildStep } from '@/lib/child-steps'

const replace = vi.fn()
let searchParamsValue = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/dashboard/child/c1',
  useSearchParams: () => new URLSearchParams(searchParamsValue),
}))

function makeSteps(content: {
  survey: ReactNode
  ability: ReactNode
  everydayNeeds: ReactNode
  customization: ReactNode
}): ChildStep[] {
  return [
    { id: 'survey', label: 'Survey', status: 'attention', content: content.survey },
    { id: 'ability', label: 'Ability', status: 'done', content: content.ability },
    { id: 'everyday-needs', label: 'Everyday needs', status: 'attention', content: content.everydayNeeds },
    { id: 'customization', label: 'Customization', status: 'neutral', content: content.customization },
  ]
}

describe('ChildEditStepper', () => {
  beforeEach(() => {
    replace.mockClear()
    searchParamsValue = ''
  })

  it('shows the first step content by default', () => {
    render(
      <ChildEditStepper
        steps={makeSteps({
          survey: <p>Survey content</p>,
          ability: <p>Ability content</p>,
          everydayNeeds: <p>Everyday needs content</p>,
          customization: <p>Customization content</p>,
        })}
      />
    )
    expect(screen.getByText('Survey content')).toBeInTheDocument()
    expect(screen.queryByText('Ability content')).toBeNull()
  })

  it('switches content and writes ?step= when a pill is clicked', () => {
    render(
      <ChildEditStepper
        steps={makeSteps({
          survey: <p>Survey content</p>,
          ability: <p>Ability content</p>,
          everydayNeeds: <p>Everyday needs content</p>,
          customization: <p>Customization content</p>,
        })}
      />
    )
    fireEvent.click(screen.getByRole('tab', { name: /ability/i }))
    expect(screen.getByText('Ability content')).toBeInTheDocument()
    expect(replace).toHaveBeenCalledWith('/dashboard/child/c1?step=ability', { scroll: false })
  })

  it('opens on the step named in ?step= on load', () => {
    searchParamsValue = 'step=customization'
    render(
      <ChildEditStepper
        steps={makeSteps({
          survey: <p>Survey content</p>,
          ability: <p>Ability content</p>,
          everydayNeeds: <p>Everyday needs content</p>,
          customization: <p>Customization content</p>,
        })}
      />
    )
    expect(screen.getByText('Customization content')).toBeInTheDocument()
  })

  it('has no locked pills — every step is a clickable tab', () => {
    render(
      <ChildEditStepper
        steps={makeSteps({
          survey: <p>Survey content</p>,
          ability: <p>Ability content</p>,
          everydayNeeds: <p>Everyday needs content</p>,
          customization: <p>Customization content</p>,
        })}
      />
    )
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).not.toBeDisabled()
    }
  })

  it('renders a trailing action inside the pill row, after the last tab', () => {
    const { container } = render(
      <ChildEditStepper
        steps={makeSteps({
          survey: <p>Survey content</p>,
          ability: <p>Ability content</p>,
          everydayNeeds: <p>Everyday needs content</p>,
          customization: <p>Customization content</p>,
        })}
        trailing={<button type="button">Delete child</button>}
      />
    )
    const row = container.querySelector('.step-pill-row') as HTMLElement
    const deleteButton = screen.getByRole('button', { name: 'Delete child' })
    expect(row).toContainElement(deleteButton)
    expect(screen.getByRole('tablist')).not.toContainElement(deleteButton)
  })

  it("renders each pill's status dot from the step status", () => {
    render(
      <ChildEditStepper
        steps={makeSteps({
          survey: <p>Survey content</p>,
          ability: <p>Ability content</p>,
          everydayNeeds: <p>Everyday needs content</p>,
          customization: <p>Customization content</p>,
        })}
      />
    )
    const surveyTab = screen.getByRole('tab', { name: /survey/i })
    expect(surveyTab.querySelector('[data-status="attention"]')).toHaveTextContent('!')
  })
})
