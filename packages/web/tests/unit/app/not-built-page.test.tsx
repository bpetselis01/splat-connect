import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NotBuiltPage from '@/app/not-built/[id]/page'

describe('/not-built/[id]', () => {
  it('WL08 names the registry item and offers Home', async () => {
    render(await NotBuiltPage({ params: Promise.resolve({ id: 'org-visit-map' }) }))
    expect(screen.getByText('Not built yet')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Map and address')
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
  })
  it('WL08 falls back for an unknown id and still offers Home', async () => {
    render(await NotBuiltPage({ params: Promise.resolve({ id: 'nope' }) }))
    expect(screen.getByText("This part of SPLAT Connect isn't ready yet.")).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
  })
})
