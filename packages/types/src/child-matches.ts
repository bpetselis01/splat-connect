/**
 * wizard-mascot-done: what the done screen counts. One rule, so the count the
 * parent is promised is the list Guides then shows.
 *
 * - A guide matches when suitsChild says true: every switch tag it has (080)
 *   is within what the child's answers (079) say they can do. "Nothing to
 *   compare" is not a match.
 * - Toys carry no switch tags, so a toy matches when it is switch-adapted,
 *   published and not paused — whatever the child (the spec's rule).
 *
 * suitsChild and the labels live in ./switch-fit, which only imports types back.
 */
import { suitsChild, SWITCH_FORCE_LABEL, SWITCH_TARGET_LABEL } from './switch-fit'
import type { ChildProfile, Toy, Tutorial } from './index'

export function matchesForChild(
  child: Pick<ChildProfile, 'press_force' | 'aim' | 'hold'>,
  guides: Pick<Tutorial, 'id' | 'switch_target' | 'switch_force' | 'switch_hold'>[],
  toys: Pick<Toy, 'id' | 'switch_adapted' | 'status' | 'paused_at'>[]
): { guideIds: string[]; toyIds: string[] } {
  return {
    guideIds: guides.filter((g) => suitsChild(g, child) === true).map((g) => g.id),
    toyIds: toys.filter((t) => t.switch_adapted && t.status === 'published' && !t.paused_at).map((t) => t.id),
  }
}

/**
 * "a light press with a big button" — MB's "that suit a palm press with a big
 * button", said from the answers the profile has. Null when there is neither a
 * press nor an aim answer; the screen then says "your child".
 */
export function childNeedsLine(child: Pick<ChildProfile, 'press_force' | 'aim'>): string | null {
  const press = child.press_force ? `a ${SWITCH_FORCE_LABEL[child.press_force]}` : null
  const target = child.aim === 'small' || child.aim === 'large' ? `a ${SWITCH_TARGET_LABEL[child.aim]}` : null
  return press && target ? `${press} with ${target}` : (press ?? target)
}
