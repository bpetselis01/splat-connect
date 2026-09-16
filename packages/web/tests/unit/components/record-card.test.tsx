import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecordCard } from '@/components/record-card'
import { Disclosure } from '@/components/disclosure'
import type { Stage } from '@/components/stage-rail'

const stages: Stage[] = [
  { key: 'requested', label: 'Requested', caption: 'Asked 2 Sep', state: 'done' },
  { key: 'closed', label: 'Closed', caption: 'Both confirm', state: 'todo' },
]

describe('RecordCard', () => {
  it('renders the head row as a title over one meta line', () => {
    render(
      <RecordCard
        icon={<span />}
        title="Bubble machine"
        meta="Donation with Northside Therapy Collective · 2 Sep"
      />
    )
    expect(screen.getByRole('heading', { name: 'Bubble machine' })).toBeInTheDocument()
    expect(screen.getByText(/Northside Therapy Collective/)).toBeInTheDocument()
  })

  /*
   * Why: a record with no process must not render an empty inset. The rail is
   * conditional on having stages rather than on the caller remembering.
   */
  it('draws no rail on a record with no process', () => {
    const { container } = render(<RecordCard icon={<span />} title="Toy" meta="meta" />)
    expect(container.querySelector('ol')).toBeNull()
  })

  it('draws the rail when the record has one', () => {
    render(<RecordCard icon={<span />} title="Toy" meta="meta" stages={stages} />)
    expect(screen.getByRole('list', { name: 'Progress' })).toBeInTheDocument()
  })

  /*
   * Why: the action row takes exactly one filled brand primary, and on a
   * conversation record that primary is Thread. The stage-specific action sits
   * past a spacer so it lands away from the primary.
   */
  it('puts the stage action after the primary, not beside it', () => {
    render(
      <RecordCard
        icon={<span />}
        title="Toy"
        meta="meta"
        primary={<button type="button">Thread</button>}
        stageAction={<button type="button">Confirm handover</button>}
      />
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Thread', 'Confirm handover'])
  })
})

describe('Disclosure', () => {
  it('keeps the evidence closed until asked', () => {
    render(
      <Disclosure summary="Build details">
        <p>Six M3 bolts</p>
      </Disclosure>
    )
    // jsdom does not implement <details> toggling, so assert the open attribute
    // rather than visibility — the element is what carries the state.
    expect(screen.getByText('Build details').closest('details')).not.toHaveAttribute('open')
  })

  it('can start open where the evidence is the point', () => {
    render(
      <Disclosure summary="Cost breakdown" defaultOpen>
        <p>$12.40</p>
      </Disclosure>
    )
    expect(screen.getByText('Cost breakdown').closest('details')).toHaveAttribute('open')
  })
})
