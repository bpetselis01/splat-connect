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
import { createContext, useContext, type ReactNode } from 'react'

const NextStepContext = createContext<ReactNode>(null)

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
