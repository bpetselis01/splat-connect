'use client'
/**
 * The row at the foot of every editor panel: the step's own action on the
 * left, the way onward on the right.
 *
 * Next used to sit in a row of its own between the panel and the finish bar,
 * because a stepper is handed a finished panel and cannot reach inside it.
 * That put the one control telling a contributor where to go next outside the
 * card holding the work — so it read as page furniture rather than as part of
 * the step. This is how it gets in: the stepper puts the button into context,
 * and each panel renders this row wherever its own action already lives.
 *
 * Context rather than a prop because the eleven panels are rendered by three
 * different pages and never share a parent that knows about steps.
 *
 * The row is skipped entirely when it would be empty — the last step of every
 * editor has nowhere onward to go, and two panels (both Review summaries) have
 * no action of their own either.
 */
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'

const NextStepContext = createContext<ReactNode>(null)

/** Opens another step from inside a panel. Null outside a stepper. */
const StepJumpContext = createContext<((step: string) => void) | null>(null)

/**
 * Where the open panel leaves its "commit what I am holding" function, for the
 * stepper to run before it moves. A ref rather than state: it is written on
 * mount and read on a click, and re-rendering the stepper every time a panel
 * changes what it is holding would be a re-render for nobody.
 */
export type PendingSave = { current: (() => Promise<boolean>) | null }
const SaveOnLeaveContext = createContext<PendingSave | null>(null)

export function NextStepProvider({
  value,
  children,
}: {
  /** The Next control, or null on the last step. */
  value: ReactNode
  children: ReactNode
}) {
  return <NextStepContext.Provider value={value}>{children}</NextStepContext.Provider>
}

/**
 * The other half of the same arrangement: a panel that needs to send someone
 * to a step the walk does not lead to. The Review summary uses it to offer
 * Team, which sits beside the rail rather than on it and so is easy to finish
 * without ever having opened.
 */
export function StepJumpProvider({
  value,
  children,
}: {
  value: (step: string) => void
  children: ReactNode
}) {
  return <StepJumpContext.Provider value={value}>{children}</StepJumpContext.Provider>
}

export function useStepJump() {
  return useContext(StepJumpContext)
}

export function SaveOnLeaveProvider({
  value,
  children,
}: {
  value: PendingSave
  children: ReactNode
}) {
  return <SaveOnLeaveContext.Provider value={value}>{children}</SaveOnLeaveContext.Provider>
}

/**
 * Registers this panel's save with the stepper, to be run before any step
 * change — Next, a pill, or a gap chip in the finish bar, all of which go
 * through the same selectStep.
 *
 * Pass null when there is nothing to save; the panel's own guard (`dirty`, a
 * picked file, a filled-in row) is the same one its Save button already uses,
 * so the two can never disagree about whether there is work outstanding.
 *
 * Return false to keep the contributor where they are. The panel is already
 * showing whatever went wrong, and moving on would throw away the edit that
 * failed to save — which is the thing this exists to prevent. Returning true
 * with nothing saved is correct and expected: it means there was nothing to do.
 */
export function useSaveOnLeave(save: (() => Promise<boolean>) | null) {
  const slotRef = useContext(SaveOnLeaveContext)

  /* The latest-ref pattern: the registration below is renewed only when the
     panel starts or stops holding something, but the function it parks has to
     see this render's state rather than the one it registered with. Kept in an
     effect rather than assigned during render, which the compiler rules out. */
  const latestRef = useRef(save)
  useEffect(() => {
    latestRef.current = save
  })

  /* Null when there is nothing to save, rather than a function resolving true:
     the stepper checks for null to change steps synchronously, the way it did
     before any of this existed. A promise that always resolved would have made
     every pill click wait a tick to be told there was nothing to do. */
  const holding = save !== null
  useEffect(() => {
    if (!slotRef) return
    // Optional call, because a render that stops holding lands before this
    // effect renews the registration — for that moment the parked closure is
    // the old one, and there is nothing left for it to run.
    slotRef.current = holding ? () => latestRef.current?.() ?? Promise.resolve(true) : null
    return () => {
      slotRef.current = null
    }
  }, [slotRef, holding])
}

export function PanelActions({ children }: { children?: ReactNode }) {
  const next = useContext(NextStepContext)
  if (!children && !next) return null

  return (
    <div className="panel-actions">
      {/* Always rendered, even when empty: it is what holds Next against the
          right edge on the panels that have no action of their own. */}
      <div className="panel-actions-lead">{children}</div>
      {next}
    </div>
  )
}
