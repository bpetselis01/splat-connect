import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { EditStepper, type EditFinish } from '@/components/edit-stepper'
import { PanelActions } from '@/components/panel-actions'
import type { EditStep } from '@/lib/edit-steps'

/**
 * A stand-in for a real step panel. Next is delivered through context and
 * rendered by PanelActions at the foot of whatever panel is open, so a fixture
 * without one would report that Next had gone missing when it had only never
 * been given anywhere to stand.
 */
function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="panel">
      {children}
      <PanelActions />
    </div>
  )
}

const replace = vi.fn()
let searchParamsValue = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/tutorials/t1/edit',
  useSearchParams: () => new URLSearchParams(searchParamsValue),
}))

function makeSteps(content: { details: ReactNode; files: ReactNode }): EditStep[] {
  return [
    { id: 'details', label: 'Details', status: 'attention', content: <Panel>{content.details}</Panel> },
    { id: 'files', label: 'Files', status: 'done', content: <Panel>{content.files}</Panel> },
  ]
}

function renderStepper(finish?: EditFinish) {
  return render(
    <EditStepper
      steps={makeSteps({ details: <p>Details content</p>, files: <p>Files content</p> })}
      finish={finish}
    />
  )
}

function makeFinish(overrides: Partial<EditFinish> = {}): EditFinish {
  return {
    missing: [],
    submitLabel: 'Submit for review',
    busyLabel: 'Submitting…',
    errorMessage: 'Could not submit this tutorial. Please try again.',
    onSubmit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('EditStepper', () => {
  beforeEach(() => {
    replace.mockClear()
    searchParamsValue = ''
  })

  it('shows the first step content by default', () => {
    renderStepper()
    expect(screen.getByText('Details content')).toBeInTheDocument()
    expect(screen.queryByText('Files content')).toBeNull()
  })

  it('names each tab after its label alone, not the decorative status glyph', () => {
    renderStepper()
    expect(screen.getByRole('tab', { name: 'Files' })).toBeInTheDocument()
  })

  it('switches content and writes ?step= when a pill is clicked', () => {
    renderStepper()
    fireEvent.click(screen.getByRole('tab', { name: /files/i }))
    expect(screen.getByText('Files content')).toBeInTheDocument()
    expect(replace).toHaveBeenCalledWith('/tutorials/t1/edit?step=files', { scroll: false })
  })

  it('opens on the step named in ?step= on load', () => {
    searchParamsValue = 'step=files'
    renderStepper()
    expect(screen.getByText('Files content')).toBeInTheDocument()
  })

  // Tests: a stepper given nothing to finish renders no bar
  // How:   renders without the finish prop and asserts the bar is absent
  // Chain: /upload mounts this before the tutorial row exists, so there is nothing
  //        to submit and no missing-field list to compute. A bar there would be a
  //        control for an object that does not exist yet
  it('renders no bar when there is nothing to finish yet', () => {
    renderStepper()
    expect(screen.queryByRole('button', { name: /submit for review/i })).toBeNull()
    expect(document.querySelector('.sticky-submit-bar')).toBeNull()
  })

  // Tests: the finishing bar is on every step, not only the last one
  // How:   renders on the first step and asserts the bar and its action are present
  // Chain: this is the whole point of moving it out of TutorialReviewPanel. While it
  //        lived there it existed only while you stood on Review, so seven of the
  //        eight steps never mentioned that submitting was a thing that happened —
  //        a contributor could fill in every field and never find the finish line
  it('shows the finishing bar on a step that is not Review', () => {
    renderStepper(makeFinish())
    expect(screen.getByText('Details content')).toBeInTheDocument()
    expect(document.querySelector('.sticky-submit-bar')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Submit for review' })).toBeEnabled()
  })

  // Tests: each remaining gap is a control that opens the step that closes it
  // How:   clicks a named gap and asserts that step's content is now showing
  // Chain: the bar used to read "Add At least one part, At least one tool to submit"
  //        — the validator's own field names, and nothing you could act on. Naming
  //        the gap and handing over the fix are the same gesture now
  it('names what is left and jumps to the step that fixes it', () => {
    renderStepper(makeFinish({ missing: [{ step: 'files', label: 'The guide PDF' }] }))
    expect(screen.getByText('1 thing left')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit for review' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'The guide PDF' }))
    expect(screen.getByText('Files content')).toBeInTheDocument()
  })

  // Tests: Next points at the first step still wanting something
  // How:   makes Details the active step and Files the one needing attention
  // Chain: three of the eight steps are optional and never carry 'attention', so a
  //        Next that walked the array would march everyone through STL Files,
  //        Backing and Collaborators on the way to Review and teach them the button
  //        is not worth pressing
  it('offers the next step that still wants something, not the next in the list', () => {
    render(
      <EditStepper
        steps={[
          { id: 'details', label: 'Details', status: 'done', content: <Panel><p>Details content</p></Panel> },
          { id: 'stl', label: 'STL Files', status: 'neutral', content: <Panel><p>STL content</p></Panel> },
          { id: 'tools', label: 'Tools', status: 'attention', content: <Panel><p>Tools content</p></Panel> },
        ]}
        finish={makeFinish({ missing: [{ step: 'tools', label: 'A tool' }] })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /next: tools/i }))
    expect(screen.getByText('Tools content')).toBeInTheDocument()
  })

  // Tests: with nothing missing, Next points at the summary rather than a gap
  // Chain: the bar can submit from anywhere once the tutorial is complete, so the
  //        last step stops being somewhere you must reach — but reading what is
  //        about to be sent before sending it is still worth offering
  it('offers the summary once nothing is missing', () => {
    renderStepper(makeFinish())
    expect(screen.getByRole('button', { name: /review and submit/i })).toBeInTheDocument()
  })

  // Tests: Next never points at a step behind you
  // How:   opens the last step while an earlier one still needs attention
  // Chain: the search used to scan the whole list, so standing on Review with a gap
  //        on Photos rendered "Next: Photos →" — a forward arrow on a backward jump,
  //        and a duplicate of the gap chip already sitting in the bar below it. The
  //        bar owns "go back and fix this"; Next owns "keep going"
  it('offers nothing onward from the last step, even with a gap behind it', () => {
    render(
      <EditStepper
        steps={[
          { id: 'details', label: 'Details', status: 'attention', content: <Panel><p>Details content</p></Panel> },
          { id: 'review', label: 'Review', status: 'neutral', content: <Panel><p>Review content</p></Panel> },
        ]}
        finish={makeFinish({ missing: [{ step: 'details', label: 'A title' }] })}
      />
    )
    fireEvent.click(screen.getByRole('tab', { name: /review/i }))
    expect(screen.getByText('Review content')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^next:/i })).toBeNull()
    // The bar still names the gap and still reaches it.
    expect(screen.getByRole('button', { name: 'A title' })).toBeInTheDocument()
  })

  // Tests: a handed-over tutorial shows its saved state instead of the action
  // Chain: submitting twice is not a thing a contributor should be able to attempt
  it('replaces the action with the done note once there is nothing left to do', () => {
    renderStepper(makeFinish({ done: <p>Last saved just now</p> }))
    expect(screen.getByText('Last saved just now')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit for review' })).toBeNull()
  })

  // Tests: arriving from /upload announces that the tutorial was created
  // How:   renders with created=1 in the query and waits for the live region
  // Chain: /upload and the editor draw the same eight pills and the same panel, so
  //        the redirect between them changed almost nothing on screen. A correct
  //        redirect that announces nothing reads as being thrown somewhere else
  it('announces the create when it arrives from the new-tutorial form', async () => {
    searchParamsValue = 'step=details&created=1'
    renderStepper(makeFinish())
    expect(await screen.findByRole('status')).toHaveTextContent('Tutorial created')
    // And drops the flag, so a refresh does not announce it twice.
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/tutorials/t1/edit?step=details', { scroll: false })
    )
  })
})
