import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SubmitAnIdea from '@/app/get-involved/submit-an-idea/page'
import SubmitATutorial from '@/app/get-involved/submit-a-tutorial/page'

const { mockGetCapabilities } = vi.hoisted(() => ({ mockGetCapabilities: vi.fn() }))
vi.mock('@/lib/capabilities', () => ({ getCapabilities: mockGetCapabilities }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe('submit explainers', () => {
  it('explains submitting an idea and how it works', async () => {
    mockGetCapabilities.mockResolvedValue(null)
    render(await SubmitAnIdea())
    expect(screen.getByRole('heading', { level: 1, name: /submit an idea/i })).toBeInTheDocument()
  })

  it('sends a signed-out visitor to sign in', async () => {
    mockGetCapabilities.mockResolvedValue(null)
    const { container } = render(await SubmitAnIdea())
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      '/login?next=/get-involved/submit-an-idea'
    )
    expect(container.querySelector('form')).toBeNull()
  })

  it('gives a signed-in visitor the idea form instead of a sign-in link', async () => {
    mockGetCapabilities.mockResolvedValue({ profile: { id: 'u1' } })
    const { container } = render(await SubmitAnIdea())
    expect(container.querySelector('form')).not.toBeNull()
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument()
  })

  it('explains submitting a guide and routes to the upload flow', () => {
    render(<SubmitATutorial />)
    expect(screen.getByRole('heading', { level: 1, name: /submit a guide/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /start a guide/i })).toHaveAttribute('href', '/upload')
  })

  it('tells a signed-out visitor they will need an account', () => {
    render(<SubmitATutorial />)
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/signup')
  })

  it('submit-a-tutorial contains no form', () => {
    const { container } = render(<SubmitATutorial />)
    expect(container.querySelector('form')).toBeNull()
  })
})
