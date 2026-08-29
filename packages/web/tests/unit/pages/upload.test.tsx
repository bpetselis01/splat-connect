import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import NewTutorialPage from '@/app/upload/page'
import type { EditStep } from '@/lib/edit-steps'

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('@/components/new-tutorial-form', () => ({
  NewTutorialForm: ({ kind }: { kind: string }) => <form data-testid="new-tutorial-form" data-kind={kind} />,
}))
// The real stepper reads useSearchParams; a flat list of tabs is all this
// page's contract with it — which pills, and which are locked.
vi.mock('@/components/stepper', () => ({
  Stepper: ({ steps }: { steps: EditStep[] }) => (
    <div>
      {steps.map((s) => (
        <button key={s.id} role="tab" disabled={s.disabled}>{s.label}</button>
      ))}
      {steps.map((s) => <span key={s.id}>{s.content}</span>)}
    </div>
  ),
}))

async function renderPage(kind?: string) {
  render(await NewTutorialPage({ searchParams: Promise.resolve(kind ? { kind } : {}) }))
}

describe('NewTutorialPage', () => {
  // The choice comes first and is a link, so the page stays a server component
  // and a reload keeps the answer.
  it('asks which kind before showing a form', async () => {
    await renderPage()
    expect(screen.getByRole('link', { name: /Toy adaptation/ })).toHaveAttribute('href', '/upload?kind=toy_adaptation')
    expect(screen.getByRole('link', { name: /Assistive tech/ })).toHaveAttribute('href', '/upload?kind=assistive_tech')
    expect(screen.queryByTestId('new-tutorial-form')).toBeNull()
  })

  it('ignores a kind it does not know', async () => {
    await renderPage('robot')
    expect(screen.queryByTestId('new-tutorial-form')).toBeNull()
  })

  it('shows the STL pill for assistive tech and hands the kind to the form', async () => {
    await renderPage('assistive_tech')
    expect(screen.getByTestId('new-tutorial-form')).toHaveAttribute('data-kind', 'assistive_tech')
    expect(screen.getByRole('tab', { name: 'STL Files' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Details' })).toBeEnabled()
  })

  it('never shows the STL pill for a toy adaptation', async () => {
    await renderPage('toy_adaptation')
    expect(screen.getByTestId('new-tutorial-form')).toHaveAttribute('data-kind', 'toy_adaptation')
    expect(screen.queryByRole('tab', { name: 'STL Files' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Recommended' })).toBeDisabled()
  })
})
