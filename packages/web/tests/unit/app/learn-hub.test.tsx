import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LearnPage from '@/app/learn/page'
import { PUBLIC_NAV } from '@/lib/public-nav'

const learn = PUBLIC_NAV.find((s) => s.href === '/learn')!

describe('Learn hub', () => {
  it('links every article in the section exactly once', () => {
    render(<LearnPage />)
    for (const child of learn.children) {
      expect(screen.getAllByRole('link', { name: new RegExp(child.label, 'i') })).toHaveLength(1)
    }
  })

  it('groups the articles so a newcomer knows where to start', () => {
    render(<LearnPage />)
    expect(screen.getByRole('heading', { name: /start here/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /going deeper/i })).toBeInTheDocument()
  })

  it('sends someone who wants a specific toy to the Guides catalogue instead', () => {
    render(<LearnPage />)
    expect(screen.getByRole('link', { name: /guides/i })).toHaveAttribute('href', '/library')
  })
})
