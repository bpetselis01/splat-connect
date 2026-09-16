import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StageRail, type Stage } from '@/components/stage-rail'

const live: Stage[] = [
  { key: 'requested', label: 'Requested', caption: 'Asked 2 Sep', state: 'done' },
  { key: 'accepted', label: 'Accepted', caption: 'They said yes', state: 'done' },
  { key: 'handover', label: 'Handover', caption: 'Agree a time', state: 'now' },
  { key: 'closed', label: 'Closed', caption: 'Both confirm to close', state: 'todo' },
]

// The same four steps on a record that was declined at Accepted.
const stopped: Stage[] = [
  { key: 'requested', label: 'Requested', caption: 'Asked 1 Sep', state: 'done' },
  { key: 'accepted', label: 'Accepted', caption: 'They said no', state: 'stop' },
  { key: 'handover', label: 'Handover', caption: 'Never got here', state: 'todo' },
  { key: 'closed', label: 'Closed', caption: 'Closed 3 Sep', state: 'done' },
]

describe('StageRail', () => {
  it('marks only the live step as the current one', () => {
    render(<StageRail stages={live} />)
    const current = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-current') === 'step')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('Handover')
  })

  /*
   * Why: a record that ended early is not in progress, it is over. Showing it
   * an in-progress dot tells the reader somebody is still waiting on them.
   */
  it('never shows an in-progress step on a record that stopped', () => {
    render(<StageRail stages={stopped} />)
    expect(screen.queryAllByRole('button').filter((b) => b.getAttribute('aria-current') === 'step')).toHaveLength(0)
  })

  /*
   * Why: this is the bug the per-step caption field exists to prevent. Two rails
   * rendered from the same vocabulary must keep their own wording — a shared
   * caption map leaks the live record's text into every other row, so a list of
   * exchanges all claim "They said yes".
   */
  it('keeps each rail on its own captions', () => {
    const { unmount } = render(<StageRail stages={live} />)
    expect(screen.getByText('They said yes')).toBeInTheDocument()
    unmount()

    render(<StageRail stages={stopped} />)
    expect(screen.getByText('They said no')).toBeInTheDocument()
    expect(screen.queryByText('They said yes')).not.toBeInTheDocument()
  })

  it('moves the record when a step is chosen', () => {
    const onSelect = vi.fn()
    render(<StageRail stages={live} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Closed'))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: 'closed' }))
  })

  /*
   * Why: the rail is a stepper on a detail page and a read-only summary inside a
   * list row. Without a handler the steps must not look or behave clickable.
   */
  it('renders inert steps when it is read-only', () => {
    render(<StageRail stages={live} />)
    for (const b of screen.getAllByRole('button')) expect(b).toBeDisabled()
  })
})
