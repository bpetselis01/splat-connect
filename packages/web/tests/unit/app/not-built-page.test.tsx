import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NotBuiltPage from '@/app/not-built/[id]/page'

describe('/not-built/[id]', () => {
  it('names the registry item', async () => {
    render(await NotBuiltPage({ params: Promise.resolve({ id: 'org-visit-map' }) }))
    expect(screen.getByText('Not built yet')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Map and address')
  })
  it('falls back for an unknown id', async () => {
    render(await NotBuiltPage({ params: Promise.resolve({ id: 'nope' }) }))
    expect(screen.getByText("This part of SPLAT Connect isn't ready yet.")).toBeTruthy()
  })
})
