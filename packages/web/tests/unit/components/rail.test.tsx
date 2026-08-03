import { describe, it, expect, vi } from 'vitest'
// fireEvent, not user-event: @testing-library/user-event is not a dependency
// of this package and the no-new-dependencies constraint applies to tests too.
import { render, screen, fireEvent } from '@testing-library/react'
import { Rail } from '@/components/rail'
import type { NavGroup } from '@/lib/nav-model'

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}))

const GROUPS: NavGroup[] = [
  {
    heading: 'Browse',
    rows: [
      { href: '/library', label: 'Tutorial library', icon: 'book' },
      { href: '/toy-library', label: 'Toy library', icon: 'toy', soon: true },
    ],
  },
  {
    heading: 'Yours',
    rows: [
      { href: '/dashboard', label: 'My tutorials', icon: 'file' },
      { href: '/dashboard/child', label: 'Child profile', icon: 'child' },
    ],
  },
]

const noop = () => {}

describe('Rail', () => {
  it('renders every group heading and row', () => {
    render(<Rail groups={GROUPS} pathname="/dashboard" collapsed={false} onToggle={noop} />)
    expect(screen.getByText('Browse')).toBeInTheDocument()
    expect(screen.getByText('Yours')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tutorial library' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Child profile' })).toBeInTheDocument()
  })

  it('marks the current row', () => {
    render(<Rail groups={GROUPS} pathname="/dashboard/child" collapsed={false} onToggle={noop} />)
    expect(screen.getByRole('link', { name: 'Child profile' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  // Chain: /dashboard prefixes every other dashboard route, so a startsWith
  //        match would light My tutorials on every page in the group.
  it('does not mark My tutorials current on a sibling route', () => {
    render(<Rail groups={GROUPS} pathname="/dashboard/child" collapsed={false} onToggle={noop} />)
    expect(screen.getByRole('link', { name: 'My tutorials' })).not.toHaveAttribute('aria-current')
  })

  // Chain: collapsed to icons, the label is the only thing a screen reader has.
  it('keeps an accessible name for every row when collapsed', () => {
    render(<Rail groups={GROUPS} pathname="/dashboard" collapsed onToggle={noop} />)
    expect(screen.getByRole('link', { name: 'Tutorial library' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My tutorials' })).toBeInTheDocument()
  })

  // Chain: collapsed, the visible "Soon" chip vanishes. If the accessible
  // name were built from the chip alone every placeholder row would announce
  // as just "Soon", indistinguishable from every other placeholder row.
  it('names a collapsed soon row with its destination, not just "Soon"', () => {
    render(<Rail groups={GROUPS} pathname="/dashboard" collapsed onToggle={noop} />)
    expect(screen.getByRole('link', { name: /Toy library/ })).toBeInTheDocument()
  })

  // Chain: collapsed, headings are replaced by a decorative divider. Without
  // this, a screen reader gets one undifferentiated list of links with no
  // indication of which of the four groups a row belongs to.
  it('keeps group headings for assistive tech when collapsed', () => {
    render(<Rail groups={GROUPS} pathname="/dashboard" collapsed onToggle={noop} />)
    expect(screen.getByText('Browse')).toBeInTheDocument()
    expect(screen.getByText('Yours')).toBeInTheDocument()
  })

  it('marks unbuilt rows so they are not mistaken for working ones', () => {
    render(<Rail groups={GROUPS} pathname="/dashboard" collapsed={false} onToggle={noop} />)
    const soon = screen.getByRole('link', { name: /Toy library/ })
    expect(soon).toHaveTextContent('Soon')
  })

  it('calls onToggle when the collapse control is used', () => {
    const onToggle = vi.fn()
    render(<Rail groups={GROUPS} pathname="/dashboard" collapsed={false} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button', { name: /collapse|expand/i }))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('offers a sign out control', () => {
    render(<Rail groups={GROUPS} pathname="/dashboard" collapsed={false} onToggle={noop} />)
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('renders a badge when a row carries a count', () => {
    const groups = [
      {
        heading: 'Account',
        rows: [{ href: '/notifications', label: 'Notifications', icon: 'bell' as const, count: 5 }],
      },
    ]
    render(<Rail groups={groups} pathname="/dashboard" collapsed={false} onToggle={noop} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders no badge when count is absent', () => {
    const groups = [
      {
        heading: 'Account',
        rows: [{ href: '/notifications', label: 'Notifications', icon: 'bell' as const }],
      },
    ]
    render(<Rail groups={groups} pathname="/dashboard" collapsed={false} onToggle={noop} />)
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument()
  })
})
