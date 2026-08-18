import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SubmitAnIdea from '@/app/get-involved/submit-an-idea/page'
import SubmitATutorial from '@/app/get-involved/submit-a-tutorial/page'

describe('submit explainers', () => {
  it('explains submitting an idea and routes to contact, since there is no form yet', () => {
    render(<SubmitAnIdea />)
    expect(screen.getByRole('heading', { level: 1, name: /submit an idea/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /send us the idea|get in touch/i })).toHaveAttribute(
      'href',
      '/contact'
    )
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

  it('neither page contains a form', () => {
    const { container: a } = render(<SubmitAnIdea />)
    const { container: b } = render(<SubmitATutorial />)
    expect(a.querySelector('form')).toBeNull()
    expect(b.querySelector('form')).toBeNull()
  })
})
