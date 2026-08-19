import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)
const jsonResponse = (body: unknown) => ({ ok: true, json: () => Promise.resolve(body) })
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

const org = (id: string, name: string, status: 'active' | 'suspended') => ({
  id, name, description: `${name} helps children`, status,
  created_by: null, created_at: '', updated_at: '',
})

describe('organisations directory', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: a suspended organisation is shown and marked, not hidden
  // How:   one active and one suspended; checks both render and the state is stated
  // Chain: an organisation vanishing from a directory is unexplainable to someone
  //        who expected to find it, and their name is still on work they backed
  it('lists suspended organisations, marked', async () => {
    fetchMock.mockResolvedValue(jsonResponse([org('o1', 'Riverside', 'active'), org('o2', 'Dormant', 'suspended')]))
    const { default: Page } = await import('@/app/organizations/page')
    render(await Page())

    expect(screen.getByText('Riverside')).toBeInTheDocument()
    expect(screen.getByText('Dormant')).toBeInTheDocument()
    expect(screen.getByText('SUSPENDED')).toBeInTheDocument()
  })

  // Tests: the empty state teaches who creates organisations
  // How:   empty list; checks the copy names SPLAT and the asking flow
  // Chain: a contributor cannot create one and would otherwise be left looking for
  //        a button that does not exist
  it('teaches the interface when there are none', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))
    const { default: Page } = await import('@/app/organizations/page')
    render(await Page())
    expect(screen.getByText(/No organisations yet/i)).toBeInTheDocument()
    expect(screen.getByText(/set up by SPLAT/i)).toBeInTheDocument()
  })

  it('links each organisation to its public profile', async () => {
    fetchMock.mockResolvedValue(jsonResponse([org('o1', 'Riverside', 'active')]))
    const { default: Page } = await import('@/app/organizations/page')
    render(await Page())
    expect(screen.getByRole('link')).toHaveAttribute('href', '/organizations/o1/public')
  })
})
