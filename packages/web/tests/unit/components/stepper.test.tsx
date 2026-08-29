import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Stepper, type Finish } from '@/components/stepper'
import { PanelActions, useSaveOnLeave } from '@/components/panel-actions'
import type { EditStep, EditStepId } from '@/lib/edit-steps'
import type { ToyStep } from '@/lib/toy-steps'
import type { ChildStep } from '@/lib/child-steps'

/**
 * One component, three call-site shapes: a tutorial (a finish bar, a step
 * parked off the walk, panels that hold unsaved work), a toy (a finish bar and
 * a row-level Delete), a child profile (neither). The three used to be three
 * components with three test files; the describes below are what each one
 * asked of the shared behaviour, kept whole.
 */

const replace = vi.fn()
let pathname = '/tutorials/t1/edit'
let searchParamsValue = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(searchParamsValue),
}))

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

describe('Stepper: the tutorial editor', () => {
  beforeEach(() => {
    replace.mockClear()
    pathname = '/tutorials/t1/edit'
    searchParamsValue = ''
  })

  function makeSteps(content: { details: ReactNode; files: ReactNode }): EditStep[] {
    return [
      { id: 'details', label: 'Details', status: 'attention', content: <Panel>{content.details}</Panel> },
      { id: 'files', label: 'Files', status: 'done', content: <Panel>{content.files}</Panel> },
    ]
  }

  function renderStepper(finish?: Finish<EditStepId>) {
    return render(
      <Stepper
        label="Tutorial sections"
        steps={makeSteps({ details: <p>Details content</p>, files: <p>Files content</p> })}
        finish={finish}
      />
    )
  }

  function makeFinish(overrides: Partial<Finish<EditStepId>> = {}): Finish<EditStepId> {
    return {
      missing: [],
      submitLabel: 'Submit for review',
      busyLabel: 'Submitting…',
      errorMessage: 'Could not submit this tutorial. Please try again.',
      endLabel: 'Review and submit',
      onSubmit: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    }
  }

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

  // Tests: Next walks the steps in order, optional ones included
  // How:   puts a settled optional step between two that want something, which is
  //        exactly where Tools -> STL Files -> Review sits
  // Chain: Next used to scan forward for the next 'attention' and fall back to the
  //        last step, so finishing Tools read "Review and submit" and jumped STL
  //        Files outright. Optional means you may leave it empty, not that you are
  //        never shown it — and going back to a gap is the finish bar's job
  it('walks to the next step in order, including one with nothing wrong with it', () => {
    render(
      <Stepper
        label="Tutorial sections"
        steps={[
          { id: 'tools', label: 'Tools', status: 'done', content: <Panel><p>Tools content</p></Panel> },
          { id: 'stl', label: 'STL Files', status: 'neutral', content: <Panel><p>STL content</p></Panel> },
          { id: 'review', label: 'Review', status: 'neutral', content: <Panel><p>Review content</p></Panel> },
        ]}
        finish={makeFinish()}
      />
    )
    // Not "Review and submit", which is what the skip used to offer here.
    fireEvent.click(screen.getByRole('button', { name: /next: stl files/i }))
    expect(screen.getByText('STL content')).toBeInTheDocument()

    // And STL Files leads on to Review rather than being a dead end.
    fireEvent.click(screen.getByRole('button', { name: /review and submit/i }))
    expect(screen.getByText('Review content')).toBeInTheDocument()
  })

  // Tests: a disabled step is stepped over rather than offered
  // Chain: /upload draws the whole journey with every step but Details locked, so
  //        a Next pointing at one would be a button that does nothing
  it('steps over a disabled step', () => {
    render(
      <Stepper
        label="Tutorial sections"
        steps={[
          { id: 'tools', label: 'Tools', status: 'done', content: <Panel><p>Tools content</p></Panel> },
          { id: 'stl', label: 'STL Files', status: 'neutral', disabled: true, content: null },
          { id: 'review', label: 'Review', status: 'neutral', content: <Panel><p>Review content</p></Panel> },
        ]}
        finish={makeFinish()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /review and submit/i }))
    expect(screen.getByText('Review content')).toBeInTheDocument()
  })

  // Tests: the step before the end names the end, once there is nothing missing
  // Chain: the bar can submit from anywhere once the tutorial is complete, so the
  //        last step stops being somewhere you must reach — but reading what is
  //        about to be sent before sending it is still worth offering, and the
  //        arrow should say so rather than reading "Next: Review"
  it('names the summary as the end once nothing is missing', () => {
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
      <Stepper
        label="Tutorial sections"
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

  // A walk of two steps with Team parked beside it, which is the editor's shape.
  function withOffWalk() {
    return render(
      <Stepper
        label="Tutorial sections"
        steps={[
          { id: 'details', label: 'Details', status: 'done', content: <Panel><p>Details content</p></Panel> },
          { id: 'review', label: 'Review', status: 'neutral', content: <Panel><p>Review content</p></Panel> },
          { id: 'team', label: 'Team', status: 'neutral', offWalk: true, content: <Panel><p>Team content</p></Panel> },
        ]}
        finish={makeFinish()}
      />
    )
  }

  // Tests: an off-walk step carries neither the submit bar nor a way onward
  // How:   opens Team with nothing missing — the case that used to draw both
  //        "Submit for review" and "Review and submit →" on the same screen
  // Chain: nothing on Team is required and nothing on it is submitted, so a submit
  //        control beside an invite field only asks what it would submit
  it('draws no finish bar and no Next on an off-walk step', () => {
    withOffWalk()
    fireEvent.click(screen.getByRole('tab', { name: /team/i }))
    expect(screen.getByText('Team content')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit for review' })).toBeNull()
    expect(screen.queryByRole('button', { name: /review and submit/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^next:/i })).toBeNull()

    // And the bar comes straight back on a step of the walk, so leaving Team is
    // all it takes to find the finish line again.
    fireEvent.click(screen.getByRole('tab', { name: /review/i }))
    expect(screen.getByRole('button', { name: 'Submit for review' })).toBeInTheDocument()
  })

  // Tests: the walk never leads to an off-walk step, and does not end on one
  // Chain: Team is last in the steps array so the pill row can float it right, and
  //        the fallback used to be "the last step" flat. Left alone, Details would
  //        offer "Review and submit →" and open Team — the wrong panel under the
  //        right words, and a walk that quietly runs one step past its own end
  it('sends Next to the end of the walk, never to the off-walk step', () => {
    withOffWalk()
    expect(screen.getByRole('button', { name: /review and submit/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /review and submit/i }))
    expect(screen.getByText('Review content')).toBeInTheDocument()
    // And Review is the end: nothing onward, even with Team sitting after it.
    expect(screen.queryByRole('button', { name: /review and submit/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^next:/i })).toBeNull()
  })

  /* A panel holding unsaved work, which is every editor panel with something
     typed in it: it parks a save with the stepper and expects to be asked
     before the step changes. */
  function Holding({ save }: { save: () => Promise<boolean> }) {
    useSaveOnLeave(save)
    return <p>Details content</p>
  }

  function renderHolding(save: () => Promise<boolean>) {
    return render(
      <Stepper
        label="Tutorial sections"
        steps={[
          { id: 'details', label: 'Details', status: 'done', content: <Panel><Holding save={save} /></Panel> },
          { id: 'files', label: 'Files', status: 'done', content: <Panel><p>Files content</p></Panel> },
        ]}
        finish={makeFinish()}
      />
    )
  }

  // Tests: leaving a step writes what the panel is holding first
  // How:   a panel parks a save; the step is changed by pill rather than by Next
  // Chain: the panels unmount on a step change, so anything typed and not saved is
  //        gone. Hanging this off selectStep rather than off Next is the point —
  //        the pill row and the finish bar's gap chips leave the step too, and a
  //        rule that only covered one of the three would lose work by which
  //        control you happened to reach for
  it('saves what the open panel is holding before the step changes', async () => {
    const save = vi.fn().mockResolvedValue(true)
    renderHolding(save)

    fireEvent.click(screen.getByRole('tab', { name: /files/i }))
    await waitFor(() => expect(screen.getByText('Files content')).toBeInTheDocument())
    expect(save).toHaveBeenCalledTimes(1)
  })

  // Tests: a failed save keeps the contributor on the step
  // Chain: the work only exists in that panel's state, so moving on would be the
  //        one thing that makes it unrecoverable. The panel is already showing why
  it('stays put when the panel cannot save', async () => {
    const save = vi.fn().mockResolvedValue(false)
    renderHolding(save)

    fireEvent.click(screen.getByRole('tab', { name: /files/i }))
    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(screen.getByText('Details content')).toBeInTheDocument()
    expect(screen.queryByText('Files content')).toBeNull()
  })

  // Tests: a panel holding nothing does not make navigation wait
  // Chain: the hook parks null rather than a promise resolving true, so a pill
  //        click on a settled step stays the synchronous setState it always was.
  //        Asserting without awaiting is the assertion
  it('changes step synchronously when the panel is holding nothing', () => {
    renderStepper(makeFinish())
    fireEvent.click(screen.getByRole('tab', { name: /files/i }))
    expect(screen.getByText('Files content')).toBeInTheDocument()
  })
})

describe('Stepper: the toy editor', () => {
  beforeEach(() => {
    replace.mockClear()
    pathname = '/dashboard/toys/t1'
    searchParamsValue = ''
  })

  function makeSteps(content: { details: ReactNode; photos: ReactNode; review: ReactNode }): ToyStep[] {
    return [
      { id: 'details', label: 'Details', status: 'done', content: content.details },
      { id: 'photos', label: 'Photos', status: 'attention', content: content.photos },
      { id: 'review', label: 'Review', status: 'neutral', content: content.review },
    ]
  }

  function steps() {
    return makeSteps({
      details: <p>Details content</p>,
      photos: <p>Photos content</p>,
      review: <p>Review content</p>,
    })
  }

  it('shows the first step content by default', () => {
    render(<Stepper label="Toy sections" steps={steps()} />)
    expect(screen.getByText('Details content')).toBeInTheDocument()
    expect(screen.queryByText('Photos content')).toBeNull()
  })

  it('names each tab after its label alone, not the decorative status glyph', () => {
    render(<Stepper label="Toy sections" steps={steps()} />)
    expect(screen.getByRole('tab', { name: 'Photos' })).toBeInTheDocument()
  })

  it('switches content and writes ?step= when a pill is clicked', () => {
    render(<Stepper label="Toy sections" steps={steps()} />)
    fireEvent.click(screen.getByRole('tab', { name: /photos/i }))
    expect(screen.getByText('Photos content')).toBeInTheDocument()
    expect(replace).toHaveBeenCalledWith('/dashboard/toys/t1?step=photos', { scroll: false })
  })

  it('opens on the step named in ?step= on load', () => {
    searchParamsValue = 'step=review'
    render(<Stepper label="Toy sections" steps={steps()} />)
    expect(screen.getByText('Review content')).toBeInTheDocument()
  })

  it('renders a trailing action inside the pill row, after the last tab', () => {
    const { container } = render(
      <Stepper
        label="Toy sections"
        steps={steps()}
        trailing={<button type="button">Delete toy</button>}
      />
    )
    const row = container.querySelector('.step-pill-row') as HTMLElement
    const deleteButton = screen.getByRole('button', { name: 'Delete toy' })
    expect(row).toContainElement(deleteButton)

    const buttons = Array.from(row.querySelectorAll('button'))
    expect(buttons[buttons.length - 1]).toBe(deleteButton)
  })

  it('keeps the trailing action out of the tablist, since it is not a tab', () => {
    render(
      <Stepper
        label="Toy sections"
        steps={steps()}
        trailing={<button type="button">Delete toy</button>}
      />
    )
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(screen.getByRole('tablist')).not.toContainElement(
      screen.getByRole('button', { name: 'Delete toy' })
    )
  })

  it('renders no trailing slot when none is given', () => {
    const { container } = render(<Stepper label="Toy sections" steps={steps()} />)
    const row = container.querySelector('.step-pill-row') as HTMLElement
    expect(row.querySelectorAll('button')).toHaveLength(3)
  })

  it("renders each pill's status dot from the step status", () => {
    render(<Stepper label="Toy sections" steps={steps()} />)
    const photosTab = screen.getByRole('tab', { name: /photos/i })
    expect(photosTab.querySelector('[data-status="attention"]')).toHaveTextContent('!')
  })
})

describe('Stepper: the child-profile editor', () => {
  beforeEach(() => {
    replace.mockClear()
    pathname = '/dashboard/child/c1'
    searchParamsValue = ''
  })

  function steps(): ChildStep[] {
    return [
      { id: 'survey', label: 'Survey', status: 'attention', content: <p>Survey content</p> },
      { id: 'ability', label: 'Ability', status: 'done', content: <p>Ability content</p> },
      { id: 'everyday-needs', label: 'Everyday needs', status: 'attention', content: <p>Everyday needs content</p> },
      { id: 'customization', label: 'Customization', status: 'neutral', content: <p>Customization content</p> },
    ]
  }

  it('shows the first step content by default', () => {
    render(<Stepper label="Child profile sections" steps={steps()} />)
    expect(screen.getByText('Survey content')).toBeInTheDocument()
    expect(screen.queryByText('Ability content')).toBeNull()
  })

  it('switches content and writes ?step= when a pill is clicked', () => {
    render(<Stepper label="Child profile sections" steps={steps()} />)
    fireEvent.click(screen.getByRole('tab', { name: /ability/i }))
    expect(screen.getByText('Ability content')).toBeInTheDocument()
    expect(replace).toHaveBeenCalledWith('/dashboard/child/c1?step=ability', { scroll: false })
  })

  it('opens on the step named in ?step= on load', () => {
    searchParamsValue = 'step=customization'
    render(<Stepper label="Child profile sections" steps={steps()} />)
    expect(screen.getByText('Customization content')).toBeInTheDocument()
  })

  it('has no locked pills — every step is a clickable tab', () => {
    render(<Stepper label="Child profile sections" steps={steps()} />)
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).not.toBeDisabled()
    }
  })

  it('renders a trailing action inside the pill row, after the last tab', () => {
    const { container } = render(
      <Stepper
        label="Child profile sections"
        steps={steps()}
        trailing={<button type="button">Delete child</button>}
      />
    )
    const row = container.querySelector('.step-pill-row') as HTMLElement
    const deleteButton = screen.getByRole('button', { name: 'Delete child' })
    expect(row).toContainElement(deleteButton)
    expect(screen.getByRole('tablist')).not.toContainElement(deleteButton)
  })

  it("renders each pill's status dot from the step status", () => {
    render(<Stepper label="Child profile sections" steps={steps()} />)
    const surveyTab = screen.getByRole('tab', { name: /survey/i })
    expect(surveyTab.querySelector('[data-status="attention"]')).toHaveTextContent('!')
  })
})
