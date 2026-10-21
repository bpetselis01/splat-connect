import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DeleteAccountInfoPage from '@/app/delete-account/page'

describe('/delete-account', () => {
  it('WA22 explains deletion and sends the visitor to sign in, then to the delete page, or to contact', () => {
    const { container } = render(<DeleteAccountInfoPage />)
    // The root layout already supplies the page's one <main>.
    expect(container.querySelectorAll('main')).toHaveLength(0)
    expect(screen.getByRole('heading', { level: 1, name: 'Delete your SPLAT Connect account' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Deleted' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in to delete' })).toHaveAttribute('href', '/login?next=%2Fdashboard%2Fprofile%2Fdelete')
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact')
  })
})
