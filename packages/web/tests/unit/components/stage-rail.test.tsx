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
    const { container } = render(<StageRail stages={live} />)
    const current = [...container.querySelectorAll('[aria-current="step"]')]
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('Handover')
  })

  /*
   * Why: a record that ended early is not in progress, it is over. Showing it
   * an in-progress dot tells the reader somebody is still waiting on them.
   */
  it('never shows an in-progress step on a record that stopped', () => {
    const { container } = render(<StageRail stages={stopped} />)
    expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(0)
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
  /*
   * Why: Closed is `done` on a record that stopped early, so a bar that looked
   * at the step to its right filled the gap between a Handover that never
   * happened and the Closed step after it — the rail drew progress through a
   * step it had just marked "Never got here".
   */
  it('fills a connector only out of a step that is done', () => {
    const { container } = render(<StageRail stages={stopped} />)
    const bars = [...container.querySelectorAll('span[aria-hidden="true"]')].filter(
      (el) => (el as HTMLElement).style.height === '3px' || el.className.includes('h-[3px]')
    ) as HTMLElement[]
    // One per step, the board's geometry. Requested is done -> filled.
    // Accepted stopped and Handover was never reached -> both grey. Closed is
    // `done` on a record that stopped, so its own bar fills.
    expect(bars).toHaveLength(4)
    expect(bars[0].style.background).toContain('--b600')
    expect(bars[1].style.background).toContain('--surface2')
    expect(bars[2].style.background).toContain('--surface2')
    expect(bars[3].style.background).toContain('--b600')
  })

  /*
   * Why: a read-only step used to be <button disabled>, which announced four
   * dead controls per list row to a screen reader and collided by accessible
   * name with the page's real actions — an "Accepted" step and an "Accept"
   * button are two different things, and a strict locator saw both.
   */
  it('renders no controls at all when it is read-only', () => {
    render(<StageRail stages={live} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
