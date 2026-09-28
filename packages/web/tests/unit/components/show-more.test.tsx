import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useShowMore, ShowMoreButton } from '@/components/show-more'

function List({ view, total }: { view: string; total: number }) {
  const { limit, more } = useShowMore(view, 2)
  const shown = Math.min(limit, total)
  return (
    <>
      <p data-testid="count">{shown}</p>
      <ShowMoreButton shown={shown} total={total} noun="guides" onMore={more} />
    </>
  )
}

describe('useShowMore', () => {
  it('steps through the list and hides the button at the end', () => {
    render(<List view="a" total={5} />)
    expect(screen.getByTestId('count')).toHaveTextContent('2')
    fireEvent.click(screen.getByRole('button', { name: 'Show more guides' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show more guides' }))
    expect(screen.getByTestId('count')).toHaveTextContent('5')
    expect(screen.queryByRole('button', { name: 'Show more guides' })).toBeNull()
  })

  it('starts over when the view changes', () => {
    const { rerender } = render(<List view="a" total={5} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show more guides' }))
    expect(screen.getByTestId('count')).toHaveTextContent('4')
    rerender(<List view="b" total={5} />)
    expect(screen.getByTestId('count')).toHaveTextContent('2')
  })
})
