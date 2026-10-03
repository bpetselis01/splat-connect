import type { ChildProfile, Hold, PressForce, Tutorial } from './index'

/** The switch tags' labels, as the board writes "big button, light press, short hold". */
export const SWITCH_TARGET_LABEL: Record<'large' | 'small', string> = { large: 'big button', small: 'small target' }
export const SWITCH_FORCE_LABEL: Record<PressForce, string> = {
  very_light: 'very light press',
  light: 'light press',
  moderate: 'moderate press',
  full: 'firm press',
}
export const SWITCH_HOLD_LABEL: Record<Hold, string> = { moment: 'short hold', second: 'one-second hold', as_long: 'long hold' }

const FORCE_ORDER: PressForce[] = ['very_light', 'light', 'moderate', 'full']
const HOLD_ORDER: Hold[] = ['moment', 'second', 'as_long']

/**
 * Does a guide's switch suit a child (080)? A suggestion about a toy, never an
 * assessment of the child: true when every tag the guide has is within what
 * the profile says the child can do, null when there is nothing to compare
 * (no tags, or none of the matching answers) — the caller then says nothing.
 *
 * - force: the switch needs at most the force the child can apply
 * - hold: the switch needs a press no longer than the child can hold
 * - target: a small target needs a child who can aim at a small one; a big
 *   button suits anyone who can aim at all ("not reliably" suits neither)
 */
export function suitsChild(
  guide: Pick<Tutorial, 'switch_target' | 'switch_force' | 'switch_hold'>,
  child: Pick<ChildProfile, 'press_force' | 'hold' | 'aim'>
): boolean | null {
  const checks: boolean[] = []
  if (guide.switch_force && child.press_force)
    checks.push(FORCE_ORDER.indexOf(guide.switch_force) <= FORCE_ORDER.indexOf(child.press_force))
  if (guide.switch_hold && child.hold)
    checks.push(HOLD_ORDER.indexOf(guide.switch_hold) <= HOLD_ORDER.indexOf(child.hold))
  if (guide.switch_target && child.aim)
    checks.push(child.aim === 'small' || (child.aim === 'large' && guide.switch_target === 'large'))
  return checks.length ? checks.every(Boolean) : null
}
