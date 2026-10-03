import { theme } from './theme'

export const TAB_BAR_HEIGHT = 66
export const TAB_BAR_OFFSET = 16

/** Bottom padding a tab root reserves so its last row clears the floating bar. */
export function tabBarClearance(insetBottom: number): number {
  return TAB_BAR_HEIGHT + Math.max(insetBottom, TAB_BAR_OFFSET) + theme.spacing(3)
}
