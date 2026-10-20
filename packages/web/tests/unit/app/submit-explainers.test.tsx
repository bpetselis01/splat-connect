import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SubmitAnIdea from '@/app/get-involved/submit-an-idea/page'
import SubmitATutorial from '@/app/get-involved/submit-a-tutorial/page'

const { mockGetCapabilities } = vi.hoisted(() => ({ mockGetCapabilities: vi.fn() }))
vi.mock('@/lib/capabilities', () => ({ getCapabilities: mockGetCapabilities }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))
const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: mockApiGet } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe('submit explainers', () => {
  it('explains submitting an idea and how it works', async () => {
    mockGetCapabilities.mockResolvedValue(null)
    render(await SubmitAnIdea({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('heading', { level: 1, name: /submit an idea/i })).toBeInTheDocument()
  })

  it('WI10 sends a signed-out visitor to sign in, returning to the idea form', async () => {
    mockGetCapabilities.mockResolvedValue(null)
    const { container } = render(await SubmitAnIdea({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      '/login?next=%2Fget-involved%2Fsubmit-an-idea'
    )
    expect(container.querySelector('form')).toBeNull()
  })

  it('gives a signed-in visitor the idea form instead of a sign-in link', async () => {
    mockGetCapabilities.mockResolvedValue({ profile: { id: 'u1' } })
    const { container } = render(await SubmitAnIdea({ searchParams: Promise.resolve({}) }))
    expect(container.querySelector('form')).not.toBeNull()
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument()
  })

  it('starts a revised idea from the author’s rejected one', async () => {
    mockGetCapabilities.mockResolvedValue({ profile: { id: 'u1' } })
    mockApiGet.mockResolvedValue({ id: 'i1', title: 'Old title', summary: 'Old', description: null, contact_prefs: [], status: 'rejected' })
    render(await SubmitAnIdea({ searchParams: Promise.resolve({ from: 'i1' }) }))
    expect(mockApiGet).toHaveBeenCalledWith('/api/ideas/mine/i1')
    expect(screen.getByLabelText(/^title$/i)).toHaveValue('Old title')
  })

  it('WT40 explains submitting a guide and routes to the upload flow', () => {
    render(<SubmitATutorial />)
    expect(screen.getByRole('heading', { level: 1, name: /submit a guide/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /start a guide/i })).toHaveAttribute('href', '/upload')
  })

  // /upload's middleware handles sign-in and the terms, so the page's other
  // door is the contributor path rather than a separate sign-up link.
  it('WT40 points at the contributor path', () => {
    render(<SubmitATutorial />)
    expect(screen.getByRole('link', { name: /read the contributor path/i })).toHaveAttribute(
      'href',
      '/get-involved/contributors'
    )
  })

  it('submit-a-tutorial contains no form', () => {
    const { container } = render(<SubmitATutorial />)
    expect(container.querySelector('form')).toBeNull()
  })
})
