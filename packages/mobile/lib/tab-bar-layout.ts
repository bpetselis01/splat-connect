import { theme } from './theme'

export const TAB_BAR_HEIGHT = 66
export const TAB_BAR_OFFSET = 16

/** Distance from the screen's bottom edge to the top of the floating bar. */
export function barLift(insetBottom: number): number {
  return TAB_BAR_HEIGHT + Math.max(insetBottom, TAB_BAR_OFFSET)
}

/** Bottom padding a screen reserves so its last row clears the floating bar. */
export function tabBarClearance(insetBottom: number): number {
  return barLift(insetBottom) + theme.spacing(3)
}
