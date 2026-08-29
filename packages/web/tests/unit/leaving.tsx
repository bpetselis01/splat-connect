import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { SaveOnLeaveProvider, type PendingSave } from '@/components/panel-actions'

/**
 * Renders a panel the way a stepper does, and hands back the step change.
 *
 * `leave()` is what selectStep runs before it moves: it resolves true when the
 * panel had nothing outstanding or wrote it successfully, false when the write
 * failed and the contributor should be kept where they are. `holding` says
 * whether the panel parked anything at all, which is the difference between a
 * pill click that waits and one that does not.
 *
 * Not a .test file, so vitest collects it as a helper rather than a suite.
 */
export function renderLeavable(ui: ReactElement) {
  const slot: PendingSave = { current: null }
  const result = render(<SaveOnLeaveProvider value={slot}>{ui}</SaveOnLeaveProvider>)
  return {
    ...result,
    holding: () => slot.current !== null,
    leave: () => slot.current?.() ?? Promise.resolve(true),
  }
}
