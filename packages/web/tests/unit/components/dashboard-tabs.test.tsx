import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardTabs } from '@/components/dashboard-tabs'

const TABS = [
  { href: '/dashboard', label: 'Tutorials' },
  { href: '/dashboard/child', label: 'Child profile' },
  { href: '/dashboard/profile', label: 'Profile' },
]

describe('DashboardTabs', () => {
  it('renders every tab it is given', () => {
    render(<DashboardTabs tabs={TABS} pathname="/dashboard" />)
    expect(screen.getByRole('link', { name: 'Tutorials' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Child profile' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument()
  })

  it('marks the current tab', () => {
    render(<DashboardTabs tabs={TABS} pathname="/dashboard/profile" />)
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Tutorials' })).not.toHaveAttribute('aria-current')
  })

  // Chain: /dashboard is a prefix of every other tab href, so a startsWith match
  //        would mark Tutorials current on every page.
  it('does not mark the index tab current on a sub-tab', () => {
    render(<DashboardTabs tabs={TABS} pathname="/dashboard/child" />)
    expect(screen.getByRole('link', { name: 'Tutorials' })).not.toHaveAttribute('aria-current')
  })
})
