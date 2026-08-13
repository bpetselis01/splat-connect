import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TutorialReviewPanel } from '@/components/tutorial-review-panel'
import type { TutorialOrg } from '@splat-connect/types'

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

type Props = Parameters<typeof TutorialReviewPanel>[0]

function setup(overrides: Partial<Props> = {}) {
  const onSubmit = overrides.onSubmit ?? vi.fn().mockResolvedValue(undefined)
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
    status: 'draft',
    updatedAt: new Date().toISOString(),
    missingFields: [],
    ...overrides,
    onSubmit,
  }
  return { ...render(<TutorialReviewPanel {...props} />), onSubmit }
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
    setup()
    expect(screen.getByAltText('Sensory light box')).toHaveAttribute(
      'src',
      'https://example.com/toy.jpg'
    )
  })

  it('says the pdf is missing rather than staying silent', () => {
    setup({ hasPdf: false })
    expect(screen.getByText('Not uploaded')).toBeInTheDocument()
  })

  it('disables submit and names the missing fields when required data is absent', () => {
    setup({ missingFields: ['Title', 'At least one part'] })
    expect(screen.getByText('Add Title, At least one part to submit')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit for review/i })).toBeDisabled()
  })

  it('enables submit and calls onSubmit when nothing is missing', async () => {
    const { onSubmit } = setup()
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
  })

  it('surfaces a failed submit instead of leaving the button spinning', async () => {
    setup({ onSubmit: vi.fn().mockRejectedValue(new Error('boom')) })
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not submit')
    expect(screen.getByRole('button', { name: /submit for review/i })).not.toBeDisabled()
  })

  it('shows a quiet last-saved indicator instead of Submit when status is not draft', () => {
    setup({ status: 'pending' })
    expect(screen.queryByRole('button', { name: /submit for review/i })).toBeNull()
    expect(screen.getByText(/last saved/i)).toBeInTheDocument()
  })
})
