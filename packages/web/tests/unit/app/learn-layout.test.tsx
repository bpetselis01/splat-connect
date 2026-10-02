/**
 * site-content-learn-legal-editing: what "Shown as" does to every /learn page
 * (Byron, 2026-10-02). Hidden hides the course from members but not from an
 * admin, and never hides /learn/ask-an-expert; sign-in-needed sends a
 * signed-out reader to sign in; a failed read is the code's course, Free.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LEARN_COURSE } from '@splat-connect/types'

const get = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => get(...a) } }))
const caps = vi.fn()
vi.mock('@/lib/capabilities', () => ({ getCapabilities: () => caps() }))
let pathname = '/learn'
vi.mock('next/headers', () => ({ headers: async () => new Map([['x-pathname', pathname]]) }))
const redirect = vi.fn((to: string) => {
  throw new Error(`redirect ${to}`)
})
vi.mock('next/navigation', () => ({ redirect: (to: string) => redirect(to) }))

const shown = (shown_as: string) => get.mockResolvedValue({ ...LEARN_COURSE, shown_as })
const renderAt = async (path: string) => {
  pathname = path
  const { default: LearnLayout } = await import('@/app/learn/layout')
  render(await LearnLayout({ children: <p>The lesson</p> }))
}

beforeEach(() => {
  vi.clearAllMocks()
  caps.mockResolvedValue(null)
})

describe('LearnLayout', () => {
  it('shows the course as it always was when Free, or when the read fails', async () => {
    get.mockRejectedValue(new Error('down'))
    await renderAt('/learn')
    expect(screen.getByText('The lesson')).toBeTruthy()
    expect(caps).not.toHaveBeenCalled()
  })

  it('says "Course hidden" to a member on every course page', async () => {
    shown('hidden')
    caps.mockResolvedValue({ isAdmin: false })
    await renderAt('/learn/switch-types')
    expect(screen.getByRole('heading', { name: 'Course hidden' })).toBeTruthy()
    expect(screen.queryByText('The lesson')).toBeNull()
  })

  it('still shows a hidden course to an admin, saying it is hidden', async () => {
    shown('hidden')
    caps.mockResolvedValue({ isAdmin: true })
    await renderAt('/learn')
    expect(screen.getByRole('status')).toHaveTextContent('Hidden from members')
    expect(screen.getByText('The lesson')).toBeTruthy()
  })

  it('never hides Ask an expert, which is not part of the course', async () => {
    shown('hidden')
    await renderAt('/learn/ask-an-expert')
    expect(screen.getByText('The lesson')).toBeTruthy()
    expect(screen.queryByText('Course hidden')).toBeNull()
  })

  it('sends a signed-out reader to sign in when sign-in is needed, and lets a member in', async () => {
    shown('sign_in')
    await expect(renderAt('/learn/handover')).rejects.toThrow('redirect /login?next=/learn')
    caps.mockResolvedValue({ isAdmin: false })
    await renderAt('/learn/handover')
    expect(screen.getByText('The lesson')).toBeTruthy()
  })
})
