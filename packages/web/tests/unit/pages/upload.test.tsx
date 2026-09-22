import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import NewTutorialPage from '@/app/upload/page'

vi.mock('@/components/new-tutorial-form', () => ({
  NewTutorialForm: ({ kind }: { kind?: string }) => (
    <form data-testid="new-tutorial-form" data-kind={kind ?? ''} />
  ),
}))

async function renderPage(kind?: string) {
  render(await NewTutorialPage({ searchParams: Promise.resolve(kind ? { kind } : {}) }))
}

describe('NewTutorialPage', () => {
  // The board's single card: the kind is a choice inside the form, not a page
  // before it.
  it('shows the form straight away, under the board heading', async () => {
    await renderPage()
    expect(screen.getByRole('heading', { name: 'Add a tutorial' })).toBeInTheDocument()
    expect(screen.getByTestId('new-tutorial-form')).toHaveAttribute('data-kind', '')
  })

  it('preselects a kind from ?kind so older links land on the right card', async () => {
    await renderPage('assistive_tech')
    expect(screen.getByTestId('new-tutorial-form')).toHaveAttribute('data-kind', 'assistive_tech')
  })

  it('ignores a kind it does not know', async () => {
    await renderPage('robot')
    expect(screen.getByTestId('new-tutorial-form')).toHaveAttribute('data-kind', '')
  })
})
