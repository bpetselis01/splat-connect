/**
 * The shape every editor stepper works in.
 *
 * The tutorial, toy and child editors each carried their own copy of this —
 * three identical status unions, three identical step interfaces, and three
 * names for a gap ({step,label}) — alongside three near-identical stepper
 * components. One shape here, one Stepper in components/stepper.tsx, and the
 * per-editor modules are left holding only what actually differs between
 * them: which step ids exist, and what makes each one done.
 */
import type { ReactNode } from 'react'

export type StepStatus = 'done' | 'attention' | 'neutral'

export interface Step<Id extends string> {
  id: Id
  label: string
  status: StepStatus
  content: ReactNode
  /** Shown in the pill row but not reachable — /upload and the Add-a-toy page
   *  use this so the whole journey is visible before the row exists to hang
   *  files and photos off. */
  disabled?: boolean
  /** Off the walk. The pill moves to the right end of the rail in its own
   *  colour, and the step drops out of the sequence entirely: nothing before it
   *  offers it as Next, it never becomes the last step, and while it is open
   *  the stepper draws neither the submit bar nor a Next control.
   *
   *  The tutorial's Team step sets it. Nothing there is required, so putting it
   *  between Tools and Review made a contributor walk past it to finish, and a
   *  submit button beside an invite field only asks what it would submit. Off
   *  to the side, it is somewhere you go when you want it — the Review step
   *  asks whether you do.
   *
   *  Not to be confused with the Stepper's `trailing` prop, which is a
   *  row-level action that is not a step at all (Delete toy, Delete child) and
   *  so stays out of the tablist. */
  offWalk?: boolean
}

/**
 * A gap left in a draft, and the step that closes it. The finish bar renders
 * these as controls, so someone reads what is left and reaches the fix in one
 * click rather than hunting the pill row.
 */
export interface Gap<Id extends string = string> {
  step: Id
  /** What a person would call it, not what the validator calls it. */
  label: string
}
