import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToyPicks } from '@/components/toy-picks'

vi.mock('next/navigation', () => ({ usePathname: () => '/toy-library/t1' }))

describe('ToyPicks', () => {
  it("names the holder and links each card to its page", () => {
    render(
      <ToyPicks
        holder="Family 3"
        picks={[
          { kind: 'toy', id: 't9', title: 'Light-up drum', photo_url: null, meta: 'Good' },
          { kind: 'assistive_tech', id: 'g1', title: 'Switch mount', photo_url: null, meta: null },
        ]}
      />
    )
    expect(screen.getByRole('heading', { name: 'Also worth a look' })).toBeInTheDocument()
    expect(screen.getByText('Picked by Family 3 — what else they have listed, and the guides behind it.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Light-up drum/ })).toHaveAttribute('href', '/toy-library/t9')
    expect(screen.getByRole('link', { name: /Switch mount/ })).toHaveAttribute('href', '/tutorials/g1')
    expect(screen.getByText('Assistive tech guide')).toBeInTheDocument()
  })

  it('draws nothing without picks', () => {
    const { container } = render(<ToyPicks holder="Family 3" picks={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
