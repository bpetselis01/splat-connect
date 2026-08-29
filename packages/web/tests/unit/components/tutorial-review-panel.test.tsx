import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TutorialReviewPanel } from '@/components/tutorial-review-panel'
import type { TutorialOrg } from '@splat-connect/types'

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

type Props = Parameters<typeof TutorialReviewPanel>[0]

function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
    title: 'Sensory light box',
    description: 'A calming light box.',
    difficulty: 'easy',
    toyPhotoUrl: 'https://example.com/toy.jpg',
    hasPdf: true,
    partCount: 3,
    toolCount: 2,
    stlCount: 0,
    backing: [] as TutorialOrg[],
    ...overrides,
  }
  return render(<TutorialReviewPanel {...props} />)
}

describe('TutorialReviewPanel', () => {
  it('summarises what is about to be sent for review', () => {
    setup()
    expect(screen.getByText('Sensory light box')).toBeInTheDocument()
    expect(screen.getByText('A calming light box.')).toBeInTheDocument()
    expect(screen.getByText('Uploaded')).toBeInTheDocument()
    expect(screen.getByText('3 parts, 2 tools')).toBeInTheDocument()
  })

  it('singularises a lone part and tool', () => {
    setup({ partCount: 1, toolCount: 1 })
    expect(screen.getByText('1 part, 1 tool')).toBeInTheDocument()
  })

  it('names the review route, which is SPLAT when no organisation backed it', () => {
    setup()
    expect(screen.getByText('Reviewed by SPLAT')).toBeInTheDocument()
  })

  it('shows the toy photo', () => {
    const { container } = setup()
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/toy.jpg')
  })

  it('says the pdf is missing rather than staying silent', () => {
    setup({ hasPdf: false })
    expect(screen.getByText('Not uploaded')).toBeInTheDocument()
  })

  // Tests: the summary carries no submit control of its own
  // How:   asserts neither the button nor the bar renders here
  // Chain: this panel owned the submit bar until 2026-08-29, which is exactly why
  //        the other seven steps never mentioned that submitting existed. The bar
  //        is EditStepper's now, and it follows the contributor between steps; a
  //        second one here would let the same work be handed over twice
  it('carries no submit control — the stepper owns the bar now', () => {
    const { container } = setup()
    expect(screen.queryByRole('button', { name: /submit for review/i })).toBeNull()
    expect(container.querySelector('.sticky-submit-bar')).toBeNull()
  })
})
